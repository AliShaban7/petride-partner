"use client";

import { PawPrint, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { useState } from "react";

import { Button, Checkbox, Drawer, IconButton, SearchField, SegmentedControl, Select } from "@/components/ui";
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

export type SortOption = { value: string; label: string };

export type ToolbarProps = {
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
  onSortChange: (value: string) => void;
  /** Results with the current filters (the mobile sheet's "Show N" button). */
  resultCount: number | undefined;
};

/**
 * Search + view switch (Pets grid / Owners table) + filters. From 640px the filters sit inline;
 * on phones they open in a bottom sheet. Active filters show as removable chips.
 */
export function DirectoryToolbar(props: ToolbarProps) {
  const { view, onViewChange, mode, search, onSearchChange, filters, onFiltersChange, onClearAll, resultCount } = props;
  const t = useT("clients");
  const [sheetOpen, setSheetOpen] = useState(false);
  const showLastVisit = mode === "visits" || view === "owners";
  const activeCount = [filters.species, filters.vaccine, showLastVisit ? filters.last : null, filters.ride || null].filter(Boolean).length;
  const lastKey = (v: LastVisitFilter) => (mode === "visits" ? `filters.last_${v}` : `filters.lastOrder_${v}`);

  const chips: { id: string; label: string; clear: () => void }[] = [];
  if (filters.species) chips.push({ id: "species", label: t.dynamic(`filters.species_${filters.species}`), clear: () => onFiltersChange({ species: null }) });
  if (filters.vaccine) chips.push({ id: "vaccine", label: t.dynamic(`filters.vaccine_${filters.vaccine}`), clear: () => onFiltersChange({ vaccine: null }) });
  if (filters.last && showLastVisit) chips.push({ id: "last", label: t.dynamic(lastKey(filters.last)), clear: () => onFiltersChange({ last: null }) });
  if (filters.ride) chips.push({ id: "ride", label: mode === "visits" ? t("filters.ride") : t("filters.rideShop"), clear: () => onFiltersChange({ ride: false }) });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2 sm:flex-1">
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
            label={activeCount ? `${t("filters.button")}: ${t("filters.activeCount", { count: activeCount })}` : t("filters.button")}
            badge={activeCount}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          />
        </div>
        <SegmentedControl<DirectoryView>
          label={t("views.label")}
          value={view}
          onChange={onViewChange}
          options={[
            { value: "pets", label: t("views.pets"), icon: <PawPrint aria-hidden="true" size={16} /> },
            { value: "owners", label: t("views.owners"), icon: <UsersRound aria-hidden="true" size={16} /> },
          ]}
          fullWidth
          className="sm:inline-flex sm:w-auto"
        />
      </div>

      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <FilterControls {...props} compact showLastVisit={showLastVisit} lastKey={lastKey} />
      </div>

      {chips.length || search ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.clear}
              aria-label={t("filters.remove", { name: chip.label })}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-primary-tint px-3 text-meta font-semibold text-primary transition-colors hover:bg-pastel-mint"
            >
              {chip.label}
              <X aria-hidden="true" size={14} />
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            {t("filters.clearAll")}
          </Button>
        </div>
      ) : null}

      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("filters.title")}
        side="bottom"
        footer={
          <>
            <Button variant="ghost" onClick={onClearAll} disabled={!activeCount && !search}>
              {t("filters.clearAll")}
            </Button>
            <Button onClick={() => setSheetOpen(false)}>
              {resultCount === undefined ? t("filters.done") : t.plural("filters.showResults", resultCount)}
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-2">
          <FilterControls {...props} showLastVisit={showLastVisit} lastKey={lastKey} />
        </div>
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
  compact,
  showLastVisit,
  lastKey,
}: ToolbarProps & { compact?: boolean; showLastVisit: boolean; lastKey: (v: LastVisitFilter) => string }) {
  const t = useT("clients");
  const width = compact ? "w-auto min-w-36 max-w-56" : "";
  return (
    <>
      <Select
        label={t("filters.species")}
        hideLabel={compact}
        wrapperClassName={width}
        value={filters.species ?? ""}
        onChange={(e) => onFiltersChange({ species: isSpecies(e.target.value) ? (e.target.value as Species) : null })}
        placeholder={t("filters.speciesAll")}
        options={SPECIES.map((s) => ({ value: s, label: t.dynamic(`filters.species_${s}`) }))}
      />
      <Select
        label={t("filters.vaccine")}
        hideLabel={compact}
        wrapperClassName={width}
        value={filters.vaccine ?? ""}
        onChange={(e) => onFiltersChange({ vaccine: isHealth(e.target.value) ? (e.target.value as PetHealthStatus) : null })}
        placeholder={t("filters.vaccineAll")}
        options={HEALTH.map((h) => ({ value: h, label: t.dynamic(`filters.vaccine_${h}`) }))}
      />
      {showLastVisit ? (
        <Select
          label={mode === "visits" ? t("filters.lastVisit") : t("filters.lastOrder")}
          hideLabel={compact}
          wrapperClassName={width}
          value={filters.last ?? ""}
          onChange={(e) => onFiltersChange({ last: isLastVisit(e.target.value) ? (e.target.value as LastVisitFilter) : null })}
          placeholder={mode === "visits" ? t("filters.lastVisitAny") : t("filters.lastOrderAny")}
          options={LAST_VISIT.map((v) => ({ value: v, label: t.dynamic(lastKey(v)) }))}
        />
      ) : null}
      <div className={cn(compact && "flex min-h-11 items-center rounded-chip border border-control-border/70 bg-surface pl-3 pr-4")}>
        <Checkbox
          checked={filters.ride}
          onCheckedChange={(ride) => onFiltersChange({ ride })}
          label={mode === "visits" ? t("filters.ride") : t("filters.rideShop")}
          description={compact ? undefined : mode === "visits" ? t("filters.rideHint") : t("filters.rideShopHint")}
        />
      </div>
      <Select
        label={t("filters.sort")}
        hideLabel={compact}
        wrapperClassName={cn(width, compact && "sm:ml-auto")}
        value={sortValue}
        onChange={(e) => onSortChange(e.target.value)}
        options={sortOptions.map((o) => ({ value: o.value, label: compact ? t("filters.sortPrefix", { sort: o.label }) : o.label }))}
      />
    </>
  );
}
