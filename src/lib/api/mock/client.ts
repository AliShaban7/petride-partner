/**
 * In-memory PartnerApi: seeded data (./seed.ts), 200–600 ms latency, mutations update the live
 * records so every screen sees the change. Swap for the Supabase implementation in ../index.ts.
 */
import type { PartnerApi } from "../partner-api";
import {
  ApiError,
  type Appointment,
  type AppointmentQuery,
  type AppointmentStatus,
  type ClientQuery,
  type ID,
  type Locale,
  type OrderQuery,
  type OrderStatus,
  type Paged,
  type PetQuery,
  type ReviewQuery,
  type RideQuery,
} from "../types";
import { DRIVERS } from "./catalog";
import {
  DAY,
  HOUR,
  MINUTE,
  apptEnd,
  travelMinutes,
  type AppointmentRecord,
  type PartnerDb,
  type RideRecord,
} from "./records";
import {
  LIVE_RIDE_STATUSES,
  buildIndex,
  clientName,
  healthOf,
  resolveAppointment,
  resolveClient,
  resolveNotification,
  resolveOrder,
  resolvePartner,
  resolvePet,
  resolveProduct,
  resolveReview,
  resolveRide,
  resolveService,
  rideState,
  type Index,
} from "./resolve";
import {
  computeBusyHours,
  computeDaily,
  computeKpis,
  computeRating,
  computeRepeat,
  computeRevenue,
  computeRideShare,
  computeServiceMix,
} from "./stats";
import { getDb, latency, mockMode } from "./store";

// ---- Helpers -----------------------------------------------------------------------------------------

const AZ_FOLD: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g", İ: "i" };

/** Case/diacritic-insensitive search key: "Məmmədova" and "memmedova" match. */
export function norm(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[əıöüşçğİ]/g, (ch) => AZ_FOLD[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function paginate<T>(items: T[], page = 1, pageSize = 20): Paged<T> {
  const size = Math.max(1, Math.min(200, pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * size, current * size), total: items.length, page: current, pageSize: size, pageCount };
}

const empty = <T>(page = 1, pageSize = 20): Paged<T> => ({ items: [], total: 0, page, pageSize, pageCount: 1 });
const toMs = (value: string | undefined) => (value ? new Date(value).getTime() : undefined);

function find<T extends { id: string }>(items: T[], id: ID, what: string): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw new ApiError("not_found", `${what} ${id} not found`);
  return item;
}

function transition(a: AppointmentRecord, allowed: AppointmentStatus[], to: AppointmentStatus, now: number, note?: string) {
  if (!allowed.includes(a.status)) throw new ApiError("invalid_transition", `Cannot move ${a.status} → ${to}`);
  a.status = to;
  a.updatedAt = now;
  a.history.push({ at: now, status: to, by: "partner", note });
}

function cancelRides(db: PartnerDb, a: AppointmentRecord, now: number) {
  for (const id of [a.rideId, a.returnRideId]) {
    const ride = id ? db.rides.find((r) => r.id === id) : undefined;
    if (ride && ride.cancelledAt === undefined && ride.arriveAt > now) ride.cancelledAt = now;
  }
}

// ---- Factory ------------------------------------------------------------------------------------------

export function createMockPartnerApi({ partnerId, locale }: { partnerId: ID; locale: Locale }): PartnerApi {
  /** Runs `fn` against the live db after simulated latency. */
  async function run<T>(fn: (db: PartnerDb, ix: Index, now: number) => T): Promise<T> {
    await latency();
    const db = getDb(partnerId);
    const now = Date.now();
    return fn(db, buildIndex(db), now);
  }
  const isEmpty = () => mockMode() === "empty";
  /** In ?mock=empty the stats are computed from a partner with no activity, so KPIs match the empty lists. */
  const statsDb = (db: PartnerDb): PartnerDb =>
    isEmpty() ? { ...db, appointments: [], rides: [], orders: [], reviews: [], notifications: [] } : db;

  /** A PetRide ride already on its way / in progress can't be moved or dropped from the dashboard. */
  function assertNoLiveRide(db: PartnerDb, a: AppointmentRecord, now: number) {
    for (const rideId of [a.rideId, a.returnRideId]) {
      const ride = rideId ? db.rides.find((r) => r.id === rideId) : undefined;
      if (ride && LIVE_RIDE_STATUSES.includes(rideState(ride, now).status)) {
        throw new ApiError("invalid_transition", "A PetRide ride for this appointment is in progress");
      }
    }
  }

  const appointment = (db: PartnerDb, id: ID, now: number) =>
    resolveAppointment(find(db.appointments, id, "Appointment"), buildIndex(db), locale, now);

  function mutateAppointment(id: ID, fn: (a: AppointmentRecord, db: PartnerDb, now: number) => void): Promise<Appointment> {
    return run((db, _ix, now) => {
      const a = find(db.appointments, id, "Appointment");
      fn(a, db, now);
      return appointment(db, id, now);
    });
  }

  const api: PartnerApi = {
    partnerId,

    // ---- Partner ---------------------------------------------------------------------------------
    getPartner: () => run((db) => resolvePartner(db, locale)),
    updatePartner: (patch) =>
      run((db) => {
        const p = db.partner;
        if (patch.hours) {
          for (const h of patch.hours) {
            if (h.open && h.from >= h.to) throw new ApiError("validation", "Opening time must be before closing time");
          }
          p.hours = patch.hours.map((h) => ({ ...h }));
          p.hoursConfirmed = true;
        }
        if (patch.phone !== undefined) p.phone = patch.phone;
        if (patch.email !== undefined) p.email = patch.email;
        if (patch.acceptsRides !== undefined) p.acceptsRides = patch.acceptsRides;
        if (patch.offersCourierDelivery !== undefined) p.offersCourierDelivery = patch.offersCourierDelivery;
        if (patch.autoConfirm !== undefined) p.autoConfirm = patch.autoConfirm;
        if (patch.responseWindowMin !== undefined) p.responseWindowMin = patch.responseWindowMin;
        return resolvePartner(db, locale);
      }),

    // ---- Services & products ---------------------------------------------------------------------
    listServices: () =>
      run((db, _ix, now) => (isEmpty() ? [] : db.services.filter((s) => !s.archived).map((s) => resolveService(s, db, locale, now)))),
    updateService: (id, patch) =>
      run((db, _ix, now) => {
        const s = find(db.services, id, "Service");
        if (patch.priceAZN !== undefined && patch.priceAZN !== null && (patch.priceAZN < 0 || !Number.isFinite(patch.priceAZN))) {
          throw new ApiError("validation", "Price must be a positive number");
        }
        if (patch.durationMin !== undefined && patch.durationMin <= 0) throw new ApiError("validation", "Duration must be positive");
        Object.assign(s, {
          ...(patch.nameI18n && { nameI18n: { ...patch.nameI18n } }),
          ...(patch.descriptionI18n && { descriptionI18n: { ...patch.descriptionI18n } }),
          ...(patch.durationMin !== undefined && { durationMin: patch.durationMin }),
          ...(patch.priceAZN !== undefined && { priceAZN: patch.priceAZN }),
          ...(patch.priceFrom !== undefined && { priceFrom: patch.priceFrom }),
          ...(patch.species && { species: [...patch.species] }),
          ...(patch.active !== undefined && { active: patch.active }),
        });
        return resolveService(s, db, locale, now);
      }),
    createService: (input) =>
      run((db, _ix, now) => {
        db.seq += 1;
        const s = {
          id: `svc-${db.seq}`,
          category: input.category,
          nameI18n: { ...input.nameI18n },
          descriptionI18n: { ...input.descriptionI18n },
          durationMin: input.durationMin,
          priceAZN: input.priceAZN,
          priceFrom: input.priceFrom,
          species: [...input.species],
          active: input.active,
          archived: false,
          weight: 1,
        };
        db.services.push(s);
        return resolveService(s, db, locale, now);
      }),
    archiveService: (id) =>
      run((db) => {
        const s = find(db.services, id, "Service");
        s.archived = true;
        s.active = false;
      }),
    listProducts: () =>
      run((db, _ix, now) => (isEmpty() ? [] : db.products.map((p) => resolveProduct(p, db, locale, now)))),
    updateProduct: (id, patch) =>
      run((db, _ix, now) => {
        const p = find(db.products, id, "Product");
        if (patch.priceAZN !== undefined && (patch.priceAZN < 0 || !Number.isFinite(patch.priceAZN))) {
          throw new ApiError("validation", "Price must be a positive number");
        }
        if (patch.nameI18n) p.nameI18n = { ...patch.nameI18n };
        if (patch.priceAZN !== undefined) p.priceAZN = patch.priceAZN;
        if (patch.stock !== undefined) p.stock = Math.max(0, Math.round(patch.stock));
        if (patch.lowStockAt !== undefined) p.lowStockAt = patch.lowStockAt;
        if (patch.active !== undefined) p.active = patch.active;
        return resolveProduct(p, db, locale, now);
      }),

    // ---- Appointments ----------------------------------------------------------------------------
    listAppointments: (query: AppointmentQuery = {}) =>
      run((db, ix, now) => {
        if (isEmpty()) return empty<Appointment>(query.page, query.pageSize);
        const from = toMs(query.from);
        const to = toMs(query.to);
        const q = query.search ? norm(query.search.trim()) : "";
        let rows = db.appointments.filter((a) => {
          if (from !== undefined && apptEnd(a) <= from) return false;
          if (to !== undefined && a.start >= to) return false;
          if (query.status?.length && !query.status.includes(a.status)) return false;
          if (query.serviceId && a.serviceId !== query.serviceId) return false;
          if (query.category?.length && !query.category.includes(ix.services.get(a.serviceId)?.category ?? "vet")) return false;
          if (query.withRide !== undefined && a.withRide !== query.withRide) return false;
          if (query.clientId && a.clientId !== query.clientId) return false;
          if (query.petId && a.petId !== query.petId) return false;
          if (q) {
            const client = ix.clients.get(a.clientId);
            const pet = ix.pets.get(a.petId);
            const service = ix.services.get(a.serviceId);
            const hay = norm(
              [a.code, client ? clientName(client, locale) : "", client?.phone ?? "", pet?.name ?? "", service?.nameI18n[locale] ?? ""].join(" "),
            );
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        const sort = query.sort ?? "start_asc";
        rows = [...rows].sort((a, b) => {
          switch (sort) {
            case "start_desc":
              return b.start - a.start;
            case "created_desc":
              return b.createdAt - a.createdAt;
            case "client_asc":
              return clientName(ix.clients.get(a.clientId)!, locale).localeCompare(clientName(ix.clients.get(b.clientId)!, locale), locale);
            case "amount_desc":
              return (b.amountAZN ?? b.priceAZN ?? 0) - (a.amountAZN ?? a.priceAZN ?? 0);
            default:
              return a.start - b.start;
          }
        });
        const paged = paginate(rows, query.page, query.pageSize);
        return { ...paged, items: paged.items.map((a) => resolveAppointment(a, ix, locale, now)) };
      }),
    getAppointment: (id) => run((db, ix, now) => resolveAppointment(find(db.appointments, id, "Appointment"), ix, locale, now)),
    confirmAppointment: (id) =>
      mutateAppointment(id, (a, db, now) => {
        transition(a, ["requested"], "confirmed", now);
        for (const rideId of [a.rideId, a.returnRideId]) {
          const ride = db.rides.find((r) => r.id === rideId);
          if (ride) ride.pendingPartner = false;
        }
      }),
    declineAppointment: (id, reason) =>
      mutateAppointment(id, (a, db, now) => {
        transition(a, ["requested"], "declined", now, reason);
        a.reason = reason;
        cancelRides(db, a, now);
      }),
    rescheduleAppointment: (id, start) =>
      mutateAppointment(id, (a, db, now) => {
        if (!["requested", "confirmed"].includes(a.status)) throw new ApiError("invalid_transition", `Cannot reschedule ${a.status}`);
        assertNoLiveRide(db, a, now);
        const next = new Date(start).getTime();
        if (!Number.isFinite(next)) throw new ApiError("validation", "Invalid start");
        if (next < now) throw new ApiError("validation", "Start must be in the future");
        const delta = next - a.start;
        a.start = next;
        for (const rideId of [a.rideId, a.returnRideId]) {
          const ride = db.rides.find((r) => r.id === rideId);
          if (ride) {
            ride.pickupAt += delta;
            ride.arriveAt += delta;
            ride.pendingPartner = false;
          }
        }
        if (a.status === "requested") transition(a, ["requested"], "confirmed", now, "rescheduled");
        else {
          a.updatedAt = now;
          a.history.push({ at: now, status: a.status, by: "partner", note: "rescheduled" });
        }
      }),
    checkInAppointment: (id) => mutateAppointment(id, (a, _db, now) => transition(a, ["confirmed"], "checked_in", now)),
    completeAppointment: (id, input) =>
      mutateAppointment(id, (a, _db, now) => {
        if (!(input.amountAZN >= 0)) throw new ApiError("validation", "Amount must be 0 or more");
        transition(a, ["confirmed", "checked_in"], "completed", now);
        a.amountAZN = Math.round(input.amountAZN * 100) / 100;
        if (input.staffNote !== undefined) a.staffNote = input.staffNote;
      }),
    markNoShow: (id) =>
      mutateAppointment(id, (a, db, now) => {
        assertNoLiveRide(db, a, now);
        transition(a, ["confirmed"], "no_show", now);
        const back = db.rides.find((r) => r.id === a.returnRideId);
        if (back && back.cancelledAt === undefined) back.cancelledAt = now;
      }),
    cancelAppointment: (id, reason) =>
      mutateAppointment(id, (a, db, now) => {
        assertNoLiveRide(db, a, now);
        transition(a, ["requested", "confirmed"], "cancelled", now, reason);
        a.reason = reason;
        cancelRides(db, a, now);
      }),
    createAppointment: (input) =>
      run((db, _ix, now) => {
        const service = find(db.services, input.serviceId, "Service");
        const pet = find(db.pets, input.petId, "Pet");
        const start = new Date(input.start).getTime();
        if (!Number.isFinite(start)) throw new ApiError("validation", "Invalid start");
        db.seq += 1;
        const a: AppointmentRecord = {
          id: `apt-${db.seq}`,
          code: `A-${1001 + db.appointments.length}`,
          serviceId: service.id,
          petId: pet.id,
          clientId: pet.ownerId,
          start,
          durationMin: service.durationMin,
          status: "confirmed",
          source: input.source,
          priceAZN: service.priceAZN,
          withRide: false,
          staffNote: input.staffNote,
          createdAt: now,
          updatedAt: now,
          history: [{ at: now, status: "confirmed", by: "partner" }],
        };
        db.appointments.push(a);
        db.appointments.sort((x, y) => x.start - y.start);
        return appointment(db, a.id, now);
      }),
    updateAppointmentNote: (id, staffNote) =>
      mutateAppointment(id, (a, _db, now) => {
        a.staffNote = staffNote;
        a.updatedAt = now;
      }),

    // ---- Rides -----------------------------------------------------------------------------------
    listRides: (query: RideQuery = {}) =>
      run((db, ix, now) => {
        if (isEmpty()) return [];
        const from = toMs(query.from);
        const to = toMs(query.to);
        return db.rides
          .filter((r) => {
            const state = rideState(r, now);
            if (query.live) {
              const live = LIVE_RIDE_STATUSES.includes(state.status);
              const soon = state.status === "scheduled" && r.pickupAt - now < 2 * HOUR && r.pickupAt > now - 10 * MINUTE;
              if (!live && !soon) return false;
            }
            if (from !== undefined && r.arriveAt < from) return false;
            if (to !== undefined && r.pickupAt >= to) return false;
            if (query.direction && r.direction !== query.direction) return false;
            if (query.status?.length && !query.status.includes(state.status)) return false;
            return true;
          })
          .sort((a, b) => a.arriveAt - b.arriveAt)
          .map((r) => resolveRide(r, ix, locale, now));
      }),
    getRide: (id) => run((db, ix, now) => resolveRide(find(db.rides, id, "Ride"), ix, locale, now)),

    // ---- Clients & pets ----------------------------------------------------------------------------
    listClients: (query: ClientQuery = {}) =>
      run((db, ix, now) => {
        if (isEmpty()) return empty(query.page, query.pageSize);
        const q = query.search ? norm(query.search.trim()) : "";
        let rows = db.clients.map((c) => resolveClient(c, ix, locale, now));
        rows = rows.filter((c) => {
          if (c.visitsCount === 0 && c.ordersCount === 0 && !db.appointments.some((a) => a.clientId === c.id)) return false;
          if (q && !norm(`${c.fullName} ${c.phone} ${c.petNames.join(" ")}`).includes(q)) return false;
          switch (query.filter) {
            case "vaccine_due":
              return c.vaccineAlert !== "ok";
            case "rides":
              return c.rideVisits > 0;
            case "repeat":
              return c.visitsCount + c.ordersCount >= 2;
            case "new":
              return c.firstVisitAt !== undefined && new Date(c.firstVisitAt).getTime() > now - 30 * DAY;
            default:
              return true;
          }
        });
        const sort = query.sort ?? "last_visit_desc";
        rows.sort((a, b) => {
          switch (sort) {
            case "name_asc":
              return a.fullName.localeCompare(b.fullName, locale);
            case "spent_desc":
              return b.totalSpentAZN - a.totalSpentAZN;
            case "visits_desc":
              return b.visitsCount + b.ordersCount - (a.visitsCount + a.ordersCount);
            default:
              return (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? "");
          }
        });
        return paginate(rows, query.page, query.pageSize);
      }),
    getClient: (id) =>
      run((db, ix, now) => {
        const c = find(db.clients, id, "Client");
        const appts = (ix.apptsByClient.get(id) ?? []).slice().sort((a, b) => b.start - a.start);
        const orders = (ix.ordersByClient.get(id) ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
        return {
          client: resolveClient(c, ix, locale, now),
          pets: (ix.petsByClient.get(id) ?? []).map((p) => resolvePet(p, ix, locale, now)),
          appointments: appts.map((a) => resolveAppointment(a, ix, locale, now)),
          orders: orders.map((o) => resolveOrder(o, ix, locale, now)),
          rides: db.rides
            .filter((r) => r.clientId === id)
            .sort((a, b) => b.pickupAt - a.pickupAt)
            .map((r) => resolveRide(r, ix, locale, now)),
          reviews: db.reviews.filter((r) => r.clientId === id).map((r) => resolveReview(r, ix, locale)),
        };
      }),
    updateClientNote: (id, note) =>
      run((db, ix, now) => {
        const c = find(db.clients, id, "Client");
        c.partnerNote = note;
        return resolveClient(c, ix, locale, now);
      }),
    listPets: (query: PetQuery = {}) =>
      run((db, ix, now) => {
        if (isEmpty()) return empty(query.page, query.pageSize);
        const q = query.search ? norm(query.search.trim()) : "";
        let rows = db.pets
          .filter((p) => (ix.apptsByPet.get(p.id)?.length ?? 0) > 0 || (ix.ordersByClient.get(p.ownerId)?.length ?? 0) > 0)
          .filter((p) => !query.species || p.species === query.species)
          .filter((p) => !query.health?.length || query.health.includes(healthOf(ix.vaccinesByPet.get(p.id) ?? [], now)))
          .map((p) => resolvePet(p, ix, locale, now));
        if (q) rows = rows.filter((p) => norm(`${p.name} ${p.code} ${p.ownerName} ${p.breed}`).includes(q));
        const sort = query.sort ?? "next_appointment";
        rows.sort((a, b) => {
          if (sort === "name_asc") return a.name.localeCompare(b.name, locale);
          if (sort === "last_visit_desc") return (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? "");
          const an = a.nextAppointment?.start ?? "9999";
          const bn = b.nextAppointment?.start ?? "9999";
          return an.localeCompare(bn) || (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? "");
        });
        return paginate(rows, query.page, query.pageSize);
      }),
    getPet: (id) => run((db, ix, now) => resolvePet(find(db.pets, id, "Pet"), ix, locale, now)),
    updatePetNote: (id, note) =>
      run((db, ix, now) => {
        const p = find(db.pets, id, "Pet");
        p.partnerNote = note;
        return resolvePet(p, ix, locale, now);
      }),

    // ---- Orders ------------------------------------------------------------------------------------
    listOrders: (query: OrderQuery = {}) =>
      run((db, ix, now) => {
        if (isEmpty()) return empty(query.page, query.pageSize);
        const from = toMs(query.from);
        const to = toMs(query.to);
        const q = query.search ? norm(query.search.trim()) : "";
        let rows = db.orders.filter((o) => {
          if (from !== undefined && o.createdAt < from) return false;
          if (to !== undefined && o.createdAt >= to) return false;
          if (query.status?.length && !query.status.includes(o.status)) return false;
          if (query.fulfilment && o.fulfilment !== query.fulfilment) return false;
          if (query.clientId && o.clientId !== query.clientId) return false;
          if (q) {
            const client = ix.clients.get(o.clientId);
            const hay = norm(`${o.code} ${client ? clientName(client, locale) : ""} ${client?.phone ?? ""}`);
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        const sort = query.sort ?? "created_desc";
        rows = [...rows].sort((a, b) => (sort === "created_asc" ? a.createdAt - b.createdAt : sort === "total_desc" ? 0 : b.createdAt - a.createdAt));
        let resolved = rows.map((o) => resolveOrder(o, ix, locale, now));
        if (sort === "total_desc") resolved = resolved.sort((a, b) => b.totalAZN - a.totalAZN);
        return paginate(resolved, query.page, query.pageSize);
      }),
    getOrder: (id) => run((db, ix, now) => resolveOrder(find(db.orders, id, "Order"), ix, locale, now)),
    updateOrderStatus: (id, status) =>
      run((db, ix, now) => {
        const o = find(db.orders, id, "Order");
        const flow: OrderStatus[] = ["new", "preparing", "ready", o.fulfilment === "petride_courier" ? "delivered" : "picked_up"];
        const from = flow.indexOf(o.status);
        const to = flow.indexOf(status);
        if (from < 0 || to <= from) throw new ApiError("invalid_transition", `Cannot move ${o.status} → ${status}`);
        o.status = status;
        o.updatedAt = now;
        o.history.push({ at: now, status, by: "partner" });
        if (o.fulfilment === "petride_courier" && to >= 2 && !o.courierRideId) {
          const client = ix.clients.get(o.clientId)!;
          db.seq += 1;
          const driver = DRIVERS[db.seq % DRIVERS.length];
          const pickupAt = status === "delivered" ? now - travelMinutes(client.distanceKm) * MINUTE : now + 12 * MINUTE;
          const ride: RideRecord = {
            id: `ride-${db.seq}`,
            direction: "delivery",
            orderId: o.id,
            clientId: o.clientId,
            petIds: [],
            driverId: driver.id,
            from: { label: db.partner.shortName, address: db.partner.address },
            to: { label: { az: "Ev", ru: "Дом", en: "Home" }, address: client.address },
            pickupAt,
            arriveAt: pickupAt + travelMinutes(client.distanceKm) * MINUTE,
            distanceKm: client.distanceKm,
            roundTrip: false,
            priceAZN: o.deliveryFeeAZN,
          };
          db.rides.push(ride);
          o.courierRideId = ride.id;
        }
        if (status === "delivered" && o.courierRideId) {
          const ride = db.rides.find((r) => r.id === o.courierRideId);
          if (ride && ride.arriveAt > now) {
            const length = ride.arriveAt - ride.pickupAt;
            ride.arriveAt = now;
            ride.pickupAt = Math.min(ride.pickupAt, now - length);
          }
        }
        return resolveOrder(o, buildIndex(db), locale, now);
      }),
    cancelOrder: (id, reason) =>
      run((db, ix, now) => {
        const o = find(db.orders, id, "Order");
        if (!["new", "preparing", "ready"].includes(o.status)) throw new ApiError("invalid_transition", `Cannot cancel ${o.status}`);
        o.status = "cancelled";
        o.reason = reason;
        o.updatedAt = now;
        o.history.push({ at: now, status: "cancelled", by: "partner" });
        const ride = o.courierRideId ? db.rides.find((r) => r.id === o.courierRideId) : undefined;
        if (ride && ride.arriveAt > now) ride.cancelledAt = now;
        return resolveOrder(o, ix, locale, now);
      }),

    // ---- Reviews -----------------------------------------------------------------------------------
    listReviews: (query: ReviewQuery = {}) =>
      run((db, ix) => {
        if (isEmpty()) return empty(query.page, query.pageSize);
        const rows = db.reviews
          .filter((r) => !query.rating?.length || query.rating.includes(r.rating))
          .filter((r) => !query.unanswered || !r.reply)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((r) => resolveReview(r, ix, locale));
        return paginate(rows, query.page, query.pageSize);
      }),
    replyToReview: (id, text) =>
      run((db, ix, now) => {
        const r = find(db.reviews, id, "Review");
        if (!text.trim()) throw new ApiError("validation", "Reply is empty");
        r.reply = { text: text.trim(), at: now };
        return resolveReview(r, ix, locale);
      }),

    // ---- Notifications -----------------------------------------------------------------------------
    listNotifications: () =>
      run((db, ix, now) => (isEmpty() ? [] : db.notifications.map((n) => resolveNotification(n, db, ix, locale, now)))),
    markNotificationRead: (id) =>
      run((db) => {
        find(db.notifications, id, "Notification").read = true;
      }),
    markAllNotificationsRead: () =>
      run((db) => {
        for (const n of db.notifications) n.read = true;
      }),

    // ---- Stats -------------------------------------------------------------------------------------
    getOverview: () =>
      run((db, ix, now) => {
        const today0 = new Date(now);
        today0.setHours(0, 0, 0, 0);
        const tomorrow0 = today0.getTime() + DAY;
        const none = isEmpty();
        const vaccineAlerts = none
          ? []
          : db.pets
              .filter((p) => (ix.apptsByPet.get(p.id)?.length ?? 0) > 0 && healthOf(ix.vaccinesByPet.get(p.id) ?? [], now) !== "ok")
              .map((p) => resolvePet(p, ix, locale, now))
              .sort((a, b) => (a.nextAppointment?.start ?? "9999").localeCompare(b.nextAppointment?.start ?? "9999"))
              .slice(0, 8);
        return {
          partner: resolvePartner(statsDb(db), locale),
          kpis: computeKpis(statsDb(db), "7d", now),
          today: none
            ? []
            : db.appointments
                .filter((a) => a.start < tomorrow0 && apptEnd(a) > today0.getTime() && a.status !== "declined" && a.durationMin < 1440 * 2)
                .sort((a, b) => a.start - b.start)
                .map((a) => resolveAppointment(a, ix, locale, now)),
          pending: none
            ? []
            : db.appointments
                .filter((a) => a.status === "requested" && a.start > now)
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((a) => resolveAppointment(a, ix, locale, now)),
          liveRides: none
            ? []
            : db.rides
                .filter((r) => {
                  const s = rideState(r, now);
                  return LIVE_RIDE_STATUSES.includes(s.status) || (s.status === "scheduled" && !r.pendingPartner && r.pickupAt > now && r.pickupAt - now < 3 * HOUR);
                })
                .sort((a, b) => a.arriveAt - b.arriveAt)
                .map((r) => resolveRide(r, ix, locale, now)),
          openOrders: none
            ? []
            : db.orders
                .filter((o) => o.status === "new" || o.status === "preparing" || o.status === "ready")
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((o) => resolveOrder(o, ix, locale, now)),
          vaccineAlerts,
          latestReviews: none
            ? []
            : [...db.reviews]
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5)
                .map((r) => resolveReview(r, ix, locale)),
        };
      }),
    getKpis: (period) => run((db, _ix, now) => computeKpis(statsDb(db), period, now)),
    getDailySeries: (period) => run((db, _ix, now) => computeDaily(statsDb(db), period, now)),
    getRevenueSeries: (period, granularity) => run((db, _ix, now) => computeRevenue(statsDb(db), period, granularity, now)),
    getServiceMix: (period) => run((db, _ix, now) => (isEmpty() ? [] : computeServiceMix(db, period, locale, now))),
    getBusyHours: (period) => run((db, _ix, now) => computeBusyHours(statsDb(db), period, now)),
    getRideShare: (period) => run((db, _ix, now) => computeRideShare(statsDb(db), period, now)),
    getRepeatClients: (period) => run((db, _ix, now) => computeRepeat(statsDb(db), period, now)),
    getRatingStats: (period) => run((db, _ix, now) => computeRating(statsDb(db), period, now)),
  };
  return api;
}

