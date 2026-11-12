"use client";

import { BedDouble, MessageSquareText, Plus } from "lucide-react";
import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";

import { Avatar, Button, EmptyState, Skeleton, StatusPill } from "@/components/ui";
import type { Appointment, OpeningHoursDay } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatDuration, formatTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { hoursForDay, isStay, startOfDay } from "../_lib/time";
import { availableActions, quickActions, type ActionKind } from "../_lib/useAppointmentActions";
import { CATEGORY_STYLE, RideBadge } from "./bits";
import { STATUS_ICONS, blockClasses } from "./WeekCalendar";

export type DayTimelineProps = {
  day: number;
  appointments: Appointment[];
  now: number;
  hours?: OpeningHoursDay[];
  loading?: boolean;
  isPending: (id: string) => boolean;
  onOpen: (id: string) => void;
  onAction: (kind: ActionKind, a: Appointment) => void;
  onCreate: () => void;
  /** Horizontal swipe on phones: −1 = previous day, 1 = next day. */
  onSwipe?: (dir: -1 | 1) => void;
  /** Extra line under the list (e.g. "cancelled are hidden"). */
  footnote?: ReactNode;
  /** Classes for the root, e.g. a max height + overflow to make the day scroll inside its own box. */
  className?: string;
};

/**
 * One day as a vertical timeline: hotel guests on top, then every visit in time order on a rail,
 * with a "now" marker. Requests and today's arrivals get one-tap buttons.
 */
export function DayTimeline({ day, appointments, now, hours, loading, isPending, onOpen, onAction, onCreate, onSwipe, footnote, className }: DayTimelineProps) {
  const t = useT("appointments");
  const locale = useLocale();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef(0);
  const dayEnd = startOfDay(day, 1);
  const inDay = appointments.filter((a) => new Date(a.start).getTime() < dayEnd && new Date(a.end).getTime() > day);
  const stays = inDay.filter(isStay);
  const timed = inDay.filter((a) => !isStay(a)).sort((a, b) => a.start.localeCompare(b.start));
  const open = hoursForDay(hours, day);
  const isToday = now > 0 && startOfDay(now) === day;
  const nowIndex = isToday ? timed.findIndex((a) => new Date(a.start).getTime() > now) : -1;
  const nowAt = nowIndex === -1 && isToday ? timed.length : nowIndex;

  // When the day scrolls inside its own box (desktop), open today at the "now" marker. Only the box
  // scrolls (never the page), once per day shown; a box that isn't scrollable ignores scrollTop.
  useEffect(() => {
    const el = root.current;
    if (!el || loading || !isToday || scrolledFor.current === day) return;
    scrolledFor.current = day;
    const marker = el.querySelector<HTMLElement>("[data-now]");
    if (!marker || el.scrollHeight <= el.clientHeight) return;
    const top = marker.getBoundingClientRect().top - el.getBoundingClientRect().top;
    if (top > el.clientHeight - 32) el.scrollTop += top - el.clientHeight / 4;
  }, [day, isToday, loading]);

  const onTouchStart = (e: TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !onSwipe) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe(dx < 0 ? 1 : -1);
  };

  if (loading) {
    return (
      <div aria-hidden="true" className="space-y-2 pt-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
            <Skeleton className="mt-3 h-4 w-12" />
            <Skeleton className="h-16 w-full rounded-card" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={root} onTouchStart={onSwipe ? onTouchStart : undefined} onTouchEnd={onSwipe ? onTouchEnd : undefined} className={cn("min-w-0", className)}>
      {hours && !open ? (
        <p className="mb-3 rounded-card bg-surface-muted px-4 py-2.5 text-body-sm text-fg-secondary">{t("day.closed")}</p>
      ) : null}

      {stays.length ? (
        <section aria-label={t("day.inHouse")} className="mb-3">
          <h3 className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-fg-secondary">
            <BedDouble aria-hidden="true" size={16} />
            {t("day.inHouse")} · <span className="tabular">{stays.length}</span>
          </h3>
          {/* Phones: one swipeable row (`relative` keeps the sr-only text inside the clip); wraps from 640px. */}
          <ul className="scrollbar-none relative -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0">
            {stays.map((a) => {
              const Icon = STATUS_ICONS[a.status];
              return (
                <li key={a.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpen(a.id)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-tile border-l-4 py-1 pl-1.5 pr-3 text-left text-body-sm text-fg shadow-thumb transition-shadow hover:shadow-card-hover lg:min-h-9",
                      blockClasses(a),
                    )}
                  >
                    <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} size="xs" />
                    <span className="font-semibold">{a.petName}</span>
                    <span className="text-meta text-fg-tertiary">
                      {a.durationMin >= 1440 ? `${formatDayMonth(a.start, locale)} – ${formatDayMonth(a.end, locale)}` : `${formatTime(a.start)}–${formatTime(a.end)}`}
                    </span>
                    <Icon aria-hidden="true" size={14} className="text-fg-tertiary" />
                    <StatusSr status={a.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {timed.length === 0 && stays.length === 0 ? (
        <EmptyState
          compact
          pet="cream"
          title={t("day.emptyTitle")}
          description={t("day.emptyBody")}
          action={
            <Button variant="secondary" size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={onCreate}>
              {t("newAppointment")}
            </Button>
          }
        />
      ) : timed.length === 0 ? (
        <p className="py-4 text-body-sm text-fg-secondary">{t("day.noVisits")}</p>
      ) : (
        <ol className="min-w-0" aria-label={t("day.timeline")}>
          {timed.map((a, i) => (
            <TimelineRow key={a.id} a={a} now={now} first={i === 0} last={i === timed.length - 1 && nowAt !== timed.length} pending={isPending(a.id)} onOpen={onOpen} onAction={onAction} nowBefore={nowAt === i} index={i} />
          ))}
          {nowAt === timed.length ? <NowMarker now={now} /> : null}
        </ol>
      )}
      {footnote ? <p className="mt-3 text-meta text-fg-secondary">{footnote}</p> : null}
    </div>
  );
}

function StatusSr({ status }: { status: Appointment["status"] }) {
  const ts = useT("status");
  return <span className="sr-only">, {ts.dynamic(`appointment.${status}`)}</span>;
}

const ROW = "grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[4rem_1.5rem_minmax(0,1fr)] sm:gap-x-3";

function NowMarker({ now }: { now: number }) {
  const t = useT("appointments");
  return (
    <li data-now className={cn(ROW, "items-center py-1.5")}>
      <span className="text-right text-caption font-bold text-accent-strong tabular">{formatTime(now)}</span>
      <span aria-hidden="true" className="justify-self-center">
        <span className="block size-3 rounded-full bg-accent-strong ring-4 ring-accent-tint" />
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 flex-1 rounded-chip bg-accent-strong" />
        <span className="text-caption font-bold text-accent-strong">{t("day.now")}</span>
      </span>
    </li>
  );
}

function TimelineRow({
  a,
  now,
  first,
  last,
  pending,
  onOpen,
  onAction,
  nowBefore,
  index,
}: {
  a: Appointment;
  now: number;
  first: boolean;
  last: boolean;
  pending: boolean;
  onOpen: (id: string) => void;
  onAction: (kind: ActionKind, a: Appointment) => void;
  nowBefore: boolean;
  index: number;
}) {
  const t = useT("appointments");
  const locale = useLocale();
  const quick = quickActions(availableActions(a, now), a);
  return (
    <>
      {nowBefore ? <NowMarker now={now} /> : null}
      <li className={cn(ROW, "animate-fade-up")} style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
        <div className="pt-2.5 text-right tabular">
          <span className="block text-body-sm font-semibold text-fg">{formatTime(a.start)}</span>
          <span className="block text-caption text-fg-secondary">{formatTime(a.end)}</span>
        </div>
        <div aria-hidden="true" className="relative flex justify-center">
          <span className={cn("absolute w-0.5 bg-border", first ? "top-4" : "top-0", last ? "h-4" : "bottom-0")} />
          <span className={cn("relative mt-3.5 size-3 rounded-full ring-4 ring-surface", CATEGORY_STYLE[a.category].dot)} />
        </div>
        <div className="pb-2">
          {/*
            Compact card: name, status and PetRide on one line, then service · duration · owner. From 1024px the
            one-tap actions sit on the right of the same card (one row per visit); below that they wrap under it.
          */}
          <article
            className={cn(
              "relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border-l-4 px-3 py-2.5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover lg:py-2",
              blockClasses(a),
            )}
          >
            <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} shape="tile" size="sm" className="hidden self-start min-[400px]:inline-flex lg:self-center" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen(a.id)}
                    className="text-left text-body font-semibold text-fg after:absolute after:inset-0 after:rounded-card after:content-['']"
                  >
                    {a.petName}
                  </button>
                </h3>
                <StatusPill kind="appointment" status={a.status} size="sm" />
                <RideBadge appointment={a} showNone={false} />
              </div>
              <p className="mt-0.5 text-meta text-fg-tertiary">
                {a.serviceName} · {formatDuration(a.durationMin, locale)} · {a.clientName}
              </p>
              {a.clientNote ? (
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-meta text-fg-tertiary">
                  <MessageSquareText aria-hidden="true" size={14} className="shrink-0" />
                  <span className="truncate">{a.clientNote}</span>
                </p>
              ) : null}
            </div>
            {quick.length ? (
              <div className="relative z-10 flex basis-full flex-wrap gap-2 lg:shrink-0 lg:basis-auto">
                {quick.map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant={kind === "decline" ? "outline" : "primary"}
                    disabled={pending}
                    onClick={() => onAction(kind, a)}
                  >
                    {t.dynamic(`actions.${kind}`)}
                  </Button>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </li>
    </>
  );
}
