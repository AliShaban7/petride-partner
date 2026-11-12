"use client";

import { ArrowRight, CalendarDays, Car, ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AsyncView, Button, ButtonLink, EmptyState, Panel, StatusPill, Tag } from "@/components/ui";
import type { QueryResult } from "@/lib/api/hooks";
import type { Appointment, AppointmentStatus, Paged, Ride } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { isLiveRide } from "./LiveRidesPanel";
import { minutesLeft, useNow } from "./now";
import { NowMarker, TimelineList, TimelineRow, TimelineSkeleton, type TimelineState } from "./Timeline";

/** Dashboard cap: what's on now and next. "Show all (N)" unfolds the whole day here; "View all" opens the day view. */
const VISIBLE = 4;
/** Folded, at most this many "on now" rows while there are still visits to come. */
const NOW_VISIBLE = 2;
const OPEN: readonly AppointmentStatus[] = ["requested", "confirmed", "checked_in"];

export type SchedulePanelProps = {
  /** Appointments overlapping today (listAppointments from…to); only the ones starting today are shown. */
  query: QueryResult<Paged<Appointment>>;
  /** Local midnight of today (null before hydration). */
  dayStart: number | null;
  /** Fresher ride data from the live rides query (polls every 10 s). */
  rides: readonly Ride[] | undefined;
  optimistic: Record<string, AppointmentStatus>;
  className?: string;
};

/**
 * Today's appointments as a vertical timeline with a "Now" line. Folded, it shows only what's on now
 * and next (finished visits drop out); "Show all (N)" unfolds the whole day in time order.
 */
export function SchedulePanel({ query, dayStart, rides, optimistic, className }: SchedulePanelProps) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const now = useNow(30_000);
  const [showAll, setShowAll] = useState(false);

  const items = todaysAppointments(query.data?.items ?? [], dayStart, optimistic);

  return (
    <Panel
      title={t("schedule.title")}
      icon={<CalendarDays size={20} />}
      className={className}
      actions={
        <ButtonLink
          href={localizedHref(locale, ROUTES.appointments, { view: "day" })}
          variant="ghost"
          size="sm"
          rightIcon={<ArrowRight size={16} aria-hidden="true" />}
        >
          {tc("actions.viewAll")}
        </ButtonLink>
      }
    >
      <AsyncView
        query={query}
        compact
        isEmpty={() => items.length === 0}
        loading={<TimelineSkeleton />}
        empty={<EmptyState compact pet="tabby" title={t("schedule.emptyTitle")} description={t("schedule.emptyBody")} />}
      >
        {() => {
          const end = (a: Appointment) => new Date(a.end).getTime();
          const start = (a: Appointment) => new Date(a.start).getTime();
          const past = now === null ? [] : items.filter((a) => end(a) <= now && !OPEN.includes(a.status));
          const rest = items.filter((a) => !past.includes(a));
          // Folded: "on now" (started, still running or still open) and "next" (not started yet). Long stays
          // that began in the morning (day care, hotel) would otherwise fill the card and hide who's coming
          // next, so at most two "now" rows are kept (the latest to start) unless there is little left to come.
          const started = now === null ? [] : rest.filter((a) => start(a) <= now);
          const upcoming = rest.filter((a) => !started.includes(a));
          const nowCount = Math.min(started.length, Math.max(NOW_VISIBLE, VISIBLE - upcoming.length));
          const folded = [...started.slice(started.length - nowCount), ...upcoming.slice(0, VISIBLE - nowCount)];
          // Late in the day (nothing left) the last visits stay visible instead of an empty card.
          const shown = showAll ? items : folded.length > 0 ? folded : past.slice(-VISIBLE);
          const hidden = items.length - shown.length;
          const markerAt = now === null ? -1 : shown.findIndex((a) => start(a) > now);
          const rows: ReactNode[] = [];
          shown.forEach((a, i) => {
            if (i === markerAt && now !== null) rows.push(<NowMarker key="now" now={now} />);
            rows.push(<ScheduleRow key={a.id} appointment={a} rides={rides} now={now} index={i} past={past.includes(a)} />);
          });
          // Everything shown has started (nothing left to come): the line goes last.
          if (markerAt === -1 && now !== null) rows.push(<NowMarker key="now" now={now} />);
          return (
            <div className="space-y-1">
              <TimelineList label={t("schedule.listLabel")}>{rows}</TimelineList>
              {hidden > 0 || showAll ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAll}
                  rightIcon={showAll ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  onClick={() => setShowAll((v) => !v)}
                  className="text-fg-secondary"
                >
                  {showAll ? t("schedule.showLess") : t("schedule.showAll", { count: items.length })}
                </Button>
              ) : null}
            </div>
          );
        }}
      </AsyncView>
    </Panel>
  );
}

function ScheduleRow({
  appointment: a,
  rides,
  now,
  index,
  past,
}: {
  appointment: Appointment;
  rides: readonly Ride[] | undefined;
  now: number | null;
  index: number;
  past: boolean;
}) {
  const t = useT("overview");
  const locale = useLocale();
  const startMs = new Date(a.start).getTime();
  const endMs = new Date(a.end).getTime();
  const current = now !== null && startMs <= now && now < endMs && a.status !== "cancelled";
  const state: TimelineState = past || a.status === "cancelled" || a.status === "no_show" ? "past" : a.status === "requested" ? "attention" : current || a.status === "checked_in" ? "current" : "upcoming";

  const ride = rideBadge(a, rides, now);
  const etaText = ride?.key === "rideLive" ? formatDuration(ride.eta ?? 0, locale) : "";
  const badge = ride ? (ride.key === "rideLive" ? t("schedule.rideLive", { eta: etaText }) : t(`schedule.${ride.key}`)) : null;

  return (
    <TimelineRow
      href={localizedHref(locale, ROUTES.appointments, { id: a.id })}
      time={a.start}
      sub={formatDuration(a.durationMin, locale)}
      state={state}
      index={index}
    >
      <p className="truncate text-body-sm font-semibold text-fg">
        {a.petName} <span className="font-normal text-fg-tertiary">· {a.clientName}</span>
      </p>
      <p className="truncate text-meta text-fg-tertiary">{a.serviceName}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <StatusPill kind="appointment" status={a.status} size="sm" />
        {badge ? (
          <Tag tone="white" className="py-0.5" icon={<Car size={13} aria-hidden="true" />}>
            {ride?.key === "rideLive" ? (
              // On the way: the car icon plus the ETA ("25 dəq") keeps it on the status pill's line in a narrow column.
              <span title={badge}>
                <span className="sr-only">{badge}</span>
                <span aria-hidden="true" className="tabular">
                  {etaText}
                </span>
              </span>
            ) : (
              badge
            )}
          </Tag>
        ) : null}
      </div>
    </TimelineRow>
  );
}

/**
 * Appointments that start today (multi-night hotel check-ins included, stays carried over from
 * earlier days left out), with optimistic statuses applied and declined requests dropped. The
 * non-cancelled ones match the "today" KPI exactly.
 */
function todaysAppointments(list: readonly Appointment[], dayStart: number | null, optimistic: Record<string, AppointmentStatus>): Appointment[] {
  return list
    .filter((a) => dayStart === null || new Date(a.start).getTime() >= dayStart)
    .map((a) => (optimistic[a.id] && a.status === "requested" ? { ...a, status: optimistic[a.id] } : a))
    .filter((a) => a.status !== "declined");
}

type BadgeKey = "rideLive" | "rideArrived" | "rideBooked" | "rideHome";

/** What the PetRide ride of an appointment is doing (null = no ride); `eta` in minutes for a ride on its way in. */
function rideBadge(a: Appointment, rides: readonly Ride[] | undefined, now: number | null): { key: BadgeKey; eta?: number } | null {
  if (!a.withRide || a.status === "cancelled") return null;
  const find = (direction: Ride["direction"]) => rides?.find((r) => r.appointmentId === a.id && r.direction === direction);
  const inbound = find("to_partner") ?? a.ride;
  const back = find("from_partner") ?? a.returnRide;
  if (back && isLiveRide(back)) return { key: "rideHome" };
  if (inbound && isLiveRide(inbound)) {
    const eta = now === null ? (inbound.etaMin ?? 0) : Math.max(0, minutesLeft(inbound.arriveAt, now));
    return { key: "rideLive", eta };
  }
  if (inbound?.status === "completed" || a.status === "checked_in" || a.status === "completed") return { key: "rideArrived" };
  return { key: "rideBooked" };
}
