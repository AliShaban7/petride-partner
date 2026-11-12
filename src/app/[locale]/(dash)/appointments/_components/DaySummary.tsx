"use client";

import { Car, Clock } from "lucide-react";
import Link from "next/link";

import type { Appointment, PartnerProfile } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatNumber, formatTime, formatTimeRange } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { MINUTE, hoursForDay, startOfDay } from "../_lib/time";
import { RideBadge } from "./bits";

/** Rides listed in the side panel; the rest are one click away on the PetRide rides page. */
const RIDES_SHOWN = 3;

/** Side panel of the Day view: the day in numbers, PetRide rides (first few), opening hours. */
export function DaySummary({
  day,
  today,
  appointments,
  partner,
  onOpen,
}: {
  day: number;
  /** Local midnight of today (picks the rides tab the "view all" link opens). */
  today: number;
  appointments: Appointment[];
  partner?: PartnerProfile;
  onOpen: (id: string) => void;
}) {
  const t = useT("appointments");
  const tc = useT("common");
  const locale = useLocale();
  const end = startOfDay(day, 1);
  const inDay = appointments.filter((a) => new Date(a.start).getTime() < end && new Date(a.end).getTime() > day);
  const active = inDay.filter((a) => a.status !== "cancelled" && a.status !== "declined");
  const rides = inDay
    .filter((a) => a.ride && a.ride.status !== "cancelled" && new Date(a.start).getTime() >= day)
    .sort((a, b) => (a.ride?.arriveAt ?? "").localeCompare(b.ride?.arriveAt ?? ""));
  const hours = partner ? hoursForDay(partner.hours, day) : null;
  const ridesHref = localizedHref(locale, ROUTES.orders, day > today ? { tab: "upcoming" } : day < today ? { tab: "past" } : undefined);

  const tiles = [
    { key: "total", value: active.length, tone: "bg-pastel-mint" },
    { key: "requests", value: inDay.filter((a) => a.status === "requested").length, tone: "bg-pastel-peach" },
    { key: "checkedIn", value: inDay.filter((a) => a.status === "checked_in").length, tone: "bg-pastel-lilac" },
    { key: "withRide", value: active.filter((a) => a.withRide).length, tone: "bg-pastel-sand" },
  ] as const;

  return (
    // On desktops as tall as the day box next to it (day strip + timeline); scrolls inside if it's longer.
    <aside aria-label={t("summary.title")} className="space-y-3 lg:-mx-1 lg:max-h-[max(26.75rem,calc(100dvh-22.25rem))] lg:overflow-y-auto lg:px-1 lg:pt-1">
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((tile, i) => (
          <div key={tile.key} className={cn("animate-fade-up rounded-card px-3 py-2", tile.tone)} style={{ animationDelay: `${i * 60}ms` }}>
            <dt className="text-meta font-medium text-fg-tertiary">{t.dynamic(`summary.${tile.key}`)}</dt>
            <dd className="font-display text-h2 font-extrabold text-fg tabular">{formatNumber(tile.value, locale)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="day-rides">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 id="day-rides" className="flex items-center gap-2 text-body-sm font-semibold text-fg">
            <Car aria-hidden="true" size={16} className="text-primary" />
            {t("summary.rides")}
            {rides.length ? <span className="text-meta font-semibold text-fg-secondary tabular">{formatNumber(rides.length, locale)}</span> : null}
          </h3>
          {rides.length > RIDES_SHOWN ? (
            <Link href={ridesHref} className="inline-flex min-h-11 items-center text-meta font-semibold text-primary underline-offset-4 hover:underline lg:min-h-9">
              {tc("actions.viewAll")}
            </Link>
          ) : null}
        </div>
        {rides.length ? (
          <ul className="divide-y divide-border">
            {rides.slice(0, RIDES_SHOWN).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a.id)} className="block min-h-11 w-full py-1.5 text-left">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-body-sm font-semibold text-fg">{a.petName}</span>
                    <RideBadge appointment={a} showNone={false} />
                  </span>
                  <span className="block text-meta text-fg-secondary tabular">
                    {t("summary.rideTimes", { pickup: formatTime(a.ride!.pickupAt), arrive: formatTime(a.ride!.arriveAt) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-fg-secondary">{t("summary.noRides")}</p>
        )}
      </section>

      {partner ? (
        <section aria-labelledby="day-hours" className="rounded-card bg-surface-muted px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 id="day-hours" className="flex items-center gap-2 text-body-sm font-semibold text-fg">
              <Clock aria-hidden="true" size={16} className="text-primary" />
              {t("summary.hours")}
            </h3>
            <p className="text-body-sm text-fg tabular">{hours ? formatTimeRange(day + hours.open * MINUTE, day + hours.close * MINUTE) : t("calendar.closed")}</p>
          </div>
          {!partner.hoursConfirmed ? (
            <p className="mt-0.5 text-meta text-fg-secondary">
              {t("summary.hoursUnconfirmed")}{" "}
              <Link href={localizedHref(locale, ROUTES.settings)} className="font-semibold text-primary underline underline-offset-4">
                {t("summary.confirmHours")}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
