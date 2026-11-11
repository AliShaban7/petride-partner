"use client";

import { useApiMutation, useApiQuery, type MutationOptions } from "@/lib/api/hooks";
import type { PartnerApi } from "@/lib/api/partner-api";

import { EXTRAS_TAG, extrasApi, type PartnerExtras } from "./extras";

/** The partner extras (mock) through the shared query cache: same loading / error / refetch rules. */
export function useExtras() {
  return useApiQuery([EXTRAS_TAG], (api) => extrasApi.get(api.partnerId));
}

/**
 * A write to the extras store. `fn` gets the partner id (the extras API is keyed by partner).
 * By default only the extras query refetches.
 */
export function useExtrasMutation<A extends unknown[], R>(
  fn: (partnerId: string, ...args: A) => Promise<R>,
  options: MutationOptions<R> = {},
) {
  return useApiMutation((api: PartnerApi, ...args: A) => fn(api.partnerId, ...args), { invalidates: [EXTRAS_TAG], ...options });
}

export type { PartnerExtras };
