"use client";

import { ArrowRight, CalendarCheck, Car, Inbox, PackageX, ShoppingBag, UserPlus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

import { partnerFeatures } from "@/components/shell";
import { ButtonLink, KpiCard, useToast } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery, type QueryResult } from "@/lib/api/hooks";
import type { Appointment, AppointmentStatus, Order, OrderStatus, Product } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { formatDuration, formatMoney, formatNumber } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";
import { stockStatus } from "@/lib/status";

import { DailyChart, MixChart } from "./_components/Charts";
import { OverviewHero } from "./_components/Hero";
import { LiveRidesPanel, isLiveRide, ridesFor } from "./_components/LiveRidesPanel";
import { minutesLeft, nextDay, ratioDelta, startOfDay, useNow } from "./_components/now";
import { RequestsPanel } from "./_components/RequestsPanel";
import { ReviewsPanel } from "./_components/ReviewsPanel";
import { SchedulePanel } from "./_components/SchedulePanel";
import { NewOrdersPanel, OrdersTodayPanel } from "./_components/ShopPanels";

/**
 * Dashboard home. Clinics, salons and hotels see appointments, requests and PetRide rides;
 * pet shops see the same layout built from orders and courier rides.
 */
export function OverviewView() {
  const session = useSession();
  return partnerFeatures(session).appointments ? <ClinicOverview /> : <ShopOverview />;
}

// ---- Shared bits ----------------------------------------------------------------------------------

/**
 * Grid under the KPI row. Phones: one column in priority order (requests, today, rides, the two
 * charts side by side in a swipeable row, reviews). From 768px: two columns. From 1280px: three equal columns, so requests, today's
 * agenda and live rides share the first screen; the charts and reviews share the second row.
 */
const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
/** Rides and reviews take the full width on tablets (their lists go 2–4 across there). */
const WIDE_ON_TABLET = "md:col-span-2 xl:col-span-1";
/**
 * Phones: the two charts share one swipeable row (the second peeks in, like the KPI strip) instead
 * of stacking, which saves a whole chart's height. From 640px the wrapper is `display: contents`, so
 * the charts are ordinary grid items again. `relative` keeps the charts' sr-only summaries inside.
 */
const CHARTS_ROW =
  "relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:contents";
const CHART_ITEM = "w-[86%] shrink-0 snap-start sm:w-auto";

function KpiSection({ children }: { children: ReactNode }) {
  const t = useT("overview");
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="sr-only">
        {t("kpi.label")}
      </h2>
      {/* Phones: a swipeable row (the next card peeks in); from 640px: 2 × 2, from 1280px: 4 in a row. */}
      <div className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

/** KPI card width in the phone carousel. */
const KPI_ITEM = "w-[72%] max-w-72 shrink-0 snap-start sm:w-auto sm:max-w-none";

type KpiState = { value: ReactNode; delta?: number | null; footnote?: ReactNode; loading: boolean };

/** Loading → skeleton, error → "—" with a short note, data → `pick(data)`. */
function useKpiState() {
  const t = useT("overview");
  return function kpi<T>(query: QueryResult<T>, pick: (data: T) => Omit<KpiState, "loading">): KpiState {
    if (query.data !== undefined) return { loading: false, ...pick(query.data) };
    if (query.error) return { loading: false, value: "—", footnote: t("kpi.failed") };
    return { loading: true, value: "" };
  };
}

function without<V>(map: Record<string, V>, id: string): Record<string, V> {
  const next = { ...map };
  delete next[id];
  return next;
}

function CtaCount({ count }: { count: number }) {
  return <span className="inline-flex min-w-6 items-center justify-center rounded-chip bg-surface/85 px-1.5 text-caption font-bold text-fg tabular">{count}</span>;
}

const APPOINTMENT_TAGS = ["overview", "appointments", "rides", "notifications", "stats", "clients", "pets"] as const;
const ORDER_TAGS = ["overview", "orders", "rides", "notifications", "stats", "clients"] as const;

// ---- Clinic / salon / hotel ----------------------------------------------------------------------

function ClinicOverview() {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const kpi = useKpiState();
  const now = useNow(60_000);
  const dayStart = now === null ? null : startOfDay(now);

  const overview = useApiQuery(["overview"], (api) => api.getOverview(), { refreshMs: 60_000 });
  const rides = useApiQuery(["rides", "overview-live"], (api) => api.listRides({ live: true }), { refreshMs: 10_000 });
  const schedule = useApiQuery(
    ["appointments", "overview-today", dayStart],
    (api) =>
      api.listAppointments({
        from: new Date(dayStart ?? 0).toISOString(),
        to: new Date(nextDay(dayStart ?? 0)).toISOString(),
        sort: "start_asc",
        pageSize: 200,
      }),
    { enabled: dayStart !== null, refreshMs: 60_000 },
  );
  const today = useApiQuery(["stats", "overview-kpis", "today"], (api) => api.getKpis("today"), { refreshMs: 60_000 });
  const month = useApiQuery(["stats", "overview-kpis", "30d"], (api) => api.getKpis("30d"));
  const daily = useApiQuery(["stats", "overview-daily", "30d"], (api) => api.getDailySeries("30d"), { refreshMs: 60_000 });
  const mix = useApiQuery(["stats", "overview-mix", "30d"], (api) => api.getServiceMix("30d"));

  const [optimistic, setOptimistic] = useState<Record<string, AppointmentStatus>>({});
  const confirm = useApiMutation((api, id: string) => api.confirmAppointment(id), { invalidates: APPOINTMENT_TAGS });
  const decline = useApiMutation((api, id: string, reason: string) => api.declineAppointment(id, reason), { invalidates: APPOINTMENT_TAGS });

  async function answer(a: Appointment, status: "confirmed" | "declined", run: () => Promise<unknown>) {
    setOptimistic((map) => ({ ...map, [a.id]: status }));
    try {
      await run();
      if (status === "confirmed") {
        toast({
          tone: "success",
          title: t("requests.acceptedTitle", { pet: a.petName }),
          description: t("requests.acceptedBody", { client: a.clientName }),
          action: { label: t("requests.open"), onClick: () => router.push(localizedHref(locale, ROUTES.appointments, { id: a.id })) },
        });
      } else {
        toast({ tone: "info", title: t("requests.declinedTitle", { pet: a.petName }), description: t("requests.declinedBody", { client: a.clientName }) });
      }
    } catch (error) {
      setOptimistic((map) => without(map, a.id));
      toast({ tone: "error", title: t("requests.failedTitle"), description: tc(`errors.${errorCode(error)}`) });
    }
  }

  // Hero button and the rides KPI footnote. No summary sentence: the KPI cards and the panels already show those numbers.
  const data = overview.data;
  const pending = data ? data.pending.filter((a) => !optimistic[a.id]).length : 0;
  const liveRides = rides.data ? ridesFor(rides.data, "clinic").filter(isLiveRide) : [];
  const inbound = liveRides.filter((r) => r.direction === "to_partner").length;

  const points = daily.data ?? [];
  const lastTwo = points.slice(-2);

  const appointmentsHref = localizedHref(locale, ROUTES.appointments);
  const cards = [
    {
      key: "visits",
      tone: "mint",
      pet: "golden",
      icon: <CalendarCheck size={18} />,
      label: t("kpi.todayVisits"),
      href: appointmentsHref,
      deltaLabel: tc("delta.vs_today"),
      ...kpi(today, (k) => ({ value: formatNumber(k.appointments.value, locale), delta: k.appointments.delta })),
    },
    {
      key: "rides",
      tone: "peach",
      pet: "ginger",
      icon: <Car size={18} />,
      label: t("kpi.rideArrivals"),
      // The PetRide rides page (today's rides, the ones still on the way first).
      href: localizedHref(locale, ROUTES.orders),
      deltaLabel: tc("delta.vs_today"),
      ...kpi(daily, () => {
        const [yesterday, todayPoint] = lastTwo.length === 2 ? lastTwo : [undefined, lastTwo[0]];
        return {
          value: formatNumber(todayPoint?.withRide ?? 0, locale),
          delta: yesterday && todayPoint ? ratioDelta(todayPoint.withRide, yesterday.withRide) : null,
          footnote: inbound > 0 ? t.plural("kpi.ridesOnWay", inbound) : undefined,
        };
      }),
    },
    {
      key: "revenue",
      tone: "lilac",
      pet: "tabby",
      icon: <Wallet size={18} />,
      label: t("kpi.revenue7d"),
      href: localizedHref(locale, ROUTES.stats),
      deltaLabel: tc("delta.vs_7d"),
      ...kpi(overview, (d) => ({ value: formatMoney(d.kpis.revenue.value, locale, { decimals: 0 }), delta: d.kpis.revenue.delta })),
    },
    {
      key: "clients",
      tone: "sand",
      pet: "cream",
      icon: <UserPlus size={18} />,
      label: t("kpi.newClients"),
      unit: month.data ? t("kpi.newClientsUnit") : undefined,
      href: localizedHref(locale, ROUTES.clients),
      deltaLabel: tc("delta.vs_30d"),
      ...kpi(month, (k) => ({ value: formatNumber(k.newClients.value, locale), delta: k.newClients.delta })),
    },
  ] as const;

  return (
    <div className="space-y-section">
      <OverviewHero
        name={session.partnerShortName}
        actions={
          !data ? null : pending > 0 ? (
            <ButtonLink
              href={localizedHref(locale, ROUTES.appointments, { status: "requested" })}
              variant="accent"
              className="max-sm:hidden"
              leftIcon={<Inbox size={18} aria-hidden="true" />}
              rightIcon={<CtaCount count={pending} />}
            >
              {t("hero.requestsCta")}
            </ButtonLink>
          ) : (
            <ButtonLink href={appointmentsHref} variant="secondary" className="max-sm:hidden" rightIcon={<ArrowRight size={18} aria-hidden="true" />}>
              {t("hero.scheduleCta")}
            </ButtonLink>
          )
        }
      />

      <KpiSection>
        {cards.map(({ key, ...card }, index) => (
          <KpiCard key={key} index={index} size="sm" className={KPI_ITEM} {...card} />
        ))}
      </KpiSection>

      <div className={GRID}>
        <RequestsPanel
          query={overview}
          optimistic={optimistic}
          onAccept={(a) => answer(a, "confirmed", () => confirm.mutateAsync(a.id))}
          onDecline={(a, reason) => answer(a, "declined", () => decline.mutateAsync(a.id, reason))}
        />
        <SchedulePanel query={schedule} dayStart={dayStart} rides={rides.data} optimistic={optimistic} />
        <LiveRidesPanel className={WIDE_ON_TABLET} query={rides} variant="clinic" />
        <div className={CHARTS_ROW}>
          <DailyChart className={CHART_ITEM} query={daily} mode="visits" />
          <MixChart className={CHART_ITEM} query={mix} mode="visits" />
        </div>
        <ReviewsPanel className={WIDE_ON_TABLET} query={overview} />
      </div>
    </div>
  );
}

// ---- Pet shop -------------------------------------------------------------------------------------

function ShopOverview() {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const kpi = useKpiState();
  const now = useNow(60_000);
  const dayStart = now === null ? null : startOfDay(now);

  const overview = useApiQuery(["overview"], (api) => api.getOverview(), { refreshMs: 60_000 });
  const rides = useApiQuery(["rides", "overview-live"], (api) => api.listRides({ live: true }), { refreshMs: 10_000 });
  const today = useApiQuery(["stats", "overview-kpis", "today"], (api) => api.getKpis("today"), { refreshMs: 60_000 });
  const daily = useApiQuery(["stats", "overview-daily", "30d"], (api) => api.getDailySeries("30d"), { refreshMs: 60_000 });
  const mix = useApiQuery(["stats", "overview-mix", "30d"], (api) => api.getServiceMix("30d"));
  const products = useApiQuery(["products", "overview"], (api) => api.listProducts(), { refreshMs: 120_000 });
  const todayOrders = useApiQuery(
    ["orders", "overview-today", dayStart],
    (api) => api.listOrders({ from: new Date(dayStart ?? 0).toISOString(), sort: "created_desc", pageSize: 100 }),
    { enabled: dayStart !== null, refreshMs: 30_000 },
  );

  const [optimistic, setOptimistic] = useState<Record<string, OrderStatus>>({});
  const start = useApiMutation((api, id: string) => api.updateOrderStatus(id, "preparing"), { invalidates: ORDER_TAGS });

  async function startPreparing(o: Order) {
    setOptimistic((map) => ({ ...map, [o.id]: "preparing" }));
    try {
      await start.mutateAsync(o.id);
      toast({
        tone: "success",
        title: t("newOrders.startedTitle", { code: o.code }),
        description: t("newOrders.startedBody", { client: o.clientName }),
        action: { label: t("newOrders.open"), onClick: () => router.push(localizedHref(locale, ROUTES.orders, { id: o.id })) },
      });
    } catch (error) {
      setOptimistic((map) => without(map, o.id));
      toast({ tone: "error", title: t("newOrders.failedTitle"), description: tc(`errors.${errorCode(error)}`) });
    }
  }

  const data = overview.data;
  const newCount = data ? data.openOrders.filter((o) => o.status === "new" && !optimistic[o.id]).length : 0;
  const couriers = rides.data ? ridesFor(rides.data, "shop").filter(isLiveRide) : [];

  const ordersHref = localizedHref(locale, ROUTES.orders);
  const nextEta = now === null || couriers.length === 0 ? null : Math.max(0, Math.min(...couriers.map((r) => minutesLeft(r.arriveAt, now))));
  const lowStock = (list: Product[]) => list.filter((p) => p.active && stockStatus(p.stock, p.lowStockAt) !== "in");

  const cards = [
    {
      key: "orders",
      tone: "mint",
      pet: "golden",
      icon: <ShoppingBag size={18} />,
      label: t("kpi.todayOrders"),
      href: ordersHref,
      deltaLabel: tc("delta.vs_today"),
      ...kpi(today, (k) => ({ value: formatNumber(k.orders.value, locale), delta: k.orders.delta })),
    },
    {
      key: "revenue",
      tone: "peach",
      pet: "ginger",
      icon: <Wallet size={18} />,
      label: t("kpi.revenue7d"),
      href: localizedHref(locale, ROUTES.stats),
      deltaLabel: tc("delta.vs_7d"),
      ...kpi(overview, (d) => ({ value: formatMoney(d.kpis.revenue.value, locale, { decimals: 0 }), delta: d.kpis.revenue.delta })),
    },
    {
      key: "stock",
      tone: "lilac",
      pet: "tabby",
      icon: <PackageX size={18} />,
      label: t("kpi.lowStock"),
      href: localizedHref(locale, ROUTES.services),
      ...kpi(products, (list) => {
        const low = lowStock(list);
        const out = low.filter((p) => p.stock <= 0).length;
        return {
          value: formatNumber(low.length, locale),
          footnote: out > 0 ? t.plural("kpi.outOfStock", out) : low.length === 0 ? t("kpi.stockOk") : undefined,
        };
      }),
    },
    {
      key: "couriers",
      tone: "sand",
      pet: "cream",
      icon: <Car size={18} />,
      label: t("kpi.couriers"),
      href: ordersHref,
      ...kpi(rides, () => ({
        value: formatNumber(couriers.length, locale),
        footnote: nextEta !== null ? t("kpi.nextCourier", { eta: formatDuration(nextEta, locale) }) : undefined,
      })),
    },
  ] as const;

  return (
    <div className="space-y-section">
      <OverviewHero
        name={session.partnerShortName}
        actions={
          !data ? null : newCount > 0 ? (
            <ButtonLink
              href={localizedHref(locale, ROUTES.orders, { status: "new" })}
              variant="accent"
              className="max-sm:hidden"
              leftIcon={<ShoppingBag size={18} aria-hidden="true" />}
              rightIcon={<CtaCount count={newCount} />}
            >
              {t("hero.ordersCta")}
            </ButtonLink>
          ) : (
            <ButtonLink href={ordersHref} variant="secondary" className="max-sm:hidden" rightIcon={<ArrowRight size={18} aria-hidden="true" />}>
              {t("hero.allOrdersCta")}
            </ButtonLink>
          )
        }
      />

      <KpiSection>
        {cards.map(({ key, ...card }, index) => (
          <KpiCard key={key} index={index} size="sm" className={KPI_ITEM} {...card} />
        ))}
      </KpiSection>

      <div className={GRID}>
        <NewOrdersPanel query={overview} optimistic={optimistic} onStart={startPreparing} />
        <OrdersTodayPanel query={todayOrders} rides={rides.data} optimistic={optimistic} />
        <LiveRidesPanel className={WIDE_ON_TABLET} query={rides} variant="shop" />
        <div className={CHARTS_ROW}>
          <DailyChart className={CHART_ITEM} query={daily} mode="orders" />
          <MixChart className={CHART_ITEM} query={mix} mode="orders" />
        </div>
        <ReviewsPanel className={WIDE_ON_TABLET} query={overview} />
      </div>
    </div>
  );
}
