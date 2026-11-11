"use client";

import { CalendarDays, Phone, Star, TriangleAlert } from "lucide-react";

import { ButtonLink, DetailList, Drawer, ErrorState, ProgressBar, Skeleton, SkeletonText, Tag, buttonClasses } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Ride } from "@/lib/api/types";
import { formatDateTime, formatDistance, formatFixed, formatMoney, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

import { DirectionTag, RideStatus } from "./bits";
import { useNow } from "./hooks";

/** Ride details (`/orders?id=ride-1001`): live status, route, driver, the owner's travel notes. */
export function RideDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useT("orders");
  const ts = useT("status");
  const locale = useLocale();
  const q = useApiQuery(["rides", "detail", id], (api) => api.getRide(id ?? ""), { enabled: Boolean(id), refreshMs: 15_000 });
  const ride = id && q.data?.id === id ? q.data : undefined;
  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={ride ? t("rides.drawer.title", { pets: ride.petNames.join(", ") || ride.clientName, direction: ts.dynamic(`direction.${ride.direction}`) }) : t("rides.title")}
      description={ride?.clientName}
      footer={
        ride?.appointmentId ? (
          <ButtonLink
            href={localizedHref(locale, ROUTES.appointments, { id: ride.appointmentId })}
            variant="secondary"
            leftIcon={<CalendarDays size={18} aria-hidden="true" />}
          >
            {t("rides.drawer.openAppointment")}
          </ButtonLink>
        ) : undefined
      }
    >
      {ride ? (
        <RideDetails ride={ride} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} compact />
      ) : (
        <div aria-busy="true" className="space-y-5 pt-2">
          <Skeleton className="h-7 w-40 rounded-chip" />
          <SkeletonText lines={5} />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      )}
    </Drawer>
  );
}

function RideDetails({ ride }: { ride: Ride }) {
  const t = useT("orders");
  const locale = useLocale();
  const now = new Date(useNow());
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <RideStatus ride={ride} size="md" />
        <DirectionTag direction={ride.direction} />
        {ride.roundTrip ? <Tag>{t("rides.roundTrip")}</Tag> : null}
      </div>
      {ride.status === "intrip" ? <ProgressBar value={ride.progress} label={t("rides.drawer.progress")} /> : null}

      <DetailList
        columns={2}
        items={[
          { label: t("rides.drawer.from"), value: <Place label={ride.from.label} address={ride.from.address} /> },
          { label: t("rides.drawer.to"), value: <Place label={ride.to.label} address={ride.to.address} /> },
          { label: t("rides.drawer.pickup"), value: <span className="tabular">{formatDateTime(ride.pickupAt, locale, now)}</span> },
          { label: t("rides.drawer.arrive"), value: <span className="tabular">{formatDateTime(ride.arriveAt, locale, now)}</span> },
          { label: t("rides.drawer.distance"), value: formatDistance(ride.distanceKm, locale) },
          { label: t("rides.drawer.price"), value: <span className="tabular">{formatMoney(ride.priceAZN, locale)}</span> },
        ]}
      />

      <div className="rounded-card bg-soft-mint p-4">
        <p className="text-meta font-semibold text-fg-tertiary">{t("rides.drawer.driver")}</p>
        {ride.driver ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold text-fg">
                {ride.driver.name}
                <span className="inline-flex items-center gap-0.5 text-meta font-semibold text-fg-tertiary">
                  <Star size={13} aria-hidden="true" className="fill-current" />
                  {formatFixed(ride.driver.rating, 1, locale)}
                </span>
              </p>
              <p className="text-meta text-fg-tertiary">
                {t("rides.drawer.car")}: {ride.driver.car.model} · {ride.driver.car.color} · <span className="font-semibold text-fg">{ride.driver.car.plate}</span>
              </p>
            </div>
            <a href={phoneHref(ride.driver.phone)} className={buttonClasses({ variant: "outline", size: "sm" })}>
              <Phone size={16} aria-hidden="true" />
              {t("rides.drawer.callDriver")}
            </a>
          </div>
        ) : (
          <p className="mt-1 text-body-sm text-fg-tertiary">{t("rides.noDriver")}</p>
        )}
      </div>

      {ride.travelNotes.length ? (
        <div>
          <p className="mb-2 text-meta font-semibold text-fg-secondary">{t("rides.drawer.travelNotes")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {ride.travelNotes.map((note) => (
              <li key={note}>
                <Tag tone="warning" icon={<TriangleAlert size={13} aria-hidden="true" />}>
                  {note}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ride.driverNote ? (
        <div className="rounded-card bg-soft-sand p-4">
          <p className="text-meta font-semibold text-fg-tertiary">{t("rides.drawer.driverNote")}</p>
          <p className="mt-1 text-body text-fg">{ride.driverNote}</p>
        </div>
      ) : null}
    </div>
  );
}

function Place({ label, address }: { label: string; address: string }) {
  return (
    <span className="block">
      <span className="block">{label}</span>
      {address && address !== label ? <span className="block text-meta font-normal text-fg-secondary">{address}</span> : null}
    </span>
  );
}
