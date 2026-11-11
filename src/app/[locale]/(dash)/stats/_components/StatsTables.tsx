"use client";

import { ListOrdered, PackageSearch, Trophy, TriangleAlert } from "lucide-react";
import { memo, useState } from "react";

import { Button, CHART_COLORS, DeltaChip, EmptyState, Panel, ResponsiveTable, StatusPill, type Column } from "@/components/ui";
import { formatDecimal, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { MixRow, ProductRow, StatsReport } from "../_lib/engine";
import { rangeLabel } from "../_lib/labels";

/** Share as text plus a slim bar (the bar is decoration; the number is the content). */
function ShareCell({ share, color }: { share: number; color?: string }) {
  const locale = useLocale();
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span aria-hidden="true" className="hidden h-1.5 w-14 overflow-hidden rounded-chip bg-segment-track md:block">
        <span className="block h-full rounded-chip" style={{ width: `${Math.round(share * 100)}%`, background: color ?? CHART_COLORS[0] }} />
      </span>
      <span className="tabular">{formatPercent(share, locale)}</span>
    </span>
  );
}

// ---- Services --------------------------------------------------------------------------------------

export const TopServicesTable = memo(function TopServicesTable({ report, index = 0 }: { report: StatsReport; index?: number }) {
  const t = useT("stats");
  const locale = useLocale();
  const money = (n: number) => formatMoney(n, locale, { decimals: "auto" });
  const columns: Column<MixRow>[] = [
    {
      id: "name",
      header: t("columns.service"),
      rowHeader: true,
      sortable: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-[4px]" style={{ background: CHART_COLORS[r.slot] }} />
          {r.name}
        </span>
      ),
    },
    {
      id: "count",
      header: t("columns.appointments"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.count,
      cell: (r) => <span className="tabular">{formatNumber(r.count, locale)}</span>,
    },
    {
      id: "share",
      header: t("columns.share"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.share,
      cell: (r) => <ShareCell share={r.share} color={CHART_COLORS[r.slot]} />,
    },
    {
      id: "revenue",
      header: t("columns.revenue"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.revenue,
      cell: (r) => <span className="tabular">{money(r.revenue)}</span>,
    },
    {
      id: "ticket",
      header: t("columns.averageTicket"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.averageTicket,
      cell: (r) => <span className="tabular">{r.averageTicket === null ? "—" : money(r.averageTicket)}</span>,
      className: "hidden lg:table-cell",
    },
  ];
  if (report.showChange) {
    columns.push({
      id: "change",
      header: t("columns.change"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.delta,
      cell: (r) => <DeltaChip value={r.delta} className="justify-end" />,
      mobile: "badge",
    });
  }

  return (
    <Panel
      title={t("topServices.title")}
      description={t("topServices.description")}
      icon={<Trophy size={20} />}
      className="animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <ResponsiveTable
        caption={t("topServices.caption", { range: rangeLabel(report.range, t, locale) })}
        columns={columns}
        rows={report.services}
        getRowId={(r) => r.id}
        defaultSort={{ id: "count", direction: "desc" }}
        empty={<EmptyState compact title={t("topServices.emptyTitle")} pet="ginger" />}
      />
    </Panel>
  );
});

// ---- Products (shop) ---------------------------------------------------------------------------------

export const TopProductsTable = memo(function TopProductsTable({ report, index = 0 }: { report: StatsReport; index?: number }) {
  const t = useT("stats");
  const locale = useLocale();
  const rows = report.products
    .filter((p) => p.units > 0)
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, 10);
  const columns: Column<ProductRow>[] = [
    { id: "name", header: t("columns.product"), rowHeader: true, sortable: true, sortValue: (r) => r.name, cell: (r) => r.name },
    {
      id: "category",
      header: t("columns.category"),
      sortable: true,
      sortValue: (r) => t.dynamic(`categories.${r.category}`),
      cell: (r) => t.dynamic(`categories.${r.category}`),
      mobile: "subtitle",
      className: "hidden md:table-cell",
    },
    {
      id: "units",
      header: t("columns.unitsSold"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.units,
      cell: (r) => <span className="tabular">{formatNumber(r.units, locale)}</span>,
    },
    {
      id: "revenue",
      header: t("columns.revenue"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.revenue,
      cell: (r) => <span className="tabular">{formatMoney(r.revenue, locale, { decimals: "auto" })}</span>,
    },
    { id: "share", header: t("columns.share"), align: "end", sortable: true, sortValue: (r) => r.share, cell: (r) => <ShareCell share={r.share} /> },
  ];
  return (
    <Panel
      title={t("topProducts.title")}
      description={t("topProducts.description")}
      icon={<Trophy size={20} />}
      className="animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <ResponsiveTable
        caption={t("topProducts.caption", { range: rangeLabel(report.range, t, locale) })}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        defaultSort={{ id: "revenue", direction: "desc" }}
        empty={<EmptyState compact title={t("topProducts.emptyTitle")} pet="ginger" />}
      />
    </Panel>
  );
});

const STOCK_PREVIEW = 8;

/** Sooner-to-run-out first: sold out, then fewest days left, then products that didn't sell. */
function stockOrder(a: ProductRow, b: ProductRow): number {
  const rank = (p: ProductRow) => (p.stock <= 0 ? -1 : (p.daysLeft ?? Number.POSITIVE_INFINITY));
  return rank(a) - rank(b) || b.units - a.units;
}

export const StockTurnoverTable = memo(function StockTurnoverTable({ report, index = 0 }: { report: StatsReport; index?: number }) {
  const t = useT("stats");
  const tc = useT("common");
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);
  const rows = report.products.filter((p) => p.active || p.stock > 0).sort(stockOrder);
  const visible = showAll ? rows : rows.slice(0, STOCK_PREVIEW);
  const runningLow = rows.filter((p) => p.stock > 0 && p.daysLeft !== null && p.daysLeft < 7).length;

  const daysLeft = (p: ProductRow) => {
    if (p.stock <= 0) return "—";
    if (p.daysLeft === null) return t("stock.noSales");
    if (p.daysLeft < 1) return t("stock.lessThanDay");
    return t.plural("count.days", Math.floor(p.daysLeft));
  };

  const columns: Column<ProductRow>[] = [
    { id: "name", header: t("columns.product"), rowHeader: true, cell: (r) => r.name },
    {
      id: "stock",
      header: t("columns.stock"),
      align: "end",
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="tabular">{formatNumber(r.stock, locale)}</span>
          <StatusPill kind="stock" status={r.stockStatus} size="sm" />
        </span>
      ),
      mobile: "badge",
    },
    { id: "units", header: t("columns.unitsSold"), align: "end", cell: (r) => <span className="tabular">{formatNumber(r.units, locale)}</span> },
    {
      id: "perDay",
      header: t("columns.perDay"),
      align: "end",
      cell: (r) => <span className="tabular">{formatDecimal(r.perDay, locale)}</span>,
      className: "hidden md:table-cell",
    },
    { id: "daysLeft", header: t("columns.daysLeft"), align: "end", cell: (r) => <span className="tabular">{daysLeft(r)}</span> },
  ];

  return (
    <Panel
      title={t("stock.title")}
      description={t("stock.description")}
      icon={<PackageSearch size={20} />}
      className="animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {runningLow > 0 ? (
        <p className="mb-4 flex items-start gap-2 rounded-tile bg-warning-bg px-3 py-2 text-body-sm font-semibold text-warning-text">
          <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {t.plural("stock.runningLow", runningLow)}
        </p>
      ) : null}
      <ResponsiveTable
        caption={t("stock.caption", { range: rangeLabel(report.range, t, locale) })}
        columns={columns}
        rows={visible}
        getRowId={(r) => r.id}
        empty={<EmptyState compact title={t("stock.emptyTitle")} pet="ginger" />}
      />
      {rows.length > STOCK_PREVIEW ? (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" size="sm" leftIcon={<ListOrdered size={16} aria-hidden="true" />} onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? tc("actions.showLess") : tc("actions.showMore")}
          </Button>
        </div>
      ) : null}
    </Panel>
  );
});
