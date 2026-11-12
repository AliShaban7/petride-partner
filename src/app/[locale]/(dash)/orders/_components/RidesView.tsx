"use client";

import { CalendarClock, Car, PawPrint, Repeat, Settings } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  AsyncView,
  ButtonLink,
  Card,
  EmptyState,
  KpiCard,
  PageHeader,
  Pagination,
  ResponsiveTable,
  SearchField,
  Select,
  TabPanel,
  Tag,
  type Column,
  type SortState,
} from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Ride, RideDirection } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayLabel, formatMoney, formatNumber, formatPercent, formatTimeRange } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";
import { LIVE_RIDE_STATUSES } from "@/lib/status";

import { DirectionTag, RideStatus } from "./bits";
import { CountTabs } from "./CountTabs";
import { FiltersPopover } from "./FiltersPopover";
import { dayStartISO, useDebouncedParam, useNow, useUrlState } from "./hooks";
import { KpiStrip } from "./KpiStrip";
import { RideDrawer } from "./RideDrawer";

const RIDE_TABS = ["live", "today", "upcoming", "past"] as const;
type RideTab = (typeof RIDE_TABS)[number];
const TABS_ID = "rides-time";
/** Rows a page; every dashboard list uses 12 so one page fits a laptop screen. */
const PAGE_SIZE = 12;
/** Body cells (td and the row-header th) from 1024px: 6px instead of 8px top and bottom. Header cells keep theirs. */
const DENSE = "lg:[tbody_&]:py-1.5";
/**
 * Non-sortable columns (header and cells alike, so they stay aligned): 12px sides instead of 16px.
 * At 1280px in ru the table was 2px wider than its card, so the price sat behind a sideways scroll.
 */
const NARROW = "px-3";
const DIRECTIONS: RideDirection[] = ["to_partner", "from_partner"];
const isLive = (r: Ride) => (LIVE_RIDE_STATUSES as readonly string[]).includes(r.status);

function fold(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Clinics, salons and hotels: their "orders" are PetRide rides that bring pets in and take them
 * home. Live status / ETA poll every 15 s. URL: tab, q, direction, page, id.
 */
export function RidesView() {
  const t = useT("orders");
  const tc = useT("common");
  const ts = useT("status");
  const locale = useLocale();
  const url = useUrlState();
  const { set } = url;
  const now = useNow();
  const today = dayStartISO(now);
  const tomorrow = dayStartISO(now, 1);

  const tabParam = url.get("tab");
  const tab: RideTab = (RIDE_TABS as readonly string[]).includes(tabParam) ? (tabParam as RideTab) : "today";
  const directionParam = url.get("direction");
  const direction = (DIRECTIONS as string[]).includes(directionParam) ? (directionParam as RideDirection) : undefined;
  const q = url.get("q");
  const page = Math.max(1, Math.floor(Number(url.get("page"))) || 1);
  const selectedId = url.get("id") || null;
  const writeSearch = useCallback((value: string) => set({ q: value, page: null }), [set]);
  const [search, setSearch] = useDebouncedParam(q, writeSearch);
  // Sorting is controlled here (not inside the table) because the list is paged on the client:
  // the table alone would only sort the 15 rows of the current page.
  const [sort, setSort] = useState<SortState>(null);

  const partner = useApiQuery(["partner"], (api) => api.getPartner());
  const live = useApiQuery(["rides", "live"], (api) => api.listRides({ live: true }), { refreshMs: 15_000 });
  const todays = useApiQuery(["rides", "range", today, tomorrow], (api) => api.listRides({ from: today, to: tomorrow }), { refreshMs: 15_000 });
  const upcomingTo = dayStartISO(now, 15);
  const upcoming = useApiQuery(["rides", "range", tomorrow, upcomingTo], (api) => api.listRides({ from: tomorrow, to: upcomingTo }), {
    enabled: tab === "upcoming",
  });
  const pastFrom = dayStartISO(now, -30);
  const past = useApiQuery(["rides", "range", pastFrom, today], (api) => api.listRides({ from: pastFrom, to: today }), { enabled: tab === "past" });
  const share = useApiQuery(["stats", "kpis", "30d"], (api) => api.getKpis("30d"));

  const source = { live, today: todays, upcoming, past }[tab];
  const caption = t("rides.caption", { tab: t.dynamic(`rides.tabs.${tab}`) });

  const filtered = useMemo(() => {
    const needle = fold(q.trim());
    const list = (source.data ?? []).filter((r) => {
      if (direction && r.direction !== direction) return false;
      if (!needle) return true;
      return fold(`${r.clientName} ${r.petNames.join(" ")} ${r.driver?.name ?? ""} ${r.driver?.car.plate ?? ""}`).includes(needle);
    });
    const ordered = tab === "past" ? [...list].reverse() : list;
    if (!sort) return ordered;
    const value = (r: Ride) => (sort.id === "price" ? r.priceAZN : new Date(r.pickupAt).getTime());
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...ordered].sort((a, b) => (value(a) - value(b)) * factor);
  }, [source.data, direction, q, tab, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (partner.data && !partner.data.acceptsRides) {
    return (
      <div className="space-y-section">
        <PageHeader title={t("rides.title")} />
        <Card padding="md">
          <EmptyState
            title={t("rides.off.title")}
            description={t("rides.off.body")}
            pet="golden"
            action={
              <ButtonLink href={localizedHref(locale, ROUTES.settings)} variant="secondary" leftIcon={<Settings size={18} aria-hidden="true" />}>
                {t("rides.off.action")}
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  // Inline from 640px (label hidden: the placeholder says it); in the phones' Filters popover with its label.
  const directionSelect = (inlineClassName?: string) => (
    <Select
      label={t("rides.direction")}
      hideLabel={inlineClassName !== undefined}
      value={direction ?? ""}
      onChange={(e) => set({ direction: e.target.value, page: null })}
      placeholder={t("rides.directionAll")}
      options={DIRECTIONS.map((d) => ({ value: d, label: ts.dynamic(`direction.${d}`) }))}
      wrapperClassName={inlineClassName}
    />
  );

  const liveNow = live.data?.filter(isLive) ?? [];
  const todayActive = todays.data?.filter((r) => r.status !== "cancelled") ?? [];
  const k = share.data;
  const dash = "—";

  const columns: Column<Ride>[] = [
    {
      id: "client",
      header: t("rides.columns.client"),
      rowHeader: true,
      mobile: "title",
      className: cn(NARROW, DENSE),
      cell: (r) => (
        <span className="block min-w-36">
          <span className="block font-semibold text-fg">{r.petNames.join(", ") || r.clientName}</span>
          <span className="block text-meta font-normal text-fg-secondary">{r.clientName}</span>
        </span>
      ),
    },
    {
      id: "direction",
      header: t("rides.columns.direction"),
      mobile: "subtitle",
      className: cn("hidden xl:table-cell", NARROW, DENSE),
      // Round trip as a plain meta line under the direction tag (a second tag made rows ~70px tall).
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <DirectionTag direction={r.direction} />
          {r.roundTrip ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-meta text-fg-secondary">
              <Repeat size={13} aria-hidden="true" />
              {t("rides.roundTrip")}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "time",
      header: t("rides.columns.time"),
      sortable: true,
      sortValue: (r) => new Date(r.pickupAt).getTime(),
      className: DENSE,
      cell: (r) => (
        <span className="flex flex-col items-end gap-1 sm:items-start">
          <span className="whitespace-nowrap tabular">
            {tab === "today" || tab === "live" ? "" : `${formatDayLabel(r.pickupAt, locale, new Date(now))}, `}
            {formatTimeRange(r.pickupAt, r.arriveAt)}
          </span>
          {/* The direction column only fits from xl; narrower tables show it here. Phones use the card subtitle. */}
          <span className="hidden sm:inline-flex xl:hidden">
            <DirectionTag direction={r.direction} />
          </span>
        </span>
      ),
    },
    {
      id: "driver",
      header: t("rides.columns.driver"),
      className: cn("hidden lg:table-cell", NARROW, DENSE),
      cell: (r) =>
        r.driver ? (
          <span className="block min-w-32">
            <span className="block text-fg">{r.driver.name}</span>
            <span className="block whitespace-nowrap text-meta text-fg-secondary">
              {r.driver.car.model} · <span className="font-semibold text-fg">{r.driver.car.plate}</span>
            </span>
          </span>
        ) : (
          <span className="text-meta text-fg-secondary">{r.status === "cancelled" || r.status === "completed" ? "—" : t("rides.noDriver")}</span>
        ),
    },
    { id: "status", header: t("rides.columns.status"), mobile: "badge", className: cn(NARROW, DENSE), cell: (r) => <RideStatus ride={r} className="flex-col items-end gap-y-0.5 sm:flex-row sm:items-center" /> },
    {
      id: "price",
      header: t("rides.columns.price"),
      align: "end",
      sortable: true,
      sortValue: (r) => r.priceAZN,
      className: DENSE,
      cell: (r) => <span className="whitespace-nowrap font-semibold tabular">{formatMoney(r.priceAZN, locale)}</span>,
    },
  ];

  // Phone card, four short lines: pet + time, owner + status, direction + price, driver.
  const mobileCard = (r: Ride) => (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <button type="button" onClick={() => set({ id: r.id })} className="min-w-0 text-left text-body font-semibold text-fg underline-offset-4 hover:underline">
          {r.petNames.join(", ") || r.clientName}
        </button>
        <span className="shrink-0 whitespace-nowrap text-body-sm font-semibold text-fg tabular">
          {tab === "today" || tab === "live" ? "" : `${formatDayLabel(r.pickupAt, locale, new Date(now))}, `}
          {formatTimeRange(r.pickupAt, r.arriveAt)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-meta text-fg-secondary">{r.clientName}</p>
        <RideStatus ride={r} className="shrink-0 justify-end" />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <DirectionTag direction={r.direction} />
          {r.roundTrip ? <Tag icon={<Repeat size={13} aria-hidden="true" />}>{t("rides.roundTrip")}</Tag> : null}
        </span>
        <span className="shrink-0 font-semibold text-fg tabular">
          <span className="sr-only">{t("rides.columns.price")}: </span>
          {formatMoney(r.priceAZN, locale)}
        </span>
      </div>
      {r.driver || (r.status !== "cancelled" && r.status !== "completed") ? (
        <p className="mt-1 text-meta text-fg-secondary">
          {r.driver ? (
            <>
              <span className="sr-only">{t("rides.columns.driver")}: </span>
              {r.driver.name} · {r.driver.car.model} · <span className="whitespace-nowrap font-semibold text-fg">{r.driver.car.plate}</span>
            </>
          ) : (
            t("rides.noDriver")
          )}
        </p>
      ) : null}
    </div>
  );

  const emptyCopy = {
    live: [t("rides.empty.liveTitle"), t("rides.empty.liveBody")],
    today: [t("rides.empty.todayTitle"), t("rides.empty.todayBody")],
    upcoming: [t("rides.empty.upcomingTitle"), t("rides.empty.upcomingBody")],
    past: [t("rides.empty.pastTitle"), t("rides.empty.pastBody")],
  }[tab];
  const noMatches = Boolean(q.trim() || direction) && (source.data?.length ?? 0) > 0;

  return (
    <div className="space-y-section">
      {/* Search and direction share the title row (no description: the title and the tabs say it). */}
      <PageHeader
        title={t("rides.title")}
        actions={
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
            <SearchField
              label={t("rides.searchLabel")}
              placeholder={t("rides.search")}
              value={search}
              onValueChange={setSearch}
              wrapperClassName="min-w-0 flex-1 sm:w-64 sm:flex-none xl:w-72"
            />
            {directionSelect("max-sm:hidden sm:w-52")}
            <FiltersPopover label={tc("actions.filter")} count={direction ? 1 : 0} className="sm:hidden">
              {directionSelect()}
            </FiltersPopover>
          </div>
        }
      />

      <KpiStrip label={t("rides.kpi.label")} className="sm:grid-cols-2 lg:grid-cols-3 sm:[&>*:nth-child(3)]:col-span-2 lg:[&>*:nth-child(3)]:col-span-1">
        <KpiCard
          index={0}
          size="sm"
          tone="mint"
          pet="golden"
          icon={<Car size={18} />}
          label={t("rides.kpi.live")}
          loading={live.isLoading}
          value={live.data ? formatNumber(liveNow.length, locale) : dash}
          footnote={
            live.data
              ? t("rides.kpi.liveNote", {
                  in: formatNumber(liveNow.filter((r) => r.direction === "to_partner").length, locale),
                  out: formatNumber(liveNow.filter((r) => r.direction === "from_partner").length, locale),
                })
              : undefined
          }
          href={localizedHref(locale, ROUTES.orders, { tab: "live" })}
        />
        <KpiCard
          index={1}
          size="sm"
          tone="peach"
          pet="ginger"
          icon={<CalendarClock size={18} />}
          label={t("rides.kpi.today")}
          loading={todays.isLoading}
          value={todays.data ? formatNumber(todayActive.length, locale) : dash}
          footnote={todays.data ? t("rides.kpi.todayNote", { done: formatNumber(todayActive.filter((r) => r.status === "completed").length, locale) }) : undefined}
          href={localizedHref(locale, ROUTES.orders)}
        />
        <KpiCard
          index={2}
          size="sm"
          tone="lilac"
          pet="tabby"
          icon={<PawPrint size={18} />}
          label={t("rides.kpi.share")}
          loading={share.isLoading}
          value={k ? formatPercent(k.rideShare.value, locale) : dash}
          delta={k ? k.rideShare.delta : undefined}
          deltaLabel={tc("delta.vs_30d")}
          footnote={k && k.rideShare.delta === null ? t("rides.kpi.shareNote") : undefined}
        />
      </KpiStrip>

      <Card padding="md" className="space-y-3">
        <CountTabs
          idPrefix={TABS_ID}
          label={t("rides.tabs.label")}
          value={tab}
          onChange={(id) => set({ tab: id === "today" ? null : id, page: null })}
          tabs={RIDE_TABS.map((id) => ({
            id,
            label: t.dynamic(`rides.tabs.${id}`),
            count: id === "live" ? (live.data ? liveNow.length : undefined) : id === "today" ? (todays.data ? todayActive.length : undefined) : undefined,
            tone: id === "live" ? "attention" : "neutral",
          }))}
        />
        <TabPanel idPrefix={TABS_ID} value={tab}>
          <AsyncView
            query={source}
            loading={<ResponsiveTable caption={caption} columns={columns} rows={[]} getRowId={(r) => r.id} loading skeletonRows={6} />}
            empty={<EmptyState title={emptyCopy[0]} description={emptyCopy[1]} pet={tab === "live" ? "golden" : "cream"} />}
          >
            {() => (
              <div className="space-y-3">
                <ResponsiveTable
                  caption={caption}
                  columns={columns}
                  rows={rows}
                  getRowId={(r) => r.id}
                  onRowClick={(r) => set({ id: r.id })}
                  selectedId={selectedId}
                  mobileCard={mobileCard}
                  sort={sort}
                  onSortChange={(next) => {
                    setSort(next);
                    set({ page: null });
                  }}
                  empty={noMatches ? <EmptyState title={tc("states.noResultsTitle")} description={tc("states.noResultsBody")} pet="tabby" /> : undefined}
                />
                <Pagination page={current} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p > 1 ? p : null })} />
              </div>
            )}
          </AsyncView>
        </TabPanel>
      </Card>

      <RideDrawer id={selectedId} onClose={() => set({ id: null })} />
    </div>
  );
}
