/**
 * Opening-hours helpers shared by Settings → Working hours and the hours card on Services:
 * merge PartnerProfile.hours with the extras (breaks, 24/7, exceptions), group equal days for
 * the "Mon–Fri 09:00–19:00" summary, and work out "open now / closed" for the app preview.
 */
import type { IsoWeekday, OpeningHoursDay } from "@/lib/api/types";
import { weekdayName } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

import type { HoursBreak, HoursException, PartnerExtras } from "./extras";
import { toMinutes } from "./controls";

export const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export type DayHours = { day: IsoWeekday; open: boolean; from: string; to: string; breaks: HoursBreak[] };

/** The regular week as the partner set it (with breaks). While 24/7 is on, the kept weekly copy is used. */
export function buildWeek(hours: OpeningHoursDay[], extras?: PartnerExtras["hours"]): DayHours[] {
  const source = extras?.alwaysOpen && extras.weekly ? extras.weekly : hours;
  return WEEKDAYS.map((day) => {
    const h = source.find((x) => x.day === day) ?? { day, open: false, from: "09:00", to: "18:00" };
    return { day, open: h.open, from: h.from, to: h.to, breaks: (extras?.breaks?.[day] ?? []).map((b) => ({ ...b })) };
  });
}

export type HoursGroup = { days: IsoWeekday[]; open: boolean; from: string; to: string; breaks: HoursBreak[] };

const sameHours = (a: DayHours | HoursGroup, b: DayHours) =>
  a.open === b.open && (!a.open || (a.from === b.from && a.to === b.to && JSON.stringify(a.breaks) === JSON.stringify(b.breaks)));

/** Consecutive days with the same hours: [Mon–Fri 09–19, Sat 10–18, Sun closed]. */
export function groupWeek(week: DayHours[]): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const d of week) {
    const last = groups[groups.length - 1];
    if (last && sameHours(last, d)) last.days.push(d.day);
    else groups.push({ days: [d.day], open: d.open, from: d.from, to: d.to, breaks: d.breaks });
  }
  return groups;
}

/** `B.e–C.a` / `Пн–Пт` / `Mon–Fri`, or one day. */
export function dayRangeLabel(days: IsoWeekday[], locale: Locale): string {
  const first = weekdayName(days[0], locale, true);
  if (days.length === 1) return first;
  return `${first}–${weekdayName(days[days.length - 1], locale, true)}`;
}

export const isoWeekday = (date: Date): IsoWeekday => ((date.getDay() || 7) as IsoWeekday);

/** Local `YYYY-MM-DD`. */
export function localDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Hours for one calendar date (an exception wins over the weekday). */
export function hoursOn(date: Date, week: DayHours[], exceptions: HoursException[]): { open: boolean; from: string; to: string; breaks: HoursBreak[]; exception?: HoursException } {
  const key = localDateKey(date);
  const exception = exceptions.find((e) => e.date === key);
  if (exception) return exception.closed ? { open: false, from: "", to: "", breaks: [], exception } : { open: true, from: exception.from, to: exception.to, breaks: [], exception };
  const d = week.find((x) => x.day === isoWeekday(date));
  return d ? { open: d.open, from: d.from, to: d.to, breaks: d.breaks } : { open: false, from: "", to: "", breaks: [] };
}

export type OpenState =
  | { kind: "always" }
  | { kind: "open"; until: string }
  | { kind: "break"; until: string }
  | { kind: "closed"; next: { dayOffset: number; at: string } | null };

/** Open now / on a break / closed (with the next opening within a week). */
export function openState(week: DayHours[], exceptions: HoursException[], alwaysOpen: boolean, now: Date): OpenState {
  if (alwaysOpen) return { kind: "always" };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = hoursOn(now, week, exceptions);
  if (today.open && today.from && today.to) {
    const from = toMinutes(today.from);
    const to = toMinutes(today.to);
    if (minutes >= from && minutes < to) {
      const inBreak = today.breaks.find((b) => minutes >= toMinutes(b.from) && minutes < toMinutes(b.to));
      return inBreak ? { kind: "break", until: inBreak.to } : { kind: "open", until: today.to };
    }
    if (minutes < from) return { kind: "closed", next: { dayOffset: 0, at: today.from } };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const h = hoursOn(date, week, exceptions);
    if (h.open && h.from) return { kind: "closed", next: { dayOffset: offset, at: h.from } };
  }
  return { kind: "closed", next: null };
}
