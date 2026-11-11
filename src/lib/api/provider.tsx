"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import { useLocale } from "@/lib/i18n/client";

import { createPartnerApi } from "./index";
import type { PartnerApi } from "./partner-api";

const PartnerApiContext = createContext<PartnerApi | null>(null);

/** Mounted by the (dash) layout with the signed-in partner's id. One API instance per partner + locale. */
export function PartnerApiProvider({ partnerId, children }: { partnerId: string; children: ReactNode }) {
  const locale = useLocale();
  const api = useMemo(() => createPartnerApi({ partnerId, locale }), [partnerId, locale]);
  return <PartnerApiContext value={api}>{children}</PartnerApiContext>;
}

/** The PartnerApi for the signed-in partner (prefer useApiQuery / useApiMutation in pages). */
export function usePartnerApi(): PartnerApi {
  const api = use(PartnerApiContext);
  if (!api) throw new Error("usePartnerApi must be used inside <PartnerApiProvider>");
  return api;
}
