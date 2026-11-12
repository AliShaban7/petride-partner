"use client";

import { useMemo, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Label, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_COLORS, ChartCard, ChartTooltipContent, chartAxisProps, chartGridProps, type LegendItem } from "@/components/ui";
import type { QueryResult } from "@/lib/api/hooks";
import type { DailyPoint, ServiceMixItem } from "@/lib/api/types";
import { formatDayMonth, formatNumber, formatPercent, formatWeekdayDate, toDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type ChartMode = "visits" | "orders";

const DAYS = 14;
/**
 * Bar chart height. One value for every width: on phones the two charts share a swipeable row whose
 * height the donut card (with its longer legend) sets, so a shorter bar chart would only leave a gap,
 * and a fixed number keeps the server render and the first client render the same height.
 */
const DAILY_HEIGHT = 220;

/**
 * "Randevular  son 14 gün": what the chart counts, with the period as a small aside (no separate
 * description line). The real space keeps the heading's accessible name "Randevular son 14 gün"
 * (a margin alone would read as "Randevularson").
 */
function ChartTitle({ children, period }: { children: ReactNode; period: string }) {
  return (
    <>
      {children}{" "}
      <span className="ml-1 align-middle font-sans text-meta font-semibold tracking-normal text-fg-secondary">{period}</span>
    </>
  );
}

// ---- Appointments / orders per day (last 14 days) ------------------------------------------------

export function DailyChart({ query, mode, className }: { query: QueryResult<DailyPoint[]>; mode: ChartMode; className?: string }) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const { points, total, rides, best } = useMemo(() => {
    const points = (query.data ?? []).slice(-DAYS).map((p) => ({
      date: p.date,
      withRide: p.withRide,
      own: Math.max(0, p.appointments - p.withRide),
      total: mode === "visits" ? p.appointments : p.orders,
      orders: p.orders,
    }));
    return {
      points,
      total: points.reduce((sum, p) => sum + p.total, 0),
      rides: points.reduce((sum, p) => sum + p.withRide, 0),
      best: points.reduce<(typeof points)[number] | undefined>((top, p) => (!top || p.total > top.total ? p : top), undefined),
    };
  }, [query.data, mode]);
  const vars = {
    total: formatNumber(total, locale),
    rides: formatNumber(rides, locale),
    day: best ? formatDayMonth(best.date, locale) : "",
    best: best ? formatNumber(best.total, locale) : "",
  };
  const summary = !query.data
    ? tc(query.error ? "states.errorTitle" : "states.loading")
    : total === 0
      ? t("charts.emptyTitle")
      : mode === "visits" ? t("charts.dailySummary", vars) : t("charts.ordersSummary", vars);
  const legend: LegendItem[] =
    mode === "visits"
      ? [
          { label: t("charts.own"), color: CHART_COLORS[0] },
          { label: t("charts.withRide"), color: CHART_COLORS[1] },
        ]
      : [{ label: t("charts.orders"), color: CHART_COLORS[0] }];

  return (
    <ChartCard
      className={className}
      title={<ChartTitle period={t("charts.period14")}>{mode === "visits" ? t("charts.visits") : t("charts.orders")}</ChartTitle>}
      summary={summary}
      legend={legend}
      height={DAILY_HEIGHT}
      loading={query.isLoading}
      error={query.data ? undefined : query.error}
      onRetry={query.refetch}
      empty={Boolean(query.data) && total === 0}
      emptyTitle={t("charts.emptyTitle")}
      emptyDescription={mode === "visits" ? t("charts.emptyBody") : t("charts.emptyBodyShop")}
    >
      <BarChart data={points} margin={{ left: -8, right: 4, top: 8, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="date" {...chartAxisProps} interval="preserveStartEnd" minTickGap={4} tickFormatter={(d: string) => String(toDate(d).getDate())} />
        <YAxis {...chartAxisProps} allowDecimals={false} width={32} tickFormatter={(v: number) => formatNumber(v, locale)} />
        <Tooltip
          cursor={{ fill: "var(--color-primary-selected)" }}
          content={<ChartTooltipContent labelFormatter={(d) => formatWeekdayDate(String(d), locale)} valueFormatter={(v) => formatNumber(v, locale)} />}
        />
        {mode === "visits" ? (
          <>
            <Bar dataKey="withRide" name={t("charts.withRide")} stackId="visits" fill={CHART_COLORS[1]} />
            <Bar dataKey="own" name={t("charts.own")} stackId="visits" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
          </>
        ) : (
          <Bar dataKey="orders" name={t("charts.orders")} fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
        )}
      </BarChart>
    </ChartCard>
  );
}

// ---- Service / category mix (last 30 days) -------------------------------------------------------

const TOP = 5;

export function MixChart({ query, mode, className }: { query: QueryResult<ServiceMixItem[]>; mode: ChartMode; className?: string }) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const otherLabel = t("charts.other");
  const { data, total, leader } = useMemo(() => {
    const items = query.data ?? [];
    const top = items.slice(0, TOP);
    const rest = items.slice(TOP);
    return {
      data: [
        ...top.map((item, i) => ({ name: item.name, count: item.count, share: item.share, fill: CHART_COLORS[i] })),
        ...(rest.length
          ? [
              {
                name: otherLabel,
                count: rest.reduce((sum, item) => sum + item.count, 0),
                share: rest.reduce((sum, item) => sum + item.share, 0),
                fill: CHART_COLORS[TOP],
              },
            ]
          : []),
      ],
      total: items.reduce((sum, item) => sum + item.count, 0),
      leader: items[0] as ServiceMixItem | undefined,
    };
  }, [query.data, otherLabel]);
  const summary = !query.data
    ? tc(query.error ? "states.errorTitle" : "states.loading")
    : total === 0 || !leader
      ? t("charts.emptyTitle")
      : t(mode === "visits" ? "charts.mixSummary" : "charts.mixSummaryShop", {
        total: formatNumber(total, locale),
        top: leader.name,
        share: formatPercent(leader.share, locale),
      });
  const legend: LegendItem[] = data.map((d) => ({ label: `${d.name} · ${formatPercent(d.share, locale)}`, color: d.fill }));

  return (
    <ChartCard
      className={className}
      title={<ChartTitle period={t("charts.period30")}>{mode === "visits" ? t("charts.mixTitle") : t("charts.mixTitleShop")}</ChartTitle>}
      summary={summary}
      legend={legend}
      height={160}
      loading={query.isLoading}
      error={query.data ? undefined : query.error}
      onRetry={query.refetch}
      empty={Boolean(query.data) && total === 0}
      emptyTitle={t("charts.emptyTitle")}
      emptyDescription={mode === "visits" ? t("charts.emptyBody") : t("charts.emptyBodyShop")}
    >
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          cornerRadius={4}
          stroke="var(--color-surface)"
          strokeWidth={2}
        >
          <Label
            position="center"
            content={(props) => {
              // position="center" hands the centre of the chart area in x / y (= the pie centre).
              const cx = Number(props.x ?? 0);
              const cy = Number(props.y ?? 0);
              return (
                <text x={cx} y={cy} textAnchor="middle">
                  <tspan x={cx} dy="-0.15em" className="fill-fg font-display text-h2 font-extrabold">
                    {formatNumber(total, locale)}
                  </tspan>
                  <tspan x={cx} dy="1.45em" className="fill-fg-secondary text-caption">
                    {t("charts.total")}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip content={<ChartTooltipContent valueFormatter={(v) => formatNumber(v, locale)} />} />
      </PieChart>
    </ChartCard>
  );
}
