/**
 * Loads the raw records the statistics engine works on, through the public PartnerApi list methods
 * (so it works with the mock today and with any backend that implements the contract).
 *
 * Why not `getKpis` / `getDailySeries` …? Those take a fixed period ("7d" | "30d" | "90d") and
 * have no per-service breakdown, while this page needs custom ranges, the previous period
 * point by point, and appointments stacked by service. `./engine.ts` reproduces the API's stats
 * definitions exactly (checked against the mock for 7d / 30d / 90d). Once the API accepts a
 * `{ from, to }` range, this loader can be replaced by those calls.
 */
import type { PartnerApi } from "@/lib/api";
import type { Appointment, Order, Paged, PartnerProfile, Product, Review } from "@/lib/api/types";

/** The API caps page size at 200. */
const PAGE_SIZE = 200;

export type StatsFeatures = { appointments: boolean; orders: boolean };

export type StatsSource = {
  partner: PartnerProfile;
  features: StatsFeatures;
  /** Every appointment (history is needed to tell new clients from returning ones). */
  appointments: Appointment[];
  orders: Order[];
  reviews: Review[];
  products: Product[];
};

/** First page, then the rest in parallel. */
async function fetchAll<T>(getPage: (page: number) => Promise<Paged<T>>): Promise<T[]> {
  const first = await getPage(1);
  if (first.pageCount <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: first.pageCount - 1 }, (_, i) => getPage(i + 2)));
  return [first, ...rest].flatMap((p) => p.items);
}

function none<T>(): Promise<T[]> {
  return Promise.resolve([]);
}

export async function loadStatsSource(api: PartnerApi, features: StatsFeatures): Promise<StatsSource> {
  const [partner, appointments, orders, reviews, products] = await Promise.all([
    api.getPartner(),
    features.appointments
      ? fetchAll((page) => api.listAppointments({ sort: "start_asc", page, pageSize: PAGE_SIZE }))
      : none<Appointment>(),
    features.orders ? fetchAll((page) => api.listOrders({ sort: "created_asc", page, pageSize: PAGE_SIZE })) : none<Order>(),
    fetchAll((page) => api.listReviews({ page, pageSize: PAGE_SIZE })),
    features.orders ? api.listProducts() : none<Product>(),
  ]);
  return { partner, features, appointments, orders, reviews, products };
}
