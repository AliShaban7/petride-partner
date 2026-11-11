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
import { SchedulePanel, todaysAppointments } from "./_components/SchedulePanel";
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

/** Grid under the KPI row. xl: 7/5 columns (requests | rides, timeline | charts, reviews). */
const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12";
const SPAN = {
  wide: "md:col-span-2 xl:col-span-7",
  side: "md:col-span-2 xl:col-span-5",
  timeline: "md:col-span-2 xl:col-span-7",
  /** Two charts: side by side on tablets, stacked next to the timeline on desktops (the second one fills the height). */
  charts: "grid min-w-0 grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-5 xl:grid-cols-1 xl:grid-rows-[auto_1fr]",
  full: "md:col-span-2 xl:col-span-12",
} as const;

function KpiSection({ children }: { children: ReactNode }) {
  const t = useT("overview");
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="sr-only">
        {t("kpi.label")}
      </h2>
      {/* Phones: a swipeable row (the next card peeks in); from 640px: 2 × 2, from 1280px: 4 in a row. */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

/** KPI card width in the phone carousel. */
const KPI_ITEM = "w-[80%] max-w-80 shrink-0 snap-start sm:w-auto sm:max-w-none";

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

  // Summary line + hero button
  const data = overview.data;
  const pending = data ? data.pending.filter((a) => !optimistic[a.id]).length : 0;
  const liveRides = rides.data ? ridesFor(rides.data, "clinic").filter(isLiveRide) : [];
  const inbound = liveRides.filter((r) => r.direction === "to_partner").length;
  let summary: string[] | null = null;
  if (data && schedule.data) {
    const visits = todaysAppointments(schedule.data.items, dayStart, optimistic).filter((a) => a.status !== "cancelled").length;
    summary = [visits > 0 ? t.plural("summary.visits", visits) : t("summary.noVisits")];
    if (pending > 0) summary.push(t.plural("summary.requests", pending));
    if (liveRides.length > 0) summary.push(t.plural("summary.rides", liveRides.length));
  } else if (overview.error || schedule.error) {
    summary = [];
  }

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
      href: appointmentsHref,
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
    <div className="space-y-6">
      <OverviewHero
        name={session.partnerShortName}
        summary={summary}
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
          <KpiCard key={key} index={index} className={KPI_ITEM} {...card} />
        ))}
      </KpiSection>

      <div className={GRID}>
        <RequestsPanel
          className={SPAN.wide}
          query={overview}
          optimistic={optimistic}
          onAccept={(a) => answer(a, "confirmed", () => confirm.mutateAsync(a.id))}
          onDecline={(a, reason) => answer(a, "declined", () => decline.mutateAsync(a.id, reason))}
        />
        <LiveRidesPanel className={SPAN.side} query={rides} variant="clinic" />
        <SchedulePanel className={SPAN.timeline} query={schedule} dayStart={dayStart} rides={rides.data} optimistic={optimistic} />
        <div className={SPAN.charts}>
          <DailyChart query={daily} mode="visits" />
          <MixChart query={mix} mode="visits" />
        </div>
        <ReviewsPanel className={SPAN.full} query={overview} />
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
  let summary: string[] | null = null;
  if (data && today.data) {
    const orders = today.data.orders.value;
    summary = [orders > 0 ? t.plural("summary.orders", orders) : t("summary.noOrders")];
    if (newCount > 0) summary.push(t.plural("summary.newOrders", newCount));
    if (couriers.length > 0) summary.push(t.plural("summary.couriers", couriers.length));
  } else if (overview.error || today.error) {
    summary = [];
  }

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
    <div className="space-y-6">
      <OverviewHero
        name={session.partnerShortName}
        summary={summary}
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
          <KpiCard key={key} index={index} className={KPI_ITEM} {...card} />
        ))}
      </KpiSection>

      <div className={GRID}>
        <NewOrdersPanel className={SPAN.wide} query={overview} optimistic={optimistic} onStart={startPreparing} />
        <LiveRidesPanel className={SPAN.side} query={rides} variant="shop" />
        <OrdersTodayPanel className={SPAN.timeline} query={todayOrders} rides={rides.data} optimistic={optimistic} />
        <div className={SPAN.charts}>
          <DailyChart query={daily} mode="orders" />
          <MixChart query={mix} mode="orders" />
        </div>
        <ReviewsPanel className={SPAN.full} query={overview} />
      </div>
    </div>
  );
}
