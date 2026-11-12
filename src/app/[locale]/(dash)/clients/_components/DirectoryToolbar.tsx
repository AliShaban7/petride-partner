"use client";

import { PawPrint, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { useState } from "react";

import { Button, Checkbox, CountBadge, Drawer, IconButton, PageHeader, Popover, SearchField, SegmentedControl, Select } from "@/components/ui";
import type { PetHealthStatus, Species } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

import {
  HEALTH,
  LAST_VISIT,
  SPECIES,
  isHealth,
  isLastVisit,
  isSpecies,
  type DirectoryFilters,
  type DirectoryMode,
  type DirectoryView,
  type LastVisitFilter,
} from "../_lib/directory";
import { QuickFilters, type QuickFilterId } from "./QuickFilters";

export type SortOption = { value: string; label: string };

export type ToolbarProps = {
  title: string;
  view: DirectoryView;
  onViewChange: (view: DirectoryView) => void;
  mode: DirectoryMode;
  search: string;
  onSearchChange: (q: string) => void;
  filters: DirectoryFilters;
  onFiltersChange: (patch: Partial<Omit<DirectoryFilters, "q">>) => void;
  onClearAll: () => void;
  sortOptions: SortOption[];
  sortValue: string;
  /** The view's default sort: any other sort shows as a removable chip. */
  defaultSort: string;
  onSortChange: (value: string) => void;
  /** Results with the current filters (the "Show N" button of the filter sheet / popover). */
  resultCount: number | undefined;
  quick: {
    counts: Record<QuickFilterId, number> | undefined;
    active: Record<QuickFilterId, boolean>;
    labels: Record<QuickFilterId, string>;
    onToggle: (id: QuickFilterId) => void;
    loading?: boolean;
  };
};

/**
 * Directory header in two rows.
 *  1. Title + Pets/Owners switch, then the search with the Filters button next to it (on the title's
 *     row when there's room, otherwise a row of their own). From 640px Filters opens a popover
 *     (species, vaccine, last visit, PetRide, sort); phones get the same controls in a bottom sheet.
 *  2. The counter chips (one-tap filters), removable chips for the other active filters and
 *     "Clear all".
 */
export function DirectoryToolbar(props: ToolbarProps) {
  const { title, view, onViewChange, mode, search, onSearchChange, filters, onFiltersChange, onClearAll, sortOptions, sortValue, defaultSort, onSortChange, resultCount, quick } = props;
  const t = useT("clients");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const showLastVisit = mode === "visits" || view === "owners";
  const activeCount = [filters.species, filters.vaccine, showLastVisit ? filters.last : null, filters.ride || null].filter(Boolean).length;
  const lastKey = (v: LastVisitFilter) => (mode === "visits" ? `filters.last_${v}` : `filters.lastOrder_${v}`);
  const filtersLabel = activeCount ? `${t("filters.button")}: ${t("filters.activeCount", { count: activeCount })}` : t("filters.button");
  const sortLabel = sortOptions.find((o) => o.value === sortValue)?.label;

  // Overdue / due soon / PetRide show as pressed counter chips; the rest get a removable chip here.
  const chips: { id: string; label: string; clear: () => void; className?: string }[] = [];
  if (filters.species) chips.push({ id: "species", label: t.dynamic(`filters.species_${filters.species}`), clear: () => onFiltersChange({ species: null }) });
  if (filters.vaccine === "ok") chips.push({ id: "vaccine", label: t("filters.vaccine_ok"), clear: () => onFiltersChange({ vaccine: null }) });
  if (filters.last && showLastVisit) chips.push({ id: "last", label: t.dynamic(lastKey(filters.last)), clear: () => onFiltersChange({ last: null }) });
  if (sortValue !== defaultSort && sortLabel) {
    // Owners: from 640px the table's column headers already show the sort.
    chips.push({ id: "sort", label: t("filters.sortPrefix", { sort: sortLabel }), clear: () => onSortChange(defaultSort), className: view === "owners" ? "sm:hidden" : undefined });
  }
  const hasAny = Boolean(activeCount || search.trim());

  const doneLabel = resultCount === undefined ? t("filters.done") : t.plural("filters.showResults", resultCount);
  const controls = <FilterControls {...props} showLastVisit={showLastVisit} lastKey={lastKey} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PageHeader
          title={title}
          // Phones: title and the switch share a row too (the switch wraps under a long title).
          className="min-w-0 basis-full max-sm:flex-row max-sm:flex-wrap max-sm:items-center max-sm:justify-between sm:flex-1 sm:basis-auto"
          actions={
            <SegmentedControl<DirectoryView>
              label={t("views.label")}
              value={view}
              onChange={onViewChange}
              options={[
                { value: "pets", label: t("views.pets"), icon: <PawPrint aria-hidden="true" size={16} className="max-sm:hidden" /> },
                { value: "owners", label: t("views.owners"), icon: <UsersRound aria-hidden="true" size={16} className="max-sm:hidden" /> },
              ]}
              className="max-sm:[&>button]:px-3"
            />
          }
        />
        {/*
          Search + Filters stay together: on the title's row when there's room (desktop), on a row of
          their own otherwise. Keeping Filters here (not on the chips row) means active-filter chips
          and "Clear all" can't push it onto an extra line.
        */}
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-[22rem] lg:max-w-[28rem]">
          <SearchField
            label={t("search.label")}
            placeholder={view === "pets" ? t("search.placeholderPets") : t("search.placeholderOwners")}
            value={search}
            onValueChange={onSearchChange}
            wrapperClassName="min-w-0 flex-1"
            autoComplete="off"
          />
          <IconButton
            variant="outline"
            className="sm:hidden"
            icon={<SlidersHorizontal size={20} />}
            label={filtersLabel}
            badge={activeCount}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          />
          <div className="shrink-0 max-sm:hidden">
            <Popover
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              label={t("filters.title")}
              // Wide enough for "Сбросить фильтры" + "Показать 230 результатов" on one line; wraps if not.
              className="w-[min(26rem,calc(100vw-2rem))]"
              trigger={(triggerProps) => (
                <Button variant="outline" size="sm" leftIcon={<SlidersHorizontal aria-hidden="true" size={16} />} {...triggerProps}>
                  {t("filters.button")}
                  {activeCount ? (
                    <>
                      <CountBadge count={activeCount} />
                      <span className="sr-only">: {t("filters.activeCount", { count: activeCount })}</span>
                    </>
                  ) : null}
                </Button>
              )}
            >
              <div className="space-y-3 p-4">{controls}</div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <Button variant="ghost" size="sm" onClick={onClearAll} disabled={!hasAny}>
                  {t("filters.clearAll")}
                </Button>
                <Button size="sm" onClick={() => setPopoverOpen(false)} className="ml-auto">
                  {doneLabel}
                </Button>
              </div>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          Below 1280px the chips scroll sideways in one row (edge to edge on phones); from 1280px they
          wrap. "relative" keeps sr-only text inside the clip; the
          1px padding leaves room for the focus ring.
        */}
        <QuickFilters
          {...quick}
          className="relative -mx-4 -my-1 basis-[calc(100%+2rem)] overflow-x-auto px-4 py-1 scrollbar-none sm:-mx-1 sm:min-w-64 sm:flex-1 sm:basis-0 sm:px-1 xl:mx-0 xl:my-0 xl:flex-none xl:basis-auto xl:flex-wrap xl:overflow-visible xl:px-0 xl:py-0"
        />
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.clear}
            aria-label={t("filters.remove", { name: chip.label })}
            className={cn(
              // 36px; below 1024px the invisible ::after makes the hit area 44px.
              "relative inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-primary-tint px-3 text-meta font-semibold text-primary transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:bg-pastel-mint lg:after:inset-y-0",
              chip.className,
            )}
          >
            {chip.label}
            <X aria-hidden="true" size={14} />
          </button>
        ))}
        {hasAny ? (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            {t("filters.clearAll")}
          </Button>
        ) : null}
      </div>

      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("filters.title")}
        side="bottom"
        footer={
          <>
            <Button variant="ghost" onClick={onClearAll} disabled={!hasAny}>
              {t("filters.clearAll")}
            </Button>
            <Button onClick={() => setSheetOpen(false)}>{doneLabel}</Button>
          </>
        }
      >
        <div className="space-y-4 pb-2">{controls}</div>
      </Drawer>
    </div>
  );
}

function FilterControls({
  mode,
  filters,
  onFiltersChange,
  sortOptions,
  sortValue,
  onSortChange,
  showLastVisit,
  lastKey,
}: ToolbarProps & { showLastVisit: boolean; lastKey: (v: LastVisitFilter) => string }) {
  const t = useT("clients");
  return (
    <>
      <Select
        label={t("filters.species")}
        value={filters.species ?? ""}
        onChange={(e) => onFiltersChange({ species: isSpecies(e.target.value) ? (e.target.value as Species) : null })}
        placeholder={t("filters.speciesAll")}
        options={SPECIES.map((s) => ({ value: s, label: t.dynamic(`filters.species_${s}`) }))}
      />
      <Select
        label={t("filters.vaccine")}
        value={filters.vaccine ?? ""}
        onChange={(e) => onFiltersChange({ vaccine: isHealth(e.target.value) ? (e.target.value as PetHealthStatus) : null })}
        placeholder={t("filters.vaccineAll")}
        options={HEALTH.map((h) => ({ value: h, label: t.dynamic(`filters.vaccine_${h}`) }))}
      />
      {showLastVisit ? (
        <Select
          label={mode === "visits" ? t("filters.lastVisit") : t("filters.lastOrder")}
          value={filters.last ?? ""}
          onChange={(e) => onFiltersChange({ last: isLastVisit(e.target.value) ? (e.target.value as LastVisitFilter) : null })}
          placeholder={mode === "visits" ? t("filters.lastVisitAny") : t("filters.lastOrderAny")}
          options={LAST_VISIT.map((v) => ({ value: v, label: t.dynamic(lastKey(v)) }))}
        />
      ) : null}
      <Checkbox
        checked={filters.ride}
        onCheckedChange={(ride) => onFiltersChange({ ride })}
        label={mode === "visits" ? t("filters.ride") : t("filters.rideShop")}
        description={mode === "visits" ? t("filters.rideHint") : t("filters.rideShopHint")}
      />
      <Select label={t("filters.sort")} value={sortValue} onChange={(e) => onSortChange(e.target.value)} options={sortOptions} />
    </>
  );
}
