"use client";

import { PackageOpen, ShoppingBag, ShoppingBasket, Wallet } from "lucide-react";

import { Card, KpiCard, PageHeader, TabPanel, Tabs } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import { formatMoney, formatNumber } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";
import { stockStatus } from "@/lib/status";

import { useUrlState } from "./hooks";
import { KpiStrip } from "./KpiStrip";
import { OrdersSection } from "./OrdersSection";
import { ProductsSection } from "./ProductsSection";

const SECTIONS_ID = "orders-section";

/** Pet shop: Orders (table / board) and Products & stock as two tabs on the title row, today's numbers, the section. */
export function ShopOrdersView() {
  const t = useT("orders");
  const tc = useT("common");
  const locale = useLocale();
  const url = useUrlState();
  const section = url.get("section") === "products" ? "products" : "orders";

  const kpis = useApiQuery(["stats", "kpis", "today"], (api) => api.getKpis("today"), { refreshMs: 60_000 });
  const products = useApiQuery(["products"], (api) => api.listProducts());
  const k = kpis.data;
  const running = products.data?.filter((p) => stockStatus(p.stock, p.lowStockAt) !== "in") ?? [];
  const soldOut = running.filter((p) => p.stock <= 0).length;
  const dash = "—";

  // Each KPI is one dense line (value + change): the strip is a single row of four on desktops.
  return (
    <div className="space-y-section">
      {/* The Orders / Products switch sits on the title row (no description: the title says it). */}
      <PageHeader
        title={t("title")}
        actions={
          <Tabs
            idPrefix={SECTIONS_ID}
            variant="pills"
            label={t("sections.label")}
            value={section}
            onChange={(id) => url.set({ section: id === "products" ? "products" : null })}
            tabs={[
              { id: "orders", label: t("sections.orders"), icon: <ShoppingBag size={16} aria-hidden="true" /> },
              { id: "products", label: t("sections.products"), icon: <PackageOpen size={16} aria-hidden="true" />, count: running.length || undefined },
            ]}
            className="w-fit"
          />
        }
      />

      <KpiStrip label={t("kpi.label")} className="sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          size="sm"
          tone="mint"
          pet="golden"
          icon={<ShoppingBag size={18} />}
          label={t("kpi.orders")}
          loading={kpis.isLoading}
          value={k ? formatNumber(k.orders.value, locale) : dash}
          delta={k ? k.orders.delta : undefined}
          deltaLabel={tc("delta.vs_today")}
        />
        <KpiCard
          index={1}
          size="sm"
          tone="peach"
          pet="ginger"
          icon={<Wallet size={18} />}
          label={t("kpi.revenue")}
          loading={kpis.isLoading}
          value={k ? formatMoney(k.revenue.value, locale, { decimals: 0 }) : dash}
          delta={k ? k.revenue.delta : undefined}
          deltaLabel={tc("delta.vs_today")}
        />
        <KpiCard
          index={2}
          size="sm"
          tone="lilac"
          pet="tabby"
          icon={<ShoppingBasket size={18} />}
          label={t("kpi.averageTicket")}
          loading={kpis.isLoading}
          value={k ? formatMoney(k.averageTicket.value, locale, { decimals: "auto" }) : dash}
          delta={k ? k.averageTicket.delta : undefined}
          deltaLabel={tc("delta.vs_today")}
        />
        <KpiCard
          index={3}
          size="sm"
          tone="sand"
          pet="cream"
          icon={<PackageOpen size={18} />}
          label={t("kpi.lowStock")}
          loading={products.isLoading}
          value={products.data ? formatNumber(running.length, locale) : dash}
          footnote={products.data?.length ? (soldOut ? t.plural("kpi.outOfStock", soldOut) : running.length ? undefined : t("kpi.allStocked")) : undefined}
          href={localizedHref(locale, ROUTES.orders, { section: "products", stock: "low" })}
        />
      </KpiStrip>

      <TabPanel idPrefix={SECTIONS_ID} value={section}>
        <Card padding="md" className="animate-fade-up">
          {section === "orders" ? <OrdersSection /> : <ProductsSection />}
        </Card>
      </TabPanel>
    </div>
  );
}
