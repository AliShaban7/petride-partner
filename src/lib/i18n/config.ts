/** Supported UI languages. Azerbaijani is the default (and the source of truth for message keys). */
export const LOCALES = ["az", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";

/** Remembers the last language the partner picked (read by src/proxy.ts for bare URLs). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Language names in their own language (for the switcher). */
export const LOCALE_NAMES: Record<Locale, string> = {
  az: "Azərbaycanca",
  ru: "Русский",
  en: "English",
};

/** Short labels for compact switchers. */
export const LOCALE_SHORT: Record<Locale, string> = { az: "AZ", ru: "RU", en: "EN" };

/** BCP 47 tags for `Intl` APIs and the `<html lang>` attribute. */
export const INTL_LOCALE: Record<Locale, string> = { az: "az-Latn-AZ", ru: "ru-RU", en: "en-GB" };

/** Picks the best supported locale from an Accept-Language header. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}
