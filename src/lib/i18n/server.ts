import "server-only";

import { notFound } from "next/navigation";

import { isLocale, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator } from "./translate";
import type { Namespace, Translator } from "./types";

/**
 * `t()` for Server Components / server actions / generateMetadata:
 *   const t = getT(locale, "appointments");
 *   t("title");
 */
export function getT<NS extends Namespace>(locale: Locale, namespace: NS): Translator<NS> {
  return createTranslator(locale, getMessages(locale), namespace);
}

/** Resolves the [locale] route param (404 for anything but az/ru/en). */
export async function localeFromParams(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
