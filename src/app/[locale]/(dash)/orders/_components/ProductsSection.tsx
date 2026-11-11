"use client";

import { useCallback, useMemo, useState } from "react";

import { AsyncView, Button, EmptyState, ResponsiveTable, SearchField, SegmentedControl, Select, StatusPill, useToast, type Column } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { Product, ProductCategory, ProductPatch } from "@/lib/api/types";
import { formatMoney, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { stockStatus } from "@/lib/status";

import { useUrlState } from "./hooks";
import { InlineNumberEdit, parseLocaleNumber } from "./InlineNumberEdit";

const CATEGORIES: ProductCategory[] = ["food", "treats", "toys", "care", "accessories", "health"];
type StockFilter = "all" | "low" | "out";
const STOCK_RANK = { out: 0, low: 1, in: 2 } as const;
const NONE: string[] = [];

/** Case- and diacritic-insensitive match ("yem" finds "Yem", "kopek" finds "köpək"). */
function fold(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Price as the user would type it in this language: "24,90" / "24.90". */
const priceText = (n: number, locale: Locale) => (locale === "en" ? n.toFixed(2) : n.toFixed(2).replace(".", ","));

/** Products of the shop: search, category and stock filters, inline price / stock edits. */
export function ProductsSection() {
  const t = useT("orders");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const url = useUrlState();
  const stockParam = url.get("stock");
  const stock: StockFilter = stockParam === "low" || stockParam === "out" ? stockParam : "all";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "">("");
  // Products edited under the current filters stay listed even if the edit moves them out of the
  // stock filter (e.g. stock 3 -> 40 under "Running low"): a row vanishing under the cursor would
  // drop keyboard focus and hide the result of the edit. Changing a filter clears this.
  const filterKey = `${stock}|${category}|${search}`;
  const [held, setHeld] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const heldIds = useMemo(() => (held.key === filterKey ? held.ids : NONE), [held, filterKey]);

  const query = useApiQuery(["products"], (api) => api.listProducts());
  const { mutateAsync } = useApiMutation((api, id: string, patch: ProductPatch) => api.updateProduct(id, patch), {
    invalidates: ["products", "overview", "stats"],
  });

  const save = useCallback(
    async (p: Product, patch: ProductPatch, message: string) => {
      try {
        await mutateAsync(p.id, patch);
        setHeld((h) => ({ key: filterKey, ids: h.key === filterKey ? [...h.ids, p.id] : [p.id] }));
        toast({ tone: "success", title: message });
        return true;
      } catch (error) {
        toast({ tone: "error", title: tc("states.errorTitle"), description: tc.dynamic(`errors.${errorCode(error)}`) });
        return false;
      }
    },
    [mutateAsync, toast, tc, filterKey],
  );

  const rows = useMemo(() => {
    const q = fold(search.trim());
    return (query.data ?? []).filter((p) => {
      if (category && p.category !== category) return false;
      const s = stockStatus(p.stock, p.lowStockAt);
      const kept = heldIds.includes(p.id);
      if (!kept && stock === "low" && s === "in") return false;
      if (!kept && stock === "out" && s !== "out") return false;
      return !q || fold(`${p.name} ${p.sku}`).includes(q);
    });
  }, [query.data, search, category, stock, heldIds]);

  const validatePrice = (raw: string) => {
    const n = parseLocaleNumber(raw);
    return n === null || n <= 0 || n > 10_000 ? { error: t("products.invalidPrice") } : { value: Math.round(n * 100) / 100 };
  };
  const validateStock = (raw: string) => {
    const clean = raw.trim();
    return /^\d{1,5}$/.test(clean) ? { value: Number(clean) } : { error: t("products.invalidStock") };
  };

  const priceEditor = (p: Product) => (
    <InlineNumberEdit
      display={<span className="font-semibold">{formatMoney(p.priceAZN, locale)}</span>}
      initial={priceText(p.priceAZN, locale)}
      editLabel={t("products.editPrice", { name: p.name })}
      inputLabel={t("products.priceInput", { name: p.name })}
      saveLabel={t("products.save")}
      cancelLabel={t("products.cancelEdit")}
      inputMode="decimal"
      suffix="₼"
      validate={validatePrice}
      onSave={(value) => save(p, { priceAZN: value }, t("products.priceSaved", { name: p.name }))}
    />
  );
  const stockEditor = (p: Product) => (
    <InlineNumberEdit
      display={t("products.pcs", { count: formatNumber(p.stock, locale) })}
      initial={String(p.stock)}
      editLabel={t("products.editStock", { name: p.name })}
      inputLabel={t("products.stockInput", { name: p.name })}
      saveLabel={t("products.save")}
      cancelLabel={t("products.cancelEdit")}
      inputMode="numeric"
      validate={validateStock}
      onSave={(value) => save(p, { stock: value }, t("products.stockSaved", { name: p.name }))}
    />
  );
  const stockPill = (p: Product) => (
    <span title={t("products.lowAt", { count: formatNumber(p.lowStockAt, locale) })}>
      <StatusPill kind="stock" status={stockStatus(p.stock, p.lowStockAt)} size="sm" />
    </span>
  );

  const columns: Column<Product>[] = [
    {
      id: "name",
      header: t("products.name"),
      rowHeader: true,
      sortable: true,
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-44">
          <p className="font-semibold text-fg">{p.name}</p>
          <p className="text-meta font-normal text-fg-secondary tabular">{p.sku}</p>
        </div>
      ),
    },
    { id: "category", header: t("products.category"), className: "hidden md:table-cell", cell: (p) => t.dynamic(`products.categories.${p.category}`) },
    { id: "price", header: t("products.price"), align: "end", sortable: true, sortValue: (p) => p.priceAZN, cell: priceEditor },
    {
      id: "stock",
      header: t("products.stock"),
      align: "end",
      sortable: true,
      sortValue: (p) => STOCK_RANK[stockStatus(p.stock, p.lowStockAt)] * 100_000 + p.stock,
      cell: (p) => (
        <div className="flex flex-col items-end gap-1">
          {stockEditor(p)}
          {stockPill(p)}
        </div>
      ),
    },
    {
      id: "sold",
      header: t("products.sold30d"),
      align: "end",
      sortable: true,
      sortValue: (p) => p.sold30d,
      className: "hidden lg:table-cell",
      cell: (p) => <span className="tabular">{formatNumber(p.sold30d, locale)}</span>,
    },
  ];

  const mobileCard = (p: Product) => (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-fg">{p.name}</p>
          <p className="text-meta text-fg-secondary">
            {t.dynamic(`products.categories.${p.category}`)} · <span className="tabular">{p.sku}</span>
          </p>
        </div>
        {stockPill(p)}
      </div>
      <dl className="mt-3 space-y-1 text-meta">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <dt className="text-fg-secondary">{t("products.price")}</dt>
          <dd className="text-body-sm">{priceEditor(p)}</dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <dt className="text-fg-secondary">{t("products.stock")}</dt>
          <dd className="text-body-sm">{stockEditor(p)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-meta text-fg-secondary">
        {t("products.sold30d")}: <span className="font-semibold text-fg tabular">{formatNumber(p.sold30d, locale)}</span>
      </p>
    </div>
  );

  const filtered = Boolean(search.trim() || category || stock !== "all");
  const reset = () => {
    setSearch("");
    setCategory("");
    url.set({ stock: null });
  };

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-fg-secondary">{t("products.description")}</p>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchField label={t("products.searchLabel")} placeholder={t("products.search")} value={search} onValueChange={setSearch} wrapperClassName="w-full lg:max-w-xs" />
        <div className="flex flex-wrap items-end gap-3 lg:contents">
          <Select
            label={t("products.category")}
            hideLabel
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory | "")}
            placeholder={t("products.categoryAll")}
            options={CATEGORIES.map((c) => ({ value: c, label: t.dynamic(`products.categories.${c}`) }))}
            wrapperClassName="min-w-40 flex-1 sm:w-56 sm:flex-none"
          />
          <SegmentedControl
            label={t("products.stockFilter")}
            value={stock}
            onChange={(v) => url.set({ stock: v === "all" ? null : v })}
            options={[
              { value: "all", label: t("products.stockAll") },
              { value: "low", label: t("products.stockLow") },
              { value: "out", label: t("products.stockOut") },
            ]}
            className="sm:ml-auto"
          />
        </div>
      </div>
      <AsyncView
        query={query}
        loading={<ResponsiveTable caption={t("products.caption")} columns={columns} rows={[]} getRowId={(p) => p.id} loading skeletonRows={8} />}
        empty={<EmptyState title={t("products.emptyTitle")} description={tc("states.emptyBody")} pet="cream" />}
      >
        {() => (
          <ResponsiveTable
            caption={t("products.caption")}
            columns={columns}
            rows={rows}
            getRowId={(p) => p.id}
            defaultSort={{ id: "stock", direction: "asc" }}
            mobileCard={mobileCard}
            empty={
              <EmptyState
                title={t("products.emptyTitle")}
                description={t("products.emptyBody")}
                pet="tabby"
                action={
                  filtered ? (
                    <Button variant="secondary" size="sm" onClick={reset}>
                      {t("filters.clear")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </AsyncView>
    </div>
  );
}
