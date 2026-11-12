/**
 * Supabase implementation of PartnerApi — NOT BUILT YET. This file marks where it plugs in.
 *
 * Plan (mirrors the mobile app's API contract):
 *  - Auth: Supabase Auth email/password for partner staff; `partner_members(user_id, partner_id, role)`
 *    decides which partner a session sees. Replace src/lib/auth (cookie mock) with @supabase/ssr.
 *  - Tables: partners, partner_hours, services (price_azn NULL = "Priced on site" in the app),
 *    products, clients (app users who booked this partner), pets, vaccines, service_requests
 *    (the app writes them; partner-side status lives in `appointments`), rides (+ live status from
 *    the dispatch service), orders/order_items, reviews, partner_notifications.
 *  - Row Level Security: every row carries partner_id; policies allow members of that partner only.
 *    RLS filters rows, not columns: partners read rides through a view / RPC without the price
 *    columns (PetRide sets and bills ride and courier prices; partners only hand over or receive
 *    the pet), and no stats RPC returns ride revenue.
 *  - Live data: subscribe to `rides` and `appointments` via Realtime and call `invalidate()` from
 *    src/lib/api/hooks.ts so screens refetch.
 *  - Stats: SQL views / RPCs (kpis(period), daily_series(period) …) returning the same shapes as
 *    ./mock/stats.ts (ride share is counts only).
 * Every method must resolve localised fields for `locale` and reject with `ApiError` (./types).
 */
import type { PartnerApi } from "./partner-api";
import type { ID, Locale } from "./types";

export function createSupabasePartnerApi(options: { partnerId: ID; locale: Locale }): PartnerApi {
  void options;
  throw new Error("Supabase PartnerApi is not implemented yet. Set NEXT_PUBLIC_PARTNER_API=mock (default).");
}
