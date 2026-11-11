"use client";

import { ArrowRight, Car, ChevronDown, ChevronUp, House, MapPin, Phone, ShoppingBag, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AsyncView, Button, ButtonLink, EmptyState, Panel, ProgressBar, SkeletonRows, StatusPill, Tag, buttonClasses } from "@/components/ui";
import type { QueryResult } from "@/lib/api/hooks";
import type { Ride } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDuration, formatPercent, formatTime, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";
import { LIVE_RIDE_STATUSES } from "@/lib/status";

import { minutesLeft, useNow } from "./now";

export type RidesVariant = "clinic" | "shop";

/** Rides this partner cares about: pets coming in / going home (clinic) or courier deliveries (shop). */
export function ridesFor(rides: readonly Ride[], variant: RidesVariant): Ride[] {
  return rides.filter((r) => (variant === "shop" ? r.direction === "delivery" : r.direction !== "delivery") && r.status !== "cancelled" && r.status !== "completed");
}

export const isLiveRide = (ride: Ride) => (LIVE_RIDE_STATUSES as readonly string[]).includes(ride.status);

/** Live PetRide rides with an ETA countdown; the query polls every 10 s. */
export function LiveRidesPanel({ query, variant, className }: { query: QueryResult<Ride[]>; variant: RidesVariant; className?: string }) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);
  return (
    <Panel
      title={variant === "shop" ? t("rides.titleShop") : t("rides.title")}
      description={t("rides.description")}
      icon={<Car size={20} />}
      className={cn("flex flex-col", className)}
      bodyClassName="flex flex-1 flex-col"
      actions={
        <>
          <LiveBadge />
          {variant === "shop" ? null : (
            <ButtonLink href={localizedHref(locale, ROUTES.orders)} variant="ghost" size="sm" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
              {tc("actions.viewAll")}
            </ButtonLink>
          )}
        </>
      }
    >
      <AsyncView
        query={query}
        compact
        isEmpty={(data) => ridesFor(data, variant).length === 0}
        loading={<SkeletonRows rows={3} />}
        empty={
          <EmptyState
            compact
            className="flex-1 justify-center"
            pet="cream"
            title={variant === "shop" ? t("rides.emptyShopTitle") : t("rides.emptyTitle")}
            description={variant === "shop" ? t("rides.emptyShopBody") : t("rides.emptyBody")}
          />
        }
      >
        {(data) => {
          const rides = ridesFor(data, variant);
          return (
            <>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
                {rides.map((ride, i) => (
                  <RideItem key={ride.id} ride={ride} index={i} className={!showAll && i >= PHONE_VISIBLE ? "max-sm:hidden" : undefined} />
                ))}
              </ul>
              {rides.length > PHONE_VISIBLE ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAll}
                  rightIcon={showAll ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 self-start text-fg-secondary sm:hidden"
                >
                  {showAll ? t("schedule.showLess") : t("schedule.showAll", { count: rides.length })}
                </Button>
              ) : null}
            </>
          );
        }}
      </AsyncView>
    </Panel>
  );
}

function LiveBadge() {
  const t = useT("overview");
  return (
    <span className="inline-flex items-center gap-2 rounded-chip bg-success-bg px-2.5 py-1 text-meta font-semibold text-success-text">
      <span aria-hidden="true" className="size-2 animate-live-dot rounded-full bg-success" />
      {t("rides.live")}
    </span>
  );
}

const DIRECTION_ICON = { to_partner: MapPin, from_partner: House, delivery: ShoppingBag } as const;

/** Phones list the first rides only, with a "Show all" toggle. */
const PHONE_VISIBLE = 3;

function RideItem({ ride, index, className }: { ride: Ride; index: number; className?: string }) {
  const t = useT("overview");
  const locale = useLocale();
  const now = useNow(5_000);
  const eta = now === null ? (ride.etaMin ?? null) : Math.max(0, minutesLeft(ride.arriveAt, now));
  const pickup = new Date(ride.pickupAt).getTime();
  const arrive = new Date(ride.arriveAt).getTime();
  const progress =
    ride.status === "intrip" && now !== null && arrive > pickup ? Math.min(0.98, Math.max(0.02, (now - pickup) / (arrive - pickup))) : ride.progress;
  const href = ride.orderId
    ? localizedHref(locale, ROUTES.orders, { id: ride.orderId })
    : ride.appointmentId
      ? localizedHref(locale, ROUTES.appointments, { id: ride.appointmentId })
      : undefined;
  const name = ride.petNames.length ? ride.petNames.join(", ") : ride.clientName;
  const Icon = DIRECTION_ICON[ride.direction];
  const driver = ride.driver;

  return (
    <li className={cn("min-w-0 animate-fade-up rounded-card bg-surface-muted p-3.5 sm:p-4", className)} style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="hidden size-10 shrink-0 items-center justify-center rounded-tile bg-surface text-primary shadow-thumb sm:inline-flex">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-body font-semibold text-fg">
                {href ? (
                  <Link href={href} className="rounded-sm underline-offset-2 hover:underline">
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </h3>
              <p className="truncate text-meta text-fg-secondary">
                {t(`rides.${ride.direction}`)}
                {ride.petNames.length ? ` · ${ride.clientName}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-h2 font-extrabold leading-none text-fg tabular">
                {eta === null ? "—" : eta <= 0 ? t("rides.arriving") : formatDuration(eta, locale)}
              </p>
              <p className="mt-1 text-caption text-fg-secondary tabular">{t("rides.arrivesAt", { time: formatTime(ride.arriveAt) })}</p>
            </div>
          </div>

          <div className="mt-2.5">
            <StatusPill kind="ride" status={ride.status} size="sm" />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="min-w-0 text-meta text-fg-secondary">
              {driver ? (
                <>
                  {driver.name} · {driver.car.model} · <span className="whitespace-nowrap tabular">{driver.car.plate}</span>
                </>
              ) : (
                t("rides.noDriver")
              )}
            </p>
            {driver ? (
              <a
                href={phoneHref(driver.phone)}
                aria-label={t("rides.call", { name: driver.name })}
                title={t("rides.call", { name: driver.name })}
                className={buttonClasses({ variant: "secondary", size: "sm", className: "size-10 shrink-0 px-0" })}
              >
                <Phone size={16} aria-hidden="true" />
              </a>
            ) : null}
          </div>

          {ride.status === "intrip" ? (
            <ProgressBar className="mt-3" value={progress} label={t("rides.progress", { percent: formatPercent(progress, locale) })} />
          ) : null}

          {ride.travelNotes.length ? (
            <ul aria-label={t("rides.travelNotes")} className={cn("mt-2.5 flex flex-wrap gap-1.5")}>
              {ride.travelNotes.slice(0, 2).map((note) => (
                <li key={note} className="max-w-full">
                  <Tag tone="warning" icon={<TriangleAlert size={13} aria-hidden="true" />}>
                    {note}
                  </Tag>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}
