/**
 * Partner API entry point. Pages use the hooks in ./hooks (useApiQuery / useApiMutation), which get
 * the instance from <PartnerApiProvider>. Only this file decides which backend runs:
 *   NEXT_PUBLIC_PARTNER_API=mock (default) → in-memory seeded mock (./mock)
 *   NEXT_PUBLIC_PARTNER_API=supabase       → ./supabase (to be built)
 */
import { createMockPartnerApi } from "./mock/client";
import type { PartnerApi } from "./partner-api";
import { createSupabasePartnerApi } from "./supabase";
import type { ID, Locale } from "./types";

export function createPartnerApi(options: { partnerId: ID; locale: Locale }): PartnerApi {
  if (process.env.NEXT_PUBLIC_PARTNER_API === "supabase") return createSupabasePartnerApi(options);
  return createMockPartnerApi(options);
}

export type { PartnerApi } from "./partner-api";
export * from "./types";
