"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import type { Locale } from "./config";
import { createTranslator } from "./translate";
import type { Messages, Namespace, Translator } from "./types";

type I18nValue = { locale: Locale; messages: Messages };

const I18nContext = createContext<I18nValue | null>(null);

/** Mounted once by app/[locale]/layout.tsx with the current locale's messages. */
export function I18nProvider({ locale, messages, children }: I18nValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useT/useLocale must be used inside <I18nProvider>");
  return value;
}

/** Current UI locale ("az" | "ru" | "en"). */
export function useLocale(): Locale {
  return useI18n().locale;
}

/**
 * Typed translator for one namespace (Client Components):
 *   const t = useT("orders");
 *   t("title"); t.plural("items", 3);
 */
export function useT<NS extends Namespace>(namespace: NS): Translator<NS> {
  const { locale, messages } = useI18n();
  return useMemo(() => createTranslator(locale, messages, namespace), [locale, messages, namespace]);
}
