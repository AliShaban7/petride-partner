import type { Locale } from "@/lib/i18n/config";

/** Same look as the design-system inputs (src/components/ui/Field.tsx) for compact custom controls. */
export const controlClass =
  "w-full min-h-11 rounded-input border border-control-border/70 bg-surface px-3.5 text-body text-fg placeholder:text-fg-secondary/80 transition-[border-color,box-shadow] duration-150 hover:border-control-border focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-secondary aria-[invalid=true]:border-error-text aria-[invalid=true]:ring-error-text/20";

// ---- Money input ------------------------------------------------------------------------------------

export type PriceParse = { ok: true; value: number } | { ok: false; reason: "empty" | "invalid" | "zero" | "tooBig" };

/** Accepts `12,80`, `12.80`, `1 200`, `₼35`; up to 2 decimals; 0 < price ≤ 9 999. */
export function parsePrice(raw: string): PriceParse {
  const text = raw.replace(/[\s  ₼]/g, "").replace(",", ".");
  if (!text) return { ok: false, reason: "empty" };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { ok: false, reason: "invalid" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, reason: "invalid" };
  if (value <= 0) return { ok: false, reason: "zero" };
  if (value > 9999) return { ok: false, reason: "tooBig" };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/** Number → input text without the currency: `35`, `12,80` (az/ru) / `12.80` (en). */
export function priceInputText(value: number | null | undefined, locale: Locale): string {
  if (value === null || value === undefined) return "";
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(2);
  return locale === "en" ? fixed : fixed.replace(".", ",");
}

/** Whole-number input in a range (minutes, stock). */
export function parseWhole(raw: string, min: number, max: number): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

// ---- Clock times ------------------------------------------------------------------------------------

/** `09:30` → 570. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const isClock = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

// ---- Contacts ---------------------------------------------------------------------------------------

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Azerbaijani phone to E.164: accepts `+994 12 565 66 55`, `012 565 66 55`, `0125656655`,
 * `125656655`. Null when it isn't a valid AZ number.
 */
export function normalizeAzPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("994")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{9}$/.test(digits) ? `+994${digits}` : null;
}
