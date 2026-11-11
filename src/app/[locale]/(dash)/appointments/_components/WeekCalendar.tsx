"use client";

import { Ban, BedDouble, Car, CheckCheck, CircleCheck, CircleX, Sparkles, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { useState, type MouseEvent } from "react";

import type { Appointment, AppointmentStatus, OpeningHoursDay } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatTime, formatTimeRange, formatWeekday, formatWeekdayShort } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { placeDay, placeStays } from "../_lib/layout";
import { MINUTE, hoursForDay, isStay, minutesOfDay, startOfDay } from "../_lib/time";
import { CATEGORY_STYLE, CategoryDot } from "./bits";

export const GRID_START = 8 * 60;
export const GRID_END = 20 * 60;
const HOUR_PX = 60;
/** Indent per cascade level (px), capped so deep stacks keep some width. */
const indent = (depth: number) => Math.min(depth, 3) * 12;
const PX_PER_MIN = HOUR_PX / 60;
const GRID_H = ((GRID_END - GRID_START) / 60) * HOUR_PX;
const STAY_ROWS = 3;
const COLS = "grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]";

export const STATUS_ICONS: Record<AppointmentStatus, LucideIcon> = {
  requested: Sparkles,
  confirmed: CircleCheck,
  checked_in: UserCheck,
  completed: CheckCheck,
  no_show: UserX,
  cancelled: Ban,
  declined: CircleX,
};

/** Block look by status: requests are white with a dashed outline, finished visits are softer. */
export function blockClasses(a: Appointment) {
  const style = CATEGORY_STYLE[a.category];
  if (a.status === "requested") return cn("border border-dashed border-on-accent-tint bg-surface", style.bar);
  if (a.status === "completed" || a.status === "no_show" || a.status === "cancelled" || a.status === "declined") return cn(style.soft, style.bar);
  return cn(style.fill, style.bar);
}

export type WeekCalendarProps = {
  days: number[];
  appointments: Appointment[];
  now: number;
  hours?: OpeningHoursDay[];
  loading?: boolean;
  onOpen: (id: string) => void;
  /** Click on an empty part of the grid: new appointment at that time. */
  onCreateAt: (start: number) => void;
};

/**
 * Week time grid 08:00–20:00 (Mon–Sun): blocks coloured by service line, side by side when they
 * overlap, hotel stays in a band on top, closed hours shaded, a line at the current time.
 * Every block is a button with the full description as its accessible name.
 */
export function WeekCalendar({ days, appointments, now, hours, loading, onOpen, onCreateAt }: WeekCalendarProps) {
  const t = useT("appointments");
  const locale = useLocale();
  const ts = useT("status");
  const [allStays, setAllStays] = useState(false);
  const today = now ? startOfDay(now) : 0;

  const stays = placeStays(appointments.filter(isStay), days);
  const stayRows = stays.reduce((m, s) => Math.max(m, s.row + 1), 0);
  const visibleStays = allStays ? stays : stays.filter((s) => s.row < STAY_ROWS);
  const hiddenStays = stays.length - visibleStays.length;
  const timed = appointments.filter((a) => !isStay(a));

  const blockLabel = (a: Appointment) =>
    t("calendar.blockLabel", {
      time: formatTimeRange(a.start, a.end),
      pet: a.petName,
      service: a.serviceName,
      client: a.clientName,
      status: ts.dynamic(`appointment.${a.status}`),
    }) + (a.withRide ? `, ${t("ride.badge")}` : "");

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-card border border-border" role="region" aria-label={t("calendar.caption")} tabIndex={0}>
        <div className="min-w-[46rem]">
          {/* Day headers */}
          <div className={cn("grid border-b border-border bg-surface-muted", COLS)}>
            <div />
            {days.map((day) => {
              const isToday = day === today;
              return (
                <div key={day} className="flex flex-col items-center gap-0.5 border-l border-border px-1 py-2">
                  <span className={cn("text-meta font-semibold", isToday ? "text-primary" : "text-fg-secondary")}>{formatWeekdayShort(day, locale)}</span>
                  <span
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full font-display text-title font-extrabold tabular",
                      isToday ? "bg-primary text-on-primary" : "text-fg",
                    )}
                  >
                    {new Date(day).getDate()}
                  </span>
                  {isToday ? <span className="sr-only">{t("nav.today")}</span> : null}
                </div>
              );
            })}
          </div>

          {/* Hotel stays band */}
          {stays.length ? (
            <div className={cn("grid border-b border-border", COLS)}>
              <div className="flex items-start justify-center pt-2 text-fg-secondary">
                <BedDouble aria-hidden="true" size={18} />
                <span className="sr-only">{t("calendar.stays")}</span>
              </div>
              <ul className="col-span-7 grid grid-cols-7 gap-y-1 py-1.5" style={{ gridAutoRows: "1.875rem" }} aria-label={t("calendar.stays")}>
                {visibleStays.map((s) => {
                  const a = s.item;
                  const Icon = STATUS_ICONS[a.status];
                  return (
                    <li key={a.id} className="min-w-0 px-0.5" style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.row + 1 }}>
                      <button
                        type="button"
                        onClick={() => onOpen(a.id)}
                        title={blockLabel(a)}
                        aria-label={t("calendar.stayLabel", {
                          pet: a.petName,
                          service: a.serviceName,
                          from: `${formatDayMonth(a.start, locale)} ${formatTime(a.start)}`,
                          to: `${formatDayMonth(a.end, locale)} ${formatTime(a.end)}`,
                          status: ts.dynamic(`appointment.${a.status}`),
                        })}
                        className={cn(
                          "flex h-full w-full min-w-0 items-center gap-1.5 border-l-4 px-2 text-left text-caption font-semibold text-fg shadow-thumb transition-shadow hover:shadow-card-hover",
                          blockClasses(a),
                          s.continuesBefore ? "rounded-r-tile" : "rounded-tile",
                          s.continuesAfter && "rounded-r-none",
                        )}
                      >
                        <Icon aria-hidden="true" size={12} className="shrink-0" />
                        <span className="truncate">{a.petName}</span>
                        <span className="hidden truncate font-normal text-fg-tertiary md:inline">· {a.serviceName}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {stayRows > STAY_ROWS ? (
            <div className="border-b border-border px-3 py-1.5 text-right">
              <button type="button" onClick={() => setAllStays((v) => !v)} className="min-h-9 rounded-tile px-2 text-meta font-semibold text-primary hover:bg-primary-selected" aria-expanded={allStays}>
                {allStays ? t("calendar.fewerStays") : t.plural("calendar.moreStays", hiddenStays)}
              </button>
            </div>
          ) : null}

          {/* Time grid */}
          <div className={cn("relative grid", COLS)} style={{ height: GRID_H }} aria-busy={loading || undefined}>
            <div aria-hidden="true" className="relative">
              {Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => (
                <span key={i} className="absolute right-2 -translate-y-1/2 text-caption text-fg-secondary tabular" style={{ top: Math.max(7, Math.min(GRID_H - 7, i * HOUR_PX)) }}>
                  {String(GRID_START / 60 + i).padStart(2, "0")}:00
                </span>
              ))}
              {today && days.includes(today) && minutesOfDay(now) >= GRID_START && minutesOfDay(now) <= GRID_END ? (
                <span
                  className="absolute right-1 z-20 -translate-y-1/2 rounded-chip bg-accent-strong px-1.5 text-caption font-bold text-on-primary tabular"
                  style={{ top: (minutesOfDay(now) - GRID_START) * PX_PER_MIN }}
                >
                  {formatTime(now)}
                </span>
              ) : null}
            </div>
            {days.map((day) => (
              <DayColumn
                key={day}
                day={day}
                items={timed.filter((a) => new Date(a.start).getTime() < startOfDay(day, 1) && new Date(a.end).getTime() > day)}
                isToday={day === today}
                now={now}
                hours={hoursForDay(hours, day)}
                hoursKnown={Boolean(hours)}
                loading={loading}
                blockLabel={blockLabel}
                onOpen={onOpen}
                onCreateAt={onCreateAt}
              />
            ))}
          </div>
        </div>
      </div>
      <Legend />
    </div>
  );
}

function DayColumn({
  day,
  items,
  isToday,
  now,
  hours,
  hoursKnown,
  loading,
  blockLabel,
  onOpen,
  onCreateAt,
}: {
  day: number;
  items: Appointment[];
  isToday: boolean;
  now: number;
  hours: { open: number; close: number } | null;
  hoursKnown: boolean;
  loading?: boolean;
  blockLabel: (a: Appointment) => string;
  onOpen: (id: string) => void;
  onCreateAt: (start: number) => void;
}) {
  const t = useT("appointments");
  const locale = useLocale();
  const placed = placeDay(items, day, GRID_START, GRID_END);
  const nowMin = isToday ? minutesOfDay(now) : -1;

  const onBackgroundClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button,a")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = GRID_START + Math.floor((e.clientY - rect.top) / PX_PER_MIN / 15) * 15;
    onCreateAt(day + Math.min(Math.max(minutes, GRID_START), GRID_END - 15) * MINUTE);
  };

  const shade = (from: number, to: number, key: string) =>
    to > from ? (
      <div
        key={key}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bg-surface-muted"
        style={{ top: (from - GRID_START) * PX_PER_MIN, height: (to - from) * PX_PER_MIN }}
      />
    ) : null;

  return (
    // Clicking empty grid space is a mouse shortcut; keyboard users have the "New appointment" button.
    <div
      className={cn("relative cursor-cell border-l border-border", isToday && "bg-primary-selected/40")}
      style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${HOUR_PX}px)` }}
      onClick={onBackgroundClick}
      title={t("calendar.emptySlot")}
    >
      <h3 className="sr-only">
        {formatWeekday(day, locale)}, {formatDayMonth(day, locale)}: {t.plural("calendar.count", items.length)}
      </h3>
      {hoursKnown ? (
        hours ? (
          <>
            {shade(GRID_START, Math.min(hours.open, GRID_END), "before")}
            {shade(Math.max(hours.close, GRID_START), GRID_END, "after")}
          </>
        ) : (
          <>
            {shade(GRID_START, GRID_END, "closed")}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-3 text-center text-caption font-semibold text-fg-secondary">
              {t("calendar.closed")}
            </span>
          </>
        )
      ) : null}

      {loading ? (
        <div aria-hidden="true" className="absolute inset-x-1 top-0 bottom-0">
          {[70, 200, 330].map((top, i) => (
            <div
              key={top}
              className="absolute inset-x-0 animate-skeleton rounded-tile bg-segment-track"
              style={{ top: top + ((new Date(day).getDay() + i) % 3) * 40, height: 48 }}
            />
          ))}
        </div>
      ) : (
        <ul>
          {placed.map((p) => {
            const a = p.item;
            const Icon = STATUS_ICONS[a.status];
            const height = (p.endMin - p.startMin) * PX_PER_MIN;
            return (
              <li
                key={a.id}
                className="absolute px-0.5 has-[:focus-visible]:z-40! hover:z-30!"
                style={{
                  top: (p.startMin - GRID_START) * PX_PER_MIN,
                  height,
                  left: `calc(${indent(p.depth)}px + (100% - ${indent(p.depth)}px) * ${p.slot / p.slots})`,
                  width: `calc((100% - ${indent(p.depth)}px) / ${p.slots})`,
                  zIndex: p.depth + 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(a.id)}
                  aria-label={blockLabel(a)}
                  title={blockLabel(a)}
                  className={cn(
                    "relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-tile border-l-4 px-1.5 py-0.5 text-left text-caption leading-4 text-fg shadow-thumb ring-1 ring-surface transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-card-hover",
                    blockClasses(a),
                    p.clippedStart && "rounded-t-none",
                    p.clippedEnd && "rounded-b-none",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1 font-semibold">
                    <Icon aria-hidden="true" size={11} className="shrink-0" />
                    <span className="truncate">{a.petName}</span>
                  </span>
                  {height >= 34 ? <span className="truncate text-fg-tertiary tabular">{formatTime(a.start)}</span> : null}
                  {height >= 50 ? <span className="truncate text-fg-tertiary">{a.serviceName}</span> : null}
                  {a.withRide && height >= 34 ? <Car aria-hidden="true" size={11} className="absolute bottom-1 right-1 text-fg-tertiary" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {nowMin >= GRID_START && nowMin <= GRID_END ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-accent-strong" style={{ top: (nowMin - GRID_START) * PX_PER_MIN }}>
          <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-accent-strong" />
        </div>
      ) : null}
      {isToday && nowMin >= 0 ? <span className="sr-only">{t("calendar.nowAt", { time: formatTime(now) })}</span> : null}
    </div>
  );
}

/** What the colours and marks mean (status is also in every block's label and icon). */
export function Legend() {
  const t = useT("appointments");
  const ts = useT("status");
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-fg-secondary" aria-label={t("calendar.legend")}>
      {(["vet", "groom", "hotel"] as const).map((c) => (
        <li key={c} className="inline-flex items-center gap-1.5">
          <CategoryDot category={c} />
          {ts.dynamic(`category.${c}`)}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-3 w-5 rounded-[4px] border border-dashed border-on-accent-tint bg-surface" />
        {t("calendar.legendRequest")}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Car aria-hidden="true" size={14} />
        {t("calendar.legendRide")}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-0.5 w-5 bg-accent-strong" />
        {t("calendar.legendNow")}
      </li>
    </ul>
  );
}
