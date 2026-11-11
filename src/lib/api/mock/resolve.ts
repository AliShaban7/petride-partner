/** Records → API types for one locale at one moment (live ride status/ETA come from `now`). */
import type {
  Appointment,
  Client,
  Driver,
  Locale,
  Order,
  PartnerNotification,
  PartnerProfile,
  Pet,
  PetHealthStatus,
  Product,
  Review,
  Ride,
  RideStatus,
  Service,
  Vaccine,
  VaccineStatus,
} from "../types";
import { formatDate, formatDayMonth, formatMoney, formatTime } from "@/lib/format";

import { DRIVERS, NOTIFICATION_TEXT, type DriverSeed } from "./catalog";
import {
  DAY,
  MINUTE,
  apptEnd,
  fromIsoDay,
  type AppointmentRecord,
  type ClientRecord,
  type NotificationRecord,
  type OrderRecord,
  type PartnerDb,
  type PetRecord,
  type ProductRecord,
  type ReviewRecord,
  type RideRecord,
  type ServiceRecord,
  type Text,
  type VaccineRecord,
} from "./records";

export function txt(value: Text | undefined, locale: Locale): string {
  if (value === undefined) return "";
  return typeof value === "string" ? value : value[locale];
}

const iso = (ms: number) => new Date(ms).toISOString();

// ---- Index (built per call; a few thousand records → well under 5 ms) -------------------------------

export type Index = {
  clients: Map<string, ClientRecord>;
  pets: Map<string, PetRecord>;
  services: Map<string, ServiceRecord>;
  products: Map<string, ProductRecord>;
  rides: Map<string, RideRecord>;
  drivers: Map<string, DriverSeed>;
  apptsByPet: Map<string, AppointmentRecord[]>;
  apptsByClient: Map<string, AppointmentRecord[]>;
  ordersByClient: Map<string, OrderRecord[]>;
  vaccinesByPet: Map<string, VaccineRecord[]>;
  petsByClient: Map<string, PetRecord[]>;
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function buildIndex(db: PartnerDb): Index {
  return {
    clients: new Map(db.clients.map((c) => [c.id, c])),
    pets: new Map(db.pets.map((p) => [p.id, p])),
    services: new Map(db.services.map((s) => [s.id, s])),
    products: new Map(db.products.map((p) => [p.id, p])),
    rides: new Map(db.rides.map((r) => [r.id, r])),
    drivers: new Map(DRIVERS.map((d) => [d.id, d])),
    apptsByPet: groupBy(db.appointments, (a) => a.petId),
    apptsByClient: groupBy(db.appointments, (a) => a.clientId),
    ordersByClient: groupBy(db.orders, (o) => o.clientId),
    vaccinesByPet: groupBy(db.vaccines, (v) => v.petId),
    petsByClient: groupBy(db.pets, (p) => p.ownerId),
  };
}

// ---- Rides -------------------------------------------------------------------------------------------

export type RideState = { status: RideStatus; progress: number; etaMin?: number };

/** Live status from the clock: scheduled → searching → onway → arrived → intrip → completed. */
export function rideState(r: RideRecord, now: number): RideState {
  if (r.cancelledAt !== undefined && r.cancelledAt <= now) return { status: "cancelled", progress: 0 };
  if (r.pendingPartner) return { status: "scheduled", progress: 0 };
  const eta = Math.max(1, Math.ceil((r.arriveAt - now) / MINUTE));
  if (now >= r.arriveAt) return { status: "completed", progress: 1 };
  if (now >= r.pickupAt) {
    const progress = Math.min(0.98, Math.max(0.02, (now - r.pickupAt) / (r.arriveAt - r.pickupAt)));
    return { status: "intrip", progress, etaMin: eta };
  }
  if (now >= r.pickupAt - 2 * MINUTE) return { status: "arrived", progress: 0, etaMin: eta };
  if (now >= r.pickupAt - 20 * MINUTE) return { status: "onway", progress: 0, etaMin: eta };
  if (now >= r.pickupAt - 25 * MINUTE) return { status: "searching", progress: 0, etaMin: eta };
  return { status: "scheduled", progress: 0 };
}

export const LIVE_RIDE_STATUSES: RideStatus[] = ["searching", "onway", "arrived", "intrip"];

function resolveDriver(d: DriverSeed, locale: Locale): Driver {
  return { id: d.id, name: d.name[locale], rating: d.rating, phone: d.phone, car: { model: d.car.model, color: d.car.color[locale], plate: d.car.plate } };
}

export function resolveRide(r: RideRecord, ix: Index, locale: Locale, now: number): Ride {
  const state = rideState(r, now);
  const client = ix.clients.get(r.clientId);
  const pets = r.petIds.map((id) => ix.pets.get(id)).filter((p): p is PetRecord => Boolean(p));
  const driver = ix.drivers.get(r.driverId);
  const hasDriver = ["onway", "arrived", "intrip", "completed"].includes(state.status);
  return {
    id: r.id,
    direction: r.direction,
    status: state.status,
    appointmentId: r.appointmentId,
    orderId: r.orderId,
    clientId: r.clientId,
    clientName: client ? clientName(client, locale) : "",
    petIds: r.petIds,
    petNames: pets.map((p) => p.shortName),
    driver: hasDriver && driver ? resolveDriver(driver, locale) : undefined,
    from: { label: txt(r.from.label, locale), address: txt(r.from.address, locale) },
    to: { label: txt(r.to.label, locale), address: txt(r.to.address, locale) },
    pickupAt: iso(r.pickupAt),
    arriveAt: iso(r.arriveAt),
    etaMin: state.etaMin,
    progress: state.progress,
    distanceKm: r.distanceKm,
    roundTrip: r.roundTrip,
    priceAZN: r.priceAZN,
    driverNote: r.driverNote ? txt(r.driverNote, locale) : undefined,
    travelNotes: pets.flatMap((p) => p.travelNotes.map((n) => n[locale])),
  };
}

// ---- Partner, services, products --------------------------------------------------------------------

export function resolvePartner(db: PartnerDb, locale: Locale): PartnerProfile {
  const p = db.partner;
  const rating = db.reviews.length ? db.reviews.reduce((s, r) => s + r.rating, 0) / db.reviews.length : 0;
  const appointments = p.categories.some((c) => c !== "shop");
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    shortName: p.shortName,
    title: p.title[locale],
    categories: [...p.categories],
    address: p.address[locale],
    area: p.area[locale],
    phone: p.phone,
    email: p.email,
    lat: p.lat,
    lng: p.lng,
    hours: p.hours.map((h) => ({ ...h })),
    hoursConfirmed: p.hoursConfirmed,
    acceptsRides: p.acceptsRides,
    offersCourierDelivery: p.offersCourierDelivery,
    autoConfirm: p.autoConfirm,
    responseWindowMin: p.responseWindowMin,
    rating: Math.round(rating * 10) / 10,
    reviewsCount: db.reviews.length,
    isDemo: p.isDemo,
    features: { appointments, orders: p.categories.includes("shop"), rides: p.acceptsRides || p.offersCourierDelivery },
  };
}

export function resolveService(s: ServiceRecord, db: PartnerDb, locale: Locale, now: number): Service {
  const since = now - 30 * DAY;
  return {
    id: s.id,
    category: s.category,
    name: s.nameI18n[locale],
    nameI18n: { ...s.nameI18n },
    description: s.descriptionI18n[locale],
    descriptionI18n: { ...s.descriptionI18n },
    durationMin: s.durationMin,
    priceAZN: s.priceAZN,
    priceFrom: s.priceFrom,
    species: [...s.species],
    active: s.active,
    bookings30d: db.appointments.filter((a) => a.serviceId === s.id && a.start >= since && a.start <= now && a.status !== "declined").length,
  };
}

export function resolveProduct(p: ProductRecord, db: PartnerDb, locale: Locale, now: number): Product {
  const since = now - 30 * DAY;
  let sold = 0;
  for (const o of db.orders) {
    if (o.createdAt < since || o.status === "cancelled") continue;
    for (const it of o.items) if (it.productId === p.id) sold += it.qty;
  }
  return {
    id: p.id,
    sku: p.sku,
    category: p.category,
    name: p.nameI18n[locale],
    nameI18n: { ...p.nameI18n },
    species: [...p.species],
    priceAZN: p.priceAZN,
    stock: p.stock,
    lowStockAt: p.lowStockAt,
    active: p.active,
    sold30d: sold,
  };
}

// ---- Pets & clients ---------------------------------------------------------------------------------

export function vaccineStatus(v: VaccineRecord, now: number): VaccineStatus {
  const due = fromIsoDay(v.nextDate ?? v.dueDate);
  const today = new Date(now);
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (due < today0) return "overdue";
  if (due <= today0 + 14 * DAY) return "due_soon";
  return v.doneDate ? "done" : "scheduled";
}

export function resolveVaccine(v: VaccineRecord, locale: Locale, now: number): Vaccine {
  return { id: v.id, petId: v.petId, name: v.name[locale], dueDate: v.dueDate, doneDate: v.doneDate, nextDate: v.nextDate, status: vaccineStatus(v, now) };
}

const HEALTH_RANK: Record<PetHealthStatus, number> = { ok: 0, due_soon: 1, overdue: 2 };

export function healthOf(vaccines: VaccineRecord[], now: number): PetHealthStatus {
  let worst: PetHealthStatus = "ok";
  for (const v of vaccines) {
    const s = vaccineStatus(v, now);
    const h: PetHealthStatus = s === "overdue" ? "overdue" : s === "due_soon" ? "due_soon" : "ok";
    if (HEALTH_RANK[h] > HEALTH_RANK[worst]) worst = h;
  }
  return worst;
}

const UPCOMING = new Set(["requested", "confirmed"]);

export function resolvePet(p: PetRecord, ix: Index, locale: Locale, now: number): Pet {
  const appts = ix.apptsByPet.get(p.id) ?? [];
  const vaccines = ix.vaccinesByPet.get(p.id) ?? [];
  let last: AppointmentRecord | undefined;
  let next: AppointmentRecord | undefined;
  let visits = 0;
  for (const a of appts) {
    if (a.status === "completed") {
      visits += 1;
      if (!last || a.start > last.start) last = a;
    }
    if (UPCOMING.has(a.status) && a.start > now && (!next || a.start < next.start)) next = a;
  }
  const owner = ix.clients.get(p.ownerId);
  return {
    id: p.id,
    code: p.code,
    ownerId: p.ownerId,
    ownerName: owner ? clientName(owner, locale) : "",
    name: p.name,
    shortName: p.shortName,
    species: p.species,
    breed: p.breed[locale],
    sex: p.sex,
    birthDate: p.birthDate,
    weightKg: p.weightKg,
    size: p.size,
    tint: p.tint,
    photoUrl: p.photoUrl,
    microchip: p.microchip,
    neutered: p.neutered,
    travelNotes: p.travelNotes.map((n) => n[locale]),
    partnerNote: p.partnerNote,
    vaccines: vaccines.map((v) => resolveVaccine(v, locale, now)),
    healthStatus: healthOf(vaccines, now),
    lastVisitAt: last ? iso(last.start) : undefined,
    nextAppointment: next
      ? { id: next.id, start: iso(next.start), serviceName: ix.services.get(next.serviceId)?.nameI18n[locale] ?? "" }
      : undefined,
    visitsCount: visits,
  };
}

export function clientName(c: ClientRecord, locale: Locale): string {
  return `${txt(c.firstName, locale)} ${txt(c.lastName, locale)}`.trim();
}

export function orderTotal(o: OrderRecord): number {
  return Math.round((o.items.reduce((s, it) => s + it.qty * it.unitPriceAZN, 0) + o.deliveryFeeAZN) * 100) / 100;
}

export function orderDone(o: OrderRecord): boolean {
  return o.status === "delivered" || o.status === "picked_up";
}

export function resolveClient(c: ClientRecord, ix: Index, locale: Locale, now: number): Client {
  const appts = ix.apptsByClient.get(c.id) ?? [];
  const orders = ix.ordersByClient.get(c.id) ?? [];
  const pets = ix.petsByClient.get(c.id) ?? [];
  let first: number | undefined;
  let last: number | undefined;
  let visits = 0;
  let spent = 0;
  let rideVisits = 0;
  for (const a of appts) {
    if (a.status === "completed") {
      visits += 1;
      spent += a.amountAZN ?? 0;
      if (a.withRide) rideVisits += 1;
      if (last === undefined || a.start > last) last = a.start;
      if (first === undefined || a.start < first) first = a.start;
    }
  }
  let ordersCount = 0;
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    ordersCount += 1;
    if (orderDone(o)) spent += orderTotal(o);
    if (last === undefined || o.createdAt > last) last = o.createdAt;
    if (first === undefined || o.createdAt < first) first = o.createdAt;
  }
  let alert: PetHealthStatus = "ok";
  for (const p of pets) {
    const h = healthOf(ix.vaccinesByPet.get(p.id) ?? [], now);
    if (HEALTH_RANK[h] > HEALTH_RANK[alert]) alert = h;
  }
  return {
    id: c.id,
    firstName: txt(c.firstName, locale),
    lastName: txt(c.lastName, locale),
    fullName: clientName(c, locale),
    phone: c.phone,
    locale: c.locale,
    area: c.area[locale],
    source: c.source,
    petIds: pets.map((p) => p.id),
    petNames: pets.map((p) => p.shortName),
    firstVisitAt: first !== undefined ? iso(first) : undefined,
    lastVisitAt: last !== undefined ? iso(last) : undefined,
    visitsCount: visits,
    ordersCount,
    totalSpentAZN: Math.round(spent * 100) / 100,
    rideVisits,
    vaccineAlert: alert,
    partnerNote: c.partnerNote,
    createdAt: iso(c.createdAt),
  };
}

// ---- Appointments & orders ----------------------------------------------------------------------------

export function resolveAppointment(a: AppointmentRecord, ix: Index, locale: Locale, now: number): Appointment {
  const service = ix.services.get(a.serviceId);
  const pet = ix.pets.get(a.petId);
  const client = ix.clients.get(a.clientId);
  const ride = a.rideId ? ix.rides.get(a.rideId) : undefined;
  const back = a.returnRideId ? ix.rides.get(a.returnRideId) : undefined;
  return {
    id: a.id,
    code: a.code,
    serviceId: a.serviceId,
    serviceName: service ? service.nameI18n[locale] : "",
    category: service?.category ?? "vet",
    petId: a.petId,
    petName: pet?.shortName ?? "",
    petSpecies: pet?.species ?? "other",
    petBreed: pet ? pet.breed[locale] : "",
    petTint: pet?.tint ?? "sage",
    clientId: a.clientId,
    clientName: client ? clientName(client, locale) : "",
    clientPhone: client?.phone ?? "",
    start: iso(a.start),
    end: iso(apptEnd(a)),
    durationMin: a.durationMin,
    status: a.status,
    source: a.source,
    requestId: a.requestId,
    priceAZN: a.priceAZN,
    amountAZN: a.amountAZN,
    withRide: a.withRide,
    ride: ride ? resolveRide(ride, ix, locale, now) : undefined,
    returnRide: back ? resolveRide(back, ix, locale, now) : undefined,
    clientNote: a.clientNote ? a.clientNote[locale] : undefined,
    staffNote: a.staffNote,
    reason: a.reason ? txt(a.reason, locale) : undefined,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
    history: a.history.map((h) => ({ at: iso(h.at), status: h.status, by: h.by, note: h.note })),
  };
}

export function resolveOrder(o: OrderRecord, ix: Index, locale: Locale, now: number): Order {
  const client = ix.clients.get(o.clientId);
  const items = o.items.map((it) => {
    const product = ix.products.get(it.productId);
    return {
      productId: it.productId,
      name: product ? product.nameI18n[locale] : it.productId,
      qty: it.qty,
      unitPriceAZN: it.unitPriceAZN,
      totalAZN: Math.round(it.qty * it.unitPriceAZN * 100) / 100,
    };
  });
  const subtotal = Math.round(items.reduce((s, it) => s + it.totalAZN, 0) * 100) / 100;
  const ride = o.courierRideId ? ix.rides.get(o.courierRideId) : undefined;
  const pets = client ? ix.petsByClient.get(client.id) ?? [] : [];
  return {
    id: o.id,
    code: o.code,
    clientId: o.clientId,
    clientName: client ? clientName(client, locale) : "",
    clientPhone: client?.phone ?? "",
    petNames: pets.map((p) => p.shortName),
    items,
    itemsCount: items.reduce((s, it) => s + it.qty, 0),
    subtotalAZN: subtotal,
    deliveryFeeAZN: o.deliveryFeeAZN,
    totalAZN: Math.round((subtotal + o.deliveryFeeAZN) * 100) / 100,
    status: o.status,
    fulfilment: o.fulfilment,
    courierRide: ride ? resolveRide(ride, ix, locale, now) : undefined,
    deliveryAddress: o.fulfilment === "petride_courier" && client ? `${txt(client.address, locale)}, ${client.area[locale]}` : undefined,
    paymentMethod: o.paymentMethod,
    paid: o.paymentMethod === "card" || orderDone(o),
    clientNote: o.clientNote ? o.clientNote[locale] : undefined,
    reason: o.reason ? txt(o.reason, locale) : undefined,
    createdAt: iso(o.createdAt),
    updatedAt: iso(o.updatedAt),
    history: o.history.map((h) => ({ at: iso(h.at), status: h.status, by: h.by })),
  };
}

export function resolveReview(r: ReviewRecord, ix: Index, locale: Locale): Review {
  const client = ix.clients.get(r.clientId);
  return {
    id: r.id,
    clientId: r.clientId,
    clientName: client ? clientName(client, locale) : "",
    petName: r.petId ? ix.pets.get(r.petId)?.shortName : undefined,
    rating: r.rating,
    text: r.text,
    serviceName: r.serviceId ? ix.services.get(r.serviceId)?.nameI18n[locale] : undefined,
    appointmentId: r.appointmentId,
    orderId: r.orderId,
    createdAt: iso(r.createdAt),
    reply: r.reply ? { text: txt(r.reply.text, locale), at: iso(r.reply.at) } : undefined,
  };
}

// ---- Notifications ----------------------------------------------------------------------------------

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function resolveNotification(n: NotificationRecord, db: PartnerDb, ix: Index, locale: Locale, now: number): PartnerNotification {
  const text = NOTIFICATION_TEXT[n.kind];
  const appt = n.appointmentId ? db.appointments.find((a) => a.id === n.appointmentId) : undefined;
  const order = n.orderId ? db.orders.find((o) => o.id === n.orderId) : undefined;
  const ride = n.rideId ? ix.rides.get(n.rideId) : undefined;
  const review = n.reviewId ? db.reviews.find((r) => r.id === n.reviewId) : undefined;
  const vaccine = n.vaccineId ? db.vaccines.find((v) => v.id === n.vaccineId) : undefined;
  const clientId = appt?.clientId ?? order?.clientId ?? ride?.clientId ?? review?.clientId;
  const client = clientId ? ix.clients.get(clientId) : undefined;
  const petId = appt?.petId ?? ride?.petIds[0] ?? vaccine?.petId;
  const pet = petId ? ix.pets.get(petId) : undefined;
  const driver = ride ? ix.drivers.get(ride.driverId) : undefined;
  const vars: Record<string, string | number> = {
    client: client ? clientName(client, locale) : "",
    pet: pet?.shortName ?? "",
    service: appt ? ix.services.get(appt.serviceId)?.nameI18n[locale] ?? "" : "",
    when: appt ? `${formatDate(appt.start, locale, new Date(now))}, ${formatTime(appt.start)}` : "",
    driver: driver ? driver.name[locale].split(" ")[0] : "",
    eta: ride ? Math.max(1, Math.ceil((ride.arriveAt - now) / MINUTE)) : "",
    code: order?.code ?? "",
    items: order ? order.items.reduce((s, it) => s + it.qty, 0) : "",
    total: order ? formatMoney(orderTotal(order), locale) : "",
    rating: review?.rating ?? "",
    text: review ? (review.text.length > 60 ? `${review.text.slice(0, 57)}…` : review.text) : "",
    vaccine: vaccine ? vaccine.name[locale] : "",
    date: vaccine ? formatDayMonth(vaccine.nextDate ?? vaccine.dueDate, locale) : "",
  };
  const href = appt
    ? `/appointments?id=${appt.id}`
    : order
      ? `/orders?id=${order.id}`
      : review
        ? `/clients?id=${review.clientId}`
        : pet
          ? `/clients?id=${pet.ownerId}`
          : undefined;
  return {
    id: n.id,
    kind: n.kind,
    title: fill(text.title[locale], vars),
    body: fill(text.body[locale], vars),
    createdAt: iso(n.createdAt),
    read: n.read,
    href,
  };
}

