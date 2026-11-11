"use client";

import { useSyncExternalStore } from "react";

import { formatDate, formatDayMonth, formatTime, formatWeekdayDate, formatWeekdayShort } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/types";

import { dayStart, localDay, type Bucket, type StatsRange } from "./range";

// ---- "Today" without hydration mismatches -----------------------------------------------------------

function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}

/**
 * Today's local date (`2026-11-11`) on the client, `null` during the server render (the server's
 * time zone isn't the partner's). Re-checks every minute, so the page rolls over at midnight.
 */
export function useToday(): string | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => localDay(Date.now()),
    () => null,
  );
}

// ---- Labels -----------------------------------------------------------------------------------------

type StatsT = Translator<"stats">;

/** `13 oktyabr – 11 noyabr` for a range or any [start, end) window. */
export function windowLabel(window: { start: number; end: number }, t: StatsT, locale: Locale): string {
  const last = dayStart(window.end, -1);
  if (last === window.start) return formatDate(window.start, locale);
  return t("range", { from: formatDate(window.start, locale), to: formatDate(last, locale) });
}

export function rangeLabel(range: StatsRange, t: StatsT, locale: Locale): string {
  return windowLabel(range, t, locale);
}

/** Short bucket label for tables, summaries and CSV: `14 noyabr` or `3 noyabr – 9 noyabr`. */
export function bucketLabel(b: Pick<Bucket, "start" | "end" | "days">, t: StatsT, locale: Locale): string {
  if (b.days === 1) return formatDate(b.start, locale);
  return windowLabel(b, t, locale);
}

/** Tooltip title: `Şənbə, 14 noyabr` for a day, the date range for a week. */
export function bucketTitle(b: Pick<Bucket, "start" | "end" | "days">, t: StatsT, locale: Locale): string {
  return b.days === 1 ? formatWeekdayDate(b.start, locale) : windowLabel(b, t, locale);
}

/** X-axis tick: weekday for a week of days, otherwise the day and month. */
export function bucketTick(b: Pick<Bucket, "start" | "days">, count: number, locale: Locale): string {
  return b.days === 1 && count <= 7 ? formatWeekdayShort(b.start, locale) : formatDayMonth(b.start, locale);
}

/** `11:00–12:00` for an hour of the day. */
export function hourSlot(hour: number): string {
  const from = new Date(2000, 0, 1, hour);
  const to = new Date(2000, 0, 1, hour + 1);
  return `${formatTime(from)}–${formatTime(to)}`;
}

/** File-name-safe slug from a partner name (`IDEA` → `idea`). */
export function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/ə/g, "e")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "partner"
  );
}
