/**
 * One place that maps every status to a pill tone, so the whole dashboard colours statuses the
 * same way. Colour is never the only cue: StatusPill always renders the label text too.
 */
import type {
  AppointmentStatus,
  OrderStatus,
  PetHealthStatus,
  RideStatus,
  VaccineStatus,
} from "@/lib/api/types";

export type PillTone = "success" | "warning" | "error" | "info" | "lilac" | "blue" | "neutral" | "coral";

/** bg + text pairs, all ≥ 4.8:1 (see globals.css). */
export const PILL_TONE_CLASSES: Record<PillTone, string> = {
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  error: "bg-error-bg text-error-text",
  info: "bg-info-bg text-info-text",
  lilac: "bg-lilac-bg text-lilac-text",
  blue: "bg-blue-bg text-blue-text",
  neutral: "bg-neutral-bg text-neutral-text",
  coral: "bg-accent-tint text-on-accent-tint",
};

export const STATUS_TONES = {
  appointment: {
    requested: "coral",
    confirmed: "info",
    checked_in: "lilac",
    completed: "success",
    no_show: "warning",
    cancelled: "neutral",
    declined: "error",
  } satisfies Record<AppointmentStatus, PillTone>,
  order: {
    new: "coral",
    preparing: "warning",
    ready: "blue",
    delivered: "success",
    picked_up: "success",
    cancelled: "neutral",
  } satisfies Record<OrderStatus, PillTone>,
  ride: {
    scheduled: "neutral",
    searching: "warning",
    onway: "blue",
    arrived: "lilac",
    intrip: "info",
    completed: "success",
    cancelled: "neutral",
  } satisfies Record<RideStatus, PillTone>,
  health: { ok: "success", due_soon: "warning", overdue: "error" } satisfies Record<PetHealthStatus, PillTone>,
  vaccine: { done: "success", due_soon: "warning", overdue: "error", scheduled: "neutral" } satisfies Record<VaccineStatus, PillTone>,
  payment: { paid: "success", unpaid: "warning" } satisfies Record<"paid" | "unpaid", PillTone>,
  availability: { active: "success", inactive: "neutral" } satisfies Record<"active" | "inactive", PillTone>,
  stock: { in: "success", low: "warning", out: "error" } satisfies Record<"in" | "low" | "out", PillTone>,
} as const;

export type StatusKind = keyof typeof STATUS_TONES;
export type StatusOf<K extends StatusKind> = keyof (typeof STATUS_TONES)[K] & string;

/** Live ride statuses (show the pulsing dot). */
export const LIVE_RIDE_STATUSES: readonly RideStatus[] = ["searching", "onway", "arrived", "intrip"];

/** Appointment statuses that still need the partner (for filters / badges). */
export const OPEN_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ["requested", "confirmed", "checked_in"];
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = ["new", "preparing", "ready"];

export function stockStatus(stock: number, lowStockAt: number): "in" | "low" | "out" {
  if (stock <= 0) return "out";
  return stock <= lowStockAt ? "low" : "in";
}
