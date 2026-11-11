"use client";

import { Car, Phone, Star, TriangleAlert } from "lucide-react";

import { Avatar, ProgressBar, StatusPill, Tag } from "@/components/ui";
import type { Ride } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayLabel, formatDistance, formatFixed, formatPhone, formatTime, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { LIVE_RIDE_STATUSES } from "@/lib/status";

/** A PetRide ride linked to the appointment: live status + ETA, route with times, driver and car. */
export function RideCard({ ride, now }: { ride: Ride; now: number }) {
  const t = useT("appointments");
  const ts = useT("status");
  const locale = useLocale();
  const live = (LIVE_RIDE_STATUSES as readonly string[]).includes(ride.status);
  const today = now ? new Date(now) : undefined;
  const done = ride.status === "completed";
  const cancelled = ride.status === "cancelled";

  return (
    <div className={cn("rounded-card border p-4", live ? "border-primary/40 bg-primary-selected" : "border-border bg-surface")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <Car aria-hidden="true" size={18} className="text-primary" />
          {ts.dynamic(`direction.${ride.direction}`)}
          {ride.roundTrip ? <Tag tone="white">{t("ride.roundTrip")}</Tag> : null}
        </p>
        <StatusPill kind="ride" status={ride.status} size="sm" />
      </div>

      {live && ride.etaMin !== undefined ? (
        <div className="mt-3 space-y-2">
          <p className="text-body-sm text-fg">
            {t("ride.arrivesIn", { min: ride.etaMin, time: formatTime(ride.arriveAt) })}
          </p>
          {ride.status === "intrip" ? <ProgressBar value={ride.progress} label={t("ride.progress")} /> : null}
        </div>
      ) : null}

      <ol className="mt-3 space-y-2.5 text-body-sm">
        <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
          <span className="font-semibold tabular text-fg">{formatTime(ride.pickupAt)}</span>
          <span className="min-w-0">
            <span className="block font-medium text-fg">
              {t("ride.pickupFrom")}: {ride.from.label}
            </span>
            <span className="block text-meta text-fg-secondary">{ride.from.address}</span>
          </span>
        </li>
        <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2">
          <span className="font-semibold tabular text-fg">{formatTime(ride.arriveAt)}</span>
          <span className="min-w-0">
            <span className="block font-medium text-fg">
              {done ? t("ride.droppedAt") : t("ride.dropAt")}: {ride.to.label}
            </span>
            <span className="block text-meta text-fg-secondary">{ride.to.address}</span>
          </span>
        </li>
      </ol>
      <p className="mt-2 text-meta text-fg-secondary">
        {today ? formatDayLabel(ride.pickupAt, locale, today) : null} · {formatDistance(ride.distanceKm, locale)}
      </p>

      {cancelled ? null : ride.driver ? (
        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
          <Avatar name={ride.driver.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 font-semibold text-fg">
              {ride.driver.name}
              <span className="inline-flex items-center gap-0.5 text-meta font-medium text-fg-secondary">
                <Star aria-hidden="true" size={12} className="fill-current" />
                <span className="sr-only">{t("ride.rating")}</span>
                {formatFixed(ride.driver.rating, 1, locale)}
              </span>
            </p>
            <p className="text-meta text-fg-secondary">
              {ride.driver.car.model} · {ride.driver.car.color} · <span className="font-semibold tabular text-fg">{ride.driver.car.plate}</span>
            </p>
          </div>
          <a
            href={phoneHref(ride.driver.phone)}
            aria-label={t("ride.callDriver", { name: ride.driver.name, phone: formatPhone(ride.driver.phone) })}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary transition-colors hover:bg-pastel-mint"
          >
            <Phone aria-hidden="true" size={18} />
          </a>
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-meta text-fg-secondary">{ride.status === "searching" ? t("ride.searching") : t("ride.noDriverYet")}</p>
      )}

      {ride.travelNotes.length || ride.driverNote ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ride.travelNotes.map((note) => (
            <Tag key={note} tone="warning" icon={<TriangleAlert aria-hidden="true" size={12} />}>
              {note}
            </Tag>
          ))}
          {ride.driverNote ? <Tag>{ride.driverNote}</Tag> : null}
        </div>
      ) : null}
    </div>
  );
}
