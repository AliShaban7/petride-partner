"use client";

import {
  Ban,
  Car,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Hourglass,
  MapPin,
  Package,
  PackageCheck,
  Search,
  Sparkles,
  TriangleAlert,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LIVE_RIDE_STATUSES, PILL_TONE_CLASSES, STATUS_TONES, type PillTone, type StatusKind, type StatusOf } from "@/lib/status";

const ICONS: Partial<Record<StatusKind, Record<string, LucideIcon>>> = {
  appointment: {
    requested: Sparkles,
    confirmed: CircleCheck,
    checked_in: UserCheck,
    completed: CheckCheck,
    no_show: UserX,
    cancelled: Ban,
    declined: CircleX,
  },
  order: { new: Sparkles, preparing: Package, ready: PackageCheck, delivered: CheckCheck, picked_up: CheckCheck, cancelled: Ban },
  ride: { scheduled: Clock, searching: Search, onway: Car, arrived: MapPin, intrip: Car, completed: CheckCheck, cancelled: Ban },
  health: { ok: CircleCheck, due_soon: Hourglass, overdue: TriangleAlert },
  vaccine: { done: CircleCheck, due_soon: Hourglass, overdue: TriangleAlert, scheduled: CircleDashed },
};

export type PillProps = {
  tone?: PillTone;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

/** Generic rounded label with a tone (bg + text ≥ 4.8:1). Use StatusPill for statuses. */
export function Pill({ tone = "neutral", icon, size = "md", className, children }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-chip font-semibold",
        size === "sm" ? "px-2 py-0.5 text-caption" : "px-2.5 py-1 text-meta",
        PILL_TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type StatusPillProps<K extends StatusKind> = {
  kind: K;
  status: StatusOf<K>;
  size?: "sm" | "md";
  /** Override the label (defaults to the `status` namespace: status.<kind>.<status>). */
  label?: string;
  /** Hide the icon (the text label is always shown). */
  noIcon?: boolean;
  className?: string;
};

/**
 * Status label for appointments, orders, rides, pet health, vaccines, payment, availability and stock.
 * Always text + colour (+ icon); live ride statuses get a pulsing dot (reduced-motion safe).
 *   <StatusPill kind="appointment" status={a.status} />
 */
export function StatusPill<K extends StatusKind>({ kind, status, size = "md", label, noIcon, className }: StatusPillProps<K>) {
  const t = useT("status");
  const tone = (STATUS_TONES[kind] as Record<string, PillTone>)[status] ?? "neutral";
  const Icon = ICONS[kind]?.[status] ?? CircleDot;
  const live = kind === "ride" && (LIVE_RIDE_STATUSES as readonly string[]).includes(status);
  const iconSize = size === "sm" ? 12 : 14;
  return (
    <Pill
      tone={tone}
      size={size}
      className={className}
      icon={
        live ? (
          <span aria-hidden="true" className="relative inline-flex size-2 shrink-0 rounded-full bg-current">
            <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
          </span>
        ) : noIcon ? null : (
          <Icon aria-hidden="true" size={iconSize} strokeWidth={2.2} />
        )
      }
    >
      {label ?? t.dynamic(`${kind}.${status}`)}
    </Pill>
  );
}
