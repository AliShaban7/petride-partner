"use client";

import { memo, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CHART_COLORS, ChartTooltipContent } from "@/components/ui";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { OTHER_SERIES, SERIES_SLOTS, type StatsReport } from "../_lib/engine";
import { StatsFigure, type FigureTable } from "./StatsFigure";

/** Donut of services (by appointments) or product categories (by units), with a readable list. */
export const MixDonut = memo(function MixDonut({ report, index }: { report: StatsReport; index?: number }) {
  const t = useT("stats");
  const locale = useLocale();
  const visits = report.features.appointments;
  const rows = useMemo(() => {
    const labelled = (visits ? report.services : report.categories).map((r) => ({
      ...r,
      label: visits ? r.name : t.dynamic(`categories.${r.id}`),
      color: CHART_COLORS[r.slot],
    }));
    // More services than colours: the engine gives the tail the last slot; show it as one "Other" slice.
    const tail = labelled.filter((r) => r.slot === SERIES_SLOTS - 1);
    if (!visits || tail.length < 2) return labelled;
    const other = tail.reduce(
      (acc, r) => ({ ...acc, count: acc.count + r.count, share: acc.share + r.share, revenue: acc.revenue + r.revenue }),
      { ...tail[0], id: OTHER_SERIES, name: OTHER_SERIES, label: t("series.otherServices"), count: 0, share: 0, revenue: 0 },
    );
    return [...labelled.filter((r) => r.slot !== SERIES_SLOTS - 1), other];
  }, [report, visits, t]);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const num = (n: number) => formatNumber(n, locale);
  const countText = (n: number) => t.plural(visits ? "count.appointments" : "count.units", n);

  const summary = t("mix.summary", {
    list: rows.map((r) => `${r.label} ${formatPercent(r.share, locale)}`).join(", "),
  });

  const table: FigureTable = {
    columns: [
      { id: "name", header: visits ? t("columns.service") : t("columns.category") },
      { id: "count", header: visits ? t("columns.appointments") : t("columns.unitsSold"), align: "end" },
      { id: "share", header: t("columns.share"), align: "end" },
      { id: "revenue", header: t("columns.revenue"), align: "end" },
    ],
    rows: rows.map((r) => ({
      id: r.id,
      cells: [r.label, num(r.count), formatPercent(r.share, locale), formatMoney(r.revenue, locale, { decimals: "auto" })],
    })),
  };

  return (
    <StatsFigure
      index={index}
      title={visits ? t("mix.titleServices") : t("mix.titleCategories")}
      description={visits ? t("mix.descriptionServices") : t("mix.descriptionCategories")}
      summary={summary}
      table={table}
      empty={total === 0 ? { title: t("mix.emptyTitle"), pet: "ginger" } : null}
      content={
        // Donut beside its list at every width (the card is narrow on desktops); counts are in the Table view too.
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 @min-[36rem]:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="relative aspect-square w-full">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="66%"
                  outerRadius="98%"
                  paddingAngle={rows.length > 1 ? 2 : 0}
                  cornerRadius={6}
                  stroke="none"
                >
                  {rows.map((r) => (
                    <Cell key={r.id} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent valueFormatter={(v) => countText(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-title font-extrabold leading-none tabular @min-[36rem]:text-h1">{num(total)}</span>
              <span className="text-caption text-fg-secondary">{t("mix.total")}</span>
            </div>
          </div>
          <ul className="min-w-0 space-y-1.5">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-body-sm">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-[4px]" style={{ background: r.color }} />
                <span className="min-w-0 flex-1 truncate text-fg" title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 font-semibold text-fg tabular">{formatPercent(r.share, locale)}</span>
                <span className="hidden w-10 shrink-0 text-right text-meta text-fg-secondary tabular @min-[25rem]:inline">{num(r.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
});
