/**
 * Conflict check for rescheduling and new bookings. A clinic's vets and groomers are separate
 * "lanes", so only appointments of the same category that are still active can clash. Hotel stays
 * have no time conflicts (capacity isn't modelled yet). This is advice, not a hard rule: staff can
 * still save over a clash.
 */
import type { Appointment, AppointmentStatus, OpeningHoursDay } from "@/lib/api/types";

import { MINUTE, ceilToQuarter, hoursForDay, startOfDay } from "./time";

const ACTIVE: readonly AppointmentStatus[] = ["requested", "confirmed", "checked_in"];

export type SlotCheck = {
  conflicts: Appointment[];
  /** Opening hours of that day (null = closed or not set). */
  hours: { open: number; close: number } | null;
  /** The slot starts before opening or ends after closing (or the day is closed). */
  outsideHours: boolean;
};

export function checkSlot(input: {
  start: number;
  durationMin: number;
  category: Appointment["category"];
  /** Appointments of that day. */
  dayAppointments: Appointment[];
  /** The appointment being moved (ignored). */
  ignoreId?: string;
  hours?: OpeningHoursDay[];
}): SlotCheck {
  const end = input.start + input.durationMin * MINUTE;
  const conflicts =
    input.category === "hotel"
      ? []
      : input.dayAppointments.filter(
          (a) =>
            a.id !== input.ignoreId &&
            a.category === input.category &&
            ACTIVE.includes(a.status) &&
            new Date(a.start).getTime() < end &&
            new Date(a.end).getTime() > input.start,
        );
  const day0 = startOfDay(input.start);
  const hours = hoursForDay(input.hours, day0);
  const startMin = (input.start - day0) / MINUTE;
  const endMin = startMin + Math.min(input.durationMin, 24 * 60);
  const outsideHours = !hours || startMin < hours.open || (input.category !== "hotel" && endMin > hours.close);
  return { conflicts, hours, outsideHours };
}

/**
 * Up to `limit` free starts (15-minute grid, inside opening hours, after `notBefore`) on the day of
 * `around`, nearest to it first.
 */
export function suggestSlots(input: {
  around: number;
  durationMin: number;
  category: Appointment["category"];
  dayAppointments: Appointment[];
  ignoreId?: string;
  hours?: OpeningHoursDay[];
  notBefore: number;
  limit?: number;
}): number[] {
  const day0 = startOfDay(input.around);
  const hours = hoursForDay(input.hours, day0);
  if (!hours || input.category === "hotel") return [];
  const out: number[] = [];
  const first = Math.max(day0 + hours.open * MINUTE, ceilToQuarter(input.notBefore));
  const last = day0 + hours.close * MINUTE - input.durationMin * MINUTE;
  for (let t = first; t <= last; t += 15 * MINUTE) {
    if (t === input.around) continue;
    const { conflicts } = checkSlot({ ...input, start: t });
    if (conflicts.length === 0) out.push(t);
  }
  return out.sort((a, b) => Math.abs(a - input.around) - Math.abs(b - input.around)).slice(0, input.limit ?? 4).sort((a, b) => a - b);
}
