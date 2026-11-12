"use client";

import { ListOrdered, PackageSearch, Trophy, TriangleAlert } from "lucide-react";
import { memo, useId, useState, type ReactNode } from "react";

import { Button, CHART_COLORS, DeltaChip, EmptyState, Panel, ResponsiveTable, StatusPill, TabPanel, Tabs, type Column } from "@/components/ui";
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

/**
 * Phone card for the stats tables: the name (+ a badge) on one line and the numbers as one
 * wrapping line of "label value" pairs, instead of a label/value row per column.
 */
function CompactCard({ title, badge, subtitle, items }: { title: ReactNode; badge?: ReactNode; subtitle?: ReactNode; items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body font-semibold text-fg">{title}</p>
          {subtitle ? <p className="text-meta text-fg-secondary">{subtitle}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-meta">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline gap-1.5">
            <dt className="text-fg-secondary">{item.label}</dt>
            <dd className="font-semibold text-fg tabular">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
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
        mobileCard={(r) => (
          <CompactCard
            title={
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-[4px]" style={{ background: CHART_COLORS[r.slot] }} />
                {r.name}
              </span>
            }
            badge={report.showChange ? <DeltaChip value={r.delta} /> : undefined}
            items={[
              { label: t("columns.appointments"), value: formatNumber(r.count, locale) },
              { label: t("columns.share"), value: formatPercent(r.share, locale) },
              { label: t("columns.revenue"), value: money(r.revenue) },
              { label: t("columns.averageTicket"), value: r.averageTicket === null ? "—" : money(r.averageTicket) },
            ]}
          />
        )}
      />
    </Panel>
  );
});

// ---- Products (shop) ---------------------------------------------------------------------------------

function TopProductsBody({ report }: { report: StatsReport }) {
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
    <>
      <p className="mb-3 text-body-sm text-fg-secondary">{t("topProducts.description")}</p>
      <ResponsiveTable
        caption={t("topProducts.caption", { range: rangeLabel(report.range, t, locale) })}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        defaultSort={{ id: "revenue", direction: "desc" }}
        empty={<EmptyState compact title={t("topProducts.emptyTitle")} pet="ginger" />}
        mobileCard={(r) => (
          <CompactCard
            title={r.name}
            subtitle={t.dynamic(`categories.${r.category}`)}
            items={[
              { label: t("columns.unitsSold"), value: formatNumber(r.units, locale) },
              { label: t("columns.revenue"), value: formatMoney(r.revenue, locale, { decimals: "auto" }) },
              { label: t("columns.share"), value: formatPercent(r.share, locale) },
            ]}
          />
        )}
      />
    </>
  );
}

const STOCK_PREVIEW = 8;

/** Sooner-to-run-out first: sold out, then fewest days left, then products that didn't sell. */
function stockOrder(a: ProductRow, b: ProductRow): number {
  const rank = (p: ProductRow) => (p.stock <= 0 ? -1 : (p.daysLeft ?? Number.POSITIVE_INFINITY));
  return rank(a) - rank(b) || b.units - a.units;
}

const stockRows = (report: StatsReport) => report.products.filter((p) => p.active || p.stock > 0).sort(stockOrder);
const runningLowCount = (rows: ProductRow[]) => rows.filter((p) => p.stock > 0 && p.daysLeft !== null && p.daysLeft < 7).length;

function StockBody({ report }: { report: StatsReport }) {
  const t = useT("stats");
  const tc = useT("common");
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);
  const rows = stockRows(report);
  const visible = showAll ? rows : rows.slice(0, STOCK_PREVIEW);
  const runningLow = runningLowCount(rows);

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
    <>
      <p className="mb-3 text-body-sm text-fg-secondary">{t("stock.description")}</p>
      {runningLow > 0 ? (
        <p className="mb-3 flex items-start gap-2 rounded-tile bg-warning-bg px-3 py-2 text-body-sm font-semibold text-warning-text">
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
        mobileCard={(r) => (
          <CompactCard
            title={r.name}
            badge={<StatusPill kind="stock" status={r.stockStatus} size="sm" />}
            items={[
              { label: t("columns.stock"), value: formatNumber(r.stock, locale) },
              { label: t("columns.unitsSold"), value: formatNumber(r.units, locale) },
              { label: t("columns.perDay"), value: formatDecimal(r.perDay, locale) },
              { label: t("columns.daysLeft"), value: daysLeft(r) },
            ]}
          />
        )}
      />
      {rows.length > STOCK_PREVIEW ? (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" leftIcon={<ListOrdered size={16} aria-hidden="true" />} onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? tc("actions.showLess") : tc("actions.showMore")}
          </Button>
        </div>
      ) : null}
    </>
  );
}

// ---- Products panel (shop): best sellers and stock turnover as two tabs of one full-width panel ----------

type ProductsTab = "top" | "stock";

export const ProductsPanel = memo(function ProductsPanel({ report, index = 0 }: { report: StatsReport; index?: number }) {
  const t = useT("stats");
  const [tab, setTab] = useState<ProductsTab>("top");
  const prefix = `stats-products${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  // The coral count on the stock tab: products that won't last a week, visible from either tab.
  const runningLow = runningLowCount(stockRows(report));
  return (
    <Panel
      title={t("productsPanel.title")}
      icon={tab === "top" ? <Trophy size={20} /> : <PackageSearch size={20} />}
      className="animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
      actions={
        <Tabs
          variant="pills"
          label={t("productsPanel.title")}
          idPrefix={prefix}
          value={tab}
          onChange={(id) => setTab(id as ProductsTab)}
          tabs={[
            { id: "top", label: t("productsPanel.top") },
            { id: "stock", label: t("productsPanel.stock"), count: runningLow },
          ]}
        />
      }
    >
      {/* Both stay mounted (sort order, "show more" survive a tab switch); only the active one shows. */}
      <TabPanel idPrefix={prefix} value="top" className={tab === "top" ? undefined : "hidden"}>
        <TopProductsBody report={report} />
      </TabPanel>
      <TabPanel idPrefix={prefix} value="stock" className={tab === "stock" ? undefined : "hidden"}>
        <StockBody report={report} />
      </TabPanel>
    </Panel>
  );
});
