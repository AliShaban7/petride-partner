"use client";

import { Ban, Car, MapPin, Phone, Printer, Store, UserRound } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import {
  Button,
  ButtonLink,
  DetailList,
  Drawer,
  ErrorState,
  ProgressBar,
  Skeleton,
  SkeletonText,
  StatusPill,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  buttonClasses,
} from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Order, Ride } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDistance, formatMoney, formatNumber, formatPhone, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

import { FulfilmentTag, RideStatus, TimeAgo } from "./bits";
import { useNow } from "./hooks";
import { canCancel, isCourier, nextStatus, actionKey, stageOf, statusForStage, type AdvanceStatus, type Stage } from "./model";
import { CancelOrderDialog } from "./OrderDialogs";
import { OrderReceiptDialog } from "./OrderReceipt";
import { useOrderActions } from "./useOrderActions";

/** Primary step offered in the drawer: the quick next step, or "delivered" once the courier has the order. */
function primaryStep(o: Order): AdvanceStatus | null {
  const next = nextStatus(o);
  if (next) return next;
  const done = statusForStage(o, "done");
  return done && done !== "cancel" ? done : null;
}

/**
 * Order details (`/orders?id=ord-12`): progress, courier, basket, customer, history, and the
 * actions that are valid for the current status. Bottom sheet on phones, side panel from 640px.
 */
export function OrderDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useT("orders");
  const q = useApiQuery(["orders", "detail", id], (api) => api.getOrder(id ?? ""), { enabled: Boolean(id), refreshMs: 15_000 });
  const actions = useOrderActions();
  const [cancelFor, setCancelFor] = useState<Order | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const order = id && q.data?.id === id ? q.data : undefined;
  const step = order ? primaryStep(order) : null;

  return (
    <>
      <Drawer
        open={Boolean(id)}
        onClose={onClose}
        size="md"
        title={order ? t("drawer.title", { code: order.code }) : t("drawer.loadingTitle")}
        description={order ? order.clientName : undefined}
        footer={
          order ? (
            <>
              {canCancel(order) ? (
                <Button variant="ghost" className="mr-auto text-error-text" leftIcon={<Ban size={18} aria-hidden="true" />} onClick={() => setCancelFor(order)}>
                  {t("actions.cancel")}
                </Button>
              ) : null}
              {/* No sales receipt for an order that was never sold. */}
              {order.status !== "cancelled" ? (
                <Button variant="outline" leftIcon={<Printer size={18} aria-hidden="true" />} onClick={() => setReceiptOpen(true)}>
                  {t("actions.receipt")}
                </Button>
              ) : null}
              {step ? (
                <Button loading={actions.busyId === order.id} onClick={() => void actions.advance(order, step)}>
                  {t(actionKey(order, step))}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {order ? (
          <OrderDetails order={order} />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} compact />
        ) : (
          <div aria-busy="true" className="space-y-5 pt-2">
            <Skeleton className="h-7 w-40 rounded-chip" />
            <Skeleton className="h-2 w-full" />
            <SkeletonText lines={4} />
            <Skeleton className="h-32 w-full rounded-card" />
          </div>
        )}
      </Drawer>
      <CancelOrderDialog
        key={cancelFor?.id ?? "none"}
        order={cancelFor}
        loading={actions.cancelling}
        onClose={() => setCancelFor(null)}
        onConfirm={async (o, reason) => {
          if (await actions.cancel(o, reason)) setCancelFor(null);
        }}
      />
      {order ? <OrderReceiptDialog order={order} open={receiptOpen} onClose={() => setReceiptOpen(false)} /> : null}
    </>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("border-t border-border pt-5", className)}>
      <h3 id={id} className="mb-3 font-display text-title font-extrabold text-fg">
        {title}
      </h3>
      {children}
    </section>
  );
}

function OrderDetails({ order }: { order: Order }) {
  const t = useT("orders");
  const ts = useT("status");
  const locale = useLocale();
  const now = useNow();
  const courier = isCourier(order);
  const money = (n: number) => formatMoney(n, locale);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill kind="order" status={order.status} />
        <FulfilmentTag fulfilment={order.fulfilment} />
        <StatusPill kind="payment" status={order.paid ? "paid" : "unpaid"} size="sm" />
        <TimeAgo value={order.createdAt} now={now} className="text-meta text-fg-secondary" />
      </div>

      {order.status === "cancelled" ? (
        <div className="rounded-card bg-neutral-bg p-4">
          <p className="text-meta font-semibold text-neutral-text">{t("drawer.reason")}</p>
          <p className="mt-1 text-body text-fg">{order.reason ?? ts("order.cancelled")}</p>
        </div>
      ) : (
        <OrderProgress order={order} />
      )}

      {courier && order.status !== "cancelled" ? <CourierBlock order={order} /> : null}

      <Section title={t("drawer.items")}>
        <Table caption={t("drawer.itemsCaption", { code: order.code })} className="text-body-sm">
          <THead>
            <Tr>
              <Th>{t("drawer.product")}</Th>
              <Th align="end">{t("drawer.qty")}</Th>
              <Th align="end" className="hidden sm:table-cell">
                {t("drawer.unitPrice")}
              </Th>
              <Th align="end">{t("drawer.lineTotal")}</Th>
            </Tr>
          </THead>
          <TBody>
            {order.items.map((item) => (
              <Tr key={item.productId}>
                <Th scope="row" className="min-w-36 font-medium">
                  {item.name}
                  <span className="mt-0.5 block text-meta font-normal text-fg-secondary sm:hidden">{money(item.unitPriceAZN)}</span>
                </Th>
                <Td align="end" className="tabular">
                  {formatNumber(item.qty, locale)}
                </Td>
                <Td align="end" className="hidden tabular sm:table-cell">
                  {money(item.unitPriceAZN)}
                </Td>
                <Td align="end" className="whitespace-nowrap font-semibold tabular">
                  {money(item.totalAZN)}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        <dl className="mt-3 space-y-1.5 px-1 text-body-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fg-secondary">{t("drawer.subtotal")}</dt>
            <dd className="tabular">{money(order.subtotalAZN)}</dd>
          </div>
          {courier ? (
            <div className="flex justify-between gap-4">
              <dt className="text-fg-secondary">{t("drawer.deliveryFee")}</dt>
              <dd className="tabular">{order.deliveryFeeAZN > 0 ? money(order.deliveryFeeAZN) : t("drawer.free")}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-title font-bold">
            <dt>{t("drawer.total")}</dt>
            <dd className="font-display font-extrabold tabular">{money(order.totalAZN)}</dd>
          </div>
        </dl>
      </Section>

      <Section title={t("drawer.customer")}>
        <DetailList
          columns={2}
          items={[
            { label: t("drawer.customer"), value: order.clientName, icon: <UserRound size={14} aria-hidden="true" /> },
            {
              label: t("drawer.phone"),
              icon: <Phone size={14} aria-hidden="true" />,
              value: order.clientPhone ? (
                <a href={phoneHref(order.clientPhone)} className="font-medium text-primary underline-offset-4 hover:underline">
                  {formatPhone(order.clientPhone)}
                </a>
              ) : (
                "—"
              ),
            },
            ...(order.petNames.length ? [{ label: t("drawer.pets"), value: order.petNames.join(", ") }] : []),
            {
              label: courier ? t("drawer.address") : ts("fulfilment.pickup"),
              icon: courier ? <MapPin size={14} aria-hidden="true" /> : <Store size={14} aria-hidden="true" />,
              value: courier ? (order.deliveryAddress ?? "—") : t("drawer.pickupAtShop"),
            },
            {
              label: t("drawer.payment"),
              value: `${t(order.paymentMethod === "card" ? "drawer.card" : "drawer.cash")} · ${ts(order.paid ? "payment.paid" : "payment.unpaid")}`,
            },
          ]}
        />
        {order.clientNote ? (
          <div className="mt-4 rounded-card bg-soft-sand p-4">
            <p className="text-meta font-semibold text-fg-tertiary">{t("drawer.clientNote")}</p>
            <p className="mt-1 text-body text-fg">{order.clientNote}</p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {order.clientPhone ? (
            <a href={phoneHref(order.clientPhone)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Phone size={16} aria-hidden="true" />
              {t("actions.callCustomer")}
            </a>
          ) : null}
          <ButtonLink href={localizedHref(locale, ROUTES.clients, { id: order.clientId })} variant="outline" size="sm" leftIcon={<UserRound size={16} aria-hidden="true" />}>
            {t("actions.openClient")}
          </ButtonLink>
        </div>
      </Section>

      <Section title={t("drawer.timeline")}>
        <ol className="relative space-y-4 border-l-2 border-border pl-5">
          {order.history.map((h, i) => (
            <li key={`${h.status}-${i}`} className="relative">
              <span
                aria-hidden="true"
                className={cn("absolute -left-[1.6rem] top-1 size-3 rounded-full ring-4 ring-surface", i === order.history.length - 1 ? "bg-primary" : "bg-sage")}
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusPill kind="order" status={h.status} size="sm" />
                <span className="text-meta text-fg-secondary">{t.dynamic(`drawer.by.${h.by}`)}</span>
              </div>
              <time dateTime={h.at} className="mt-1 block text-meta text-fg-secondary tabular">
                {formatDateTime(h.at, locale, new Date(now))}
              </time>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/** Step bar: New → Preparing → Ready → (On the way →) Delivered / Picked up. */
function OrderProgress({ order }: { order: Order }) {
  const t = useT("orders");
  const ts = useT("status");
  const steps: Stage[] = isCourier(order) ? ["new", "preparing", "ready", "on_the_way", "done"] : ["new", "preparing", "ready", "done"];
  const current = steps.indexOf(stageOf(order));
  const label = (s: Stage) => (s === "done" ? ts.dynamic(`order.${isCourier(order) ? "delivered" : "picked_up"}`) : t.dynamic(`board.columns.${s}`));
  return (
    <ol aria-label={t("drawer.progress")} className={cn("grid gap-1.5", steps.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="min-w-0">
            <div className={cn("h-1.5 rounded-chip transition-colors duration-500", state === "todo" ? "bg-progress-track" : state === "current" ? "bg-accent" : "bg-primary")} />
            <p className={cn("mt-1.5 text-caption font-semibold leading-tight", state === "todo" ? "text-fg-secondary" : "text-fg")}>{label(s)}</p>
            {state !== "todo" ? <span className="sr-only">, {t(state === "done" ? "drawer.stepDone" : "drawer.stepCurrent")}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function CourierBlock({ order }: { order: Order }) {
  const t = useT("orders");
  const locale = useLocale();
  const ride: Ride | undefined = order.courierRide;
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-card bg-soft-lilac p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="flex items-center gap-2 font-display text-title font-extrabold text-fg">
          <Car size={18} aria-hidden="true" />
          {t("drawer.courier")}
        </h3>
        {ride ? <RideStatus ride={ride} /> : null}
      </div>
      {!ride ? (
        <p className="mt-2 text-body-sm text-fg-tertiary">{t("drawer.courierNotBooked")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {ride.status === "intrip" ? <ProgressBar value={ride.progress} label={t("drawer.rideProgress")} /> : null}
          <p className="flex items-start gap-2 text-body-sm text-fg">
            <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-tertiary" />
            <span className="min-w-0">
              {ride.from.label} → {ride.to.address}
              <span className="block text-meta text-fg-tertiary">{formatDistance(ride.distanceKm, locale)}</span>
            </span>
          </p>
          {ride.driver ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-surface/80 p-3">
              <div className="min-w-0 text-body-sm">
                <p className="font-semibold text-fg">{ride.driver.name}</p>
                <p className="text-meta text-fg-tertiary">
                  {ride.driver.car.model} · {ride.driver.car.color} · <span className="whitespace-nowrap font-semibold text-fg">{ride.driver.car.plate}</span>
                </p>
              </div>
              <a href={phoneHref(ride.driver.phone)} className={buttonClasses({ variant: "outline", size: "sm" })}>
                <Phone size={16} aria-hidden="true" />
                {t("actions.callDriver")}
              </a>
            </div>
          ) : ride.status !== "cancelled" && ride.status !== "completed" ? (
            <p className="text-body-sm text-fg-tertiary">{t("drawer.driverPending")}</p>
          ) : null}
          {ride.status === "completed" && order.status === "ready" ? <p className="text-body-sm font-semibold text-fg">{t("drawer.courierDoneHint")}</p> : null}
        </div>
      )}
    </section>
  );
}
