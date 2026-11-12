"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AsyncView,
  Button,
  EmptyState,
  Pagination,
  ResponsiveTable,
  SearchField,
  SegmentedControl,
  Select,
  StatusPill,
  useToast,
  type Column,
  type SortState,
} from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { Product, ProductCategory, ProductPatch } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { stockStatus } from "@/lib/status";

import { FiltersPopover } from "./FiltersPopover";
import { useUrlState } from "./hooks";
import { InlineNumberEdit, parseLocaleNumber } from "./InlineNumberEdit";

const CATEGORIES: ProductCategory[] = ["food", "treats", "toys", "care", "accessories", "health"];
type StockFilter = "all" | "low" | "out";
const STOCK_RANK = { out: 0, low: 1, in: 2 } as const;
/** Sort keys of the sortable columns (same as their `sortValue`). */
const SORT_VALUES: Record<string, (p: Product) => string | number> = {
  name: (p) => p.name,
  price: (p) => p.priceAZN,
  stock: (p) => STOCK_RANK[stockStatus(p.stock, p.lowStockAt)] * 100_000 + p.stock,
  sold: (p) => p.sold30d,
};
const NONE: string[] = [];
/** Rows a page; every dashboard list uses 12 so one page fits a laptop screen. */
const PAGE_SIZE = 12;
/** Body cells (td and the row-header th) from 1024px: 6px instead of 8px top and bottom. Header cells keep theirs. */
const DENSE = "lg:[tbody_&]:py-1.5";

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

/** Products of the shop: search, category and stock filters, inline price / stock edits, pages of 15. */
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

  // Sorting and paging are controlled here (the table alone would only sort one page). Changing the
  // filters or the sort starts again at page 1.
  const [sort, setSort] = useState<SortState>({ id: "stock", direction: "asc" });
  const viewKey = `${filterKey}|${sort?.id ?? ""}|${sort?.direction ?? ""}`;
  const [paging, setPaging] = useState({ key: viewKey, page: 1 });
  const page = paging.key === viewKey ? paging.page : 1;
  // The order rows were in when the first edit under this view was saved. While it holds, an edit
  // that changes a sorted value (stock 3 -> 40) leaves the row where it is, on this page, instead
  // of jumping to another page under the cursor. A new filter or sort re-sorts.
  const [frozen, setFrozen] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });

  const query = useApiQuery(["products"], (api) => api.listProducts());
  const { mutateAsync } = useApiMutation((api, id: string, patch: ProductPatch) => api.updateProduct(id, patch), {
    invalidates: ["products", "overview", "stats"],
  });

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

  const sorted = useMemo(() => {
    const value = SORT_VALUES[sort?.id ?? ""];
    const fresh = value
      ? [...rows].sort((a, b) => {
          const av = value(a);
          const bv = value(b);
          const diff = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), locale);
          return sort?.direction === "desc" ? -diff : diff;
        })
      : rows;
    if (frozen.key !== viewKey) return fresh;
    const rank = new Map(frozen.ids.map((id, i) => [id, i]));
    return [...fresh].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }, [rows, sort, locale, frozen, viewKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const order = sorted.map((p) => p.id).join(",");

  const save = useCallback(
    async (p: Product, patch: ProductPatch, message: string) => {
      try {
        await mutateAsync(p.id, patch);
        setHeld((h) => ({ key: filterKey, ids: h.key === filterKey ? [...h.ids, p.id] : [p.id] }));
        setFrozen((f) => (f.key === viewKey ? f : { key: viewKey, ids: order.split(",") }));
        toast({ tone: "success", title: message, description: t("products.savedBody") });
        return true;
      } catch (error) {
        toast({ tone: "error", title: tc("states.errorTitle"), description: tc.dynamic(`errors.${errorCode(error)}`) });
        return false;
      }
    },
    [mutateAsync, toast, t, tc, filterKey, viewKey, order],
  );

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
      sortValue: SORT_VALUES.name,
      className: DENSE,
      cell: (p) => (
        <div className="min-w-44">
          <p className="font-semibold text-fg">{p.name}</p>
          <p className="text-meta font-normal text-fg-secondary tabular">{p.sku}</p>
        </div>
      ),
    },
    { id: "category", header: t("products.category"), className: cn("hidden md:table-cell", DENSE), cell: (p) => t.dynamic(`products.categories.${p.category}`) },
    { id: "price", header: t("products.price"), align: "end", sortable: true, sortValue: SORT_VALUES.price, className: DENSE, cell: priceEditor },
    {
      id: "stock",
      header: t("products.stock"),
      align: "end",
      sortable: true,
      sortValue: SORT_VALUES.stock,
      className: DENSE,
      cell: (p) => (
        // From 1280px the pill sits left of the number, so the numbers line up at the column's end. Not
        // from 1024px: next to the full sidebar that made the table ~100px wider than its card.
        <div className="flex flex-col items-end gap-1 xl:flex-row-reverse xl:items-center xl:justify-start xl:gap-2.5">
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
      sortValue: SORT_VALUES.sold,
      className: cn("hidden lg:table-cell", DENSE),
      cell: (p) => <span className="tabular">{formatNumber(p.sold30d, locale)}</span>,
    },
  ];

  // Phone card: name + stock pill; category · SKU with "sold in 30 days" on the right; price and stock
  // editors side by side (an open editor takes the whole row). Three equal columns at 360–390px cut the
  // "sold" label and wrapped "10 pcs" under its pencil.
  const mobileCard = (p: Product) => (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold text-fg">{p.name}</p>
        {stockPill(p)}
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-meta">
        <p className="text-fg-secondary">
          {t.dynamic(`products.categories.${p.category}`)} · <span className="tabular">{p.sku}</span>
        </p>
        <p className="whitespace-nowrap">
          <span className="text-fg-secondary">{t("products.sold30d")}:</span> <span className="font-semibold text-fg tabular">{formatNumber(p.sold30d, locale)}</span>
        </p>
      </div>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 text-meta">
        <div className="min-w-0 has-[input]:col-span-2">
          <dt className="text-fg-secondary">{t("products.price")}</dt>
          <dd className="flex min-h-11 items-center text-body-sm">{priceEditor(p)}</dd>
        </div>
        <div className="min-w-0 has-[input]:col-span-2">
          <dt className="text-fg-secondary">{t("products.stock")}</dt>
          <dd className="flex min-h-11 items-center text-body-sm">{stockEditor(p)}</dd>
        </div>
      </dl>
    </div>
  );

  // Inline from 640px (label hidden: the placeholder says it); in the phones' Filters popover with its label.
  const categorySelect = (inlineClassName?: string) => (
    <Select
      label={t("products.category")}
      hideLabel={inlineClassName !== undefined}
      value={category}
      onChange={(e) => setCategory(e.target.value as ProductCategory | "")}
      placeholder={t("products.categoryAll")}
      options={CATEGORIES.map((c) => ({ value: c, label: t.dynamic(`products.categories.${c}`) }))}
      wrapperClassName={inlineClassName}
    />
  );

  const filtered = Boolean(search.trim() || category || stock !== "all");
  const reset = () => {
    setSearch("");
    setCategory("");
    url.set({ stock: null });
  };

  return (
    <div className="space-y-3">
      {/* Phones: search + a Filters button (category inside) on one row, then the stock switch. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex items-center gap-2 lg:contents">
          <SearchField label={t("products.searchLabel")} placeholder={t("products.search")} value={search} onValueChange={setSearch} wrapperClassName="min-w-0 flex-1 lg:max-w-xs" />
          <FiltersPopover label={tc("actions.filter")} count={category ? 1 : 0} className="sm:hidden">
            {categorySelect()}
          </FiltersPopover>
        </div>
        <div className="flex flex-wrap items-end gap-3 lg:contents">
          {categorySelect("max-sm:hidden sm:w-56")}
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
          <div className="space-y-3">
            <ResponsiveTable
              caption={t("products.caption")}
              columns={columns}
              rows={pageRows}
              getRowId={(p) => p.id}
              sort={sort}
              onSortChange={setSort}
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
            {sorted.length ? (
              <Pagination page={current} pageCount={pageCount} total={sorted.length} pageSize={PAGE_SIZE} onPageChange={(p) => setPaging({ key: viewKey, page: p })} />
            ) : null}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
