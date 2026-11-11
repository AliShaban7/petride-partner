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

/** Side panel of the Day view: the day in numbers, PetRide rides, opening hours. */
export function DaySummary({ day, appointments, partner, onOpen }: { day: number; appointments: Appointment[]; partner?: PartnerProfile; onOpen: (id: string) => void }) {
  const t = useT("appointments");
  const locale = useLocale();
  const end = startOfDay(day, 1);
  const inDay = appointments.filter((a) => new Date(a.start).getTime() < end && new Date(a.end).getTime() > day);
  const active = inDay.filter((a) => a.status !== "cancelled" && a.status !== "declined");
  const rides = inDay
    .filter((a) => a.ride && a.ride.status !== "cancelled" && new Date(a.start).getTime() >= day)
    .sort((a, b) => (a.ride?.arriveAt ?? "").localeCompare(b.ride?.arriveAt ?? ""));
  const hours = partner ? hoursForDay(partner.hours, day) : null;

  const tiles = [
    { key: "total", value: active.length, tone: "bg-pastel-mint" },
    { key: "requests", value: inDay.filter((a) => a.status === "requested").length, tone: "bg-pastel-peach" },
    { key: "checkedIn", value: inDay.filter((a) => a.status === "checked_in").length, tone: "bg-pastel-lilac" },
    { key: "withRide", value: active.filter((a) => a.withRide).length, tone: "bg-pastel-sand" },
  ] as const;

  return (
    <aside aria-label={t("summary.title")} className="space-y-5">
      <dl className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile, i) => (
          <div key={tile.key} className={cn("animate-fade-up rounded-card px-4 py-3", tile.tone)} style={{ animationDelay: `${i * 60}ms` }}>
            <dt className="text-meta font-medium text-fg-tertiary">{t.dynamic(`summary.${tile.key}`)}</dt>
            <dd className="font-display text-h1 font-extrabold text-fg tabular">{formatNumber(tile.value, locale)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="day-rides">
        <h3 id="day-rides" className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-fg">
          <Car aria-hidden="true" size={16} className="text-primary" />
          {t("summary.rides")}
        </h3>
        {rides.length ? (
          <ul className="divide-y divide-border">
            {rides.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm font-semibold text-fg">{a.petName}</span>
                    <span className="block text-meta text-fg-secondary tabular">
                      {t("summary.rideTimes", { pickup: formatTime(a.ride!.pickupAt), arrive: formatTime(a.ride!.arriveAt) })}
                    </span>
                  </span>
                  <RideBadge appointment={a} showNone={false} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-fg-secondary">{t("summary.noRides")}</p>
        )}
      </section>

      {partner ? (
        <section aria-labelledby="day-hours" className="rounded-card bg-surface-muted px-4 py-3">
          <h3 id="day-hours" className="flex items-center gap-2 text-body-sm font-semibold text-fg">
            <Clock aria-hidden="true" size={16} className="text-primary" />
            {t("summary.hours")}
          </h3>
          <p className="mt-1 text-body-sm text-fg tabular">
            {hours ? formatTimeRange(day + hours.open * MINUTE, day + hours.close * MINUTE) : t("calendar.closed")}
          </p>
          {!partner.hoursConfirmed ? (
            <p className="mt-1 text-meta text-fg-secondary">
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
