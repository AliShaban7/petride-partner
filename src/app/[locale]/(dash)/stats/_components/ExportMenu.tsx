"use client";

import { CalendarRange, ChevronDown, Download, Gauge, Layers } from "lucide-react";

import { Button, Menu, useToast, type MenuItem } from "@/components/ui";
import type { Kpi } from "@/lib/api/types";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/types";

import { downloadCsv, toCsv, type CsvCell } from "../_lib/csv";
import { OTHER_SERIES, type StatsReport } from "../_lib/engine";
import { bucketDays, dayStart, localDay } from "../_lib/range";
import { slug } from "../_lib/labels";

type StatsT = Translator<"stats">;

const pct = (ratio: number | null | undefined): CsvCell => (ratio === null || ratio === undefined ? null : Math.round(ratio * 1000) / 10);
const lastDay = (end: number) => localDay(dayStart(end, -1));

function summaryRows(r: StatsReport, t: StatsT): CsvCell[][] {
  const k = r.kpis;
  const visits = r.features.appointments;
  const prev = (v: number): CsvCell => (r.comparable ? v : null);
  const row = (label: string, kpi: Kpi, transform: (n: number) => CsvCell = (n) => n): CsvCell[] => [
    label,
    transform(kpi.value),
    r.comparable ? transform(kpi.previous) : null,
    pct(kpi.delta),
  ];
  const money = (label: string) => t("export.money", { label });
  const percent = (label: string) => t("export.percent", { label });
  return [
    [t("columns.metric"), t("series.current"), t("series.previous"), percent(t("columns.change"))],
    [t("export.period"), `${r.range.from} – ${r.range.to}`, r.comparable ? `${r.previous.from} – ${r.previous.to}` : null, null],
    row(money(t("kpi.revenue")), k.revenue),
    visits ? row(t("kpi.appointments"), k.appointments) : row(t("kpi.orders"), k.orders),
    row(money(t("kpi.averageTicket")), k.averageTicket),
    row(t("kpi.newClients"), k.newClients),
    row(t("kpi.returningClients"), k.returningClients),
    row(percent(visits ? t("kpi.rideShare") : t("kpi.courierShare")), k.rideShare, pct),
    [t("kpi.rating"), k.ratingCount ? k.rating.value : null, r.comparable && r.rating.previousCount ? r.rating.previousAverage : null, pct(k.rating.delta)],
    [t("kpi.reviewsCount"), k.ratingCount, prev(r.rating.previousCount), null],
    ...(visits ? [row(percent(t("kpi.noShowRate")), k.noShowRate, pct)] : []),
  ];
}

function seriesRows(r: StatsReport, t: StatsT): CsvCell[][] {
  const visits = r.features.appointments;
  const withPrev = r.points.some((p) => p.prev);
  const money = (label: string) => t("export.money", { label });
  const services = visits ? r.serviceSeries : [];
  const header: CsvCell[] = [
    t("columns.start"),
    t("columns.end"),
    money(t("columns.revenue")),
    ...(withPrev ? [money(`${t("columns.revenue")} · ${t("series.previous")}`)] : []),
    ...(visits
      ? [t("columns.appointments"), t("columns.completed"), t("series.cancelled"), t("series.declined"), t("series.noShow"), t("columns.withRide")]
      : [t("columns.orders"), t("series.pickup"), t("series.courier"), t("series.cancelledOrders")]),
    t("export.percent", { label: t("series.share") }),
    ...services.map((s) => (s.id === OTHER_SERIES ? t("series.otherServices") : s.name)),
  ];
  const rows = r.points.map((p): CsvCell[] => [
    p.key,
    lastDay(p.end),
    p.revenue,
    ...(withPrev ? [p.prev ? p.prev.revenue : null] : []),
    ...(visits ? [p.appointments, p.completed, p.cancelled, p.declined, p.noShow, p.withRide] : [p.orders, p.pickup, p.courier, p.cancelledOrders]),
    pct(p.rideShare),
    ...services.map((s) => p.byService[s.id] ?? 0),
  ]);
  return [header, ...rows];
}

function mixRows(r: StatsReport, t: StatsT): CsvCell[][] {
  const money = (label: string) => t("export.money", { label });
  const percent = (label: string) => t("export.percent", { label });
  if (r.features.appointments) {
    const withPrev = r.showChange;
    return [
      [
        t("columns.service"),
        t("columns.appointments"),
        percent(t("columns.share")),
        t("columns.completed"),
        money(t("columns.revenue")),
        money(t("columns.averageTicket")),
        ...(withPrev ? [t("columns.previousBookings"), percent(t("columns.change"))] : []),
      ],
      ...r.services.map((s): CsvCell[] => [
        s.name,
        s.count,
        pct(s.share),
        s.completed,
        s.revenue,
        s.averageTicket,
        ...(withPrev ? [s.previousCount, pct(s.delta)] : []),
      ]),
    ];
  }
  return [
    [t("columns.product"), t("columns.category"), t("columns.unitsSold"), money(t("columns.revenue")), percent(t("columns.share")), t("columns.stock"), t("columns.perDay"), t("columns.daysLeft")],
    ...[...r.products]
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
      .map((p): CsvCell[] => [
        p.name,
        t.dynamic(`categories.${p.category}`),
        p.units,
        p.revenue,
        pct(p.share),
        p.stock,
        Math.round(p.perDay * 10) / 10,
        p.daysLeft === null ? null : Math.round(p.daysLeft * 10) / 10,
      ]),
  ];
}

/** "Export CSV" menu: key figures, the chart series (by day / week), services or products. */
export function ExportMenu({ report, partnerName }: { report: StatsReport | null; partnerName: string }) {
  const t = useT("stats");
  const locale = useLocale();
  const { toast } = useToast();

  if (!report) {
    return (
      <Button variant="outline" leftIcon={<Download size={18} aria-hidden="true" />} disabled>
        {t("export.button")}
      </Button>
    );
  }

  const weekly = bucketDays(report.range) === 7;
  const save = (kind: string, rows: CsvCell[][]) => {
    const file = `petride-${slug(partnerName)}-${kind}-${report.range.from}_${report.range.to}.csv`;
    downloadCsv(file, toCsv(rows, locale));
    toast({ title: t("export.done"), description: file, tone: "success" });
  };
  const items: MenuItem[] = [
    { id: "summary", label: t("export.summary"), icon: <Gauge size={18} aria-hidden="true" />, onSelect: () => save("summary", summaryRows(report, t)) },
    {
      id: "series",
      label: weekly ? t("export.seriesWeek") : t("export.seriesDay"),
      icon: <CalendarRange size={18} aria-hidden="true" />,
      onSelect: () => save(weekly ? "weekly" : "daily", seriesRows(report, t)),
    },
    {
      id: "mix",
      label: report.features.appointments ? t("export.services") : t("export.products"),
      icon: <Layers size={18} aria-hidden="true" />,
      onSelect: () => save(report.features.appointments ? "services" : "products", mixRows(report, t)),
    },
  ];

  return (
    <Menu
      label={t("export.menu")}
      items={items}
      trigger={(props) => (
        <Button variant="outline" leftIcon={<Download size={18} aria-hidden="true" />} rightIcon={<ChevronDown size={16} aria-hidden="true" />} {...props}>
          {t("export.button")}
        </Button>
      )}
    />
  );
}
