/**
 * PetRide Partner API contract — the data a partner (vet clinic, grooming salon, pet hotel,
 * pet shop) sees about requests coming from the PetRide app.
 *
 * Mirrors the mobile app's API contract where the two meet:
 *  - an app `ServiceRequest` (pending/confirmed/declined/cancelled) becomes a partner `Appointment`
 *    with a richer lifecycle (see `toServiceRequestStatus`);
 *  - app `RideStatus` (searching/onway/arrived/intrip/completed/cancelled) is reused for PetRide rides,
 *    plus `scheduled` for rides booked ahead that have no driver yet.
 *
 * Localised text: like the app API, every method returns strings already resolved for the
 * locale the client was created with (`createPartnerApi({ locale })`). Names of people and pets are
 * user data and never translated. Editable multilingual fields also come as `*I18n` objects.
 *
 * Money is in manat (AZN) as plain numbers; format with `formatMoney`. Dates are ISO 8601 strings.
 */
import type { Locale } from "@/lib/i18n/config";

export type { Locale };
export type ID = string;
/** ISO 8601 date (`2026-11-14`) or date-time (`2026-11-14T09:45:00.000Z`). */
export type ISODate = string;
/** `HH:MM`, 24-hour. */
export type ClockTime = string;
/** Text in all three UI languages (editable by the partner). */
export type LocalizedText = Record<Locale, string>;

// ---- Partner -------------------------------------------------------------------------------------

/** What kind of business the partner is. Drives navigation order and visible sections. */
export type PartnerKind = "clinic" | "salon" | "hotel" | "petshop";
/** Service lines a partner offers. `vet`/`groom`/`hotel` create appointments; `shop` creates orders. */
export type ServiceCategory = "vet" | "groom" | "hotel" | "shop";

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type OpeningHoursDay = {
  day: IsoWeekday;
  open: boolean;
  from: ClockTime;
  to: ClockTime;
};

export type PartnerProfile = {
  id: ID;
  kind: PartnerKind;
  /** Brand name, e.g. "IDEA Animal Care Center". */
  name: string;
  /** Short name for tight UI, e.g. "IDEA". */
  shortName: string;
  /** Listing title in the app, e.g. "IDEA · Baytar klinikası". */
  title: string;
  categories: ServiceCategory[];
  address: string;
  /** Short place line, e.g. "Qaradağ · ~22 km". */
  area: string;
  /** E.164, e.g. +994125656655. */
  phone: string;
  email: string;
  lat: number;
  lng: number;
  /**
   * Opening hours as the partner set them. For IDEA the real hours are unknown: the mock ships
   * editable defaults with `hoursConfirmed: false`, and the UI asks the partner to confirm them.
   */
  hours: OpeningHoursDay[];
  hoursConfirmed: boolean;
  /** Accepts PetRide rides (drop-off / pick-up at the door). */
  acceptsRides: boolean;
  /** Offers delivery by PetRide courier (pet shops). */
  offersCourierDelivery: boolean;
  /** Auto-confirm app requests that fit the hours (otherwise each request waits for "Accept"). */
  autoConfirm: boolean;
  /** Minutes the partner has to answer a request before the app tells the client to try later. */
  responseWindowMin: number;
  rating: number;
  reviewsCount: number;
  /** Demo partner (not a real business). */
  isDemo: boolean;
  /** Feature switches derived from `categories` (navigation uses these). */
  features: { appointments: boolean; orders: boolean; rides: boolean };
};

export type PartnerProfilePatch = Partial<
  Pick<PartnerProfile, "phone" | "email" | "acceptsRides" | "offersCourierDelivery" | "autoConfirm" | "responseWindowMin">
> & { hours?: OpeningHoursDay[] };

// ---- Services & products ---------------------------------------------------------------------------

export type Species = "dog" | "cat" | "other";

export type Service = {
  id: ID;
  category: Exclude<ServiceCategory, "shop">;
  name: string;
  nameI18n: LocalizedText;
  description: string;
  descriptionI18n: LocalizedText;
  durationMin: number;
  /**
   * Price set by the partner. `null` = not set yet → the app shows "Priced on site" (qiymət yerində).
   * Setting it here is how the app's "Priced on site" gets resolved.
   */
  priceAZN: number | null;
  /** The price is a starting price ("from 35 ₼"), e.g. depends on size. */
  priceFrom: boolean;
  species: Species[];
  /** Visible and bookable in the PetRide app. */
  active: boolean;
  /** Bookings in the last 30 days (for sorting / "popular"). */
  bookings30d: number;
};

export type ServicePatch = Partial<
  Pick<Service, "nameI18n" | "descriptionI18n" | "durationMin" | "priceAZN" | "priceFrom" | "species" | "active">
>;

export type NewServiceInput = Pick<
  Service,
  "category" | "nameI18n" | "descriptionI18n" | "durationMin" | "priceAZN" | "priceFrom" | "species" | "active"
>;

export type ProductCategory = "food" | "treats" | "toys" | "care" | "accessories" | "health";

export type Product = {
  id: ID;
  sku: string;
  category: ProductCategory;
  name: string;
  nameI18n: LocalizedText;
  species: Species[];
  priceAZN: number;
  stock: number;
  /** Stock at or below this shows "low stock". */
  lowStockAt: number;
  active: boolean;
  sold30d: number;
};

export type ProductPatch = Partial<Pick<Product, "nameI18n" | "priceAZN" | "stock" | "lowStockAt" | "active">>;

// ---- People & pets ---------------------------------------------------------------------------------

export type PetSex = "f" | "m";
export type PetSize = "small" | "medium" | "large";
/** Derived from vaccines: any overdue → `overdue`; any due in ≤ 14 days → `due_soon`; else `ok`. */
export type PetHealthStatus = "ok" | "due_soon" | "overdue";
/** Decorative avatar tint for pets without a photo. */
export type AvatarTint = "sage" | "coral" | "mint" | "lilac" | "peach" | "sand" | "sky";

export type VaccineStatus = "done" | "due_soon" | "overdue" | "scheduled";

export type Vaccine = {
  id: ID;
  petId: ID;
  name: string;
  dueDate: ISODate;
  doneDate?: ISODate;
  nextDate?: ISODate;
  status: VaccineStatus;
};

export type Pet = {
  id: ID;
  /** Short human-friendly id shown in tables, e.g. "PR-1042". */
  code: string;
  ownerId: ID;
  ownerName: string;
  name: string;
  /** "Kitty" for "Kitty Antonelli". */
  shortName: string;
  species: Species;
  breed: string;
  sex: PetSex;
  birthDate: ISODate;
  weightKg: number;
  size: PetSize;
  tint: AvatarTint;
  photoUrl?: string;
  microchip?: string;
  neutered: boolean;
  /** Notes the owner gave for the PetRide driver ("Anxious in cars", "Needs a carrier"). */
  travelNotes: string[];
  /** Partner's internal note about the pet (allergies, behaviour). */
  partnerNote?: string;
  vaccines: Vaccine[];
  healthStatus: PetHealthStatus;
  lastVisitAt?: ISODate;
  nextAppointment?: { id: ID; start: ISODate; serviceName: string };
  visitsCount: number;
};

export type ClientSource = "petride" | "walk_in" | "phone";

export type Client = {
  id: ID;
  firstName: string;
  lastName: string;
  fullName: string;
  /** E.164. */
  phone: string;
  /** Preferred language for messages from the partner. */
  locale: Locale;
  area: string;
  source: ClientSource;
  petIds: ID[];
  petNames: string[];
  firstVisitAt?: ISODate;
  lastVisitAt?: ISODate;
  visitsCount: number;
  ordersCount: number;
  totalSpentAZN: number;
  /** Visits that came with a PetRide ride. */
  rideVisits: number;
  /** Any pet has overdue / due-soon vaccines. */
  vaccineAlert: PetHealthStatus;
  partnerNote?: string;
  createdAt: ISODate;
};

export type ClientDetail = {
  client: Client;
  pets: Pet[];
  appointments: Appointment[];
  orders: Order[];
  rides: Ride[];
  reviews: Review[];
};

// ---- Rides -----------------------------------------------------------------------------------------

/** App RideStatus + `scheduled` (booked ahead, driver not assigned yet). */
export type RideStatus = "scheduled" | "searching" | "onway" | "arrived" | "intrip" | "completed" | "cancelled";
/** `to_partner`: pet is brought in · `from_partner`: pet goes home · `delivery`: shop order courier. */
export type RideDirection = "to_partner" | "from_partner" | "delivery";

export type Driver = {
  id: ID;
  name: string;
  rating: number;
  phone: string;
  car: { model: string; color: string; plate: string };
};

export type RidePlace = { label: string; address: string };

export type Ride = {
  id: ID;
  direction: RideDirection;
  status: RideStatus;
  appointmentId?: ID;
  orderId?: ID;
  clientId: ID;
  clientName: string;
  petIds: ID[];
  petNames: string[];
  driver?: Driver;
  from: RidePlace;
  to: RidePlace;
  /** Pick-up time (planned). */
  pickupAt: ISODate;
  /** Arrival at the destination (planned, or actual once completed). */
  arriveAt: ISODate;
  /** Minutes until arrival at the destination while the ride is live. */
  etaMin?: number;
  /** 0–1 along the route (same as the app's TripProgress). */
  progress: number;
  distanceKm: number;
  roundTrip: boolean;
  priceAZN: number;
  /** Owner's note for the driver. */
  driverNote?: string;
  /** Owner's travel notes for the pet(s), shown as warning chips. */
  travelNotes: string[];
};

export type RideQuery = {
  /** Only rides that are live now (searching/onway/arrived/intrip) or start within 2 h. */
  live?: boolean;
  from?: ISODate;
  to?: ISODate;
  direction?: RideDirection;
  status?: RideStatus[];
};

// ---- Appointments ----------------------------------------------------------------------------------

/**
 * Partner-side lifecycle. requested → confirmed → checked_in → completed, or → no_show / cancelled
 * (by client or partner) / declined (partner said no to the request).
 */
export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled"
  | "declined";

/** The mobile app's ServiceRequestStatus. */
export type ServiceRequestStatus = "pending" | "confirmed" | "declined" | "cancelled";

/** How the app sees a partner appointment status. */
export function toServiceRequestStatus(status: AppointmentStatus): ServiceRequestStatus {
  switch (status) {
    case "requested":
      return "pending";
    case "declined":
      return "declined";
    case "cancelled":
      return "cancelled";
    default:
      return "confirmed";
  }
}

export type AppointmentSource = "app" | "phone" | "walk_in";
export type ActorKind = "partner" | "client" | "system";

export type AppointmentEvent = { at: ISODate; status: AppointmentStatus; by: ActorKind; note?: string };

export type Appointment = {
  id: ID;
  /** Short reference shown to staff and the client, e.g. "A-1042". */
  code: string;
  serviceId: ID;
  serviceName: string;
  category: Exclude<ServiceCategory, "shop">;
  petId: ID;
  petName: string;
  petSpecies: Species;
  petBreed: string;
  petTint: AvatarTint;
  clientId: ID;
  clientName: string;
  clientPhone: string;
  start: ISODate;
  end: ISODate;
  durationMin: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  /** The app ServiceRequest id this came from (source = app). */
  requestId?: ID;
  /** List price at booking time (null = priced on site). */
  priceAZN: number | null;
  /** What was charged at the visit (completed only). */
  amountAZN?: number;
  /** The client booked a PetRide ride with it. */
  withRide: boolean;
  /** Ride bringing the pet in (and the ride home, for round trips). */
  ride?: Ride;
  returnRide?: Ride;
  /** Client's note from the app. */
  clientNote?: string;
  /** Internal staff note. */
  staffNote?: string;
  /** Reason when declined / cancelled. */
  reason?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  history: AppointmentEvent[];
};

export type AppointmentSort = "start_asc" | "start_desc" | "created_desc" | "client_asc" | "amount_desc";

export type AppointmentQuery = {
  from?: ISODate;
  to?: ISODate;
  status?: AppointmentStatus[];
  category?: Exclude<ServiceCategory, "shop">[];
  serviceId?: ID;
  withRide?: boolean;
  clientId?: ID;
  petId?: ID;
  /** Matches client, pet, phone, code, service. */
  search?: string;
  sort?: AppointmentSort;
  page?: number;
  pageSize?: number;
};

export type NewAppointmentInput = {
  serviceId: ID;
  petId: ID;
  start: ISODate;
  source: Exclude<AppointmentSource, "app">;
  staffNote?: string;
};

// ---- Shop orders -----------------------------------------------------------------------------------

/** new → preparing → ready → delivered (courier) / picked_up (pickup), or cancelled. */
export type OrderStatus = "new" | "preparing" | "ready" | "delivered" | "picked_up" | "cancelled";
export type Fulfilment = "pickup" | "petride_courier";

export type OrderItem = { productId: ID; name: string; qty: number; unitPriceAZN: number; totalAZN: number };

export type Order = {
  id: ID;
  /** e.g. "S-2031". */
  code: string;
  clientId: ID;
  clientName: string;
  clientPhone: string;
  petNames: string[];
  items: OrderItem[];
  itemsCount: number;
  subtotalAZN: number;
  deliveryFeeAZN: number;
  totalAZN: number;
  status: OrderStatus;
  fulfilment: Fulfilment;
  /** PetRide courier ride (fulfilment = petride_courier). */
  courierRide?: Ride;
  deliveryAddress?: string;
  paymentMethod: "card" | "cash";
  paid: boolean;
  clientNote?: string;
  reason?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  history: { at: ISODate; status: OrderStatus; by: ActorKind }[];
};

export type OrderSort = "created_desc" | "created_asc" | "total_desc";

export type OrderQuery = {
  from?: ISODate;
  to?: ISODate;
  status?: OrderStatus[];
  fulfilment?: Fulfilment;
  clientId?: ID;
  search?: string;
  sort?: OrderSort;
  page?: number;
  pageSize?: number;
};

// ---- Reviews & notifications -----------------------------------------------------------------------

export type Review = {
  id: ID;
  clientId: ID;
  clientName: string;
  petName?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  serviceName?: string;
  appointmentId?: ID;
  orderId?: ID;
  createdAt: ISODate;
  reply?: { text: string; at: ISODate };
};

export type ReviewQuery = { rating?: number[]; unanswered?: boolean; page?: number; pageSize?: number };

export type NotificationKind =
  | "new_request"
  | "request_cancelled"
  | "ride_onway"
  | "ride_arriving"
  | "ride_arrived"
  | "new_order"
  | "order_cancelled"
  | "new_review"
  | "vaccine_due";

export type PartnerNotification = {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  /** Dashboard route relative to /[locale], e.g. `/appointments?id=apt-12`. */
  href?: string;
};

// ---- Lists -----------------------------------------------------------------------------------------

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number; pageCount: number };

export type ClientSort = "last_visit_desc" | "name_asc" | "spent_desc" | "visits_desc";
export type ClientQuery = {
  search?: string;
  /** `vaccine_due`: a pet has overdue/due-soon vaccines · `rides`: came with PetRide · `repeat`: 2+ visits. */
  filter?: "vaccine_due" | "rides" | "repeat" | "new";
  sort?: ClientSort;
  page?: number;
  pageSize?: number;
};

export type PetQuery = {
  search?: string;
  species?: Species;
  health?: PetHealthStatus[];
  sort?: "name_asc" | "next_appointment" | "last_visit_desc";
  page?: number;
  pageSize?: number;
};

// ---- Stats -----------------------------------------------------------------------------------------

/** Rolling windows ending now. The previous period is the same length right before it. */
export type StatsPeriod = "today" | "7d" | "30d" | "90d";

export type Kpi = {
  value: number;
  previous: number;
  /** (value − previous) / previous; null when previous is 0. */
  delta: number | null;
};

export type KpiSet = {
  period: StatsPeriod;
  /** Appointments (excluding declined) in the period. */
  appointments: Kpi;
  /** Completed visits. */
  completed: Kpi;
  /** Requests waiting for an answer right now (value only; previous = same moment last period). */
  pendingRequests: Kpi;
  /** Revenue (appointments + orders) in AZN. */
  revenue: Kpi;
  /** Shop orders (excluding cancelled). */
  orders: Kpi;
  /** Clients whose first visit/order falls in the period. */
  newClients: Kpi;
  /** Share 0–1 of visits that came with a PetRide ride. */
  rideShare: Kpi;
  /** Share 0–1 of clients in the period with an earlier visit/order. */
  repeatRate: Kpi;
  /** Share 0–1 of confirmed appointments that ended as no-show. */
  noShowRate: Kpi;
  /** Average review rating in the period (1–5). */
  rating: Kpi;
  /** Average order / visit value in AZN. */
  averageTicket: Kpi;
};

export type DailyPoint = {
  /** Local date `2026-11-14`. */
  date: ISODate;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  withRide: number;
  orders: number;
  revenueAZN: number;
  appointmentRevenueAZN: number;
  orderRevenueAZN: number;
};

export type RevenuePoint = {
  /** Start of the bucket (local date). */
  date: ISODate;
  appointmentsAZN: number;
  ordersAZN: number;
  totalAZN: number;
};

export type ServiceMixItem = {
  id: ID;
  name: string;
  category: ServiceCategory | ProductCategory;
  count: number;
  revenueAZN: number;
  /** Share 0–1 of the total count. */
  share: number;
};

/** Visits/orders per weekday × hour (local), for the busiest-hours heatmap. */
export type BusyHourCell = { day: IsoWeekday; hour: number; count: number };

export type RideShareStats = { withRide: number; total: number; share: number; rides: number; rideRevenueAZN: number };
export type RepeatStats = { repeatClients: number; clients: number; rate: number };
export type RatingStats = { average: number; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };

/** Everything the overview page needs in one call. */
export type OverviewData = {
  partner: PartnerProfile;
  kpis: KpiSet;
  /** Today's appointments, by start time. */
  today: Appointment[];
  /** Requests waiting for an answer (oldest first). */
  pending: Appointment[];
  /** Live / soon PetRide rides to and from the partner. */
  liveRides: Ride[];
  /** Shop orders that need action (new / preparing / ready). */
  openOrders: Order[];
  /** Pets with vaccines overdue or due within 14 days (with an upcoming visit first). */
  vaccineAlerts: Pet[];
  latestReviews: Review[];
};

// ---- Errors ----------------------------------------------------------------------------------------

export type ApiErrorCode =
  | "network"
  | "not_found"
  | "conflict"
  | "invalid_transition"
  | "validation"
  | "forbidden"
  | "unknown";

/** Typed error the UI maps to copy (`common.errors.<code>`). */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}
