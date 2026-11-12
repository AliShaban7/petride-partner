"use client";

import { Columns3, Rows3 } from "lucide-react";
import { useCallback, useMemo } from "react";

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
  TabPanel,
  tabId,
  type Column,
  type SortState,
} from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Fulfilment, Order, OrderSort } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { FulfilmentTag, RideStatus, TimeAgo } from "./bits";
import { CountTabs } from "./CountTabs";
import { FiltersPopover } from "./FiltersPopover";
import { useDebouncedParam, useNow, useUrlState } from "./hooks";
import {
  ATTENTION_TABS,
  ORDER_TABS,
  actionKey,
  fetchOrderCounts,
  fetchOrderPage,
  isOrderTab,
  itemsSummary,
  nextStatus,
  stageOf,
  type OrderFilters,
  type OrderTab,
} from "./model";
import { OrderDrawer } from "./OrderDrawer";
import { OrdersBoard } from "./OrdersBoard";
import { useOrderActions } from "./useOrderActions";

/** Rows a page; every dashboard list uses 12 so one page fits a laptop screen. */
const PAGE_SIZE = 12;
/** Body cells (td and the row-header th) from 1024px: 6px instead of 8px top and bottom. Header cells keep theirs. */
const DENSE = "lg:[tbody_&]:py-1.5";
const TABS_ID = "orders-status";
const SORTS: OrderSort[] = ["created_desc", "created_asc", "total_desc"];
const FULFILMENTS: Fulfilment[] = ["petride_courier", "pickup"];

function toSortState(sort: OrderSort): SortState {
  if (sort === "total_desc") return { id: "total", direction: "desc" };
  return { id: "created", direction: sort === "created_asc" ? "asc" : "desc" };
}

/**
 * Shop orders: search + delivery filter, table (status tabs with counts) or Kanban board, and the
 * order drawer. State lives in the URL: status, q, fulfilment, sort, page, view, id.
 */
export function OrdersSection() {
  const t = useT("orders");
  const tc = useT("common");
  const ts = useT("status");
  const url = useUrlState();
  const { set } = url;

  const statusParam = url.get("status");
  const tab: OrderTab = isOrderTab(statusParam) ? statusParam : "all";
  const view = url.get("view") === "board" ? "board" : "table";
  const q = url.get("q");
  const fulfilmentParam = url.get("fulfilment");
  const fulfilment = (FULFILMENTS as string[]).includes(fulfilmentParam) ? (fulfilmentParam as Fulfilment) : undefined;
  const sortParam = url.get("sort");
  const sort: OrderSort = (SORTS as string[]).includes(sortParam) ? (sortParam as OrderSort) : "created_desc";
  const page = Math.max(1, Math.floor(Number(url.get("page"))) || 1);
  const selectedId = url.get("id") || null;

  const writeSearch = useCallback((value: string) => set({ q: value, page: null }), [set]);
  const [search, setSearch] = useDebouncedParam(q, writeSearch);

  const filters: OrderFilters = useMemo(() => ({ search: q.trim() || undefined, fulfilment, sort }), [q, fulfilment, sort]);
  const counts = useApiQuery(["orders", "counts", filters.search ?? "", fulfilment ?? ""], (api) => fetchOrderCounts(api, filters), { refreshMs: 30_000 });

  const open = useCallback((o: Order) => set({ id: o.id }), [set]);
  // Inline from 640px (label hidden: the placeholder says it); in the phones' Filters popover with its label.
  const fulfilmentSelect = (inlineClassName?: string) => (
    <Select
      label={t("filters.fulfilment")}
      hideLabel={inlineClassName !== undefined}
      value={fulfilment ?? ""}
      onChange={(e) => set({ fulfilment: e.target.value, page: null })}
      placeholder={t("filters.fulfilmentAll")}
      options={FULFILMENTS.map((f) => ({ value: f, label: ts.dynamic(`fulfilment.${f}`) }))}
      wrapperClassName={inlineClassName}
    />
  );
  const filtered = Boolean(filters.search || fulfilment);

  return (
    <div className="space-y-3">
      {/* Phones: search + a Filters button on one row (delivery method inside), then the view switch. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex items-center gap-2 lg:contents">
          <SearchField
            label={t("filters.searchLabel")}
            placeholder={t("filters.search")}
            value={search}
            onValueChange={setSearch}
            wrapperClassName="min-w-0 flex-1 lg:max-w-sm"
          />
          <FiltersPopover label={tc("actions.filter")} count={fulfilment ? 1 : 0} className="sm:hidden">
            {fulfilmentSelect()}
          </FiltersPopover>
        </div>
        <div className="flex flex-wrap items-end gap-3 lg:contents">
          {fulfilmentSelect("max-sm:hidden sm:w-56")}
          <SegmentedControl
            label={t("view.label")}
            value={view}
            onChange={(v) => set({ view: v === "board" ? "board" : null, page: null })}
            options={[
              { value: "table", label: t("view.table"), icon: <Rows3 size={16} aria-hidden="true" /> },
              { value: "board", label: t("view.board"), icon: <Columns3 size={16} aria-hidden="true" /> },
            ]}
            className="sm:ml-auto"
          />
        </div>
      </div>

      {view === "table" ? (
        <>
          <CountTabs
            idPrefix={TABS_ID}
            label={t("tabs.label")}
            value={tab}
            onChange={(id) => set({ status: id === "all" ? null : id, page: null })}
            tabs={ORDER_TABS.map((id) => ({
              id,
              label: t.dynamic(`tabs.${id}`),
              count: counts.data?.[id],
              tone: ATTENTION_TABS.includes(id) ? "attention" : "neutral",
            }))}
          />
          <TabPanel idPrefix={TABS_ID} value={tab}>
            <OrdersTable
              tab={tab}
              filters={filters}
              page={page}
              selectedId={selectedId}
              onOpen={open}
              onPage={(p) => set({ page: p > 1 ? p : null })}
              onSort={(next) => set({ sort: next === "created_desc" ? null : next, page: null })}
              onReset={filtered || tab !== "all" ? () => set({ status: null, q: null, fulfilment: null, page: null }) : undefined}
            />
          </TabPanel>
        </>
      ) : (
        <OrdersBoard filters={filters} selectedId={selectedId} onOpen={open} />
      )}

      <OrderDrawer id={selectedId} onClose={() => set({ id: null })} />
    </div>
  );
}

function OrdersTable({
  tab,
  filters,
  page,
  selectedId,
  onOpen,
  onPage,
  onSort,
  onReset,
}: {
  tab: OrderTab;
  filters: OrderFilters;
  page: number;
  selectedId: string | null;
  onOpen: (o: Order) => void;
  onPage: (page: number) => void;
  onSort: (sort: OrderSort) => void;
  onReset?: () => void;
}) {
  const t = useT("orders");
  const locale = useLocale();
  const now = useNow();
  const actions = useOrderActions();
  const query = useApiQuery(
    ["orders", "list", tab, filters.search ?? "", filters.fulfilment ?? "", filters.sort, page],
    (api) => fetchOrderPage(api, tab, filters, page, PAGE_SIZE),
    { refreshMs: 30_000 },
  );
  const more = (first: string, count: number) => t("itemsMore", { first, count });
  const caption = t("table.caption", { tab: t.dynamic(`tabs.${tab}`) });

  const quick = (o: Order) => {
    const step = nextStatus(o);
    if (!step) return null;
    return (
      <Button
        size="sm"
        variant={o.status === "new" ? "accent" : "secondary"}
        loading={actions.busyId === o.id}
        onClick={async () => {
          const ok = await actions.advance(o, step);
          // In a status tab the row leaves the list on the next refetch and takes the focused button
          // with it: move focus to the active tab now instead of letting it fall to <body> (the
          // toast announces the change). In "All" the row stays.
          if (ok && tab !== "all") document.getElementById(tabId(TABS_ID, tab))?.focus();
        }}
      >
        {t(actionKey(o, step))}
      </Button>
    );
  };

  const courierLine = (o: Order) => (o.courierRide && (stageOf(o) === "ready" || stageOf(o) === "on_the_way") ? <RideStatus ride={o.courierRide} /> : null);

  const columns: Column<Order>[] = [
    {
      // Codes are chronological, so this column sorts by time and shows "5 min ago" under the code.
      id: "created",
      header: t("table.order"),
      rowHeader: true,
      sortable: true,
      className: DENSE,
      cell: (o) => (
        <span className="block whitespace-nowrap">
          <span className="block tabular">{o.code}</span>
          <TimeAgo value={o.createdAt} now={now} className="block text-meta font-normal text-fg-secondary" />
        </span>
      ),
    },
    {
      id: "customer",
      header: t("table.customer"),
      className: DENSE,
      cell: (o) => (
        <div className="min-w-36">
          {/* Pets on the name's line: two lines per row instead of three. */}
          <p className="font-medium text-fg">
            {o.clientName}
            {o.petNames.length ? <span className="text-meta font-normal text-fg-secondary"> · {o.petNames.join(", ")}</span> : null}
          </p>
          {/* The items column only fits from 1728px (all seven columns); narrower tables show the basket summary here. */}
          <p className="max-w-48 truncate text-meta text-fg-secondary xl:max-w-64 min-[108rem]:hidden">{itemsSummary(o, more)}</p>
        </div>
      ),
    },
    {
      id: "items",
      header: t("table.items"),
      className: cn("hidden min-[108rem]:table-cell", DENSE),
      cell: (o) => (
        <div className="max-w-60">
          <p className="truncate text-fg">{itemsSummary(o, more)}</p>
          <p className="text-meta text-fg-secondary">{t.plural("items", o.itemsCount)}</p>
        </div>
      ),
    },
    {
      id: "total",
      header: t("table.total"),
      align: "end",
      sortable: true,
      className: DENSE,
      cell: (o) => <span className="whitespace-nowrap font-semibold tabular">{formatMoney(o.totalAZN, locale)}</span>,
    },
    {
      id: "delivery",
      header: t("table.delivery"),
      // Its own column only from 1440px: at 1280px next to the full sidebar the table would be wider than
      // the card and the "next step" buttons would end up behind a sideways scroll.
      className: cn("hidden min-[90rem]:table-cell", DENSE),
      cell: (o) => (
        <div className="flex flex-col items-start gap-1">
          <FulfilmentTag fulfilment={o.fulfilment} />
          {courierLine(o)}
        </div>
      ),
    },
    {
      id: "status",
      header: t("table.status"),
      className: DENSE,
      cell: (o) => (
        <div className="flex flex-col items-start gap-0.5">
          <StatusPill kind="order" status={o.status} size="sm" />
          {/* Narrower tables fold the delivery column in here, as a plain line so the row stays two lines tall. */}
          <div className="flex flex-col items-start gap-1 min-[90rem]:hidden">
            <FulfilmentTag fulfilment={o.fulfilment} variant="text" />
            {courierLine(o)}
          </div>
        </div>
      ),
    },
    { id: "next", header: t("table.next"), align: "end", className: cn("hidden xl:table-cell", DENSE), cell: (o) => quick(o) },
  ];

  // Phone card: code + "5 min ago" and the status; customer and total; basket; delivery with the next
  // step on its right (it wraps under the tags only when they don't leave room), instead of a
  // full-width button on a row of its own.
  const mobileCard = (o: Order) => (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <button type="button" onClick={() => onOpen(o)} className="text-body font-semibold text-fg underline-offset-4 hover:underline">
            {o.code}
          </button>
          <TimeAgo value={o.createdAt} now={now} className="text-meta text-fg-secondary" />
        </p>
        <StatusPill kind="order" status={o.status} size="sm" />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-semibold text-fg">{o.clientName}</p>
        <span className="shrink-0 font-display text-title font-extrabold tabular">
          <span className="sr-only">{t("table.total")}: </span>
          {formatMoney(o.totalAZN, locale)}
        </span>
      </div>
      <p className="line-clamp-2 text-meta text-fg-secondary">{itemsSummary(o, more)}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <FulfilmentTag fulfilment={o.fulfilment} />
          {courierLine(o)}
        </div>
        {nextStatus(o) ? <div className="ml-auto">{quick(o)}</div> : null}
      </div>
    </div>
  );

  const emptyState = filters.search ? (
    <EmptyState title={t("empty.searchTitle")} description={t("empty.searchBody")} pet="tabby" action={onReset ? <Button variant="secondary" size="sm" onClick={onReset}>{t("filters.clear")}</Button> : undefined} />
  ) : tab !== "all" || filters.fulfilment ? (
    <EmptyState title={t("empty.tabTitle")} description={t("empty.tabBody")} pet="cream" action={onReset ? <Button variant="secondary" size="sm" onClick={onReset}>{t("filters.clear")}</Button> : undefined} />
  ) : (
    <EmptyState title={t("empty.title")} description={t("empty.body")} pet="ginger" />
  );

  return (
    <AsyncView
      query={query}
      loading={<ResponsiveTable caption={caption} columns={columns} rows={[]} getRowId={(o) => o.id} loading skeletonRows={8} />}
      empty={emptyState}
    >
      {(data) => (
        <div className="space-y-3">
          <ResponsiveTable
            caption={caption}
            columns={columns}
            rows={data.items}
            getRowId={(o) => o.id}
            onRowClick={onOpen}
            selectedId={selectedId}
            sort={toSortState(filters.sort)}
            onSortChange={(next) => {
              if (!next) return onSort("created_desc");
              if (next.id === "total") return onSort(filters.sort === "total_desc" ? "created_desc" : "total_desc");
              onSort(next.direction === "asc" ? "created_asc" : "created_desc");
            }}
            mobileCard={mobileCard}
          />
          <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPageChange={onPage} />
        </div>
      )}
    </AsyncView>
  );
}
