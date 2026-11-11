/**
 * Deterministic seed for one partner: 90 days of history + 14 days ahead, relative to "now".
 * The same partner always gets the same clients, pets and patterns (seeded PRNG); dates move with
 * the calendar so "today" always has a busy agenda, pending requests and live PetRide rides.
 *
 * Shared with the mobile app's demo seed: Leyla Məmmədova (`user-leyla`) with
 * Bella the Golden Retriever and Kitty Antonelli the tabby (same vaccines), driver Anar Həsənov
 * (Toyota Prius 10-AA-123) and Kitty's past grooming ride `ride-1001` on 4 November.
 */
import type {
  AppointmentSource,
  AppointmentStatus,
  AvatarTint,
  Fulfilment,
  OrderStatus,
  ServiceCategory,
  Species,
} from "../types";
import {
  AREAS,
  AZ_NAMES,
  BREEDS,
  CANCEL_REASONS,
  CLIENT_NOTES,
  DECLINE_REASONS,
  DRIVERS,
  HOME_LABEL,
  IDEA_SERVICES,
  PARTNER_PET_NOTES,
  PARTNERS,
  PET_NAMES,
  REVIEW_REPLIES,
  REVIEW_TEXTS,
  RU_NAMES,
  SHOP_PRODUCTS,
  STREETS,
  TRAVEL_NOTES,
  VACCINES,
  type DemoPartnerId,
  type PartnerSeed,
} from "./catalog";
import {
  DAY,
  HOUR,
  MINUTE,
  apptEnd,
  clockToMin,
  dayStart,
  isoDay,
  isoWeekday,
  ridePrice,
  travelMinutes,
  type AppointmentRecord,
  type ClientRecord,
  type L,
  type NotificationRecord,
  type OrderRecord,
  type PartnerDb,
  type PetRecord,
  type ProductRecord,
  type ReviewRecord,
  type RideRecord,
  type ServiceRecord,
  type VaccineRecord,
} from "./records";
import { createRng, type Rng } from "./rng";

const HISTORY_DAYS = 90;
const AHEAD_DAYS = 14;
const TINTS: AvatarTint[] = ["sage", "coral", "mint", "lilac", "peach", "sand", "sky"];

const l = (az: string, ru: string, en: string): L => ({ az, ru, en });
const round5 = (ms: number) => Math.ceil(ms / (5 * MINUTE)) * 5 * MINUTE;
const money = (n: number) => Math.round(n * 2) / 2;

type Ctx = {
  rng: Rng;
  now: number;
  partner: PartnerSeed;
  db: PartnerDb;
  ids: Record<string, number>;
};

function nextId(ctx: Ctx, prefix: string): string {
  ctx.ids[prefix] = (ctx.ids[prefix] ?? 0) + 1;
  return `${prefix}-${ctx.ids[prefix]}`;
}

// ---- People & pets -----------------------------------------------------------------------------------

/**
 * Obviously fake numbers (+994 50 000 xx xx) so no demo client can dial a real person. The two
 * discarded draws keep the rng sequence (and so every other seeded value) the same as before.
 */
function phone(rng: Rng): string {
  rng.pick(["50", "51", "55", "70", "77", "99", "10"]);
  rng.int(200, 999);
  return `+99450000${String(rng.int(0, 99)).padStart(2, "0")}${String(rng.int(0, 99)).padStart(2, "0")}`;
}

function makeClient(ctx: Ctx): ClientRecord {
  const { rng, partner } = ctx;
  const russian = rng.chance(0.2);
  const female = rng.chance(0.62);
  const pool = russian ? RU_NAMES : AZ_NAMES;
  const firstName = rng.pick(female ? pool.female : pool.male);
  const base = rng.pick(pool.surnames);
  // Female surnames: Məmmədov → Məmmədova / Иванов → Иванова (Cyrillic "а").
  const lastName = female ? `${base}${russian ? "а" : "a"}` : base;
  const area = rng.pick(AREAS);
  const near = area.en.startsWith(partner.id === "idea" ? "Garadagh" : "Narimanov");
  const distanceKm = near ? rng.int(3, 7) : Math.round(rng.around(partner.id === "idea" ? 22 : 9, 6) * 10) / 10;
  const activity = rng.weighted([
    [6, 2],
    [2, 4],
    [0.6, 6],
  ] as const);
  return {
    id: nextId(ctx, "cl"),
    firstName,
    lastName,
    phone: phone(rng),
    locale: russian ? "ru" : rng.chance(0.06) ? "en" : "az",
    area,
    address: `${rng.pick(STREETS)} ${rng.int(1, 140)}`,
    distanceKm: Math.max(2, distanceKm),
    source: rng.weighted([
      ["petride", 7],
      ["phone", 2],
      ["walk_in", 1],
    ] as const),
    createdAt: 0,
    activity,
  };
}

function makePet(ctx: Ctx, owner: ClientRecord, species?: Species): PetRecord {
  const { rng, now } = ctx;
  const kind: Species = species ?? rng.weighted([
    ["dog", 55],
    ["cat", 42],
    ["other", 3],
  ] as const);
  const breed = rng.weighted(BREEDS.filter((b) => b.species === kind).map((b) => [b, b.weight] as const));
  const russian = owner.locale === "ru";
  const names: readonly string[] =
    kind === "dog" ? (russian && rng.chance(0.6) ? PET_NAMES.dogRu : PET_NAMES.dog) : kind === "cat" ? (russian && rng.chance(0.6) ? PET_NAMES.catRu : PET_NAMES.cat) : PET_NAMES.other;
  const name = rng.pick(names);
  const ageMonths = rng.int(4, 150);
  const birth = new Date(now);
  birth.setMonth(birth.getMonth() - ageMonths);
  const [minKg, maxKg] = breed.weightKg;
  const weightKg = Math.round((minKg + rng.next() * (maxKg - minKg)) * 10) / 10;
  const index = ctx.db.pets.length + 1000;
  return {
    id: nextId(ctx, "pet"),
    code: `PR-${index}`,
    ownerId: owner.id,
    name,
    shortName: name,
    species: kind,
    breed: breed.name,
    sex: rng.chance(0.5) ? "f" : "m",
    birthDate: isoDay(birth.getTime()),
    weightKg,
    size: breed.size,
    tint: rng.pick(TINTS),
    microchip: kind !== "other" && rng.chance(0.55) ? `981 0200 ${rng.int(1000, 9999)} •••` : undefined,
    neutered: rng.chance(0.6),
    travelNotes: rng.chance(0.45) ? rng.shuffle(TRAVEL_NOTES).slice(0, rng.int(1, 2)) : [],
    partnerNote: rng.chance(0.08) ? rng.pick(PARTNER_PET_NOTES).az : undefined,
  };
}

/** Yearly / quarterly vaccines with a realistic spread of done, due-soon and overdue. */
function makeVaccines(ctx: Ctx, pet: PetRecord): VaccineRecord[] {
  const { rng, now } = ctx;
  if (pet.species === "other") return [];
  const plan: [L, number][] =
    pet.species === "dog"
      ? [
          [VACCINES.rabies, 12],
          [VACCINES.dhppi, 12],
          [VACCINES.lepto, 12],
          [VACCINES.parasite, 3],
        ]
      : [
          [VACCINES.rabies, 12],
          [VACCINES.fvrcp, 12],
          [VACCINES.parasite, 3],
        ];
  return plan.map(([name, months]) => {
    // Months since the last dose: mostly within the interval, sometimes late.
    const late = rng.chance(0.05);
    const since = late ? months + rng.int(0, 2) + rng.next() : rng.next() * months;
    const done = new Date(now);
    done.setDate(done.getDate() - Math.round(since * 30.4));
    const next = new Date(done);
    next.setMonth(next.getMonth() + months);
    return {
      id: nextId(ctx, "vac"),
      petId: pet.id,
      name,
      dueDate: isoDay(done.getTime()),
      doneDate: isoDay(done.getTime()),
      nextDate: isoDay(next.getTime()),
    };
  });
}

// ---- The app's own people (same ids and facts as the mobile app) --------------------------------

function seedLeyla(ctx: Ctx): { leyla: ClientRecord; bella: PetRecord; kitty: PetRecord } {
  const leyla: ClientRecord = {
    id: "user-leyla",
    firstName: l("Leyla", "Лейла", "Leyla"),
    lastName: l("Məmmədova", "Мамедова", "Mammadova"),
    phone: "+994501234567",
    locale: "az",
    area: l("Nəsimi, Bakı", "Насими, Баку", "Nasimi, Baku"),
    address: l("24 Nizami küç., Nəsimi", "ул. Низами 24, Насими", "24 Nizami St, Nasimi"),
    distanceKm: ctx.partner.id === "idea" ? 22 : 5,
    source: "petride",
    createdAt: 0,
    activity: 0,
  };
  const bella: PetRecord = {
    id: "bella",
    code: "PR-0001",
    ownerId: leyla.id,
    name: "Bella",
    shortName: "Bella",
    species: "dog",
    breed: l("Golden Retriever", "Голден ретривер", "Golden Retriever"),
    sex: "f",
    birthDate: "2023-06-18",
    weightKg: 24,
    size: "large",
    tint: "coral",
    microchip: "981 0200 4471 •••",
    neutered: true,
    travelNotes: [TRAVEL_NOTES[0], TRAVEL_NOTES[1]],
  };
  const kitty: PetRecord = {
    id: "kitty",
    code: "PR-0002",
    ownerId: leyla.id,
    name: "Kitty Antonelli",
    shortName: "Kitty",
    species: "cat",
    breed: l("zolaqlı (tabby)", "полосатый (табби)", "tabby"),
    sex: "m",
    birthDate: "2025-09-02",
    weightKg: 3.5,
    size: "small",
    tint: "sage",
    neutered: true,
    travelNotes: [TRAVEL_NOTES[1], TRAVEL_NOTES[2]],
  };
  ctx.db.clients.push(leyla);
  ctx.db.pets.push(bella, kitty);
  // Health.dc.html — Bella (rabies due 14 Nov, lepto overdue since 30 Oct); Kitty up to date.
  ctx.db.vaccines.push(
    { id: "vac-bella-rabies", petId: "bella", name: VACCINES.rabies, dueDate: "2026-11-14" },
    { id: "vac-bella-lepto", petId: "bella", name: VACCINES.lepto, dueDate: "2026-10-30" },
    { id: "vac-bella-dhppi", petId: "bella", name: VACCINES.dhppi, dueDate: "2026-03-02", doneDate: "2026-03-02", nextDate: "2027-03-02" },
    { id: "vac-bella-parasite", petId: "bella", name: VACCINES.parasite, dueDate: "2026-09-20", doneDate: "2026-09-20", nextDate: "2026-12-20" },
    { id: "vac-kitty-rabies", petId: "kitty", name: VACCINES.rabies, dueDate: "2026-05-12", doneDate: "2026-05-12", nextDate: "2027-05-12" },
    { id: "vac-kitty-fvrcp", petId: "kitty", name: VACCINES.fvrcp, dueDate: "2026-05-12", doneDate: "2026-05-12", nextDate: "2027-05-12" },
  );
  return { leyla, bella, kitty };
}

// ---- Appointments ------------------------------------------------------------------------------------

type ApptInput = {
  service: ServiceRecord;
  petId: string;
  clientId: string;
  start: number;
  durationMin?: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  createdAt: number;
  withRide?: boolean;
  roundTrip?: boolean;
  /** Override ride timing (ms): pickup / arrive of the ride in. */
  rideIn?: { pickupAt: number; arriveAt: number; driverId?: string; id?: string };
  rideBack?: { pickupAt: number; arriveAt: number; driverId?: string };
  amountAZN?: number;
  id?: string;
  clientNote?: L;
  reason?: L;
};

function partnerPlace(partner: PartnerSeed) {
  return { label: partner.shortName, address: partner.address };
}

function addAppointment(ctx: Ctx, input: ApptInput): AppointmentRecord {
  const { db, rng, now, partner } = ctx;
  const client = db.clients.find((c) => c.id === input.clientId)!;
  const durationMin = input.durationMin ?? input.service.durationMin;
  const id = input.id ?? nextId(ctx, "apt");
  const appt: AppointmentRecord = {
    id,
    code: "",
    serviceId: input.service.id,
    petId: input.petId,
    clientId: input.clientId,
    start: input.start,
    durationMin,
    status: input.status,
    source: input.source,
    requestId: input.source === "app" ? `req-${id.replace(/^apt-/, "")}` : undefined,
    priceAZN: input.service.priceAZN,
    withRide: Boolean(input.withRide),
    clientNote: input.clientNote,
    reason: input.reason,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    history: [],
  };
  const end = apptEnd(appt);

  // History
  const push = (at: number, status: AppointmentStatus, by: "partner" | "client" | "system") => {
    appt.history.push({ at: Math.min(at, now), status, by });
    appt.updatedAt = Math.max(appt.updatedAt, Math.min(at, now));
  };
  if (input.source === "app") push(input.createdAt, "requested", "client");
  const confirmedAt = input.source === "app" ? input.createdAt + rng.int(4, 45) * MINUTE : input.createdAt;
  if (input.status === "declined") push(confirmedAt, "declined", "partner");
  if (["confirmed", "checked_in", "completed", "no_show"].includes(input.status) || (input.status === "cancelled" && input.source !== "app")) {
    push(confirmedAt, "confirmed", "partner");
  }
  if (input.status === "cancelled") {
    const by = rng.chance(0.8) ? "client" : "partner";
    // Past bookings: cancelled a few hours before the start. Future ones: some time since booking.
    const cancelAt =
      input.start > now
        ? input.createdAt + rng.next() * Math.max(0, now - input.createdAt)
        : Math.max(input.createdAt, input.start - rng.int(1, 30) * HOUR);
    push(cancelAt, "cancelled", by);
    appt.reason = appt.reason ?? rng.pick(CANCEL_REASONS);
  }
  if (input.status === "checked_in" || input.status === "completed") push(input.start - rng.int(-5, 8) * MINUTE, "checked_in", "partner");
  if (input.status === "completed") push(end + rng.int(0, 10) * MINUTE, "completed", "partner");
  if (input.status === "no_show") push(input.start + 30 * MINUTE, "no_show", "partner");
  if (input.status === "declined") appt.reason = appt.reason ?? rng.pick(DECLINE_REASONS);

  // Amount charged
  if (input.status === "completed") {
    if (input.amountAZN !== undefined) appt.amountAZN = input.amountAZN;
    else {
      const pet = db.pets.find((p) => p.id === input.petId)!;
      const base = input.service.priceAZN ?? 20;
      const sizeFactor = input.service.category === "groom" ? { small: 1, medium: 1.2, large: 1.45 }[pet.size] : 1;
      const nights = input.service.category === "hotel" && durationMin >= 1440 ? durationMin / 1440 : 1;
      const extra = input.service.category === "vet" && rng.chance(0.35) ? rng.int(8, 45) : 0;
      appt.amountAZN = money(base * sizeFactor * nights + extra);
    }
  }

  // PetRide rides
  if (appt.withRide && partner.acceptsRides) {
    const travel = travelMinutes(client.distanceKm);
    const cancelledAt = appt.history.find((h) => h.status === "cancelled" || h.status === "declined")?.at;
    const home = { label: HOME_LABEL, address: client.address };
    const pets = [input.petId];
    const inTiming = input.rideIn ?? {
      pickupAt: input.start - (travel + rng.int(6, 14)) * MINUTE,
      arriveAt: input.start - rng.int(2, 8) * MINUTE,
    };
    const rideIn: RideRecord = {
      id: input.rideIn?.id ?? nextId(ctx, "ride"),
      direction: "to_partner",
      appointmentId: appt.id,
      clientId: client.id,
      petIds: pets,
      driverId: input.rideIn?.driverId ?? rng.pick(DRIVERS).id,
      from: home,
      to: partnerPlace(partner),
      pickupAt: inTiming.pickupAt,
      arriveAt: inTiming.arriveAt,
      distanceKm: client.distanceKm,
      roundTrip: Boolean(input.roundTrip),
      priceAZN: ridePrice(client.distanceKm),
      cancelledAt,
      pendingPartner: input.status === "requested",
    };
    db.rides.push(rideIn);
    appt.rideId = rideIn.id;
    if (input.roundTrip) {
      const backTiming = input.rideBack ?? {
        pickupAt: end + rng.int(5, 20) * MINUTE,
        arriveAt: end + (travel + rng.int(10, 25)) * MINUTE,
      };
      const rideBack: RideRecord = {
        ...rideIn,
        id: nextId(ctx, "ride"),
        direction: "from_partner",
        driverId: input.rideBack?.driverId ?? rng.pick(DRIVERS).id,
        from: partnerPlace(partner),
        to: home,
        pickupAt: backTiming.pickupAt,
        arriveAt: backTiming.arriveAt,
        cancelledAt: cancelledAt ?? (input.status === "no_show" ? end : undefined),
      };
      db.rides.push(rideBack);
      appt.returnRideId = rideBack.id;
    }
  }
  db.appointments.push(appt);
  return appt;
}

function pickWeighted<T extends { activity: number }>(rng: Rng, items: T[]): T {
  return rng.weighted(items.map((c) => [c, c.activity] as const));
}

function seedClinic(ctx: Ctx) {
  const { rng, now, db, partner } = ctx;
  const services: ServiceRecord[] = IDEA_SERVICES.map((s) => ({
    id: s.id,
    category: s.category,
    nameI18n: s.name,
    descriptionI18n: s.description,
    durationMin: s.durationMin,
    priceAZN: s.priceAZN,
    priceFrom: s.priceFrom,
    species: s.species,
    active: true,
    archived: false,
    weight: s.weight,
  }));
  db.services = services;
  const byId = (id: string) => services.find((s) => s.id === id)!;

  const { leyla, bella, kitty } = seedLeyla(ctx);
  for (let i = 0; i < 420; i += 1) {
    const client = makeClient(ctx);
    db.clients.push(client);
    const petCount = rng.weighted([
      [1, 70],
      [2, 24],
      [3, 6],
    ] as const);
    for (let p = 0; p < petCount; p += 1) {
      const pet = makePet(ctx, client);
      db.pets.push(pet);
      db.vaccines.push(...makeVaccines(ctx, pet));
    }
  }
  const generated = db.clients.filter((c) => c.activity > 0);
  const petsOf = new Map<string, PetRecord[]>();
  for (const pet of db.pets) petsOf.set(pet.ownerId, [...(petsOf.get(pet.ownerId) ?? []), pet]);

  const today0 = dayStart(now);
  const categoryWeights: [Exclude<ServiceCategory, "shop">, number][] = [
    ["vet", 6],
    ["groom", 3.2],
    ["hotel", 1],
  ];

  for (let d = -HISTORY_DAYS; d <= AHEAD_DAYS; d += 1) {
    const day0 = dayStart(now, d);
    const weekday = isoWeekday(day0);
    const hours = partner.hours.find((h) => h.day === weekday);
    if (!hours?.open) continue;
    const open = day0 + clockToMin(hours.from) * MINUTE;
    const close = day0 + clockToMin(hours.to) * MINUTE;
    const trend = 0.78 + 0.32 * ((d + HISTORY_DAYS) / HISTORY_DAYS);
    const weekend = weekday >= 6 ? 0.85 : 1;
    const ahead = d > 0 ? Math.max(0.12, 0.82 - d * 0.055) : 1;
    const count = Math.max(1, Math.round(rng.around(13, 4) * trend * weekend * ahead));

    for (let i = 0; i < count; i += 1) {
      const category = rng.weighted(categoryWeights);
      const client = pickWeighted(rng, generated);
      const pets = (petsOf.get(client.id) ?? []).filter((p) => category === "vet" || p.species !== "other");
      if (!pets.length) continue;
      const pet = rng.pick(pets);
      const service = rng.weighted(services.filter((s) => s.category === category).map((s) => [s, s.weight] as const));
      let durationMin = service.durationMin;
      if (service.id === "off-groom-full" && pet.size === "small") durationMin = 90;
      if (service.id === "off-hotel-night") durationMin = 1440 * rng.int(1, 5);

      // Start time on a 15-minute grid inside opening hours.
      const latest = service.category === "hotel" ? open + 3 * HOUR : close - Math.min(durationMin, 180) * MINUTE;
      const slots = Math.max(1, Math.floor((latest - open) / (15 * MINUTE)));
      const start = open + rng.int(0, slots - 1) * 15 * MINUTE;
      const end = start + durationMin * MINUTE;

      const source = rng.weighted([
        ["app", client.source === "petride" ? 8 : 3],
        ["phone", 2],
        ["walk_in", start < now ? 1 : 0],
      ] as const);
      let status: AppointmentStatus;
      if (end <= now) {
        status = rng.weighted([
          ["completed", 84],
          ["no_show", 3.5],
          ["cancelled", 8],
          [source === "app" ? "declined" : "cancelled", 4.5],
        ] as const);
      } else if (start <= now) {
        status = "checked_in";
      } else if (d === 0) {
        status = source === "app" && rng.chance(0.14) ? "requested" : "confirmed";
      } else {
        status = rng.weighted([
          [source === "app" ? "requested" : "confirmed", 4 + d * 0.6],
          ["confirmed", 74],
          ["cancelled", 6],
        ] as const);
      }
      const createdAt =
        status === "requested"
          ? now - rng.int(10, 26 * 60) * MINUTE
          : source === "walk_in"
            ? start - rng.int(0, 20) * MINUTE
            : Math.min(start - rng.int(2, 9 * 24) * HOUR, now - rng.int(30, 300) * MINUTE);
      const withRide = source === "app" && status !== "no_show" && rng.chance(0.4);
      addAppointment(ctx, {
        service,
        petId: pet.id,
        clientId: client.id,
        start,
        durationMin,
        status,
        source,
        createdAt,
        withRide,
        roundTrip: withRide && rng.chance(0.55),
        clientNote: source === "app" && rng.chance(0.2) ? rng.pick(CLIENT_NOTES) : undefined,
      });
    }
  }

  // ---- Leyla's story (app seed) -------------------------------------------------------------------
  // Parasite control done 20 Sep (Health.dc.html v4d) — a vet visit.
  const sep20 = new Date(2026, 8, 20, 11, 0).getTime();
  if (sep20 < now) {
    addAppointment(ctx, {
      service: byId("off-vet-vaccine"),
      petId: bella.id,
      clientId: leyla.id,
      start: sep20,
      status: "completed",
      source: "app",
      createdAt: sep20 - 3 * DAY,
      amountAZN: 35,
    });
  }
  // Kitty's grooming ride `ride-1001` on 4 Nov: picked up 10:02, at IDEA 10:41 (app db.ts).
  const nov4 = new Date(2026, 10, 4, 10, 45).getTime();
  if (nov4 < now) {
    addAppointment(ctx, {
      service: byId("off-groom-wash"),
      petId: kitty.id,
      clientId: leyla.id,
      start: nov4,
      status: "completed",
      source: "app",
      createdAt: nov4 - 2 * DAY,
      withRide: true,
      roundTrip: false,
      rideIn: { id: "ride-1001", pickupAt: new Date(2026, 10, 4, 10, 2).getTime(), arriveAt: new Date(2026, 10, 4, 10, 41).getTime(), driverId: "driver-anar" },
      amountAZN: 40,
    });
  }

  // ---- Live right now (relative to "now", so the demo is alive at any time) -----------------------
  // Bella rides to IDEA with Anar for her rabies shot: in the car, ~24 min away (app LiveTrip seed).
  const bellaStart = round5(now + 26 * MINUTE);
  addAppointment(ctx, {
    id: "apt-bella-vaccine",
    service: byId("off-vet-vaccine"),
    petId: bella.id,
    clientId: leyla.id,
    start: bellaStart,
    status: "confirmed",
    source: "app",
    createdAt: now - 26 * HOUR,
    withRide: true,
    roundTrip: true,
    rideIn: { pickupAt: now - 13 * MINUTE, arriveAt: now + 24 * MINUTE, driverId: "driver-anar" },
    clientNote: l("Quduzluq peyvəndi vaxtıdır. Maşında bir az narahat olur.", "Пора на прививку от бешенства. В машине немного нервничает.", "Rabies shot is due. A bit anxious in the car."),
  });
  // Bella's full grooming on Saturday 14 Nov 11:00 (app ServiceDetail seed) — waiting for an answer.
  let groomAt = new Date(2026, 10, 14, 11, 0).getTime();
  while (groomAt < now + 2 * HOUR) groomAt += 7 * DAY;
  addAppointment(ctx, {
    id: "apt-bella-groom",
    service: byId("off-groom-full"),
    petId: bella.id,
    clientId: leyla.id,
    start: groomAt,
    status: "requested",
    source: "app",
    createdAt: now - 47 * MINUTE,
    withRide: true,
    roundTrip: true,
  });

  const live = rng.shuffle(generated.filter((c) => (petsOf.get(c.id) ?? []).some((p) => p.species !== "other"))).slice(0, 6);
  const petFor = (c: ClientRecord) => (petsOf.get(c.id) ?? []).find((p) => p.species !== "other")!;
  // Driver on the way to pick a pet up for grooming.
  addAppointment(ctx, {
    service: byId("off-groom-wash"),
    petId: petFor(live[0]).id,
    clientId: live[0].id,
    start: round5(now + 55 * MINUTE),
    status: "confirmed",
    source: "app",
    createdAt: now - 20 * HOUR,
    withRide: true,
    rideIn: { pickupAt: now + 9 * MINUTE, arriveAt: now + 50 * MINUTE, driverId: "driver-rashad" },
  });
  // Driver at the client's door.
  addAppointment(ctx, {
    service: byId("off-vet-check"),
    petId: petFor(live[1]).id,
    clientId: live[1].id,
    start: round5(now + 40 * MINUTE),
    status: "confirmed",
    source: "app",
    createdAt: now - 5 * HOUR,
    withRide: true,
    rideIn: { pickupAt: now + 1 * MINUTE, arriveAt: now + 36 * MINUTE, driverId: "driver-tural" },
  });
  // Going home after grooming.
  addAppointment(ctx, {
    service: byId("off-groom-full"),
    petId: petFor(live[2]).id,
    clientId: live[2].id,
    start: round5(now - 135 * MINUTE),
    durationMin: 120,
    status: "completed",
    source: "app",
    createdAt: now - 3 * DAY,
    withRide: true,
    roundTrip: true,
    rideIn: { pickupAt: now - 190 * MINUTE, arriveAt: now - 140 * MINUTE },
    rideBack: { pickupAt: now - 7 * MINUTE, arriveAt: now + 27 * MINUTE, driverId: "driver-elvin" },
  });
  // Booked for later today — no driver yet.
  addAppointment(ctx, {
    service: byId("off-vet-check"),
    petId: petFor(live[3]).id,
    clientId: live[3].id,
    start: round5(now + 2 * HOUR + 10 * MINUTE),
    status: "confirmed",
    source: "app",
    createdAt: now - 30 * HOUR,
    withRide: true,
    roundTrip: true,
  });
  // Fresh requests waiting for "Accept".
  for (const [i, minutesAgo, inHours] of [
    [4, 12, 22],
    [5, 95, 46],
  ] as const) {
    addAppointment(ctx, {
      service: rng.pick(services.filter((s) => s.category !== "hotel")),
      petId: petFor(live[i]).id,
      clientId: live[i].id,
      start: round5(dayStart(now + inHours * HOUR) + 11 * HOUR + rng.int(0, 12) * 30 * MINUTE),
      status: "requested",
      source: "app",
      createdAt: now - minutesAgo * MINUTE,
      withRide: i === 4,
      clientNote: rng.pick(CLIENT_NOTES),
    });
  }

  // Codes in chronological order; client "since" = first visit.
  db.appointments.sort((a, b) => a.start - b.start);
  db.appointments.forEach((a, i) => (a.code = `A-${1001 + i}`));
  for (const client of db.clients) {
    const first = db.appointments.find((a) => a.clientId === client.id);
    client.createdAt = first ? Math.min(first.createdAt, first.start) : today0 - rng.int(1, 120) * DAY;
  }

  seedReviewsForAppointments(ctx);
}

// ---- Shop ---------------------------------------------------------------------------------------------

function seedShop(ctx: Ctx) {
  const { rng, now, db, partner } = ctx;
  db.products = SHOP_PRODUCTS.map((p, i): ProductRecord => ({
    id: p.id,
    sku: `PP-${String(1001 + i)}`,
    category: p.category,
    nameI18n: p.name,
    species: p.species,
    priceAZN: p.priceAZN,
    stock: rng.chance(0.12) ? rng.int(0, 3) : rng.int(6, 64),
    lowStockAt: 5,
    active: true,
    weight: p.weight,
  }));
  const { leyla } = seedLeyla(ctx);
  for (let i = 0; i < 300; i += 1) {
    const client = makeClient(ctx);
    db.clients.push(client);
    const petCount = rng.weighted([
      [1, 75],
      [2, 25],
    ] as const);
    for (let p = 0; p < petCount; p += 1) {
      const pet = makePet(ctx, client);
      db.pets.push(pet);
      db.vaccines.push(...makeVaccines(ctx, pet));
    }
  }
  const generated = db.clients.filter((c) => c.activity > 0);
  const speciesOf = new Map<string, Species[]>();
  for (const pet of db.pets) speciesOf.set(pet.ownerId, [...(speciesOf.get(pet.ownerId) ?? []), pet.species]);

  const addOrder = (input: {
    clientId: string;
    createdAt: number;
    status: OrderStatus;
    fulfilment: Fulfilment;
    items?: { productId: string; qty: number }[];
  }): OrderRecord => {
    const client = db.clients.find((c) => c.id === input.clientId)!;
    const own = (speciesOf.get(client.id) ?? []).filter((s) => s !== "other");
    const species: Species[] = own.length ? own : ["dog", "cat"];
    const items =
      input.items ??
      rng
        .shuffle(db.products.filter((p) => p.species.some((s) => species.includes(s))))
        .slice(0, rng.weighted([
          [1, 4],
          [2, 4],
          [3, 2],
          [4, 1],
        ] as const))
        .map((p) => ({ productId: p.id, qty: p.priceAZN < 5 ? rng.int(2, 12) : rng.int(1, 2) }));
    const order: OrderRecord = {
      id: nextId(ctx, "ord"),
      code: "",
      clientId: client.id,
      items: items.map((it) => ({ ...it, unitPriceAZN: db.products.find((p) => p.id === it.productId)!.priceAZN })),
      deliveryFeeAZN: input.fulfilment === "petride_courier" ? ridePrice(client.distanceKm, false) : 0,
      status: input.status,
      fulfilment: input.fulfilment,
      paymentMethod: rng.chance(0.7) ? "card" : "cash",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      history: [{ at: input.createdAt, status: "new", by: "client" }],
      clientNote: rng.chance(0.12) ? l("Zəng etmədən qapıya qoyun.", "Оставьте у двери, без звонка.", "Leave it at the door, no need to call.") : undefined,
    };
    const steps: OrderStatus[] = ["preparing", "ready", input.fulfilment === "petride_courier" ? "delivered" : "picked_up"];
    const reached = input.status === "cancelled" ? 0 : steps.indexOf(input.status) + 1;
    let t = input.createdAt;
    for (let s = 0; s < reached; s += 1) {
      t += (s === 0 ? rng.int(3, 15) : s === 1 ? rng.int(15, 45) : rng.int(20, 90)) * MINUTE;
      order.history.push({ at: Math.min(t, now), status: steps[s], by: "partner" });
      order.updatedAt = Math.min(t, now);
    }
    if (input.status === "cancelled") {
      const at = Math.min(input.createdAt + rng.int(5, 60) * MINUTE, now);
      order.history.push({ at, status: "cancelled", by: rng.chance(0.7) ? "client" : "partner" });
      order.updatedAt = at;
      order.reason = rng.pick(CANCEL_REASONS);
    }
    // Courier ride once the order is ready.
    const readyAt = order.history.find((h) => h.status === "ready")?.at;
    if (input.fulfilment === "petride_courier" && readyAt !== undefined) {
      const pickupAt = readyAt + rng.int(8, 20) * MINUTE;
      const ride: RideRecord = {
        id: nextId(ctx, "ride"),
        direction: "delivery",
        orderId: order.id,
        clientId: client.id,
        petIds: [],
        driverId: rng.pick(DRIVERS).id,
        from: { label: partner.shortName, address: partner.address },
        to: { label: HOME_LABEL, address: client.address },
        pickupAt,
        arriveAt: pickupAt + travelMinutes(client.distanceKm) * MINUTE,
        distanceKm: client.distanceKm,
        roundTrip: false,
        priceAZN: order.deliveryFeeAZN,
      };
      db.rides.push(ride);
      order.courierRideId = ride.id;
      if (input.status === "delivered") {
        order.history[order.history.length - 1].at = Math.min(ride.arriveAt, now);
        order.updatedAt = Math.min(ride.arriveAt, now);
      }
    }
    db.orders.push(order);
    return order;
  };

  for (let d = -HISTORY_DAYS; d <= 0; d += 1) {
    const day0 = dayStart(now, d);
    const weekday = isoWeekday(day0);
    const hours = partner.hours.find((h) => h.day === weekday);
    if (!hours?.open) continue;
    const open = day0 + clockToMin(hours.from) * MINUTE;
    const close = day0 + clockToMin(hours.to) * MINUTE;
    const trend = 0.8 + 0.3 * ((d + HISTORY_DAYS) / HISTORY_DAYS);
    const count = Math.max(2, Math.round(rng.around(weekday >= 6 ? 12 : 9, 4) * trend));
    for (let i = 0; i < count; i += 1) {
      const createdAt = open + Math.floor(rng.next() * (close - open - 30 * MINUTE));
      if (createdAt > now - 10 * MINUTE) continue;
      const age = now - createdAt;
      const fulfilment: Fulfilment = rng.chance(0.45) ? "petride_courier" : "pickup";
      const done: OrderStatus = fulfilment === "petride_courier" ? "delivered" : "picked_up";
      const status: OrderStatus =
        age < 25 * MINUTE ? "new" : age < 70 * MINUTE ? "preparing" : age < 150 * MINUTE ? (rng.chance(0.6) ? "ready" : done) : rng.chance(0.08) ? "cancelled" : done;
      addOrder({ clientId: pickWeighted(rng, generated).id, createdAt, status, fulfilment });
    }
  }
  // Leyla orders for Kitty and Bella (courier) — a past one and a brand-new one.
  addOrder({
    clientId: leyla.id,
    createdAt: now - 16 * DAY,
    status: "delivered",
    fulfilment: "petride_courier",
    items: [
      { productId: "p-cat-dry-2", qty: 1 },
      { productId: "p-litter", qty: 2 },
    ],
  });
  addOrder({
    clientId: leyla.id,
    createdAt: now - 6 * MINUTE,
    status: "new",
    fulfilment: "petride_courier",
    items: [
      { productId: "p-cat-sterile", qty: 1 },
      { productId: "p-treat-cat", qty: 2 },
      { productId: "p-treat-dog", qty: 1 },
    ],
  });
  // A couple of fresh orders so "new" always has something.
  for (const minutesAgo of [3, 14, 31]) {
    addOrder({ clientId: pickWeighted(rng, generated).id, createdAt: now - minutesAgo * MINUTE, status: minutesAgo > 25 ? "preparing" : "new", fulfilment: rng.chance(0.5) ? "petride_courier" : "pickup" });
  }

  db.orders.sort((a, b) => a.createdAt - b.createdAt);
  db.orders.forEach((o, i) => (o.code = `S-${2001 + i}`));
  for (const client of db.clients) {
    const first = db.orders.find((o) => o.clientId === client.id);
    client.createdAt = first ? first.createdAt : dayStart(now, -rng.int(1, 120));
  }

  // Reviews for delivered orders
  for (const order of db.orders) {
    if ((order.status !== "delivered" && order.status !== "picked_up") || !rng.chance(0.1)) continue;
    addReview(ctx, { clientId: order.clientId, orderId: order.id, after: order.updatedAt });
  }
}

// ---- Reviews & notifications ----------------------------------------------------------------------

function addReview(ctx: Ctx, input: { clientId: string; after: number; appointmentId?: string; orderId?: string; serviceId?: string; petId?: string }) {
  const { rng, now, db } = ctx;
  const at = input.after + rng.int(1, 30) * HOUR;
  if (at > now) return;
  const client = db.clients.find((c) => c.id === input.clientId)!;
  const rating = rng.weighted([
    [5, 68],
    [4, 22],
    [3, 6],
    [2, 3],
    [1, 1],
  ] as const);
  const lang: "az" | "ru" = client.locale === "ru" ? "ru" : "az";
  const bucket = rating >= 5 ? "great" : rating >= 3 ? "ok" : "bad";
  const pool = rating === 4 && rng.chance(0.5) ? REVIEW_TEXTS[lang].great : REVIEW_TEXTS[lang][bucket];
  const review: ReviewRecord = {
    id: nextId(ctx, "rev"),
    clientId: client.id,
    petId: input.petId,
    rating,
    text: rng.pick(pool),
    serviceId: input.serviceId,
    appointmentId: input.appointmentId,
    orderId: input.orderId,
    createdAt: at,
  };
  if (at < now - 2 * DAY && rng.chance(0.6)) {
    review.reply = { text: rating >= 4 ? REVIEW_REPLIES[0] : REVIEW_REPLIES[1], at: at + rng.int(2, 20) * HOUR };
  }
  db.reviews.push(review);
}

function seedReviewsForAppointments(ctx: Ctx) {
  const { rng, db } = ctx;
  for (const appt of db.appointments) {
    if (appt.status !== "completed" || !rng.chance(0.16)) continue;
    addReview(ctx, {
      clientId: appt.clientId,
      appointmentId: appt.id,
      serviceId: appt.serviceId,
      petId: appt.petId,
      after: apptEnd(appt),
    });
  }
}

function seedNotifications(ctx: Ctx) {
  const { db, now } = ctx;
  const out: NotificationRecord[] = [];
  const add = (n: Omit<NotificationRecord, "id" | "read">) =>
    out.push({ ...n, id: nextId(ctx, "ntf"), read: n.createdAt < now - 3 * HOUR });

  for (const a of db.appointments) {
    if (a.status === "requested" && a.createdAt > now - 30 * HOUR) add({ kind: "new_request", createdAt: a.createdAt, appointmentId: a.id });
  }
  const cancellations = db.appointments
    .map((a) => ({ a, h: a.history.find((h) => h.status === "cancelled" && h.by === "client") }))
    .filter((x) => x.h && x.h.at > now - DAY && x.h.at < now - 5 * MINUTE)
    .sort((x, y) => y.h!.at - x.h!.at)
    .slice(0, 2);
  for (const { a, h } of cancellations) add({ kind: "request_cancelled", createdAt: h!.at, appointmentId: a.id });
  for (const r of db.rides) {
    if (r.cancelledAt || r.direction !== "to_partner") continue;
    if (r.pickupAt <= now && r.arriveAt > now) add({ kind: "ride_arriving", createdAt: r.pickupAt, rideId: r.id, appointmentId: r.appointmentId });
    else if (r.pickupAt > now && r.pickupAt - now < 20 * MINUTE) add({ kind: "ride_onway", createdAt: now - 4 * MINUTE, rideId: r.id, appointmentId: r.appointmentId });
  }
  for (const o of db.orders) {
    if (o.status === "new") add({ kind: "new_order", createdAt: o.createdAt, orderId: o.id });
    if (o.status === "cancelled" && o.updatedAt > now - DAY) add({ kind: "order_cancelled", createdAt: o.updatedAt, orderId: o.id });
  }
  for (const r of [...db.reviews].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)) {
    add({ kind: "new_review", createdAt: r.createdAt, reviewId: r.id });
  }
  const rabies = db.vaccines.find((v) => v.id === "vac-bella-rabies");
  if (rabies && db.partner.categories.includes("vet")) add({ kind: "vaccine_due", createdAt: dayStart(now) + 9 * HOUR, vaccineId: rabies.id });

  db.notifications = out.filter((n) => n.createdAt <= now).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
}

// ---- Entry -------------------------------------------------------------------------------------------

export function seedPartner(partnerId: DemoPartnerId, now: number = Date.now()): PartnerDb {
  const partner: PartnerSeed = structuredClone(PARTNERS[partnerId]);
  const db: PartnerDb = {
    partner,
    services: [],
    products: [],
    clients: [],
    pets: [],
    vaccines: [],
    appointments: [],
    rides: [],
    orders: [],
    reviews: [],
    notifications: [],
    seq: 0,
    seededAt: now,
  };
  const ctx: Ctx = { rng: createRng(`petride-partner-${partnerId}-v1`), now, partner, db, ids: {} };
  if (partner.categories.includes("shop")) seedShop(ctx);
  else seedClinic(ctx);
  seedNotifications(ctx);
  db.seq = Object.values(ctx.ids).reduce((a, b) => a + b, 0) + 1000;
  return db;
}
