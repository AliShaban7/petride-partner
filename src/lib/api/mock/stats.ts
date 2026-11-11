/** Stats computed from the in-memory records for rolling windows ending today. */
import type {
  BusyHourCell,
  DailyPoint,
  IsoWeekday,
  Kpi,
  KpiSet,
  Locale,
  ProductCategory,
  RatingStats,
  RepeatStats,
  RevenuePoint,
  RideShareStats,
  ServiceMixItem,
  StatsPeriod,
} from "../types";

import { clockToMin, dayStart, isoDay, isoWeekday, type PartnerDb } from "./records";
import { orderDone, orderTotal } from "./resolve";

const PERIOD_DAYS: Record<StatsPeriod, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };

const PRODUCT_CATEGORY_NAMES: Record<ProductCategory, Record<Locale, string>> = {
  food: { az: "Yem", ru: "Корм", en: "Food" },
  treats: { az: "Ləzzətlər", ru: "Лакомства", en: "Treats" },
  toys: { az: "Oyuncaqlar", ru: "Игрушки", en: "Toys" },
  care: { az: "Baxım", ru: "Уход", en: "Care" },
  accessories: { az: "Aksesuarlar", ru: "Аксессуары", en: "Accessories" },
  health: { az: "Sağlamlıq", ru: "Здоровье", en: "Health" },
};

export type Window = { start: number; end: number };

/** [start of first day, start of tomorrow) — so "7d" = the last 7 calendar days including today. */
export function periodWindow(period: StatsPeriod, now: number, shift = 0): Window {
  const days = PERIOD_DAYS[period];
  const end = dayStart(now, 1 - shift * days);
  const start = dayStart(now, 1 - (shift + 1) * days);
  return { start, end };
}

const inWindow = (t: number, w: Window) => t >= w.start && t < w.end;
const ACTIVE = new Set(["requested", "confirmed", "checked_in", "completed", "no_show"]);

function kpi(value: number, previous: number, comparable = true): Kpi {
  return { value, previous, delta: !comparable || previous === 0 ? null : (value - previous) / previous };
}

/** Mock history starts 90 days before seeding: earlier windows can't be compared fairly. */
const HISTORY_DAYS = 90;

type Totals = {
  appointments: number;
  completed: number;
  noShow: number;
  withRide: number;
  revenue: number;
  orders: number;
  ordersDone: number;
  clients: Set<string>;
  repeatClients: number;
  newClients: number;
  ratingSum: number;
  ratingCount: number;
  requests: number;
  courierOrders: number;
};

function totals(db: PartnerDb, w: Window, firstSeen: Map<string, number>): Totals {
  const out: Totals = {
    appointments: 0,
    completed: 0,
    noShow: 0,
    withRide: 0,
    revenue: 0,
    orders: 0,
    ordersDone: 0,
    clients: new Set(),
    repeatClients: 0,
    newClients: 0,
    ratingSum: 0,
    ratingCount: 0,
    requests: 0,
    courierOrders: 0,
  };
  const visitsInWindow = new Map<string, number>();
  for (const a of db.appointments) {
    if (a.source === "app" && inWindow(a.createdAt, w)) out.requests += 1;
    if (!inWindow(a.start, w) || !ACTIVE.has(a.status)) continue;
    out.appointments += 1;
    if (a.withRide) out.withRide += 1;
    if (a.status === "no_show") out.noShow += 1;
    if (a.status === "completed") {
      out.completed += 1;
      out.revenue += a.amountAZN ?? 0;
      out.clients.add(a.clientId);
      visitsInWindow.set(a.clientId, (visitsInWindow.get(a.clientId) ?? 0) + 1);
    }
  }
  for (const o of db.orders) {
    if (!inWindow(o.createdAt, w) || o.status === "cancelled") continue;
    out.orders += 1;
    if (o.fulfilment === "petride_courier") out.courierOrders += 1;
    if (orderDone(o)) {
      out.ordersDone += 1;
      out.revenue += orderTotal(o);
      out.clients.add(o.clientId);
      visitsInWindow.set(o.clientId, (visitsInWindow.get(o.clientId) ?? 0) + 1);
    }
  }
  for (const id of out.clients) {
    const first = firstSeen.get(id) ?? w.start;
    if (first < w.start || (visitsInWindow.get(id) ?? 0) > 1) out.repeatClients += 1;
  }
  for (const [, first] of firstSeen) if (inWindow(first, w)) out.newClients += 1;
  for (const r of db.reviews) {
    if (!inWindow(r.createdAt, w)) continue;
    out.ratingSum += r.rating;
    out.ratingCount += 1;
  }
  out.revenue = Math.round(out.revenue * 100) / 100;
  return out;
}

/** First completed visit / delivered order per client. */
export function firstSeenMap(db: PartnerDb): Map<string, number> {
  const out = new Map<string, number>();
  const see = (id: string, t: number) => {
    const cur = out.get(id);
    if (cur === undefined || t < cur) out.set(id, t);
  };
  for (const a of db.appointments) if (a.status === "completed") see(a.clientId, a.start);
  for (const o of db.orders) if (orderDone(o)) see(o.clientId, o.createdAt);
  return out;
}

export function computeKpis(db: PartnerDb, period: StatsPeriod, now: number): KpiSet {
  const first = firstSeenMap(db);
  const prevWindow = periodWindow(period, now, 1);
  const comparable = prevWindow.start >= dayStart(db.seededAt, -HISTORY_DAYS);
  const cur = totals(db, periodWindow(period, now), first);
  const prev = totals(db, prevWindow, first);
  const k = (value: number, previous: number) => kpi(value, previous, comparable);
  const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);
  const pending = db.appointments.filter((a) => a.status === "requested" && a.start > now).length;
  const ticket = (t: Totals) => ratio(t.revenue, t.completed + t.ordersDone);
  // Shops have no visits: "with PetRide" = orders delivered by the PetRide courier.
  const shop = db.services.length === 0;
  const rideShare = (t: Totals) => (shop ? ratio(t.courierOrders, t.orders) : ratio(t.withRide, t.appointments));
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    period,
    appointments: k(cur.appointments, prev.appointments),
    completed: k(cur.completed, prev.completed),
    pendingRequests: { value: pending, previous: 0, delta: null },
    revenue: k(cur.revenue, prev.revenue),
    orders: k(cur.orders, prev.orders),
    newClients: k(cur.newClients, prev.newClients),
    rideShare: k(rideShare(cur), rideShare(prev)),
    repeatRate: k(ratio(cur.repeatClients, cur.clients.size), ratio(prev.repeatClients, prev.clients.size)),
    noShowRate: k(ratio(cur.noShow, cur.completed + cur.noShow), ratio(prev.noShow, prev.completed + prev.noShow)),
    rating: k(round1(ratio(cur.ratingSum, cur.ratingCount)), round1(ratio(prev.ratingSum, prev.ratingCount))),
    averageTicket: k(Math.round(ticket(cur) * 100) / 100, Math.round(ticket(prev) * 100) / 100),
  };
}

export function computeDaily(db: PartnerDb, period: StatsPeriod, now: number): DailyPoint[] {
  const w = periodWindow(period, now);
  const points = new Map<string, DailyPoint>();
  for (let t = w.start; t < w.end; t = dayStart(t, 1)) {
    const date = isoDay(t);
    points.set(date, {
      date,
      appointments: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      withRide: 0,
      orders: 0,
      revenueAZN: 0,
      appointmentRevenueAZN: 0,
      orderRevenueAZN: 0,
    });
  }
  for (const a of db.appointments) {
    if (!inWindow(a.start, w)) continue;
    const p = points.get(isoDay(a.start));
    if (!p) continue;
    if (a.status === "cancelled" || a.status === "declined") {
      p.cancelled += 1;
      continue;
    }
    p.appointments += 1;
    if (a.withRide) p.withRide += 1;
    if (a.status === "no_show") p.noShow += 1;
    if (a.status === "completed") {
      p.completed += 1;
      p.appointmentRevenueAZN += a.amountAZN ?? 0;
    }
  }
  for (const o of db.orders) {
    if (!inWindow(o.createdAt, w) || o.status === "cancelled") continue;
    const p = points.get(isoDay(o.createdAt));
    if (!p) continue;
    p.orders += 1;
    if (orderDone(o)) p.orderRevenueAZN += orderTotal(o);
  }
  return [...points.values()].map((p) => {
    const a = Math.round(p.appointmentRevenueAZN * 100) / 100;
    const o = Math.round(p.orderRevenueAZN * 100) / 100;
    return { ...p, appointmentRevenueAZN: a, orderRevenueAZN: o, revenueAZN: Math.round((a + o) * 100) / 100 };
  });
}

export function computeRevenue(db: PartnerDb, period: StatsPeriod, granularity: "day" | "week", now: number): RevenuePoint[] {
  const daily = computeDaily(db, period, now);
  if (granularity === "day") {
    return daily.map((p) => ({ date: p.date, appointmentsAZN: p.appointmentRevenueAZN, ordersAZN: p.orderRevenueAZN, totalAZN: p.revenueAZN }));
  }
  const weeks = new Map<string, RevenuePoint>();
  for (const p of daily) {
    const [y, m, d] = p.date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const monday = new Date(y, m - 1, d - ((date.getDay() + 6) % 7));
    const key = isoDay(monday.getTime());
    const bucket = weeks.get(key) ?? { date: key, appointmentsAZN: 0, ordersAZN: 0, totalAZN: 0 };
    bucket.appointmentsAZN += p.appointmentRevenueAZN;
    bucket.ordersAZN += p.orderRevenueAZN;
    bucket.totalAZN += p.revenueAZN;
    weeks.set(key, bucket);
  }
  return [...weeks.values()].map((b) => ({
    date: b.date,
    appointmentsAZN: Math.round(b.appointmentsAZN * 100) / 100,
    ordersAZN: Math.round(b.ordersAZN * 100) / 100,
    totalAZN: Math.round(b.totalAZN * 100) / 100,
  }));
}

export function computeServiceMix(db: PartnerDb, period: StatsPeriod, locale: Locale, now: number): ServiceMixItem[] {
  const w = periodWindow(period, now);
  const rows = new Map<string, ServiceMixItem>();
  if (db.services.length) {
    for (const a of db.appointments) {
      if (!inWindow(a.start, w) || !ACTIVE.has(a.status)) continue;
      const s = db.services.find((x) => x.id === a.serviceId);
      if (!s) continue;
      const row = rows.get(s.id) ?? { id: s.id, name: s.nameI18n[locale], category: s.category, count: 0, revenueAZN: 0, share: 0 };
      row.count += 1;
      row.revenueAZN += a.status === "completed" ? a.amountAZN ?? 0 : 0;
      rows.set(s.id, row);
    }
  } else {
    for (const o of db.orders) {
      if (!inWindow(o.createdAt, w) || o.status === "cancelled") continue;
      for (const it of o.items) {
        const p = db.products.find((x) => x.id === it.productId);
        if (!p) continue;
        const row = rows.get(p.category) ?? { id: p.category, name: PRODUCT_CATEGORY_NAMES[p.category][locale], category: p.category, count: 0, revenueAZN: 0, share: 0 };
        row.count += it.qty;
        row.revenueAZN += orderDone(o) ? it.qty * it.unitPriceAZN : 0;
        rows.set(p.category, row);
      }
    }
  }
  const total = [...rows.values()].reduce((s, r) => s + r.count, 0);
  return [...rows.values()]
    .map((r) => ({ ...r, revenueAZN: Math.round(r.revenueAZN * 100) / 100, share: total ? r.count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

export function computeBusyHours(db: PartnerDb, period: StatsPeriod, now: number): BusyHourCell[] {
  const w = periodWindow(period, now);
  const open = db.partner.hours.filter((h) => h.open);
  const minHour = Math.floor(Math.min(...open.map((h) => clockToMin(h.from))) / 60);
  const maxHour = Math.ceil(Math.max(...open.map((h) => clockToMin(h.to))) / 60) - 1;
  const counts = new Map<string, number>();
  const add = (t: number) => {
    const hour = new Date(t).getHours();
    const key = `${isoWeekday(t)}-${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const a of db.appointments) if (inWindow(a.start, w) && ACTIVE.has(a.status) && a.durationMin < 1440) add(a.start);
  for (const o of db.orders) if (inWindow(o.createdAt, w) && o.status !== "cancelled") add(o.createdAt);
  const cells: BusyHourCell[] = [];
  for (let day = 1; day <= 7; day += 1) {
    for (let hour = minHour; hour <= maxHour; hour += 1) {
      cells.push({ day: day as IsoWeekday, hour, count: counts.get(`${day}-${hour}`) ?? 0 });
    }
  }
  return cells;
}

export function computeRideShare(db: PartnerDb, period: StatsPeriod, now: number): RideShareStats {
  const w = periodWindow(period, now);
  let total = 0;
  let withRide = 0;
  for (const a of db.appointments) {
    if (!inWindow(a.start, w) || !ACTIVE.has(a.status)) continue;
    total += 1;
    if (a.withRide) withRide += 1;
  }
  let rides = 0;
  let revenue = 0;
  for (const r of db.rides) {
    if (!inWindow(r.arriveAt, w) || r.cancelledAt !== undefined) continue;
    rides += 1;
    revenue += r.priceAZN;
  }
  if (!db.services.length) {
    // Shops: share of orders delivered by PetRide courier.
    total = 0;
    withRide = 0;
    for (const o of db.orders) {
      if (!inWindow(o.createdAt, w) || o.status === "cancelled") continue;
      total += 1;
      if (o.fulfilment === "petride_courier") withRide += 1;
    }
  }
  return { withRide, total, share: total ? withRide / total : 0, rides, rideRevenueAZN: Math.round(revenue * 100) / 100 };
}

export function computeRepeat(db: PartnerDb, period: StatsPeriod, now: number): RepeatStats {
  const t = totals(db, periodWindow(period, now), firstSeenMap(db));
  return { repeatClients: t.repeatClients, clients: t.clients.size, rate: t.clients.size ? t.repeatClients / t.clients.size : 0 };
}

export function computeRating(db: PartnerDb, period: StatsPeriod, now: number): RatingStats {
  const w = periodWindow(period, now);
  const distribution: RatingStats["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  for (const r of db.reviews) {
    if (!inWindow(r.createdAt, w)) continue;
    distribution[r.rating] += 1;
    sum += r.rating;
    count += 1;
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution };
}

