"use client";

import { ArrowRight, Car, ChevronDown, ChevronUp, PackageOpen, ShoppingBag, Store } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { AsyncView, Button, ButtonLink, EmptyState, Panel, SkeletonRows, StatusPill, Tag } from "@/components/ui";
import type { QueryResult } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import type { Order, OrderStatus, OverviewData, Paged, Ride } from "@/lib/api/types";
import { formatDuration, formatMoney, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { isLiveRide } from "./LiveRidesPanel";
import { minutesLeft, useNow } from "./now";
import { TimelineList, TimelineRow, TimelineSkeleton, type TimelineState } from "./Timeline";

const VISIBLE_NEW = 4;
/** Phones show fewer cards; the "View all (N)" link covers the rest. */
const PHONE_VISIBLE = 2;
const VISIBLE_TODAY = 8;

/** Optimistic status wins while the refetch is on its way. */
export function withOptimistic(order: Order, optimistic: Record<string, OrderStatus>): Order {
  return optimistic[order.id] ? { ...order, status: optimistic[order.id] } : order;
}

// ---- New orders (shop "incoming requests") ------------------------------------------------------

export type NewOrdersPanelProps = {
  query: QueryResult<OverviewData>;
  optimistic: Record<string, OrderStatus>;
  onStart: (order: Order) => void;
  className?: string;
};

export function NewOrdersPanel({ query, optimistic, onStart, className }: NewOrdersPanelProps) {
  const t = useT("overview");
  const locale = useLocale();
  const bodyRef = useRef<HTMLDivElement>(null);
  const isNew = (o: Order) => o.status === "new" && !optimistic[o.id];
  const orders = (query.data?.openOrders ?? []).filter(isNew);

  const moveFocusFrom = (id: string) => {
    const root = bodyRef.current;
    if (!root || !root.contains(document.activeElement)) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-order]"));
    const index = cards.findIndex((card) => card.dataset.order === id);
    const next = cards[index + 1] ?? cards[index - 1];
    requestAnimationFrame(() => {
      const target = next?.isConnected ? next.querySelector<HTMLElement>("[data-primary-action]") : null;
      (target ?? root).focus({ preventScroll: true });
    });
  };

  return (
    <Panel
      title={t("newOrders.title")}
      description={t("newOrders.description")}
      icon={<ShoppingBag size={20} />}
      className={cn("flex flex-col", className)}
      bodyClassName="flex flex-1 flex-col"
      actions={
        orders.length > 0 ? (
          <ButtonLink
            href={localizedHref(locale, ROUTES.orders, { status: "new" })}
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight size={16} aria-hidden="true" />}
          >
            {t("newOrders.viewAll", { count: orders.length })}
          </ButtonLink>
        ) : null
      }
    >
      <div ref={bodyRef} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <AsyncView
          query={query}
          compact
          isEmpty={(data) => !data.openOrders.some(isNew)}
          loading={<SkeletonRows rows={3} />}
          empty={<EmptyState compact className="flex-1 justify-center" pet="golden" title={t("newOrders.emptyTitle")} description={t("newOrders.emptyBody")} />}
        >
          {() => (
            <ul className="space-y-3">
              {orders.slice(0, VISIBLE_NEW).map((o, i) => (
                <NewOrderCard
                  key={o.id}
                  order={o}
                  index={i}
                  onStart={() => {
                    moveFocusFrom(o.id);
                    onStart(o);
                  }}
                />
              ))}
            </ul>
          )}
        </AsyncView>
      </div>
    </Panel>
  );
}

function NewOrderCard({ order: o, index, onStart }: { order: Order; index: number; onStart: () => void }) {
  const t = useT("overview");
  const ts = useT("status");
  const locale = useLocale();
  const now = useNow(30_000);
  const titleId = useId();
  const href = localizedHref(locale, ROUTES.orders, { id: o.id });
  const courier = o.fulfilment === "petride_courier";
  return (
    <li
      data-order={o.id}
      className={cn(
        "animate-fade-up rounded-card border border-border bg-surface p-4 transition-shadow duration-200 hover:shadow-card",
        index >= PHONE_VISIBLE && "max-sm:hidden",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex gap-3">
        <span aria-hidden="true" className="hidden size-12 shrink-0 items-center justify-center rounded-tile bg-pastel-peach text-fg sm:inline-flex">
          <ShoppingBag size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 id={titleId} className="min-w-0 text-body font-semibold text-fg">
              <Link href={href} className="rounded-sm underline-offset-2 hover:underline">
                {o.code}
              </Link>
              <span className="font-normal text-fg-secondary"> · {o.clientName}</span>
            </h3>
            {now !== null ? <span className="text-meta text-fg-secondary">{formatRelative(o.createdAt, locale, new Date(now))}</span> : null}
          </div>
          <p className="mt-1 text-body-sm text-fg-secondary">
            {t.plural("newOrders.items", o.itemsCount)} · <span className="font-semibold text-fg tabular">{formatMoney(o.totalAZN, locale)}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-meta text-fg-secondary">{o.items.map((item) => `${item.qty}× ${item.name}`).join(", ")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag icon={courier ? <Car size={14} aria-hidden="true" /> : <Store size={14} aria-hidden="true" />}>{ts(`fulfilment.${o.fulfilment}`)}</Tag>
            <StatusPill kind="payment" status={o.paid ? "paid" : "unpaid"} size="sm" />
            {o.petNames.length ? <Tag>{t("newOrders.forPets", { pets: o.petNames.join(", ") })}</Tag> : null}
          </div>
          {o.clientNote ? <p className="mt-2 line-clamp-2 rounded-tile bg-surface-muted px-3 py-2 text-body-sm text-fg-secondary">{o.clientNote}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button size="sm" data-primary-action="" aria-describedby={titleId} leftIcon={<PackageOpen size={16} aria-hidden="true" />} onClick={onStart}>
          {t("newOrders.start")}
        </Button>
      </div>
    </li>
  );
}

// ---- Today's orders timeline --------------------------------------------------------------------

const ORDER_STATE: Record<OrderStatus, TimelineState> = {
  new: "attention",
  preparing: "current",
  ready: "current",
  delivered: "past",
  picked_up: "past",
  cancelled: "past",
};

export type OrdersTodayPanelProps = {
  query: QueryResult<Paged<Order>>;
  rides: readonly Ride[] | undefined;
  optimistic: Record<string, OrderStatus>;
  className?: string;
};

/** Today's orders, newest first, with the courier's ETA when one is on the way. */
export function OrdersTodayPanel({ query, rides, optimistic, className }: OrdersTodayPanelProps) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);
  const orders = (query.data?.items ?? []).map((o) => withOptimistic(o, optimistic));
  const counted = orders.filter((o) => o.status !== "cancelled").length;

  return (
    <Panel
      title={t("schedule.ordersTitle")}
      description={query.data && counted > 0 ? t.plural("schedule.ordersCount", counted) : undefined}
      icon={<PackageOpen size={20} />}
      className={className}
      actions={
        <ButtonLink href={localizedHref(locale, ROUTES.orders)} variant="ghost" size="sm" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
          {tc("actions.viewAll")}
        </ButtonLink>
      }
    >
      <AsyncView
        query={query}
        compact
        loading={<TimelineSkeleton />}
        empty={<EmptyState compact pet="tabby" title={t("schedule.ordersEmptyTitle")} description={t("schedule.ordersEmptyBody")} />}
      >
        {() => {
          const shown = showAll ? orders : orders.slice(0, VISIBLE_TODAY);
          return (
            <div className="space-y-2">
              <TimelineList label={t("schedule.ordersListLabel")}>
                {shown.map((o, i) => (
                  <OrderRow key={o.id} order={o} rides={rides} index={i} />
                ))}
              </TimelineList>
              {orders.length > VISIBLE_TODAY ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={showAll}
                  rightIcon={showAll ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                  onClick={() => setShowAll((v) => !v)}
                  className="text-fg-secondary"
                >
                  {showAll ? t("schedule.showLess") : t("schedule.showAll", { count: orders.length })}
                </Button>
              ) : null}
            </div>
          );
        }}
      </AsyncView>
    </Panel>
  );
}

function OrderRow({ order: o, rides, index }: { order: Order; rides: readonly Ride[] | undefined; index: number }) {
  const t = useT("overview");
  const ts = useT("status");
  const locale = useLocale();
  const now = useNow(15_000);
  const ride = rides?.find((r) => r.orderId === o.id) ?? o.courierRide;
  const liveRide = ride && isLiveRide(ride) ? ride : undefined;
  const eta = liveRide ? (now === null ? (liveRide.etaMin ?? 0) : Math.max(0, minutesLeft(liveRide.arriveAt, now))) : 0;
  const courier = o.fulfilment === "petride_courier";
  return (
    <TimelineRow href={localizedHref(locale, ROUTES.orders, { id: o.id })} time={o.createdAt} state={ORDER_STATE[o.status]} index={index}>
      <p className="truncate font-semibold text-fg">
        {o.code} <span className="font-normal text-fg-tertiary">· {o.clientName}</span>
      </p>
      <p className="truncate text-meta text-fg-tertiary">
        {t.plural("newOrders.items", o.itemsCount)} · <span className="tabular">{formatMoney(o.totalAZN, locale)}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusPill kind="order" status={o.status} size="sm" />
        <Tag tone="white" icon={courier ? <Car size={13} aria-hidden="true" /> : <Store size={13} aria-hidden="true" />}>
          {liveRide ? t("schedule.courierLive", { eta: formatDuration(eta, locale) }) : ts(`fulfilment.${o.fulfilment}`)}
        </Tag>
      </div>
    </TimelineRow>
  );
}
