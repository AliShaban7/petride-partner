"use client";

import {
  Ban,
  CalendarClock,
  CalendarPlus,
  Car,
  Check,
  CheckCheck,
  CircleX,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { Pill } from "@/components/ui";
import type { Appointment, RideStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { LIVE_RIDE_STATUSES, STATUS_TONES } from "@/lib/status";

import type { ActionKind } from "../_lib/useAppointmentActions";
import type { ActionMenuItem } from "./ActionMenu";

type Category = Appointment["category"];

/**
 * Service-line colours for calendar blocks and timeline cards (decorative; the category name is
 * always written next to them). Text on these fills: text-fg / text-fg-tertiary only.
 */
export const CATEGORY_STYLE: Record<Category, { fill: string; soft: string; bar: string; dot: string }> = {
  vet: { fill: "bg-pastel-mint", soft: "bg-soft-mint", bar: "border-l-primary", dot: "bg-primary" },
  groom: { fill: "bg-pastel-peach", soft: "bg-soft-peach", bar: "border-l-accent-strong", dot: "bg-accent" },
  hotel: { fill: "bg-pastel-lilac", soft: "bg-soft-lilac", bar: "border-l-chart-3", dot: "bg-chart-3" },
};

/** Little colour square + category name (legend, service cells). */
export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2.5 shrink-0 rounded-full", CATEGORY_STYLE[category].dot, className)} />;
}

export const ACTION_ICONS: Record<ActionKind, LucideIcon> = {
  accept: Check,
  decline: CircleX,
  reschedule: CalendarClock,
  checkIn: UserCheck,
  complete: CheckCheck,
  noShow: UserX,
  cancel: Ban,
  bookAgain: CalendarPlus,
};

/** Menu items for a set of actions (labels from the appointments namespace). */
export function useActionItems() {
  const t = useT("appointments");
  return (actions: ActionKind[], onAction: (kind: ActionKind) => void): ActionMenuItem[] =>
    actions.map((kind) => {
      const Icon = ACTION_ICONS[kind];
      const danger = kind === "decline" || kind === "cancel";
      return {
        id: kind,
        label: t.dynamic(`actions.${kind}`),
        icon: <Icon aria-hidden="true" size={18} />,
        tone: danger ? "danger" : "default",
        separatorBefore: danger,
        onSelect: () => onAction(kind),
      };
    });
}

/** "PetRide" ride chip: live status + ETA, pickup time, or the final state. Text, icon and colour. */
export function RideBadge({ appointment, size = "sm", showNone = true }: { appointment: Appointment; size?: "sm" | "md"; showNone?: boolean }) {
  const t = useT("appointments");
  const ts = useT("status");
  const ride = appointment.ride;
  if (!appointment.withRide || !ride) {
    return showNone ? (
      <span className="text-fg-secondary">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("ride.none")}</span>
      </span>
    ) : null;
  }
  const status: RideStatus = ride.status;
  const live = (LIVE_RIDE_STATUSES as readonly string[]).includes(status);
  const tone = STATUS_TONES.ride[status];
  const detail = live && ride.etaMin !== undefined ? t("ride.eta", { min: ride.etaMin }) : status === "scheduled" ? t("ride.pickup", { time: formatTime(ride.pickupAt) }) : ts.dynamic(`ride.${status}`);
  const label = live ? `${ts.dynamic(`ride.${status}`)} · ${detail}` : detail;
  return (
    <Pill
      tone={tone}
      size={size}
      icon={
        live ? (
          <span aria-hidden="true" className="relative inline-flex size-2 shrink-0 rounded-full bg-current">
            <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
          </span>
        ) : (
          <Car aria-hidden="true" size={size === "sm" ? 12 : 14} strokeWidth={2.2} />
        )
      }
    >
      <span className="sr-only">{t("ride.badge")}: </span>
      {label}
      {appointment.returnRide ? <span className="sr-only">, {t("ride.roundTrip")}</span> : null}
    </Pill>
  );
}

/** What the visit costs: charged amount (completed), list price, or "Priced on site". */
export function PriceText({ appointment, className }: { appointment: Appointment; className?: string }) {
  const locale = useLocale();
  const tc = useT("common");
  if (appointment.amountAZN !== undefined && appointment.status === "completed") {
    return <span className={cn("tabular font-semibold", className)}>{formatMoney(appointment.amountAZN, locale, { decimals: "auto" })}</span>;
  }
  if (appointment.priceAZN === null) return <span className={cn("text-fg-secondary", className)}>{tc("money.pricedOnSite")}</span>;
  return <span className={cn("tabular", className)}>{formatMoney(appointment.priceAZN, locale, { decimals: "auto" })}</span>;
}
