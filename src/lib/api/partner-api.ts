import type {
  Appointment,
  AppointmentQuery,
  BusyHourCell,
  Client,
  ClientDetail,
  ClientQuery,
  DailyPoint,
  ID,
  ISODate,
  KpiSet,
  NewAppointmentInput,
  NewServiceInput,
  Order,
  OrderQuery,
  OrderStatus,
  OverviewData,
  Paged,
  PartnerNotification,
  PartnerProfile,
  PartnerProfilePatch,
  Pet,
  PetQuery,
  Product,
  ProductPatch,
  RatingStats,
  RepeatStats,
  RevenuePoint,
  Review,
  ReviewQuery,
  Ride,
  RideQuery,
  RideShareStats,
  Service,
  ServiceMixItem,
  ServicePatch,
  StatsPeriod,
} from "./types";

/**
 * Everything the partner dashboard can read or change. One instance is bound to one partner and
 * one UI locale (`createPartnerApi({ partnerId, locale })`), so methods take no partner/locale
 * arguments. Implementations: `./mock` (in-memory, seeded, 200–600 ms latency) now; Supabase later.
 *
 * Every method rejects with `ApiError` (`./types`) — `not_found`, `invalid_transition`, `network`…
 */
export interface PartnerApi {
  readonly partnerId: ID;

  // ---- Partner profile -------------------------------------------------------------------------
  getPartner(): Promise<PartnerProfile>;
  /** Contact details, switches and opening hours. Saving hours sets `hoursConfirmed: true`. */
  updatePartner(patch: PartnerProfilePatch): Promise<PartnerProfile>;

  // ---- Services & prices (vet / groom / hotel) ---------------------------------------------------
  listServices(): Promise<Service[]>;
  /** Price edits resolve the app's "Priced on site" for this service. */
  updateService(id: ID, patch: ServicePatch): Promise<Service>;
  createService(input: NewServiceInput): Promise<Service>;
  /** Archives the service (hidden in the app; history keeps its name). */
  archiveService(id: ID): Promise<void>;

  // ---- Products (pet shop) -----------------------------------------------------------------------
  listProducts(): Promise<Product[]>;
  updateProduct(id: ID, patch: ProductPatch): Promise<Product>;

  // ---- Appointments ------------------------------------------------------------------------------
  listAppointments(query?: AppointmentQuery): Promise<Paged<Appointment>>;
  getAppointment(id: ID): Promise<Appointment>;
  /** requested → confirmed. */
  confirmAppointment(id: ID): Promise<Appointment>;
  /** requested → declined (reason is shown to the client in the app). */
  declineAppointment(id: ID, reason: string): Promise<Appointment>;
  /** Moves a requested/confirmed appointment; a requested one becomes confirmed. Moves its ride too. */
  rescheduleAppointment(id: ID, start: ISODate): Promise<Appointment>;
  /** confirmed → checked_in (the pet is here). */
  checkInAppointment(id: ID): Promise<Appointment>;
  /** checked_in/confirmed → completed, with the amount charged at the visit. */
  completeAppointment(id: ID, input: { amountAZN: number; staffNote?: string }): Promise<Appointment>;
  /** confirmed → no_show. */
  markNoShow(id: ID): Promise<Appointment>;
  /** requested/confirmed → cancelled by the partner (also cancels the PetRide ride). */
  cancelAppointment(id: ID, reason: string): Promise<Appointment>;
  /** Phone or walk-in booking made by staff (status confirmed). */
  createAppointment(input: NewAppointmentInput): Promise<Appointment>;
  updateAppointmentNote(id: ID, staffNote: string): Promise<Appointment>;

  // ---- PetRide rides -----------------------------------------------------------------------------
  /** Rides to/from the partner (and courier rides for shop orders). Status/ETA are live. */
  listRides(query?: RideQuery): Promise<Ride[]>;
  getRide(id: ID): Promise<Ride>;

  // ---- Clients & pets ----------------------------------------------------------------------------
  listClients(query?: ClientQuery): Promise<Paged<Client>>;
  getClient(id: ID): Promise<ClientDetail>;
  updateClientNote(id: ID, note: string): Promise<Client>;
  listPets(query?: PetQuery): Promise<Paged<Pet>>;
  getPet(id: ID): Promise<Pet>;
  updatePetNote(id: ID, note: string): Promise<Pet>;

  // ---- Shop orders -------------------------------------------------------------------------------
  listOrders(query?: OrderQuery): Promise<Paged<Order>>;
  getOrder(id: ID): Promise<Order>;
  /**
   * Moves an order along new → preparing → ready → delivered/picked_up. Setting `ready` on a
   * courier order books the PetRide courier ride automatically.
   */
  updateOrderStatus(id: ID, status: Exclude<OrderStatus, "cancelled">): Promise<Order>;
  cancelOrder(id: ID, reason: string): Promise<Order>;

  // ---- Reviews -----------------------------------------------------------------------------------
  listReviews(query?: ReviewQuery): Promise<Paged<Review>>;
  replyToReview(id: ID, text: string): Promise<Review>;

  // ---- Notifications -----------------------------------------------------------------------------
  listNotifications(): Promise<PartnerNotification[]>;
  markNotificationRead(id: ID): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // ---- Stats (all computed for rolling windows ending now) ---------------------------------------
  getOverview(): Promise<OverviewData>;
  getKpis(period: StatsPeriod): Promise<KpiSet>;
  /** One point per local day of the period (today = 1 point, 7d = 7 …). */
  getDailySeries(period: StatsPeriod): Promise<DailyPoint[]>;
  getRevenueSeries(period: StatsPeriod, granularity: "day" | "week"): Promise<RevenuePoint[]>;
  /** Services (or product categories for shops) by count, biggest first. */
  getServiceMix(period: StatsPeriod): Promise<ServiceMixItem[]>;
  /** Weekday × hour counts of started visits / placed orders. */
  getBusyHours(period: StatsPeriod): Promise<BusyHourCell[]>;
  getRideShare(period: StatsPeriod): Promise<RideShareStats>;
  getRepeatClients(period: StatsPeriod): Promise<RepeatStats>;
  getRatingStats(period: StatsPeriod): Promise<RatingStats>;
}
