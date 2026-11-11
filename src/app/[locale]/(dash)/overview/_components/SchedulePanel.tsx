"use client";

import { ArrowRight, CalendarDays, Car, ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AsyncView, Avatar, Button, ButtonLink, EmptyState, Panel, StatusPill, Tag } from "@/components/ui";
import type { QueryResult } from "@/lib/api/hooks";
import type { Appointment, AppointmentStatus, Paged, Ride } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { isLiveRide } from "./LiveRidesPanel";
import { minutesLeft, useNow } from "./now";
import { NowMarker, TimelineList, TimelineRow, TimelineSkeleton, type TimelineState } from "./Timeline";

const VISIBLE = 8;
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

/** Today's appointments as a vertical timeline with a "Now" line. Earlier, finished visits fold away. */
export function SchedulePanel({ query, dayStart, rides, optimistic, className }: SchedulePanelProps) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const now = useNow(30_000);
  const [showEarlier, setShowEarlier] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const items = todaysAppointments(query.data?.items ?? [], dayStart, optimistic);
  const counted = items.filter((a) => a.status !== "cancelled").length;

  return (
    <Panel
      title={t("schedule.title")}
      description={query.data && counted > 0 ? t.plural("schedule.count", counted) : undefined}
      icon={<CalendarDays size={20} />}
      className={className}
      actions={
        <ButtonLink href={localizedHref(locale, ROUTES.appointments)} variant="ghost" size="sm" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
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
          const visibleRest = showAll ? rest : rest.slice(0, VISIBLE);
          const shown = showEarlier ? [...past, ...visibleRest] : visibleRest;
          const markerAt = now === null ? -1 : shown.findIndex((a) => start(a) > now);
          const rows: ReactNode[] = [];
          shown.forEach((a, i) => {
            if (i === markerAt && now !== null) rows.push(<NowMarker key="now" now={now} />);
            rows.push(<ScheduleRow key={a.id} appointment={a} rides={rides} now={now} index={i} past={past.includes(a)} />);
          });
          if (markerAt === -1 && now !== null && rest.length === visibleRest.length) {
            rows.push(<NowMarker key="now" now={now} />);
          }
          return (
            <div className="space-y-2">
              {past.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showEarlier}
                  rightIcon={showEarlier ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  onClick={() => setShowEarlier((v) => !v)}
                  className="text-fg-secondary"
                >
                  {showEarlier ? t("schedule.hideEarlier") : t("schedule.earlier", { count: past.length })}
                </Button>
              ) : null}
              <TimelineList label={t("schedule.listLabel")}>{rows}</TimelineList>
              {rest.length > VISIBLE ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAll}
                  rightIcon={showAll ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  onClick={() => setShowAll((v) => !v)}
                  className="text-fg-secondary"
                >
                  {showAll ? t("schedule.showLess") : t("schedule.showAll", { count: rest.length })}
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

  const badge = rideBadge(a, rides, now, (key, eta) => (key === "rideLive" ? t("schedule.rideLive", { eta: formatDuration(eta ?? 0, locale) }) : t(`schedule.${key}`)));

  return (
    <TimelineRow
      href={localizedHref(locale, ROUTES.appointments, { id: a.id })}
      time={a.start}
      sub={formatDuration(a.durationMin, locale)}
      state={state}
      index={index}
    >
      <div className="flex items-start gap-3">
        <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} size="sm" shape="tile" className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-fg">
            {a.petName} <span className="font-normal text-fg-tertiary">· {a.clientName}</span>
          </p>
          <p className="truncate text-meta text-fg-tertiary">{a.serviceName}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill kind="appointment" status={a.status} size="sm" />
            {badge ? (
              <Tag tone="white" icon={<Car size={13} aria-hidden="true" />}>
                {badge}
              </Tag>
            ) : null}
          </div>
        </div>
      </div>
    </TimelineRow>
  );
}

/**
 * Appointments that start today (multi-night hotel check-ins included, stays carried over from
 * earlier days left out), with optimistic statuses applied and declined requests dropped. The
 * non-cancelled ones match the "today" KPI exactly.
 */
export function todaysAppointments(list: readonly Appointment[], dayStart: number | null, optimistic: Record<string, AppointmentStatus>): Appointment[] {
  return list
    .filter((a) => dayStart === null || new Date(a.start).getTime() >= dayStart)
    .map((a) => (optimistic[a.id] && a.status === "requested" ? { ...a, status: optimistic[a.id] } : a))
    .filter((a) => a.status !== "declined");
}

type BadgeKey = "rideLive" | "rideArrived" | "rideBooked" | "rideHome";

/** What the PetRide ride of an appointment is doing, in one short label (null = no ride). */
function rideBadge(a: Appointment, rides: readonly Ride[] | undefined, now: number | null, label: (key: BadgeKey, eta?: number) => string): string | null {
  if (!a.withRide || a.status === "cancelled") return null;
  const find = (direction: Ride["direction"]) => rides?.find((r) => r.appointmentId === a.id && r.direction === direction);
  const inbound = find("to_partner") ?? a.ride;
  const back = find("from_partner") ?? a.returnRide;
  if (back && isLiveRide(back)) return label("rideHome");
  if (inbound && isLiveRide(inbound)) {
    const eta = now === null ? (inbound.etaMin ?? 0) : Math.max(0, minutesLeft(inbound.arriveAt, now));
    return label("rideLive", eta);
  }
  if (inbound?.status === "completed" || a.status === "checked_in" || a.status === "completed") return label("rideArrived");
  return label("rideBooked");
}
