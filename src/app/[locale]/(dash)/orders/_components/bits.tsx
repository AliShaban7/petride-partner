"use client";

import { Car, House, Stethoscope, Store } from "lucide-react";

import { StatusPill, Tag } from "@/components/ui";
import type { Fulfilment, Ride, RideDirection } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { LIVE_RIDE_STATUSES } from "@/lib/status";

/** "PetRide courier" / "Pickup" with an icon (text always present). */
export function FulfilmentTag({ fulfilment, className }: { fulfilment: Fulfilment; className?: string }) {
  const ts = useT("status");
  const Icon = fulfilment === "petride_courier" ? Car : Store;
  return (
    <Tag className={className} icon={<Icon aria-hidden="true" size={13} />}>
      {ts.dynamic(`fulfilment.${fulfilment}`)}
    </Tag>
  );
}

/** "Coming in" / "Going home" / "Courier" with an icon. */
export function DirectionTag({ direction }: { direction: RideDirection }) {
  const ts = useT("status");
  const Icon = direction === "to_partner" ? Stethoscope : direction === "from_partner" ? House : Car;
  return <Tag icon={<Icon size={13} aria-hidden="true" />}>{ts.dynamic(`direction.${direction}`)}</Tag>;
}

/** Ride status pill + "12 min to go" while the ride is live. */
export function RideStatus({ ride, size = "sm", className }: { ride: Pick<Ride, "status" | "etaMin">; size?: "sm" | "md"; className?: string }) {
  const t = useT("orders");
  const locale = useLocale();
  const live = (LIVE_RIDE_STATUSES as readonly string[]).includes(ride.status);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <StatusPill kind="ride" status={ride.status} size={size} />
      {live && ride.etaMin !== undefined ? (
        <span className="whitespace-nowrap text-meta font-semibold text-fg tabular">{t("rides.etaShort", { eta: formatDuration(ride.etaMin, locale) })}</span>
      ) : null}
    </span>
  );
}

/** "5 min ago" with the exact date and time in `title` / `dateTime`. */
export function TimeAgo({ value, now, className }: { value: string; now: number; className?: string }) {
  const locale = useLocale();
  const at = new Date(now);
  return (
    <time dateTime={value} title={formatDateTime(value, locale, at)} className={cn("whitespace-nowrap tabular", className)}>
      {formatRelative(value, locale, at)}
    </time>
  );
}
