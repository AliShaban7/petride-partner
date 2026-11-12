"use client";

import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { partnerFeatures } from "@/components/shell";
import { Button, EmptyState, ErrorState, PageHeader, Pagination, type SortState } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import { useSession } from "@/lib/auth/client";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { DirectoryToolbar, type SortOption } from "./_components/DirectoryToolbar";
import { OwnerQuickView } from "./_components/OwnerQuickView";
import { OwnersTable } from "./_components/OwnersTable";
import { PetCard, PetCardSkeleton } from "./_components/PetCard";
import type { QuickFilterId } from "./_components/QuickFilters";
import {
  filterOwners,
  filterPets,
  isHealth,
  isLastVisit,
  isSpecies,
  loadDirectory,
  paginate,
  sortOwners,
  sortPets,
  type DirectoryFilters,
  type DirectoryView,
  type OwnerSortId,
  type PetSort,
} from "./_lib/directory";
import { useNow } from "./_lib/stores";
import { useMockParam, useQueryUpdater } from "./_lib/url";

/** 12 = 4 rows of 3 cards: a page plus its pagination fits a 1440×900 screen; phones scroll half as far. */
const PET_PAGE_SIZE = 12;
/** 1 column on phones, then 2 / 3 / 4 as the results area gets wider (container query). */
const PET_GRID = "grid gap-2.5 @2xl:grid-cols-2 @2xl:gap-3 @4xl:grid-cols-3 @6xl:grid-cols-4";
/** 12 rows: the table and its pagination fit a 1440×900 screen. */
const OWNER_PAGE_SIZE = 12;
const OWNER_SORTS: OwnerSortId[] = ["last", "name", "spent", "visits", "pets"];
const DEFAULT_DIRECTION: Record<OwnerSortId, "asc" | "desc"> = { last: "desc", name: "asc", spent: "desc", visits: "desc", pets: "desc" };

function parseOwnerSort(value: string | null): { id: OwnerSortId; direction: "asc" | "desc" } {
  const [id, dir] = (value ?? "").split("_");
  const sortId = (OWNER_SORTS as string[]).includes(id) ? (id as OwnerSortId) : "last";
  return { id: sortId, direction: dir === "asc" || dir === "desc" ? dir : DEFAULT_DIRECTION[sortId] };
}

/**
 * Clients & pets directory. URL state: view (pets|owners), q, species, vaccine, last, ride=1,
 * sort (pets), osort (owners, e.g. spent_desc), page, id (owner quick view from notifications).
 */
export function ClientsView() {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const features = partnerFeatures(session);
  const mode = features.appointments ? "visits" : "orders";
  const now = useNow();
  const params = useSearchParams();
  const update = useQueryUpdater();
  const linkQuery = useMockParam();

  // ---- URL state -------------------------------------------------------------------------------
  const view: DirectoryView = params.get("view") === "owners" ? "owners" : "pets";
  const urlQ = params.get("q") ?? "";
  const species = params.get("species");
  const vaccine = params.get("vaccine");
  const last = params.get("last");
  const speciesF = isSpecies(species) ? species : null;
  const vaccineF = isHealth(vaccine) ? vaccine : null;
  const lastF = isLastVisit(last) && (mode === "visits" || view === "owners") ? last : null;
  const rideF = params.get("ride") === "1";
  const filters: Omit<DirectoryFilters, "q"> = { species: speciesF, vaccine: vaccineF, last: lastF, ride: rideF };
  const petSortParam = params.get("sort");
  const petSorts: PetSort[] = mode === "visits" ? ["next", "last", "name"] : ["name"];
  const petSort: PetSort = (petSorts as string[]).includes(petSortParam ?? "") ? (petSortParam as PetSort) : petSorts[0];
  const ownerSort = parseOwnerSort(params.get("osort"));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openId = params.get("id");

  // ---- Search box: instant locally, written to the URL after a pause -----------------------------
  const [search, setSearch] = useState(urlQ);
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ);
  const [written, setWritten] = useState(urlQ);
  if (urlQ !== seenUrlQ) {
    // The URL changed (global search, back/forward): adopt it unless it's our own debounced write.
    setSeenUrlQ(urlQ);
    if (urlQ !== written) setSearch(urlQ);
  }
  useEffect(() => {
    if (search === urlQ) return;
    const timer = window.setTimeout(() => {
      setWritten(search);
      update({ q: search.trim() ? search : null, page: null });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, urlQ, update]);
  const deferredSearch = useDeferredValue(search);

  // ---- Data ----------------------------------------------------------------------------------------
  const query = useApiQuery(["clients", "directory", mode], (api) => loadDirectory(api, mode));
  const dir = query.data;

  const result = useMemo(() => {
    if (!dir) return undefined;
    const f: DirectoryFilters = { species: speciesF, vaccine: vaccineF, last: lastF, ride: rideF, q: deferredSearch };
    const base: DirectoryFilters = { ...f, vaccine: null, ride: false };
    if (view === "pets") {
      const all = filterPets(dir, base, now);
      const rows = sortPets(filterPets(dir, f, now), petSort, locale);
      return {
        counts: {
          all: all.length,
          overdue: all.filter((p) => p.healthStatus === "overdue").length,
          due_soon: all.filter((p) => p.healthStatus === "due_soon").length,
          ride: all.filter((p) => dir.ridePetIds.has(p.id)).length,
        },
        total: rows.length,
        pets: paginate(rows, page, PET_PAGE_SIZE),
        owners: undefined,
      };
    }
    const all = filterOwners(dir, base, now);
    const rows = sortOwners(filterOwners(dir, f, now), ownerSort.id, ownerSort.direction, locale);
    return {
      counts: {
        all: all.length,
        overdue: all.filter((c) => c.vaccineAlert === "overdue").length,
        due_soon: all.filter((c) => c.vaccineAlert === "due_soon").length,
        ride: all.filter((c) => dir.rideClientIds.has(c.id)).length,
      },
      total: rows.length,
      pets: undefined,
      owners: paginate(rows, page, OWNER_PAGE_SIZE),
    };
  }, [dir, view, deferredSearch, speciesF, vaccineF, lastF, rideF, petSort, ownerSort.id, ownerSort.direction, page, now, locale]);

  // ---- Handlers ----------------------------------------------------------------------------------
  const setFilters = (patch: Partial<Omit<DirectoryFilters, "q">>) => {
    const next: Record<string, string | null> = { page: null };
    if ("species" in patch) next.species = patch.species ?? null;
    if ("vaccine" in patch) next.vaccine = patch.vaccine ?? null;
    if ("last" in patch) next.last = patch.last ?? null;
    if ("ride" in patch) next.ride = patch.ride ? "1" : null;
    update(next);
  };
  const clearAll = () => {
    setSearch("");
    setWritten("");
    update({ q: null, species: null, vaccine: null, last: null, ride: null, page: null });
  };
  const onQuickToggle = (id: QuickFilterId) => {
    if (id === "all") setFilters({ vaccine: null, ride: false });
    else if (id === "ride") setFilters({ ride: !filters.ride });
    else setFilters({ vaccine: filters.vaccine === id ? null : id });
  };
  const goToPage = (next: number) => {
    update({ page: next > 1 ? String(next) : null });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("clients-results")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };

  const petSortOptions: SortOption[] = petSorts.map((s) => ({ value: s, label: t.dynamic(`sort.pets_${s}`) }));
  const ownerSortOptions: SortOption[] = OWNER_SORTS.map((s) => ({
    value: s,
    label: s === "visits" && mode === "orders" ? t("sort.owners_orders") : s === "last" && mode === "orders" ? t("sort.owners_lastOrder") : t.dynamic(`sort.owners_${s}`),
  }));
  const tableSort: SortState = { id: ownerSort.id, direction: ownerSort.direction };

  const quickLabels: Record<QuickFilterId, string> = {
    all: t("quick.all"),
    overdue: t("quick.overdue"),
    due_soon: t("quick.dueSoon"),
    ride: mode === "visits" ? t("quick.ride") : t("quick.rideShop"),
  };
  const hasFilters = Boolean(filters.species || filters.vaccine || filters.last || filters.ride || search.trim());
  const petHref = (id: string) => localizedHref(locale, `${ROUTES.clients}/pets/${id}`, linkQuery);
  const ownerHref = (id: string) => localizedHref(locale, `${ROUTES.clients}/owners/${id}`, linkQuery);

  // ---- Render --------------------------------------------------------------------------------------
  const isEmptyDirectory = dir !== undefined && dir.pets.length === 0 && dir.clients.length === 0;
  const resultsLabel = view === "pets" ? t("views.pets") : t("views.owners");

  return (
    <div className="space-y-section">
      {query.error && !dir ? (
        <>
          <PageHeader title={t("title")} />
          <ErrorState error={query.error} onRetry={query.refetch} />
        </>
      ) : isEmptyDirectory ? (
        <>
          <PageHeader title={t("title")} />
          <EmptyState pet="golden" title={t("empty.noClientsTitle")} description={mode === "visits" ? t("empty.noClientsBody") : t("empty.noClientsBodyShop")} />
        </>
      ) : (
        <>
          <DirectoryToolbar
            title={t("title")}
            view={view}
            onViewChange={(v) => update({ view: v === "pets" ? null : v, page: null })}
            mode={mode}
            search={search}
            onSearchChange={setSearch}
            filters={{ ...filters, q: search }}
            onFiltersChange={setFilters}
            onClearAll={clearAll}
            sortOptions={view === "pets" ? petSortOptions : ownerSortOptions}
            sortValue={view === "pets" ? petSort : ownerSort.id}
            defaultSort={view === "pets" ? petSorts[0] : "last"}
            onSortChange={(value) => {
              if (view === "pets") update({ sort: value === petSorts[0] ? null : value, page: null });
              else {
                const id = value as OwnerSortId;
                update({ osort: id === "last" ? null : `${id}_${DEFAULT_DIRECTION[id]}`, page: null });
              }
            }}
            resultCount={result?.total}
            quick={{
              counts: result?.counts,
              loading: !result,
              labels: quickLabels,
              active: {
                all: !filters.vaccine && !filters.ride,
                overdue: filters.vaccine === "overdue",
                due_soon: filters.vaccine === "due_soon",
                ride: filters.ride,
              },
              onToggle: onQuickToggle,
            }}
          />

          {/* @container: the grid follows the space it gets (sidebar open or collapsed), not the window. */}
          <section id="clients-results" aria-labelledby="clients-results-title" aria-busy={!result || query.isRefreshing || undefined} className="@container scroll-mt-28 space-y-3">
            {/* The Pets/Owners switch and the counter chips already say what this is; the heading and count are for screen readers. */}
            <h2 id="clients-results-title" className="sr-only">
              {resultsLabel}
            </h2>
            <p className="sr-only" aria-live="polite">
              {result ? (view === "pets" ? t.plural("results.pets", result.total) : t.plural("results.owners", result.total)) : tc("states.loading")}
            </p>

            {!result ? (
              view === "pets" ? (
                <div className={PET_GRID}>
                  {Array.from({ length: PET_PAGE_SIZE }, (_, i) => (
                    <PetCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <OwnersTable rows={[]} loading skeletonRows={OWNER_PAGE_SIZE} mode={mode} sort={tableSort} onSortChange={() => {}} rowHref={(c) => ownerHref(c.id)} rideClientIds={new Set()} now={now} />
              )
            ) : result.total === 0 ? (
              <EmptyState
                pet="tabby"
                title={t("empty.noResultsTitle")}
                description={t("empty.noResultsBody")}
                action={
                  hasFilters ? (
                    <Button variant="secondary" onClick={clearAll}>
                      {t("filters.clearAll")}
                    </Button>
                  ) : undefined
                }
              />
            ) : view === "pets" && result.pets && dir ? (
              <>
                <ul className={PET_GRID}>
                  {result.pets.items.map((pet, i) => (
                    <li key={pet.id} className="min-w-0">
                      <PetCard pet={pet} href={petHref(pet.id)} mode={mode} cameWithRide={dir.ridePetIds.has(pet.id)} now={now} index={i} />
                    </li>
                  ))}
                </ul>
                <Pagination page={result.pets.page} pageCount={result.pets.pageCount} total={result.pets.total} pageSize={PET_PAGE_SIZE} onPageChange={goToPage} />
              </>
            ) : result.owners && dir ? (
              <>
                <OwnersTable
                  rows={result.owners.items}
                  mode={mode}
                  sort={tableSort}
                  onSortChange={(s) => {
                    const id = (s?.id ?? "last") as OwnerSortId;
                    const direction = s?.direction ?? DEFAULT_DIRECTION[id];
                    update({ osort: id === "last" && direction === "desc" ? null : `${id}_${direction}`, page: null });
                  }}
                  rowHref={(c) => ownerHref(c.id)}
                  rideClientIds={dir.rideClientIds}
                  now={now}
                />
                <Pagination page={result.owners.page} pageCount={result.owners.pageCount} total={result.owners.total} pageSize={OWNER_PAGE_SIZE} onPageChange={goToPage} />
              </>
            ) : null}
          </section>
        </>
      )}

      <OwnerQuickView clientId={openId} mode={mode} onClose={() => update({ id: null })} linkQuery={linkQuery} />
    </div>
  );
}
