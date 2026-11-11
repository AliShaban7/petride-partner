/**
 * In-memory records of the mock database. Localisable values stay unresolved (`L`) and times are
 * epoch ms; `./resolve.ts` turns records into API types for one locale at read time (live ride
 * status and ETA are derived from the clock then, so they move while you watch).
 */
import type {
  ActorKind,
  AppointmentSource,
  AppointmentStatus,
  AvatarTint,
  ClientSource,
  Fulfilment,
  ID,
  Locale,
  LocalizedText,
  NotificationKind,
  OrderStatus,
  PetSex,
  PetSize,
  ProductCategory,
  RideDirection,
  ServiceCategory,
  Species,
} from "../types";
import type { PartnerSeed } from "./catalog";

export type L = LocalizedText;
/** User data (plain string, never translated) or a localised mock string. */
export type Text = string | L;

export type PartnerRecord = PartnerSeed;

export type ServiceRecord = {
  id: ID;
  category: Exclude<ServiceCategory, "shop">;
  nameI18n: L;
  descriptionI18n: L;
  durationMin: number;
  priceAZN: number | null;
  priceFrom: boolean;
  species: Species[];
  active: boolean;
  archived: boolean;
  weight: number;
};

export type ProductRecord = {
  id: ID;
  sku: string;
  category: ProductCategory;
  nameI18n: L;
  species: Species[];
  priceAZN: number;
  stock: number;
  lowStockAt: number;
  active: boolean;
  weight: number;
};

export type ClientRecord = {
  id: ID;
  firstName: Text;
  lastName: Text;
  phone: string;
  locale: Locale;
  area: L;
  /** Street address (user data) for rides / deliveries. */
  address: Text;
  /** Road distance to the partner, km. */
  distanceKm: number;
  source: ClientSource;
  createdAt: number;
  partnerNote?: string;
  /** Mock-only: how often this client comes back (seeding). */
  activity: number;
};

export type PetRecord = {
  id: ID;
  code: string;
  ownerId: ID;
  name: string;
  shortName: string;
  species: Species;
  breed: L;
  sex: PetSex;
  birthDate: string;
  weightKg: number;
  size: PetSize;
  tint: AvatarTint;
  photoUrl?: string;
  microchip?: string;
  neutered: boolean;
  travelNotes: L[];
  partnerNote?: string;
};

export type VaccineRecord = {
  id: ID;
  petId: ID;
  name: L;
  dueDate: string;
  doneDate?: string;
  nextDate?: string;
};

export type HistoryRecord<S> = { at: number; status: S; by: ActorKind; note?: string };

export type AppointmentRecord = {
  id: ID;
  code: string;
  serviceId: ID;
  petId: ID;
  clientId: ID;
  start: number;
  durationMin: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  requestId?: ID;
  priceAZN: number | null;
  amountAZN?: number;
  withRide: boolean;
  rideId?: ID;
  returnRideId?: ID;
  clientNote?: L;
  staffNote?: string;
  reason?: Text;
  createdAt: number;
  updatedAt: number;
  history: HistoryRecord<AppointmentStatus>[];
};

export type RidePlaceRecord = { label: Text; address: Text };

export type RideRecord = {
  id: ID;
  direction: RideDirection;
  appointmentId?: ID;
  orderId?: ID;
  clientId: ID;
  petIds: ID[];
  driverId: ID;
  from: RidePlaceRecord;
  to: RidePlaceRecord;
  pickupAt: number;
  arriveAt: number;
  distanceKm: number;
  roundTrip: boolean;
  priceAZN: number;
  driverNote?: L;
  cancelledAt?: number;
  /** Booked but waiting for the partner to accept the appointment (stays `scheduled`). */
  pendingPartner?: boolean;
};

export type OrderItemRecord = { productId: ID; qty: number; unitPriceAZN: number };

export type OrderRecord = {
  id: ID;
  code: string;
  clientId: ID;
  items: OrderItemRecord[];
  deliveryFeeAZN: number;
  status: OrderStatus;
  fulfilment: Fulfilment;
  courierRideId?: ID;
  paymentMethod: "card" | "cash";
  clientNote?: L;
  reason?: Text;
  createdAt: number;
  updatedAt: number;
  history: HistoryRecord<OrderStatus>[];
};

export type ReviewRecord = {
  id: ID;
  clientId: ID;
  petId?: ID;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  serviceId?: ID;
  appointmentId?: ID;
  orderId?: ID;
  createdAt: number;
  reply?: { text: Text; at: number };
};

export type NotificationRecord = {
  id: ID;
  kind: NotificationKind;
  createdAt: number;
  read: boolean;
  appointmentId?: ID;
  orderId?: ID;
  rideId?: ID;
  reviewId?: ID;
  vaccineId?: ID;
};

export type PartnerDb = {
  partner: PartnerRecord;
  services: ServiceRecord[];
  products: ProductRecord[];
  clients: ClientRecord[];
  pets: PetRecord[];
  vaccines: VaccineRecord[];
  appointments: AppointmentRecord[];
  rides: RideRecord[];
  orders: OrderRecord[];
  reviews: ReviewRecord[];
  notifications: NotificationRecord[];
  seq: number;
  seededAt: number;
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Local midnight of the day containing `ms`, shifted by `days` (calendar-safe across DST). */
export function dayStart(ms: number, days = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** `2026-11-14` for a local time. */
export function isoDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local `2026-11-14` → epoch ms of local midnight. */
export function fromIsoDay(value: string): number {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** ISO weekday 1–7 (Mon–Sun) for a local time. */
export function isoWeekday(ms: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = new Date(ms).getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** "09:30" → minutes after midnight. */
export function clockToMin(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** Appointment end. */
export function apptEnd(a: AppointmentRecord): number {
  return a.start + a.durationMin * MINUTE;
}

/** Ride price, same tariff as the app (4 ₼ base + 0,70 ₼/km + 3 ₼ pet assist). */
export function ridePrice(distanceKm: number, petAssist = true): number {
  return Math.round((4 + 0.7 * distanceKm + (petAssist ? 3 : 0)) * 100) / 100;
}

/** Road minutes for a distance in Baku traffic. */
export function travelMinutes(distanceKm: number): number {
  return Math.max(12, Math.round(8 + distanceKm * 1.35));
}
