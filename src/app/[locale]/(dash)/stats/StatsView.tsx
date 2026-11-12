"use client";

import { CalendarRange } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { partnerFeatures } from "@/components/shell";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonCard } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import { useSession } from "@/lib/auth/client";
import { useT } from "@/lib/i18n/client";

import { BusyHeatmap } from "./_components/BusyHeatmap";
import { ExportMenu } from "./_components/ExportMenu";
import { KpiRow, KpiRowSkeleton } from "./_components/KpiRow";
import { MixDonut } from "./_components/MixDonut";
import { RatingPanel } from "./_components/RatingPanel";
import { CustomRangeFields, PeriodControls, RangeLine } from "./_components/StatsToolbar";
import { ProductsPanel, TopServicesTable } from "./_components/StatsTables";
import { CancellationsChart, RevenueChart, RideShareChart, VolumeChart } from "./_components/TimeCharts";
import { computeReport, prepareSource, type StatsReport } from "./_lib/engine";
import { useToday } from "./_lib/labels";
import { loadStatsSource } from "./_lib/load";
import { presetRange, previousRange, rangeFromSearch, rangeToQuery, type RangeState, type StatsRange } from "./_lib/range";

/** An optimistic period pick while `router.replace` catches up (`from` = the URL before the first pick). */
type Pending = { query: string; from: string; requested: string[]; state: RangeState };

const stateKey = (s: RangeState | null) => (s ? `${s.range.kind}|${s.range.from}|${s.range.to}|${s.compare ? 1 : 0}` : "");

/**
 * Statistics: period picker + comparison and CSV export on the title row, one row of KPI cards,
 * charts in a 2–3 column grid (each with a Table view), top services / products, stock turnover.
 * The clinic variant is about visits and PetRide rides; the shop variant about orders, products and the PetRide courier.
 */
export function StatsView() {
  const t = useT("stats");
  const tc = useT("common");
  const session = useSession();
  const features = partnerFeatures(session);
  const today = useToday();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // The URL is the source of truth (shareable, back / forward). A period picked here shows at
  // once as `pending` while router.replace fetches the new URL; it's dropped when the URL catches
  // up, or when the user goes back / forward.
  const query = searchParams.toString();
  const [pending, setPending] = useState<Pending | null>(null);
  // Drop the optimistic period once the URL has it, or when the URL changes some other way (a link,
  // global search) so a stale pick never hides it.
  if (pending && (pending.query === query || (query !== pending.from && !pending.requested.includes(query)))) setPending(null);
  useEffect(() => {
    const onPopState = () => setPending(null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const urlState = useMemo(() => (today ? rangeFromSearch(searchParams, today) : null), [searchParams, today]);
  const liveState = pending?.state ?? urlState;
  // Keep one object per period (not per URL round-trip), so the report and the charts aren't
  // recomputed and re-animated when the URL catches up with an optimistic pick.
  const [stable, setStable] = useState<RangeState | null>(liveState);
  const sameAsStable = stateKey(stable) === stateKey(liveState);
  if (!sameAsStable) setStable(liveState);
  const state = sameAsStable ? stable : liveState;
  const source = useApiQuery(["stats", "source", features.appointments, features.orders], (api) => loadStatsSource(api, features));
  const prepared = useMemo(() => (source.data ? prepareSource(source.data) : null), [source.data]);
  const report = useMemo(() => (prepared && state ? computeReport(prepared, state.range, state.compare) : null), [prepared, state]);

  const navigate = (range: StatsRange, compare: boolean) => {
    const params = new URLSearchParams(query);
    for (const [key, value] of Object.entries(rangeToQuery(range, compare))) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    setPending((prev) => ({
      query: qs,
      from: prev?.from ?? query,
      requested: [...(prev?.requested ?? []), qs],
      state: { range, compare },
    }));
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const deltaLabel = !state ? "" : state.range.kind === "custom" ? t("delta.vsPrevious") : tc(`delta.vs_${state.range.kind}`);

  let body;
  if (source.error && !source.data) {
    body = (
      <Card>
        <ErrorState error={source.error} onRetry={source.refetch} />
      </Card>
    );
  } else if (!report || !state || !today) {
    body = <StatsSkeleton label={t("loading")} />;
  } else if (!report.hasData) {
    body = (
      <Card className="animate-fade-up">
        <EmptyState
          title={t("empty.title")}
          description={t("empty.body")}
          pet="golden"
          action={
            state.range.kind !== "90d" ? (
              <Button variant="secondary" leftIcon={<CalendarRange size={18} aria-hidden="true" />} onClick={() => navigate(presetRange("90d", today), state.compare)}>
                {t("empty.action")}
              </Button>
            ) : null
          }
        />
      </Card>
    );
  } else {
    body = <StatsContent report={report} deltaLabel={deltaLabel} refreshing={source.isRefreshing} />;
  }

  return (
    <div className="space-y-section">
      {/* Period, comparison and export share the title's row; the dates on screen are the (small) description. */}
      <PageHeader
        title={t("title")}
        description={
          state && today ? <RangeLine range={state.range} previous={previousRange(state.range)} compare={state.compare} comparable={report?.comparable ?? true} /> : undefined
        }
        actions={
          <>
            {state && today ? (
              <PeriodControls
                range={state.range}
                compare={state.compare}
                today={today}
                onRangeChange={(range) => navigate(range, state.compare)}
                onCompareChange={(compare) => navigate(state.range, compare)}
              />
            ) : (
              <Skeleton className="h-10 w-80 max-w-full rounded-chip" />
            )}
            <ExportMenu report={report?.hasData ? report : null} partnerName={session.partnerShortName} />
          </>
        }
      />
      {state && today && state.range.kind === "custom" ? (
        <CustomRangeFields from={state.range.from} to={state.range.to} today={today} onApply={(range) => navigate(range, state.compare)} />
      ) : null}
      {body}
    </div>
  );
}

function StatsContent({ report, deltaLabel, refreshing }: { report: StatsReport; deltaLabel: string; refreshing: boolean }) {
  const visits = report.features.appointments;
  const orders = report.features.orders;
  // Desktop: revenue + mix side by side, the three time charts in one row, heatmap + rating, then
  // the table (the shop's best sellers and stock turnover are two tabs of one panel). Each chart
  // keeps its own Chart / Table switch.
  return (
    <div className="space-y-section" aria-busy={refreshing || undefined}>
      <KpiRow report={report} deltaLabel={deltaLabel} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <RevenueChart report={report} index={0} />
        <MixDonut report={report} index={1} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <VolumeChart report={report} index={2} />
        <RideShareChart report={report} index={3} />
        <CancellationsChart report={report} index={4} className="md:col-span-2 xl:col-span-1" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <BusyHeatmap report={report} index={5} />
        <RatingPanel report={report} deltaLabel={deltaLabel} index={6} />
      </div>
      {visits ? <TopServicesTable report={report} index={7} /> : null}
      {orders ? <ProductsPanel report={report} index={8} /> : null}
    </div>
  );
}

function StatsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="space-y-section">
      <span className="sr-only" role="status">
        {label}
      </span>
      <KpiRowSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72" />
        <SkeletonCard className="h-72 md:col-span-2 xl:col-span-1" />
      </div>
    </div>
  );
}
