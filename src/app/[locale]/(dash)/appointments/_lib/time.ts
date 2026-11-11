/**
 * Local-time helpers for the appointments page (calendar maths on epoch ms). Everything is in the
 * viewer's local time zone, like the rest of the dashboard (partners are in Baku).
 */
import type { OpeningHoursDay } from "@/lib/api/types";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Local midnight of the day containing `ms`, shifted by `days` (DST-safe). */
export function startOfDay(ms: number, days = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Monday 00:00 of the week containing `ms`, shifted by `weeks`. */
export function startOfWeek(ms: number, weeks = 0): number {
  const d = new Date(ms);
  const isoDay = d.getDay() === 0 ? 7 : d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (isoDay - 1) + weeks * 7).getTime();
}

/** The 7 local midnights (Mon–Sun) of the week starting at `weekStart`. */
export function weekDays(weekStart: number): number[] {
  return Array.from({ length: 7 }, (_, i) => startOfDay(weekStart, i));
}

/** ISO weekday 1–7 (Mon–Sun). */
export function isoWeekday(ms: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = new Date(ms).getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** `2026-11-14` for a local time. */
export function toIsoDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `2026-11-14` → local midnight (ms), or null when it isn't a real date. */
export function parseIsoDay(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

/** `09:45` → minutes after midnight, or null. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Date input + time input → local epoch ms, or null. */
export function combineDateTime(day: string, time: string): number | null {
  const d = parseIsoDay(day);
  const t = parseClock(time);
  if (d === null || t === null) return null;
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(t / 60), t % 60).getTime();
}

/** `09:45` for a local time (value for <input type="time">). */
export function toClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Minutes after local midnight. */
export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Next quarter hour at or after `ms`. */
export function ceilToQuarter(ms: number): number {
  const q = 15 * MINUTE;
  const d = new Date(ms);
  d.setSeconds(0, 0);
  return Math.ceil(d.getTime() / q) * q;
}

/** Opening hours for a local day, as minutes after midnight (null = closed or unknown). */
export function hoursForDay(hours: OpeningHoursDay[] | undefined, day: number): { open: number; close: number } | null {
  const h = hours?.find((x) => x.day === isoWeekday(day));
  if (!h || !h.open) return null;
  const open = parseClock(h.from);
  const close = parseClock(h.to);
  if (open === null || close === null || close <= open) return null;
  return { open, close };
}

/** Appointments of a day or more (hotel nights) are shown as stays, not time blocks. */
export function isStay(a: { category: string; durationMin: number }): boolean {
  return a.category === "hotel";
}

// ---- Date-range presets (list view) ----------------------------------------------------------------

export const RANGE_PRESETS = ["today", "tomorrow", "next7", "week", "last7", "last30", "upcoming", "all", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export function isRangePreset(value: string | null | undefined): value is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(value ?? "");
}

/**
 * `[from, to)` in ms for a preset, anchored on local midnight of `today` so query keys stay stable
 * all day. `custom` reads the inclusive `from`/`to` dates (YYYY-MM-DD).
 */
export function rangeFor(preset: RangePreset, today: number, custom: { from?: string; to?: string } = {}): { from?: number; to?: number } {
  const d0 = startOfDay(today);
  switch (preset) {
    case "today":
      return { from: d0, to: startOfDay(d0, 1) };
    case "tomorrow":
      return { from: startOfDay(d0, 1), to: startOfDay(d0, 2) };
    case "next7":
      return { from: d0, to: startOfDay(d0, 7) };
    case "week":
      return { from: startOfWeek(d0), to: startOfWeek(d0, 1) };
    case "last7":
      return { from: startOfDay(d0, -6), to: startOfDay(d0, 1) };
    case "last30":
      return { from: startOfDay(d0, -29), to: startOfDay(d0, 1) };
    case "upcoming":
      return { from: d0 };
    case "all":
      return {};
    case "custom": {
      let from = parseIsoDay(custom.from);
      let to = parseIsoDay(custom.to);
      // Typed dates can come in reversed (min/max only guard the pickers): read them as a range.
      if (from !== null && to !== null && from > to) [from, to] = [to, from];
      return { from: from ?? undefined, to: to !== null ? startOfDay(to, 1) : undefined };
    }
  }
}
