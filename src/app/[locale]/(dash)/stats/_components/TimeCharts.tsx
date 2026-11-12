"use client";

import { memo, useId, useMemo } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";

import { CHART_COLORS, ChartTooltipContent, chartAxisProps, chartGridProps, type LegendItem } from "@/components/ui";
import { formatMoney, formatMoneyCompact, formatNumber, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { OTHER_SERIES, type BucketPoint, type StatsReport } from "../_lib/engine";
import { bucketDays } from "../_lib/range";
import { bucketLabel, bucketTick, bucketTitle, rangeLabel } from "../_lib/labels";
import { StatsFigure, type FigureTable } from "./StatsFigure";

/** Dashed grey for "previous period" everywhere on the page. */
const PREVIOUS_COLOR = "var(--color-chart-axis)";

type ChartProps = { report: StatsReport; index?: number; className?: string };

/** Shared helpers for the time-series charts (ticks, tooltip titles, table rows). */
function useBuckets(report: StatsReport) {
  const t = useT("stats");
  const locale = useLocale();
  return useMemo(() => {
    const byKey = new Map(report.points.map((p) => [p.key, p]));
    const count = report.points.length;
    const weekly = bucketDays(report.range) === 7;
    return {
      weekly,
      granularity: weekly ? t("granularity.week") : t("granularity.day"),
      firstColumn: weekly ? t("columns.week") : t("columns.day"),
      tick: (key: unknown) => {
        const p = byKey.get(String(key));
        return p ? bucketTick(p, count, locale) : String(key);
      },
      title: (key: unknown) => {
        const p = byKey.get(String(key));
        return p ? bucketTitle(p, t, locale) : String(key);
      },
      label: (p: BucketPoint) => bucketLabel(p, t, locale),
      /** Recharts' tick spacing: fewer labels on long ranges. */
      minTickGap: count > 14 ? 24 : 8,
    };
  }, [report, t, locale]);
}

function maxBy<T>(items: readonly T[], value: (item: T) => number): T | undefined {
  let best: T | undefined;
  for (const item of items) if (best === undefined || value(item) > value(best)) best = item;
  return best;
}

const tooltipCursor = { fill: "var(--color-primary-selected)" };
const lineCursor = { stroke: "var(--color-chart-grid)", strokeWidth: 1.5 };
const margin = { top: 8, right: 8, left: 0, bottom: 0 };

// ---- Revenue over time (area) -----------------------------------------------------------------------

export const RevenueChart = memo(function RevenueChart({ report, index }: ChartProps) {
  const t = useT("stats");
  const locale = useLocale();
  const b = useBuckets(report);
  const gradientId = `rev${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const points = report.points;
  const withPrev = points.some((p) => p.prev);
  const money = (n: number) => formatMoney(n, locale, { decimals: "auto" });
  const total = report.kpis.revenue.value;
  const best = maxBy(points, (p) => p.revenue);

  const summary = [
    t("revenue.summary", {
      range: rangeLabel(report.range, t, locale),
      total: formatMoney(total, locale, { decimals: 0 }),
      best: best ? b.label(best) : "—",
      bestValue: best ? money(best.revenue) : "—",
    }),
    withPrev ? t("revenue.summaryPrevious", { total: formatMoney(report.kpis.revenue.previous, locale, { decimals: 0 }) }) : "",
  ]
    .join(" ")
    .trim();

  const legend: LegendItem[] = [{ label: t("series.current"), color: CHART_COLORS[0] }];
  if (withPrev) legend.push({ label: t("series.previous"), color: PREVIOUS_COLOR, shape: "dashed" });

  const table: FigureTable = {
    columns: [
      { id: "bucket", header: b.firstColumn },
      { id: "revenue", header: t("columns.revenue"), align: "end" },
      ...(withPrev ? [{ id: "previous", header: t("series.previous"), align: "end" as const }] : []),
    ],
    rows: points.map((p) => ({
      id: p.key,
      cells: [b.label(p), money(p.revenue), ...(withPrev ? [p.prev ? money(p.prev.revenue) : "—"] : [])],
    })),
  };

  const data = points.map((p) => ({ key: p.key, current: p.revenue, previous: p.prev?.revenue ?? null }));

  return (
    <StatsFigure
      index={index}
      title={t("revenue.title")}
      // Say where the money comes from for this partner: visits, orders, or both.
      description={t(
        report.features.appointments && report.features.orders
          ? "revenue.description"
          : report.features.orders
            ? "revenue.descriptionOrders"
            : "revenue.descriptionVisits",
        { granularity: b.granularity },
      )}
      summary={summary}
      legend={legend}
      table={table}
      height={220}
      empty={total === 0 ? { title: t("revenue.emptyTitle"), description: t("revenue.emptyBody"), pet: "golden" } : null}
      chart={
        <ComposedChart data={data} margin={margin}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: CHART_COLORS[0], stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: CHART_COLORS[0], stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="key" {...chartAxisProps} tickFormatter={b.tick} minTickGap={b.minTickGap} />
          <YAxis {...chartAxisProps} width={64} tickFormatter={(v: number) => formatMoneyCompact(v, locale)} />
          <Tooltip cursor={lineCursor} content={<ChartTooltipContent labelFormatter={b.title} valueFormatter={(v) => money(v)} />} />
          <Area
            type="monotone"
            dataKey="current"
            name={t("series.current")}
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }}
          />
          {withPrev ? (
            <Line
              type="monotone"
              dataKey="previous"
              name={t("series.previous")}
              stroke={PREVIOUS_COLOR}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : null}
        </ComposedChart>
      }
    />
  );
});

// ---- Appointments by service / orders by fulfilment (stacked bars) -----------------------------------

export const VolumeChart = memo(function VolumeChart({ report, index }: ChartProps) {
  const t = useT("stats");
  const locale = useLocale();
  const b = useBuckets(report);
  const visits = report.features.appointments;
  const points = report.points;
  const num = (n: number) => formatNumber(n, locale);

  const series = visits
    ? report.serviceSeries.map((s) => ({
        key: s.id,
        name: s.id === OTHER_SERIES ? t("series.otherServices") : s.name,
        color: CHART_COLORS[s.slot],
      }))
    : [
        { key: "pickup", name: t("series.pickup"), color: CHART_COLORS[0] },
        { key: "courier", name: t("series.courier"), color: CHART_COLORS[1] },
      ];

  const valueOf = (p: BucketPoint, key: string) => (visits ? (p.byService[key] ?? 0) : key === "courier" ? p.courier : p.pickup);
  const totalOf = (p: BucketPoint) => (visits ? p.appointments : p.orders);
  const data = points.map((p) => ({ key: p.key, ...Object.fromEntries(series.map((s) => [s.key, valueOf(p, s.key)])) }));
  const total = visits ? report.kpis.appointments.value : report.kpis.orders.value;
  const best = maxBy(points, totalOf);
  const countText = (n: number) => t.plural(visits ? "count.appointments" : "count.orders", n);
  const topService = visits ? report.services[0] : undefined;

  const summary = visits
    ? t("volume.summaryVisits", {
        total: countText(total),
        best: best ? b.label(best) : "—",
        bestCount: best ? countText(totalOf(best)) : "—",
        service: topService ? `${topService.name} (${formatPercent(topService.share, locale)})` : "—",
      })
    : t("volume.summaryOrders", {
        total: countText(total),
        courier: num(points.reduce((s, p) => s + p.courier, 0)),
        best: best ? b.label(best) : "—",
        bestCount: best ? countText(totalOf(best)) : "—",
      });

  const table: FigureTable = {
    columns: [
      { id: "bucket", header: b.firstColumn },
      ...series.map((s) => ({ id: s.key, header: s.name, align: "end" as const })),
      { id: "total", header: t("columns.total"), align: "end" },
    ],
    rows: points.map((p) => ({ id: p.key, cells: [b.label(p), ...series.map((s) => num(valueOf(p, s.key))), num(totalOf(p))] })),
  };

  return (
    <StatsFigure
      index={index}
      title={visits ? t("volume.titleVisits") : t("volume.titleOrders")}
      summary={summary}
      legend={series.map((s) => ({ label: s.name, color: s.color }))}
      table={table}
      empty={total === 0 ? { title: visits ? t("volume.emptyVisits") : t("volume.emptyOrders"), description: t("volume.emptyBody") } : null}
      chart={
        <BarChart data={data} margin={margin} barCategoryGap={points.length > 20 ? "18%" : "28%"}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="key" {...chartAxisProps} tickFormatter={b.tick} minTickGap={b.minTickGap} />
          <YAxis {...chartAxisProps} width={40} allowDecimals={false} />
          <Tooltip cursor={tooltipCursor} content={<ChartTooltipContent labelFormatter={b.title} valueFormatter={(v) => num(v)} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="volume"
              fill={s.color}
              radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      }
    />
  );
});

// ---- PetRide share over time (line) -----------------------------------------------------------------

export const RideShareChart = memo(function RideShareChart({ report, index }: ChartProps) {
  const t = useT("stats");
  const locale = useLocale();
  const b = useBuckets(report);
  const visits = report.features.appointments;
  const points = report.points;
  const withPrev = points.some((p) => p.prev);
  const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : formatPercent(n, locale));
  const best = maxBy(
    points.filter((p) => p.rideShare !== null),
    (p) => p.rideShare ?? 0,
  );
  const hasAny = points.some((p) => p.rideShare !== null);
  const peak = Math.max(0, ...points.map((p) => Math.max(p.rideShare ?? 0, p.prev?.rideShare ?? 0)));
  const yMax = Math.min(1, Math.ceil((peak + 0.05) * 10) / 10);

  const summary = [
    t("rides.summary", { share: pct(report.kpis.rideShare.value), best: best ? b.label(best) : "—", bestShare: pct(best?.rideShare) }),
    withPrev ? t("rides.summaryPrevious", { share: pct(report.kpis.rideShare.previous) }) : "",
  ]
    .join(" ")
    .trim();

  const legend: LegendItem[] = [{ label: t("series.current"), color: CHART_COLORS[0], shape: "line" }];
  if (withPrev) legend.push({ label: t("series.previous"), color: PREVIOUS_COLOR, shape: "dashed" });

  const table: FigureTable = {
    columns: [
      { id: "bucket", header: b.firstColumn },
      { id: "share", header: t("series.share"), align: "end" },
      { id: "count", header: visits ? t("columns.withRide") : t("series.courier"), align: "end" },
      ...(withPrev ? [{ id: "previous", header: t("series.previous"), align: "end" as const }] : []),
    ],
    rows: points.map((p) => ({
      id: p.key,
      cells: [
        b.label(p),
        pct(p.rideShare),
        `${formatNumber(visits ? p.withRide : p.courier, locale)} / ${formatNumber(visits ? p.appointments : p.orders, locale)}`,
        ...(withPrev ? [pct(p.prev?.rideShare)] : []),
      ],
    })),
  };

  const data = points.map((p) => ({ key: p.key, current: p.rideShare, previous: p.prev?.rideShare ?? null }));
  const showDots = points.length <= 14;

  return (
    <StatsFigure
      index={index}
      title={visits ? t("rides.titleVisits") : t("rides.titleOrders")}
      description={visits ? t("rides.descriptionVisits") : t("rides.descriptionOrders")}
      summary={summary}
      legend={legend}
      table={table}
      empty={hasAny ? null : { title: t("rides.emptyTitle"), pet: "tabby" }}
      chart={
        <ComposedChart data={data} margin={margin}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="key" {...chartAxisProps} tickFormatter={b.tick} minTickGap={b.minTickGap} />
          <YAxis {...chartAxisProps} width={48} domain={[0, yMax]} tickFormatter={(v: number) => formatPercent(v, locale)} />
          <Tooltip cursor={lineCursor} content={<ChartTooltipContent labelFormatter={b.title} valueFormatter={(v) => pct(v)} />} />
          <Line
            type="monotone"
            dataKey="current"
            name={t("series.current")}
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            dot={showDots ? { r: 3, strokeWidth: 0, fill: CHART_COLORS[0] } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }}
          />
          {withPrev ? (
            <Line
              type="monotone"
              dataKey="previous"
              name={t("series.previous")}
              stroke={PREVIOUS_COLOR}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : null}
        </ComposedChart>
      }
    />
  );
});

// ---- Cancellations & no-shows (stacked bars) --------------------------------------------------------

export const CancellationsChart = memo(function CancellationsChart({ report, index, className }: ChartProps) {
  const t = useT("stats");
  const locale = useLocale();
  const b = useBuckets(report);
  const visits = report.features.appointments;
  const c = report.cancellations;
  const points = report.points;
  const num = (n: number) => formatNumber(n, locale);

  const series = visits
    ? [
        { key: "cancelled" as const, name: t("series.cancelled"), color: CHART_COLORS[3] },
        { key: "declined" as const, name: t("series.declined"), color: CHART_COLORS[1] },
        { key: "noShow" as const, name: t("series.noShow"), color: CHART_COLORS[2] },
      ]
    : [{ key: "cancelledOrders" as const, name: t("series.cancelledOrders"), color: CHART_COLORS[1] }];

  const total = visits ? c.cancelled + c.declined + c.noShow : c.cancelledOrders;
  const summary = visits
    ? t("cancellations.summaryVisits", {
        cancelled: num(c.cancelled),
        declined: num(c.declined),
        noShow: num(c.noShow),
        rate: formatPercent(c.lostRate, locale),
      })
    : t("cancellations.summaryOrders", { count: num(c.cancelledOrders), rate: formatPercent(c.orderCancelRate, locale) });

  const table: FigureTable = {
    columns: [{ id: "bucket", header: b.firstColumn }, ...series.map((s) => ({ id: s.key, header: s.name, align: "end" as const }))],
    rows: points.map((p) => ({ id: p.key, cells: [b.label(p), ...series.map((s) => num(p[s.key]))] })),
  };

  const data = points.map((p) => ({ key: p.key, ...Object.fromEntries(series.map((s) => [s.key, p[s.key]])) }));

  return (
    <StatsFigure
      index={index}
      className={className}
      title={visits ? t("cancellations.titleVisits") : t("cancellations.titleOrders")}
      description={
        visits
          ? t("cancellations.descriptionVisits", { rate: formatPercent(c.noShowRate, locale) })
          : t("cancellations.descriptionOrders", { rate: formatPercent(c.orderCancelRate, locale) })
      }
      summary={summary}
      legend={series.map((s) => ({ label: s.name, color: s.color }))}
      table={table}
      empty={
        total === 0
          ? { title: t("cancellations.emptyTitle"), description: visits ? t("cancellations.emptyVisits") : t("cancellations.emptyOrders"), pet: "golden" }
          : null
      }
      chart={
        <BarChart data={data} margin={margin} barCategoryGap={points.length > 20 ? "18%" : "28%"}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="key" {...chartAxisProps} tickFormatter={b.tick} minTickGap={b.minTickGap} />
          <YAxis {...chartAxisProps} width={40} allowDecimals={false} />
          <Tooltip cursor={tooltipCursor} content={<ChartTooltipContent labelFormatter={b.title} valueFormatter={(v) => num(v)} />} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="lost"
              fill={s.color}
              radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      }
    />
  );
});
