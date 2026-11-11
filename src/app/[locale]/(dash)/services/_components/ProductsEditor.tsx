"use client";

import { Boxes, PackageCheck, PackageX, Pencil, ShoppingBag, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { controlClass, SaveBar, useDraft, useUnsavedGuard } from "@/components/services-settings";
import {
  Checkbox,
  EmptyState,
  ErrorState,
  IconButton,
  KpiCard,
  PageHeader,
  Panel,
  SearchField,
  SkeletonRows,
  StatusPill,
  Switch,
  useToast,
} from "@/components/ui";
import type { ProductCategory, ProductPatch } from "@/lib/api/types";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { PriceInput } from "./PriceInput";
import { ProductDialog } from "./ProductDialog";
import {
  draftStockStatus,
  hasErrors,
  PRODUCT_CATS,
  productEquals,
  productErrors,
  productName,
  productPatch,
  productsEqual,
  saveProducts,
  toProductsDraft,
  type ProductDraft,
  type ProductsDraft,
} from "./productModel";

/** Case- and diacritic-insensitive search key: "yem" finds "Yem", "it" finds "İt", "kopek" finds "köpək". */
const fold = (s: string) =>
  s
    .toLocaleLowerCase("az")
    .replace(/[ıİ]/g, "i")
    .replace(/ə/g, "e")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Products & prices for pet shops: KPIs (active, low stock, out of stock, sold), search and
 * filters, products grouped by category with inline price / stock / active edits, an edit dialog
 * and a sticky save bar. `headless` hides the page title (when shown under the services editor).
 */
export function ProductsEditor({ headless = false }: { headless?: boolean }) {
  const t = useT("services");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const query = useApiQuery(["products"], (api) => api.listProducts());
  const serverBase = useMemo(() => (query.data ? toProductsDraft(query.data, locale) : undefined), [query.data, locale]);
  const { draft, base, setDraft, reset, commit, dirty } = useDraft<ProductsDraft>(serverBase, productsEqual);
  useUnsavedGuard(dirty, t("saveBar.leaveConfirm"));

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [editing, setEditing] = useState<ProductDraft | null>(null);

  const save = useApiMutation((api, patches: { id: string; patch: ProductPatch }[]) => saveProducts(api, patches), {
    invalidates: ["products", "overview", "stats"],
  });

  const items = useMemo(() => (draft ? Object.values(draft) : []), [draft]);
  const changed = useMemo(() => new Set(items.filter((p) => base?.[p.id] && !productEquals(p, base[p.id])).map((p) => p.id)), [items, base]);
  const invalid = items.filter((p) => hasErrors(productErrors(p)));

  const kpis = useMemo(() => {
    const saved = base ? Object.values(base) : [];
    return {
      total: saved.length,
      active: saved.filter((p) => p.active).length,
      low: saved.filter((p) => draftStockStatus(p) === "low").length,
      out: saved.filter((p) => draftStockStatus(p) === "out").length,
      sold: saved.reduce((s, p) => s + p.sold30d, 0),
    };
  }, [base]);

  const visible = useMemo(() => {
    const q = fold(search.trim());
    return items.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (lowOnly && draftStockStatus(p) === "in") return false;
      if (!q) return true;
      return fold(productName(p, locale)).includes(q) || fold(p.sku).includes(q);
    });
  }, [items, search, category, lowOnly, locale]);

  const update = (id: string, patch: Partial<ProductDraft>) => setDraft((d) => (d[id] ? { ...d, [id]: { ...d[id], ...patch } } : d));

  const saveAll = async () => {
    if (!draft || !base) return;
    if (invalid.length) {
      setShowErrors(true);
      const first = invalid[0];
      setSearch("");
      setCategory("all");
      setLowOnly(false);
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-product-key="${CSS.escape(first.id)}"] input[aria-invalid="true"]`)?.focus());
      return;
    }
    const sent = draft;
    const patches = [...changed].map((id) => ({ id, patch: productPatch(sent[id], base[id]) })).filter((p) => Object.keys(p.patch).length);
    // mutateAsync, not mutate: `save.error` in this closure is the previous render's value.
    let result: Awaited<ReturnType<typeof saveProducts>>;
    try {
      result = await save.mutateAsync(patches);
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
      return;
    }
    const ok = patches.map((p) => p.id).filter((id) => !result.failed.includes(id));
    commit((current) => ({ base: { ...current.base, ...Object.fromEntries(ok.map((id) => [id, sent[id]])) }, draft: current.draft }));
    setShowErrors(false);
    if (result.failed.length) toast({ tone: "error", title: t("toast.partial"), description: tc.dynamic(`errors.${errorCode(result.firstError)}`) });
    else toast({ title: t("toast.saved"), description: t("products.savedBody") });
  };

  const submitDialog = async (item: ProductDraft) => {
    if (!base) return;
    setDraft((d) => ({ ...d, [item.id]: item }));
    const patch = productPatch(item, base[item.id]);
    let result: Awaited<ReturnType<typeof saveProducts>> = { failed: [], firstError: undefined };
    try {
      if (Object.keys(patch).length) result = await save.mutateAsync([{ id: item.id, patch }]);
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
      return;
    }
    if (result.failed.length) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(result.firstError)}`) });
      return;
    }
    commit((current) => ({ base: { ...current.base, [item.id]: item }, draft: current.draft }));
    setEditing(null);
    toast({ title: t("toast.updated", { name: productName(item, locale) }) });
  };

  const changeCount = changed.size;
  const saveMessage = showErrors && invalid.length ? t.plural("saveBar.fix", invalid.length) : t.plural("saveBar.changes", Math.max(1, changeCount));

  return (
    <div className="space-y-6">
      {!headless ? <PageHeader title={t("titleShop")} description={t("descriptionShop")} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          tone="mint"
          pet="golden"
          icon={<PackageCheck size={16} />}
          label={t("products.kpi.active")}
          loading={!base && !query.error}
          value={base ? formatNumber(kpis.active, locale) : "—"}
          unit={base ? t("kpi.ofTotal", { total: formatNumber(kpis.total, locale) }) : undefined}
        />
        <KpiCard
          index={1}
          tone="peach"
          pet="ginger"
          icon={<TriangleAlert size={16} />}
          label={t("products.kpi.low")}
          loading={!base && !query.error}
          value={base ? formatNumber(kpis.low, locale) : "—"}
          footnote={kpis.low ? t("products.kpi.lowNote") : undefined}
        />
        <KpiCard index={2} tone="rose" pet="tabby" icon={<PackageX size={16} />} label={t("products.kpi.out")} loading={!base && !query.error} value={base ? formatNumber(kpis.out, locale) : "—"} />
        <KpiCard index={3} tone="sand" pet="cream" icon={<ShoppingBag size={16} />} label={t("products.kpi.sold")} loading={!base && !query.error} value={base ? formatNumber(kpis.sold, locale) : "—"} />
      </div>

      <Panel
        title={t("products.listTitle")}
        icon={<Boxes size={20} />}
        description={t("products.listHint")}
        bodyClassName="space-y-5 @container"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchField label={t("products.search")} value={search} onValueChange={setSearch} wrapperClassName="lg:w-80" />
          <Checkbox checked={lowOnly} onCheckedChange={setLowOnly} label={t("products.lowOnly")} />
        </div>
        <div role="group" aria-label={t("products.categoryFilter")} className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(["all", ...PRODUCT_CATS] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center rounded-chip border px-3.5 text-body-sm font-semibold transition-colors",
                category === c ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-fg hover:bg-surface-muted",
              )}
            >
              {c === "all" ? t("products.all") : t(`productCategories.${c}`)}
            </button>
          ))}
        </div>

        {query.error && !draft ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : !draft ? (
          <div aria-busy="true">
            <span className="sr-only">{tc("states.loading")}</span>
            <SkeletonRows rows={6} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={t("products.emptyTitle")} description={t("products.emptyBody")} pet="cream" />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            title={tc("states.noResultsTitle")}
            description={tc("states.noResultsBody")}
            action={
              <button
                type="button"
                className="min-h-10 rounded-button px-3 text-body-sm font-semibold text-primary hover:bg-primary-tint"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setLowOnly(false);
                }}
              >
                {t("products.clearFilters")}
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {PRODUCT_CATS.map((c) => {
              const rows = visible.filter((p) => p.category === c);
              if (!rows.length) return null;
              return (
                <section key={c} aria-labelledby={`cat-${c}`} className="min-w-0">
                  <h3 id={`cat-${c}`} className="mb-2 font-display text-title font-extrabold text-fg">
                    {t(`productCategories.${c}`)} <span className="text-body-sm font-semibold text-fg-secondary">· {formatNumber(rows.length, locale)}</span>
                  </h3>
                  <ul className="space-y-3 @min-[48rem]:space-y-0">
                    {rows.map((p) => (
                      <ProductRow
                        key={p.id}
                        item={p}
                        changed={changed.has(p.id)}
                        showErrors={showErrors}
                        onChange={(patch) => update(p.id, patch)}
                        onEdit={() => setEditing(p)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      <SaveBar
        visible={dirty}
        saving={save.isPending && !editing}
        label={t("saveBar.label")}
        message={saveMessage}
        hint={t("products.saveHint")}
        saveLabel={t("saveBar.save")}
        discardLabel={t("saveBar.discard")}
        onSave={saveAll}
        onDiscard={() => {
          reset();
          setShowErrors(false);
        }}
      />

      {editing ? <ProductDialog key={editing.id} initial={editing} saving={save.isPending} onClose={() => setEditing(null)} onSubmit={submitDialog} /> : null}
    </div>
  );
}

function ProductRow({
  item,
  changed,
  showErrors,
  onChange,
  onEdit,
}: {
  item: ProductDraft;
  changed: boolean;
  showErrors: boolean;
  onChange: (patch: Partial<ProductDraft>) => void;
  onEdit: () => void;
}) {
  const t = useT("services");
  const tc = useT("common");
  const locale = useLocale();
  const [touched, setTouched] = useState({ price: false, stock: false });
  const id = useId();
  const name = productName(item, locale);
  const errors = productErrors(item);
  const priceError = errors.price && (showErrors || touched.price) ? errors.price : undefined;
  const stockError = errors.stock && (showErrors || touched.stock) ? errors.stock : undefined;

  return (
    <li
      data-product-key={item.id}
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_2.75rem] gap-x-2 gap-y-3 rounded-card border border-border bg-surface p-3",
        "@min-[48rem]:grid-cols-[minmax(0,1fr)_10rem_12rem_9rem_2.75rem] @min-[48rem]:items-center @min-[48rem]:gap-x-3 @min-[48rem]:rounded-none @min-[48rem]:border-0 @min-[48rem]:border-b @min-[48rem]:px-1 @min-[48rem]:py-2.5",
        !item.active && "bg-surface-muted",
      )}
    >
      {changed ? <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-chip bg-accent" /> : null}
      <div className="col-start-1 row-start-1 min-w-0 pl-1">
        <p className="break-words text-body font-semibold text-fg">{name}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-meta text-fg-secondary">
          <span className="whitespace-nowrap tabular">{item.sku}</span>
          <span className="before:mr-2 before:content-['·']">{item.species.map((s) => tc(`species.${s}`)).join(", ")}</span>
          <span className="whitespace-nowrap tabular before:mr-2 before:content-['·']">{t.plural("products.sold", item.sold30d)}</span>
        </p>
        {changed ? <span className="mt-1 inline-block rounded-chip bg-warning-bg px-2 py-0.5 text-caption font-semibold text-warning-text">{t("row.unsaved")}</span> : null}
      </div>

      <div className="col-span-2 row-start-2 flex flex-wrap items-start gap-x-5 gap-y-3 @min-[48rem]:contents">
        <div className="w-36 @min-[48rem]:col-start-2 @min-[48rem]:row-start-1 @min-[48rem]:w-auto">
          <label htmlFor={`${id}-price`} className="mb-1.5 block text-body-sm font-semibold text-fg @min-[48rem]:sr-only">
            <span aria-hidden="true">{t("row.price")}</span>
            <span className="sr-only">{t("row.priceFor", { name })}</span>
          </label>
          <PriceInput
            id={`${id}-price`}
            value={item.price}
            locale={locale}
            invalid={Boolean(priceError)}
            aria-describedby={priceError ? `${id}-price-error` : undefined}
            onBlur={() => setTouched((s) => ({ ...s, price: true }))}
            onValueChange={(price) => onChange({ price })}
          />
          {priceError ? (
            <p id={`${id}-price-error`} className="mt-1 text-meta font-medium text-error-text">
              {t.dynamic(`errors.price.${priceError}`, { max: formatMoney(9999, locale, { decimals: 0 }) })}
            </p>
          ) : null}
        </div>

        <div className="w-44 @min-[48rem]:col-start-3 @min-[48rem]:row-start-1 @min-[48rem]:w-auto">
          <label htmlFor={`${id}-stock`} className="mb-1.5 block text-body-sm font-semibold text-fg @min-[48rem]:sr-only">
            <span aria-hidden="true">{t("products.stock")}</span>
            <span className="sr-only">{t("products.stockFor", { name })}</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`${id}-stock`}
              inputMode="numeric"
              autoComplete="off"
              value={item.stock}
              aria-invalid={stockError ? true : undefined}
              aria-describedby={stockError ? `${id}-stock-error` : undefined}
              onBlur={() => setTouched((s) => ({ ...s, stock: true }))}
              onChange={(e) => onChange({ stock: e.target.value.replace(/[^\d]/g, "") })}
              className={cn(controlClass, "w-20 shrink-0 px-3 text-center tabular")}
            />
            <StatusPill kind="stock" status={draftStockStatus(item)} size="sm" />
          </div>
          {stockError ? (
            <p id={`${id}-stock-error`} className="mt-1 text-meta font-medium text-error-text">
              {t("products.errors.stock")}
            </p>
          ) : null}
        </div>

        <div className="pt-0 sm:pt-7 @min-[48rem]:col-start-4 @min-[48rem]:row-start-1 @min-[48rem]:pt-0">
          <Switch
            checked={item.active}
            onCheckedChange={(active) => onChange({ active })}
            label={
              <span className="text-body-sm">
                {t("row.active")}
                <span className="sr-only">: {name}</span>
              </span>
            }
            className="items-center justify-start gap-3"
          />
        </div>
      </div>

      <div className="col-start-2 row-start-1 flex justify-end @min-[48rem]:col-start-5">
        <IconButton label={t("products.edit", { name })} icon={<Pencil size={18} />} onClick={onEdit} />
      </div>
    </li>
  );
}
