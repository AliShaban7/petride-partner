"use client";

import { ArrowRight, Car, Clock, House, MapPin, Phone, ShoppingBag, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { AsyncView, ButtonLink, EmptyState, Panel, ProgressBar, SkeletonRows, StatusPill, Tag, buttonClasses } from "@/components/ui";
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

/**
 * Dashboard cap; "View all (N)" opens the full list. Stacked (the 1280px+ side column) three fit;
 * phones show two; when the cards sit two across (tablets) a fourth fills the second row.
 */
const VISIBLE = 4;
const STACKED_VISIBLE = 3;
const PHONE_VISIBLE = 2;
function capClass(index: number): string | undefined {
  if (index >= STACKED_VISIBLE) return "@max-xl:hidden";
  if (index >= PHONE_VISIBLE) return "max-sm:hidden";
  return undefined;
}

/** Live PetRide rides with an ETA countdown; the query polls every 10 s (the "Live" badge says so). */
export function LiveRidesPanel({ query, variant, className }: { query: QueryResult<Ride[]>; variant: RidesVariant; className?: string }) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const count = query.data ? ridesFor(query.data, variant).length : 0;
  // Clinics: the PetRide rides page. Shops: courier orders (rides belong to orders there), only when some may be folded away.
  const allHref =
    variant === "shop" ? localizedHref(locale, ROUTES.orders, { fulfilment: "petride_courier" }) : localizedHref(locale, ROUTES.orders);
  const folds = count > PHONE_VISIBLE;
  const showAll = variant === "clinic" || folds;
  return (
    <Panel
      title={variant === "shop" ? t("rides.titleShop") : t("rides.title")}
      icon={<Car size={20} />}
      className={cn("flex flex-col", className)}
      bodyClassName="@container flex flex-1 flex-col"
      actions={
        <>
          <LiveBadge />
          {showAll ? (
            <ButtonLink href={allHref} variant="ghost" size="sm" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
              {folds ? t("rides.viewAll", { count }) : tc("actions.viewAll")}
            </ButtonLink>
          ) : null}
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
        {(data) => (
          // One column in the dashboard's side column and on phones; two across when the panel spans a tablet row.
          <ul className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
            {ridesFor(data, variant)
              .slice(0, VISIBLE)
              .map((ride, i) => (
                <RideItem key={ride.id} ride={ride} index={i} className={capClass(i)} />
              ))}
          </ul>
        )}
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
  const about = `${t(`rides.${ride.direction}`)}${ride.petNames.length ? ` · ${ride.clientName}` : ""}`;
  const arrives = t("rides.arrivesAt", { time: formatTime(ride.arriveAt) });
  const Icon = DIRECTION_ICON[ride.direction];
  const driver = ride.driver;

  return (
    <li className={cn("@container min-w-0 animate-fade-up rounded-card bg-surface-muted p-3", className)} style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="hidden size-9 shrink-0 items-center justify-center rounded-tile bg-surface text-primary shadow-thumb @sm:inline-flex">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Name and status share the first line (the pill drops under the name when the card is too narrow). */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h3 className="min-w-0 truncate text-body font-semibold text-fg">
                  {href ? (
                    <Link href={href} className="rounded-sm underline-offset-2 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </h3>
                <StatusPill kind="ride" status={ride.status} size="sm" className="shrink-0" />
              </div>
              <p title={about} className="truncate text-meta text-fg-secondary">
                {about}
              </p>
            </div>
            {/* ETA and arrival time. The time carries a clock icon instead of the "Arrives:" word, so the name
                and status keep the width in a narrow column; screen readers and the tooltip get the full label. */}
            <div className="shrink-0 text-right">
              <p className="font-display text-title font-extrabold leading-tight text-fg tabular">
                {eta === null ? "—" : eta <= 0 ? t("rides.arriving") : formatDuration(eta, locale)}
              </p>
              <p title={arrives} className="text-caption text-fg-secondary tabular">
                <span className="sr-only">{arrives}</span>
                <span aria-hidden="true" className="inline-flex items-center gap-1">
                  <Clock size={12} className="shrink-0" />
                  {formatTime(ride.arriveAt)}
                </span>
              </p>
            </div>
          </div>

          {ride.status === "intrip" ? (
            <ProgressBar className="mt-2 h-1.5" value={progress} label={t("rides.progress", { percent: formatPercent(progress, locale) })} />
          ) : null}

          {ride.travelNotes.length ? (
            <ul aria-label={t("rides.travelNotes")} className="mt-2 flex flex-wrap gap-1.5">
              {ride.travelNotes.slice(0, 2).map((note) => (
                <li key={note} className="max-w-full">
                  <Tag tone="warning" className="py-0.5" icon={<TriangleAlert size={13} aria-hidden="true" />}>
                    {note}
                  </Tag>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="line-clamp-2 min-w-0 text-meta text-fg-secondary">
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
                className={buttonClasses({ variant: "secondary", size: "sm", className: "size-11 shrink-0 px-0 lg:size-9 lg:px-0" })}
              >
                <Phone size={16} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
