"use client";

import { Star } from "lucide-react";
import { memo } from "react";

import { DeltaChip } from "@/components/ui";
import { formatFixed, formatNumber, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { StatsReport } from "../_lib/engine";
import { StatsFigure, type FigureTable } from "./StatsFigure";

const STARS = [5, 4, 3, 2, 1] as const;

/** Average rating with a 5→1 star distribution (plain HTML bars with their numbers as text). */
export const RatingPanel = memo(function RatingPanel({ report, deltaLabel, index }: { report: StatsReport; deltaLabel: string; index?: number }) {
  const t = useT("stats");
  const locale = useLocale();
  const { average, count, distribution, delta } = report.rating;
  const share = (n: number) => formatPercent(count ? n / count : 0, locale);
  const most = Math.max(1, ...STARS.map((s) => distribution[s]));

  const table: FigureTable = {
    columns: [
      { id: "stars", header: t("columns.stars") },
      { id: "reviews", header: t("columns.reviews"), align: "end" },
      { id: "share", header: t("columns.share"), align: "end" },
    ],
    rows: STARS.map((s) => ({
      id: `s${s}`,
      cells: [t.plural("count.stars", s), formatNumber(distribution[s], locale), share(distribution[s])],
    })),
  };

  return (
    <StatsFigure
      index={index}
      tone="softLilac"
      title={t("rating.title")}
      summary={t("rating.summary", {
        average: formatFixed(average, 1, locale),
        reviews: t.plural("count.reviews", count),
        share: share(distribution[5]),
      })}
      table={table}
      empty={count === 0 ? { title: t("rating.emptyTitle"), description: t("rating.emptyBody"), pet: "cream" } : null}
      content={
        // Average on one line above the bars in a narrow card; side by side when the card is wide.
        <div className="grid gap-3 @min-[34rem]:grid-cols-[auto_1fr] @min-[34rem]:items-center @min-[34rem]:gap-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 @min-[34rem]:flex-col @min-[34rem]:items-start">
            <p className="flex items-baseline gap-1.5 font-display font-extrabold text-fg">
              <span className="sr-only">{t("rating.average")}:</span>
              <span className="text-kpi-md tabular">{formatFixed(average, 1, locale)}</span>
              <span className="text-body-sm text-fg-tertiary">{t("kpi.outOf")}</span>
            </p>
            <div aria-hidden="true" className="flex gap-0.5 text-fg">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={16} strokeWidth={2} className={s <= Math.round(average) ? "fill-current" : "opacity-40"} />
              ))}
            </div>
            <p className="text-body-sm text-fg-tertiary">{t.plural("count.reviews", count)}</p>
            {report.showChange ? <DeltaChip value={delta} label={deltaLabel} /> : null}
          </div>
          <ul className="min-w-0 space-y-1.5">
            {STARS.map((s) => (
              <li key={s} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 text-body-sm">
                <span aria-hidden="true" className="inline-flex items-center gap-1 font-semibold text-fg tabular">
                  {s}
                  <Star size={13} strokeWidth={2.2} className="fill-current" />
                </span>
                <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-chip bg-surface/80">
                  <span
                    className="block h-full rounded-chip bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${(distribution[s] / most) * 100}%` }}
                  />
                </span>
                <span aria-hidden="true" className="min-w-16 text-right text-fg tabular">
                  {formatNumber(distribution[s], locale)} <span className="text-fg-tertiary">· {share(distribution[s])}</span>
                </span>
                <span className="sr-only">
                  {t("rating.row", {
                    stars: t.plural("count.stars", s),
                    reviews: t.plural("count.reviews", distribution[s]),
                    share: share(distribution[s]),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
});
