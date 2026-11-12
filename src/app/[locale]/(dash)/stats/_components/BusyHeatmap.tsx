"use client";

import { memo, type CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { formatNumber, weekdayName } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { StatsReport } from "../_lib/engine";
import { hourSlot } from "../_lib/labels";
import { StatsFigure, type FigureTable } from "./StatsFigure";

/** Intensity steps (share of the busiest cell → mix of teal into the surface). */
const LEVELS = [0, 18, 38, 62, 88] as const;

function level(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

function cellStyle(lvl: number): CSSProperties {
  if (lvl === 0) return { background: "var(--color-surface-muted)" };
  return { background: `color-mix(in srgb, var(--color-primary) ${LEVELS[lvl]}%, var(--color-surface))` };
}

/**
 * Weekday × hour grid (CSS grid) of when visits start / orders come in. The grid is decorative
 * for screen readers: the summary and the Table view carry the same numbers.
 */
export const BusyHeatmap = memo(function BusyHeatmap({ report, index }: { report: StatsReport; index?: number }) {
  const t = useT("stats");
  const locale = useLocale();
  const visits = report.features.appointments;
  const { hours, counts, max, total, peak, dayTotals } = report.busy;
  const num = (n: number) => formatNumber(n, locale);
  const countText = (n: number) => t.plural(visits ? "count.appointments" : "count.orders", n);
  const days = [1, 2, 3, 4, 5, 6, 7] as const;

  const busiest = dayTotals.indexOf(Math.max(...dayTotals));
  const quietest = dayTotals.indexOf(Math.min(...dayTotals));
  const summary = peak
    ? t("busy.summary", {
        day: weekdayName(peak.day, locale),
        time: hourSlot(peak.hour),
        count: countText(peak.count),
        busiestDay: weekdayName(busiest + 1, locale),
        quietestDay: weekdayName(quietest + 1, locale),
      })
    : t("busy.emptyTitle");

  const table: FigureTable = {
    columns: [
      { id: "day", header: t("columns.weekday") },
      ...hours.map((h) => ({ id: `h${h}`, header: hourSlot(h), align: "end" as const })),
      { id: "total", header: t("columns.total"), align: "end" },
    ],
    rows: days.map((d, i) => ({ id: `d${d}`, cells: [weekdayName(d, locale), ...counts[i].map(num), num(dayTotals[i])] })),
  };

  // On phones only every third hour gets a label, so the header stays readable.
  const showHourLabel = (h: number, i: number) => i === 0 || i === hours.length - 1 || h % 3 === 0;

  return (
    <StatsFigure
      index={index}
      tone="softMint"
      title={t("busy.title")}
      description={visits ? t("busy.descriptionVisits") : t("busy.descriptionOrders")}
      summary={summary}
      table={table}
      empty={total === 0 ? { title: t("busy.emptyTitle"), pet: "tabby" } : null}
      content={
        <div>
          <div
            aria-hidden="true"
            className="grid gap-0.5 sm:gap-1"
            style={{ gridTemplateColumns: `auto repeat(${hours.length}, minmax(0, 1fr))` }}
          >
            <span />
            {hours.map((h, i) => (
              <span
                key={h}
                className={cn(
                  "pb-0.5 text-center text-caption text-fg-tertiary tabular",
                  !showHourLabel(h, i) && "invisible sm:visible",
                )}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
            {days.map((d, di) => (
              <div key={d} className="contents">
                <span className="flex items-center pr-2 text-caption font-semibold text-fg-tertiary">{weekdayName(d, locale, true)}</span>
                {hours.map((h, hi) => {
                  const count = counts[di][hi];
                  const lvl = level(count, max);
                  return (
                    <span
                      key={h}
                      title={t("busy.cell", { day: weekdayName(d, locale), time: hourSlot(h), count: num(count) })}
                      className={cn(
                        "flex aspect-square min-h-5 items-center justify-center rounded-[6px] text-caption font-semibold tabular transition-transform duration-150 hover:scale-105 md:aspect-auto md:h-7",
                        lvl === 4 ? "text-on-primary" : "text-fg",
                      )}
                      style={cellStyle(lvl)}
                    >
                      <span className="hidden md:inline">{count > 0 ? num(count) : ""}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-2 flex items-center justify-end gap-1.5 text-caption text-fg-tertiary">
            <span className="mr-1">{t("busy.less")}</span>
            {LEVELS.map((_, lvl) => (
              <span key={lvl} className="size-3.5 rounded-[4px]" style={cellStyle(lvl)} />
            ))}
            <span className="ml-1">{t("busy.more")}</span>
          </div>
        </div>
      }
    />
  );
});
