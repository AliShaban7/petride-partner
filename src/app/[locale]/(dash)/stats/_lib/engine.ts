/**
 * Statistics engine: turns the raw records from `./load.ts` into everything the page shows for one
 * range (KPIs with deltas, chart series by day/week, mixes, busiest hours, ratings, products).
 *
 * Definitions match the API's stats (lib/api/mock/stats.ts), so the numbers agree with Overview:
 *  - an appointment counts on its start day if it is requested / confirmed / checked in / completed /
 *    no-show ("active"); cancelled and declined ones only show in the cancellations chart;
 *  - revenue = amounts charged at completed visits (by visit day) + delivered / picked-up orders
 *    (by order day), delivery fee included;
 *  - a client is new in a period when their first completed visit or finished order falls in it;
 *  - PetRide share = visits booked with a ride (clinics) or orders delivered by PetRide courier (shops);
 *  - deltas are null when the previous period starts before the partner's history does.
 * Pure functions, no React.
 */
import type { Appointment, AppointmentStatus, IsoWeekday, Kpi, Order, ProductCategory, Review } from "@/lib/api/types";
import { stockStatus } from "@/lib/status";

import type { StatsFeatures, StatsSource } from "./load";
import { bucketIndex, dayStart, makeBuckets, previousRange, type Bucket, type StatsRange } from "./range";

// ---- Helpers ----------------------------------------------------------------------------------------

const ACTIVE: ReadonlySet<AppointmentStatus> = new Set(["requested", "confirmed", "checked_in", "completed", "no_show"]);
/** Overnight hotel stays are left out of the busiest-hours grid (they'd all land on check-in time). */
const LONG_STAY_MIN = 1440;
/** Colour slots for series (CHART_COLORS has 6); with more services the tail becomes "other". */
export const SERIES_SLOTS = 6;
export const OTHER_SERIES = "__other";

const toMs = (iso: string) => new Date(iso).getTime();
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);
const orderDone = (o: Order) => o.status === "delivered" || o.status === "picked_up";

function kpi(value: number, previous: number, comparable: boolean): Kpi {
  return { value, previous, delta: !comparable || previous === 0 ? null : (value - previous) / previous };
}

type Window = { start: number; end: number };
const inWindow = (t: number, w: Window) => t >= w.start && t < w.end;

// ---- Prepared source (computed once per load) ---------------------------------------------------------

type ApptRow = { a: Appointment; start: number };
type OrderRow = { o: Order; created: number; done: boolean };
type ReviewRow = { r: Review; created: number };

export type SeriesKey = { id: string; name: string };

export type PreparedSource = {
  source: StatsSource;
  features: StatsFeatures;
  appts: ApptRow[];
  orders: OrderRow[];
  reviews: ReviewRow[];
  /** First completed visit / finished order per client. */
  firstSeen: Map<string, number>;
  /** Local midnight of the earliest record; periods starting earlier can't be compared. */
  historyStart: number | null;
  /** Services by all-time bookings (stable colours whatever the period). */
  services: SeriesKey[];
  /** Product categories by all-time units sold. */
  categories: ProductCategory[];
};

export function prepareSource(source: StatsSource): PreparedSource {
  const appts = source.appointments.map((a) => ({ a, start: toMs(a.start) }));
  const orders = source.orders.map((o) => ({ o, created: toMs(o.createdAt), done: orderDone(o) }));
  const reviews = source.reviews.map((r) => ({ r, created: toMs(r.createdAt) }));

  const firstSeen = new Map<string, number>();
  const see = (id: string, t: number) => {
    const cur = firstSeen.get(id);
    if (cur === undefined || t < cur) firstSeen.set(id, t);
  };
  for (const { a, start } of appts) if (a.status === "completed") see(a.clientId, start);
  for (const { o, created, done } of orders) if (done) see(o.clientId, created);

  let earliest = Infinity;
  for (const { start } of appts) earliest = Math.min(earliest, start);
  for (const { created } of orders) earliest = Math.min(earliest, created);

  const serviceCount = new Map<string, { name: string; count: number }>();
  for (const { a } of appts) {
    if (!ACTIVE.has(a.status)) continue;
    const row = serviceCount.get(a.serviceId) ?? { name: a.serviceName, count: 0 };
    row.count += 1;
    serviceCount.set(a.serviceId, row);
  }
  const services = [...serviceCount.entries()]
    .sort((x, y) => y[1].count - x[1].count || x[1].name.localeCompare(y[1].name))
    .map(([id, v]) => ({ id, name: v.name }));

  const productCategory = new Map(source.products.map((p) => [p.id, p.category]));
  const categoryUnits = new Map<ProductCategory, number>();
  for (const { o } of orders) {
    if (o.status === "cancelled") continue;
    for (const it of o.items) {
      const cat = productCategory.get(it.productId);
      if (cat) categoryUnits.set(cat, (categoryUnits.get(cat) ?? 0) + it.qty);
    }
  }
  const categories = [...categoryUnits.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);

  return {
    source,
    features: source.features,
    appts,
    orders,
    reviews,
    firstSeen,
    historyStart: Number.isFinite(earliest) ? dayStart(earliest) : null,
    services,
    categories,
  };
}

// ---- Window totals ----------------------------------------------------------------------------------

type Totals = {
  appointments: number;
  completed: number;
  noShow: number;
  cancelled: number;
  declined: number;
  withRide: number;
  revenue: number;
  orders: number;
  ordersDone: number;
  courierOrders: number;
  cancelledOrders: number;
  clients: number;
  newClients: number;
  ratingSum: number;
  ratingCount: number;
  /** Any record at all in the window (including cancelled ones and reviews). */
  records: number;
};

function totals(p: PreparedSource, w: Window): Totals {
  const t: Totals = {
    appointments: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
    declined: 0,
    withRide: 0,
    revenue: 0,
    orders: 0,
    ordersDone: 0,
    courierOrders: 0,
    cancelledOrders: 0,
    clients: 0,
    newClients: 0,
    ratingSum: 0,
    ratingCount: 0,
    records: 0,
  };
  const clients = new Set<string>();
  for (const { a, start } of p.appts) {
    if (!inWindow(start, w)) continue;
    t.records += 1;
    if (a.status === "cancelled") t.cancelled += 1;
    if (a.status === "declined") t.declined += 1;
    if (!ACTIVE.has(a.status)) continue;
    t.appointments += 1;
    if (a.withRide) t.withRide += 1;
    if (a.status === "no_show") t.noShow += 1;
    if (a.status === "completed") {
      t.completed += 1;
      t.revenue += a.amountAZN ?? 0;
      clients.add(a.clientId);
    }
  }
  for (const { o, created, done } of p.orders) {
    if (!inWindow(created, w)) continue;
    t.records += 1;
    if (o.status === "cancelled") {
      t.cancelledOrders += 1;
      continue;
    }
    t.orders += 1;
    if (o.fulfilment === "petride_courier") t.courierOrders += 1;
    if (done) {
      t.ordersDone += 1;
      t.revenue += o.totalAZN;
      clients.add(o.clientId);
    }
  }
  for (const [, first] of p.firstSeen) if (inWindow(first, w)) t.newClients += 1;
  t.clients = clients.size;
  for (const { r, created } of p.reviews) {
    if (!inWindow(created, w)) continue;
    t.records += 1;
    t.ratingSum += r.rating;
    t.ratingCount += 1;
  }
  t.revenue = round2(t.revenue);
  return t;
}

// ---- Report -----------------------------------------------------------------------------------------

export type StatsKpis = {
  revenue: Kpi;
  appointments: Kpi;
  orders: Kpi;
  averageTicket: Kpi;
  newClients: Kpi;
  returningClients: Kpi;
  /** 0–1: visits with a PetRide ride (clinics) or orders by PetRide courier (shops). */
  rideShare: Kpi;
  rating: Kpi;
  ratingCount: number;
  noShowRate: Kpi;
  completed: number;
  clients: number;
};

export type BucketPoint = Bucket & {
  revenue: number;
  appointments: number;
  completed: number;
  cancelled: number;
  declined: number;
  noShow: number;
  withRide: number;
  orders: number;
  pickup: number;
  courier: number;
  cancelledOrders: number;
  /** null when there was nothing to take a share of. */
  rideShare: number | null;
  /** Active appointments per series id (services, plus OTHER_SERIES). */
  byService: Record<string, number>;
  /** Same bucket of the previous period (null when comparison is off or impossible). */
  prev: { start: number; end: number; revenue: number; appointments: number; orders: number; rideShare: number | null } | null;
};

export type MixRow = {
  id: string;
  name: string;
  /** Colour slot (0–5) — stable across periods. */
  slot: number;
  count: number;
  /** Share 0–1 of the period's total count. */
  share: number;
  /** Visits completed (services) or orders finished (categories) — revenue comes from these. */
  completed: number;
  revenue: number;
  averageTicket: number | null;
  previousCount: number;
  delta: number | null;
};

export type BusyHours = {
  hours: number[];
  /** counts[dayIndex 0–6 = Mon–Sun][hourIndex]. */
  counts: number[][];
  max: number;
  total: number;
  peak: { day: IsoWeekday; hour: number; count: number } | null;
  /** Weekday totals, Mon–Sun. */
  dayTotals: number[];
};

export type RatingSummary = {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  previousAverage: number;
  previousCount: number;
  delta: number | null;
};

export type ProductRow = {
  id: string;
  name: string;
  category: ProductCategory;
  units: number;
  revenue: number;
  /** Share 0–1 of the period's product revenue. */
  share: number;
  stock: number;
  lowStockAt: number;
  stockStatus: "in" | "low" | "out";
  /** Units per day at the period's pace. */
  perDay: number;
  /** Days the current stock lasts at that pace; null when nothing sold. */
  daysLeft: number | null;
  active: boolean;
};

export type CancellationSummary = {
  cancelled: number;
  declined: number;
  noShow: number;
  cancelledOrders: number;
  /** Lost appointments (cancelled + declined + no-show) out of all appointments in the period. */
  lostRate: number;
  noShowRate: number;
  /** Cancelled orders out of all orders placed. */
  orderCancelRate: number;
};

export type StatsReport = {
  range: StatsRange;
  previous: StatsRange;
  /** The user asked for a comparison… */
  compare: boolean;
  /** …and the previous period lies within the history. */
  comparable: boolean;
  /** Show change chips (compare && comparable). */
  showChange: boolean;
  hasData: boolean;
  features: StatsFeatures;
  kpis: StatsKpis;
  points: BucketPoint[];
  /** Series of the stacked appointments chart, in colour order. */
  serviceSeries: (SeriesKey & { slot: number })[];
  services: MixRow[];
  categories: MixRow[];
  busy: BusyHours;
  rating: RatingSummary;
  cancellations: CancellationSummary;
  products: ProductRow[];
};

function seriesSlots(p: PreparedSource): Map<string, number> {
  const slots = new Map<string, number>();
  const crowded = p.services.length > SERIES_SLOTS;
  p.services.forEach((s, i) => slots.set(s.id, crowded && i >= SERIES_SLOTS - 1 ? SERIES_SLOTS - 1 : i));
  return slots;
}

function seriesId(p: PreparedSource, serviceId: string, slots: Map<string, number>): string {
  const crowded = p.services.length > SERIES_SLOTS;
  return crowded && (slots.get(serviceId) ?? SERIES_SLOTS - 1) === SERIES_SLOTS - 1 ? OTHER_SERIES : serviceId;
}

function bucketPoints(p: PreparedSource, buckets: Bucket[], slots: Map<string, number>): Omit<BucketPoint, "prev">[] {
  const points = buckets.map((b) => ({
    ...b,
    revenue: 0,
    appointments: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
    noShow: 0,
    withRide: 0,
    orders: 0,
    pickup: 0,
    courier: 0,
    cancelledOrders: 0,
    rideShare: null as number | null,
    byService: {} as Record<string, number>,
  }));
  for (const { a, start } of p.appts) {
    const i = bucketIndex(buckets, start);
    if (i < 0) continue;
    const pt = points[i];
    if (a.status === "cancelled") pt.cancelled += 1;
    else if (a.status === "declined") pt.declined += 1;
    if (!ACTIVE.has(a.status)) continue;
    pt.appointments += 1;
    if (a.withRide) pt.withRide += 1;
    if (a.status === "no_show") pt.noShow += 1;
    if (a.status === "completed") {
      pt.completed += 1;
      pt.revenue += a.amountAZN ?? 0;
    }
    const sid = seriesId(p, a.serviceId, slots);
    pt.byService[sid] = (pt.byService[sid] ?? 0) + 1;
  }
  for (const { o, created, done } of p.orders) {
    const i = bucketIndex(buckets, created);
    if (i < 0) continue;
    const pt = points[i];
    if (o.status === "cancelled") {
      pt.cancelledOrders += 1;
      continue;
    }
    pt.orders += 1;
    if (o.fulfilment === "petride_courier") pt.courier += 1;
    else pt.pickup += 1;
    if (done) pt.revenue += o.totalAZN;
  }
  const visits = p.features.appointments;
  return points.map((pt) => ({
    ...pt,
    revenue: round2(pt.revenue),
    rideShare: visits ? (pt.appointments ? pt.withRide / pt.appointments : null) : pt.orders ? pt.courier / pt.orders : null,
  }));
}

function serviceMix(p: PreparedSource, w: Window, prevW: Window | null, slots: Map<string, number>): MixRow[] {
  const rows = new Map<string, MixRow>();
  const prevCount = new Map<string, number>();
  for (const { a, start } of p.appts) {
    if (!ACTIVE.has(a.status)) continue;
    if (prevW && inWindow(start, prevW)) prevCount.set(a.serviceId, (prevCount.get(a.serviceId) ?? 0) + 1);
    if (!inWindow(start, w)) continue;
    const row =
      rows.get(a.serviceId) ??
      ({ id: a.serviceId, name: a.serviceName, slot: slots.get(a.serviceId) ?? 0, count: 0, share: 0, completed: 0, revenue: 0, averageTicket: null, previousCount: 0, delta: null } satisfies MixRow);
    row.count += 1;
    if (a.status === "completed") {
      row.completed += 1;
      row.revenue += a.amountAZN ?? 0;
    }
    rows.set(a.serviceId, row);
  }
  return finishMix([...rows.values()], prevCount, prevW !== null);
}

function categoryMix(p: PreparedSource, w: Window, prevW: Window | null): MixRow[] {
  const productCategory = new Map(p.source.products.map((x) => [x.id, x.category]));
  const rows = new Map<string, MixRow>();
  const prevCount = new Map<string, number>();
  for (const { o, created, done } of p.orders) {
    if (o.status === "cancelled") continue;
    const current = inWindow(created, w);
    const previous = prevW !== null && inWindow(created, prevW);
    if (!current && !previous) continue;
    const seen = new Set<string>();
    for (const it of o.items) {
      const cat = productCategory.get(it.productId);
      if (!cat) continue;
      if (previous) prevCount.set(cat, (prevCount.get(cat) ?? 0) + it.qty);
      if (!current) continue;
      const row =
        rows.get(cat) ??
        ({ id: cat, name: cat, slot: Math.max(0, p.categories.indexOf(cat)) % SERIES_SLOTS, count: 0, share: 0, completed: 0, revenue: 0, averageTicket: null, previousCount: 0, delta: null } satisfies MixRow);
      row.count += it.qty;
      if (done) {
        row.revenue += it.totalAZN;
        if (!seen.has(cat)) row.completed += 1;
        seen.add(cat);
      }
      rows.set(cat, row);
    }
  }
  return finishMix([...rows.values()], prevCount, prevW !== null);
}

function finishMix(rows: MixRow[], prevCount: Map<string, number>, comparable: boolean): MixRow[] {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return rows
    .map((r) => {
      const previousCount = prevCount.get(r.id) ?? 0;
      const revenue = round2(r.revenue);
      return {
        ...r,
        revenue,
        share: total ? r.count / total : 0,
        averageTicket: r.completed ? round2(revenue / r.completed) : null,
        previousCount,
        delta: comparable && previousCount ? (r.count - previousCount) / previousCount : null,
      };
    })
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);
}

function busyHours(p: PreparedSource, w: Window): BusyHours {
  const cells = new Map<string, number>();
  let dataMin = 24;
  let dataMax = -1;
  const add = (t: number) => {
    const d = new Date(t);
    const day = d.getDay() === 0 ? 7 : d.getDay();
    const hour = d.getHours();
    cells.set(`${day}-${hour}`, (cells.get(`${day}-${hour}`) ?? 0) + 1);
    dataMin = Math.min(dataMin, hour);
    dataMax = Math.max(dataMax, hour);
  };
  for (const { a, start } of p.appts) if (inWindow(start, w) && ACTIVE.has(a.status) && a.durationMin < LONG_STAY_MIN) add(start);
  for (const { o, created } of p.orders) if (inWindow(created, w) && o.status !== "cancelled") add(created);

  // Opening hours set the frame (as in the API); anything outside them widens it.
  const toMin = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const open = p.source.partner.hours.filter((h) => h.open);
  let minHour = open.length ? Math.floor(Math.min(...open.map((h) => toMin(h.from))) / 60) : 9;
  let maxHour = open.length ? Math.ceil(Math.max(...open.map((h) => toMin(h.to))) / 60) - 1 : 18;
  if (dataMax >= 0) {
    minHour = Math.min(minHour, dataMin);
    maxHour = Math.max(maxHour, dataMax);
  }
  const hours = Array.from({ length: Math.max(0, maxHour - minHour + 1) }, (_, i) => minHour + i);
  let max = 0;
  let total = 0;
  let peak: BusyHours["peak"] = null;
  const counts = [1, 2, 3, 4, 5, 6, 7].map((day) =>
    hours.map((hour) => {
      const count = cells.get(`${day}-${hour}`) ?? 0;
      total += count;
      if (count > max) {
        max = count;
        peak = { day: day as IsoWeekday, hour, count };
      }
      return count;
    }),
  );
  return { hours, counts, max, total, peak, dayTotals: counts.map((row) => row.reduce((s, n) => s + n, 0)) };
}

function ratingSummary(p: PreparedSource, w: Window, prevW: Window, comparable: boolean): RatingSummary {
  const distribution: RatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  let prevSum = 0;
  let prevCount = 0;
  for (const { r, created } of p.reviews) {
    if (inWindow(created, w)) {
      distribution[r.rating] += 1;
      sum += r.rating;
      count += 1;
    } else if (inWindow(created, prevW)) {
      prevSum += r.rating;
      prevCount += 1;
    }
  }
  const average = count ? round1(sum / count) : 0;
  const previousAverage = prevCount ? round1(prevSum / prevCount) : 0;
  return {
    average,
    count,
    distribution,
    previousAverage,
    previousCount: prevCount,
    delta: comparable && count && prevCount ? (average - previousAverage) / previousAverage : null,
  };
}

function productRows(p: PreparedSource, w: Window, days: number): ProductRow[] {
  const sold = new Map<string, { units: number; revenue: number }>();
  for (const { o, created, done } of p.orders) {
    if (!inWindow(created, w) || o.status === "cancelled") continue;
    for (const it of o.items) {
      const row = sold.get(it.productId) ?? { units: 0, revenue: 0 };
      row.units += it.qty;
      if (done) row.revenue += it.totalAZN;
      sold.set(it.productId, row);
    }
  }
  const totalRevenue = [...sold.values()].reduce((s, r) => s + r.revenue, 0);
  return p.source.products.map((product) => {
    const s = sold.get(product.id) ?? { units: 0, revenue: 0 };
    const perDay = s.units / Math.max(1, days);
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      units: s.units,
      revenue: round2(s.revenue),
      share: totalRevenue ? s.revenue / totalRevenue : 0,
      stock: product.stock,
      lowStockAt: product.lowStockAt,
      stockStatus: stockStatus(product.stock, product.lowStockAt),
      perDay,
      daysLeft: perDay > 0 ? product.stock / perDay : null,
      active: product.active,
    };
  });
}

/** Everything the page shows for `range` (and its previous period when `compare` is on). */
export function computeReport(p: PreparedSource, range: StatsRange, compare: boolean): StatsReport {
  const previous = previousRange(range);
  const comparable = p.historyStart !== null && previous.start >= p.historyStart;
  const useCompare = compare && comparable;
  const cur = totals(p, range);
  const prev = totals(p, previous);
  const k = (value: number, previousValue: number) => kpi(value, previousValue, comparable);
  const visits = p.features.appointments;
  const share = (t: Totals) => (visits ? ratio(t.withRide, t.appointments) : ratio(t.courierOrders, t.orders));
  const ticket = (t: Totals) => round2(ratio(t.revenue, t.completed + t.ordersDone));
  const noShow = (t: Totals) => ratio(t.noShow, t.completed + t.noShow);

  const slots = seriesSlots(p);
  const points = bucketPoints(p, makeBuckets(range), slots);
  const prevPoints = useCompare ? bucketPoints(p, makeBuckets(previous), slots) : null;

  const crowded = p.services.length > SERIES_SLOTS;
  const serviceSeries = (crowded ? p.services.slice(0, SERIES_SLOTS - 1) : p.services).map((s, i) => ({ ...s, slot: i }));
  if (crowded) serviceSeries.push({ id: OTHER_SERIES, name: OTHER_SERIES, slot: SERIES_SLOTS - 1 });

  const rating = ratingSummary(p, range, previous, comparable);
  const allAppointments = cur.appointments + cur.cancelled + cur.declined;

  return {
    range,
    previous,
    compare,
    comparable,
    showChange: useCompare,
    hasData: cur.records > 0,
    features: p.features,
    kpis: {
      revenue: k(cur.revenue, prev.revenue),
      appointments: k(cur.appointments, prev.appointments),
      orders: k(cur.orders, prev.orders),
      averageTicket: k(ticket(cur), ticket(prev)),
      newClients: k(cur.newClients, prev.newClients),
      returningClients: k(cur.clients - cur.newClients, prev.clients - prev.newClients),
      rideShare: k(share(cur), share(prev)),
      rating: { value: rating.average, previous: rating.previousAverage, delta: rating.delta },
      ratingCount: rating.count,
      noShowRate: k(noShow(cur), noShow(prev)),
      completed: cur.completed + cur.ordersDone,
      clients: cur.clients,
    },
    points: points.map((pt, i) => {
      const pp = prevPoints?.[i];
      return {
        ...pt,
        prev: pp ? { start: pp.start, end: pp.end, revenue: pp.revenue, appointments: pp.appointments, orders: pp.orders, rideShare: pp.rideShare } : null,
      };
    }),
    serviceSeries,
    services: visits ? serviceMix(p, range, useCompare ? previous : null, slots) : [],
    categories: p.features.orders ? categoryMix(p, range, useCompare ? previous : null) : [],
    busy: busyHours(p, range),
    rating,
    cancellations: {
      cancelled: cur.cancelled,
      declined: cur.declined,
      noShow: cur.noShow,
      cancelledOrders: cur.cancelledOrders,
      lostRate: ratio(cur.cancelled + cur.declined + cur.noShow, allAppointments),
      noShowRate: noShow(cur),
      orderCancelRate: ratio(cur.cancelledOrders, cur.orders + cur.cancelledOrders),
    },
    products: p.features.orders ? productRows(p, range, range.days) : [],
  };
}
