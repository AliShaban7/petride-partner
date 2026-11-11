"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

/*
 * Vertical day timeline (time · rail with a dot · card). One continuous rail line is drawn by the
 * <ol>; each row is a single link so the time is part of its accessible name. Card text uses only
 * text-fg / text-fg-tertiary because some cards sit on soft pastel fills.
 */

/** Grid shared by rows and the "Now" marker: time column, rail column, content. */
const ROW_GRID = "grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-2";

export type TimelineState = "past" | "current" | "upcoming" | "attention";

const CARD: Record<TimelineState, string> = {
  past: "border border-border bg-surface",
  current: "bg-soft-mint",
  upcoming: "bg-surface-muted",
  attention: "bg-soft-peach",
};

const DOT: Record<TimelineState, string> = {
  past: "bg-control-border",
  current: "bg-primary",
  upcoming: "border-2 border-primary bg-surface",
  attention: "bg-accent",
};

export function TimelineList({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <ol
      aria-label={label}
      className={cn(
        // rail: centre of the 1.25rem column = 3.25rem + 0.5rem gap + 0.625rem − 1px
        "relative before:absolute before:bottom-4 before:left-[calc(4.375rem-1px)] before:top-4 before:w-0.5 before:rounded-chip before:bg-progress-track",
        className,
      )}
    >
      {children}
    </ol>
  );
}

export type TimelineRowProps = {
  href: string;
  /** ISO start time. */
  time: string;
  /** Small line under the time (duration). */
  sub?: ReactNode;
  state: TimelineState;
  index?: number;
  children: ReactNode;
};

export function TimelineRow({ href, time, sub, state, index = 0, children }: TimelineRowProps) {
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Link href={href} className={cn(ROW_GRID, "group rounded-card py-1.5 pr-1 transition-colors duration-150 hover:bg-primary-selected")}>
        <div className="pt-2.5 text-right">
          <time dateTime={time} className="block font-semibold text-fg tabular">
            {formatTime(time)}
          </time>
          {sub ? <span className="block text-caption text-fg-secondary">{sub}</span> : null}
        </div>
        <div aria-hidden="true" className="relative flex justify-center">
          <span
            className={cn(
              "relative mt-3.5 size-3 shrink-0 rounded-full ring-4 ring-surface transition-transform duration-200 group-hover:scale-125",
              DOT[state],
            )}
          />
        </div>
        <div className={cn("min-w-0 rounded-card p-3 transition-shadow duration-200 group-hover:shadow-card", CARD[state])}>{children}</div>
      </Link>
    </li>
  );
}

/** The coral "Now 10:42" line between what's done and what's next. */
export function NowMarker({ now }: { now: number }) {
  const t = useT("overview");
  return (
    <li className={cn(ROW_GRID, "items-center py-1.5")}>
      <span className="text-right text-caption font-bold uppercase tracking-wide text-accent-strong">{t("schedule.now")}</span>
      <span aria-hidden="true" className="relative flex justify-center">
        <span className="relative size-3 animate-pop rounded-full bg-accent ring-4 ring-accent-tint" />
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="h-0.5 flex-1 rounded-chip bg-accent" />
        <time dateTime={new Date(now).toISOString()} className="text-caption font-semibold text-accent-strong tabular">
          {formatTime(now)}
        </time>
      </span>
    </li>
  );
}

/** Skeleton in the same shape as the timeline. */
export function TimelineSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={ROW_GRID}>
          <div className="flex flex-col items-end gap-1.5 pt-2.5">
            <span className="h-3.5 w-10 animate-skeleton rounded-tile bg-segment-track" />
            <span className="h-3 w-8 animate-skeleton rounded-tile bg-segment-track" />
          </div>
          <div className="flex justify-center">
            <span className="mt-3.5 size-3 animate-skeleton rounded-full bg-segment-track" />
          </div>
          <div className="h-[4.5rem] animate-skeleton rounded-card bg-segment-track" />
        </div>
      ))}
    </div>
  );
}
