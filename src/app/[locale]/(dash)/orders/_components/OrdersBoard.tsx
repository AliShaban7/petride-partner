"use client";

import { ArrowRightLeft, GripVertical } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

import { Button, ErrorState, IconButton, Skeleton, StatusPill, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Order, OrderStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { FulfilmentTag, RideStatus, TimeAgo } from "./bits";
import { dayStartISO, useNow } from "./hooks";
import {
  BOARD_STAGES,
  actionKey,
  fetchBoard,
  itemsSummary,
  nextStatus,
  stageForStatus,
  stageOf,
  statusForStage,
  type AdvanceStatus,
  type OrderFilters,
  type Stage,
} from "./model";
import { CancelOrderDialog, MoveOrderDialog } from "./OrderDialogs";
import { useOrderActions } from "./useOrderActions";

/** Column fills (text on soft fills is text-fg / text-fg-tertiary only). */
const COLUMN_TONE: Record<Stage, string> = {
  new: "bg-soft-peach",
  preparing: "bg-soft-sand",
  ready: "bg-soft-sky",
  on_the_way: "bg-soft-lilac",
  done: "bg-soft-mint",
  cancelled: "bg-surface-muted",
};

/** A move the UI shows right away, until the refetched order no longer has status `from`. */
type Pending = { stage: Stage; from: OrderStatus };

/**
 * Kanban: one column per stage. Drag a card to move it (only valid columns accept it), or press
 * "Move" on the card for the same choice in a dialog (keyboard and touch). Moves are optimistic.
 */
export function OrdersBoard({ filters, selectedId, onOpen }: { filters: OrderFilters; selectedId: string | null; onOpen: (o: Order) => void }) {
  const t = useT("orders");
  const now = useNow();
  const today = dayStartISO(now);
  const { toast } = useToast();
  const actions = useOrderActions();
  const query = useApiQuery(
    ["orders", "board", filters.search ?? "", filters.fulfilment ?? "", today],
    (api) => fetchBoard(api, { search: filters.search, fulfilment: filters.fulfilment }, today),
    { refreshMs: 30_000 },
  );
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [moveFor, setMoveFor] = useState<Order | null>(null);
  const [cancelFor, setCancelFor] = useState<Order | null>(null);
  /**
   * Card to focus once it re-mounts in its new column. Moving a card unmounts the button that
   * started the move (the "Move" dialog's opener or the next-step button), which would drop
   * keyboard focus on <body>.
   */
  const [focusId, setFocusId] = useState<string | null>(null);

  const orders = query.data;
  const stageFor = (o: Order): Stage => {
    const p = pending[o.id];
    return p && p.from === o.status ? p.stage : stageOf(o);
  };
  const columns = useMemo(() => {
    const map = new Map<Stage, Order[]>(BOARD_STAGES.map((s) => [s, []]));
    for (const o of orders ?? []) {
      const p = pending[o.id];
      map.get(p && p.from === o.status ? p.stage : stageOf(o))?.push(o);
    }
    return map;
  }, [orders, pending]);
  const dragging = dragId ? orders?.find((o) => o.id === dragId) : undefined;

  const drop = (id: string) =>
    setPending((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });

  const advance = async (order: Order, status: AdvanceStatus, refocus = false) => {
    setMoveFor(null);
    if (refocus) setFocusId(order.id);
    setPending((p) => ({ ...p, [order.id]: { stage: stageForStatus(status), from: order.status } }));
    if (!(await actions.advance(order, status))) drop(order.id);
  };

  const moveTo = (order: Order, stage: Stage) => {
    const target = statusForStage(order, stage);
    if (target === "cancel") return setCancelFor(order);
    if (target === null) {
      if (stage !== stageFor(order)) toast({ tone: "info", title: t("toast.notAllowed"), description: stage === "on_the_way" ? t("toast.courierMoves") : undefined });
      return;
    }
    void advance(order, target);
  };

  if (!orders) {
    if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;
    return (
      <div aria-busy="true" className="scrollbar-none relative -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        <span className="sr-only">{t("board.label")}</span>
        {BOARD_STAGES.map((s) => (
          <div key={s} className={cn("w-[min(17rem,82vw)] shrink-0 space-y-2.5 rounded-panel p-3", COLUMN_TONE[s])}>
            <Skeleton className="h-5 w-24 bg-surface/70" />
            <Skeleton className="h-28 w-full rounded-card bg-surface/70" />
            <Skeleton className="h-28 w-full rounded-card bg-surface/70" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-body-sm text-fg-secondary">{t("board.hint")}</p>
      {/* `relative`: absolutely positioned sr-only text inside must be clipped by this scroller, or it widens the page. */}
      <div
        role="group"
        aria-label={t("board.label")}
        aria-busy={query.isRefreshing || undefined}
        className="relative -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 sm:snap-none"
      >
        {BOARD_STAGES.map((stage) => {
          const list = columns.get(stage) ?? [];
          const accepts = dragging ? statusForStage(dragging, stage) !== null && stageFor(dragging) !== stage : false;
          return (
            <BoardColumn
              key={stage}
              stage={stage}
              orders={list}
              dragActive={Boolean(dragging)}
              accepts={accepts}
              over={overStage === stage}
              onDragOver={(e) => {
                if (!accepts) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStage !== stage) setOverStage(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage((s) => (s === stage ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverStage(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                const order = orders.find((o) => o.id === id);
                setDragId(null);
                if (order) moveTo(order, stage);
              }}
            >
              {list.map((o, i) => (
                <BoardCard
                  key={o.id}
                  order={o}
                  index={i}
                  now={now}
                  selected={selectedId === o.id}
                  busy={actions.busyId === o.id}
                  dragging={dragId === o.id}
                  onOpen={() => onOpen(o)}
                  onMove={() => setMoveFor(o)}
                  onNext={(status) => void advance(o, status, true)}
                  focusRequested={focusId === o.id}
                  onFocused={() => setFocusId(null)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", o.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(o.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                />
              ))}
            </BoardColumn>
          );
        })}
      </div>

      <MoveOrderDialog
        order={moveFor}
        onClose={() => setMoveFor(null)}
        onMove={(o, status) => void advance(o, status, true)}
        onCancel={(o) => {
          setMoveFor(null);
          setCancelFor(o);
        }}
      />
      <CancelOrderDialog
        key={cancelFor?.id ?? "none"}
        order={cancelFor}
        loading={actions.cancelling}
        onClose={() => setCancelFor(null)}
        onConfirm={async (o, reason) => {
          setPending((p) => ({ ...p, [o.id]: { stage: "cancelled", from: o.status } }));
          const ok = await actions.cancel(o, reason);
          if (ok) {
            setFocusId(o.id);
            setCancelFor(null);
          }
          else drop(o.id);
        }}
      />
    </div>
  );
}

function BoardColumn({
  stage,
  orders,
  dragActive,
  accepts,
  over,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  stage: Stage;
  orders: Order[];
  dragActive: boolean;
  accepts: boolean;
  over: boolean;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const t = useT("orders");
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex w-[min(17rem,82vw)] shrink-0 snap-start flex-col rounded-panel p-3 transition-[opacity,box-shadow] duration-200 lg:w-auto lg:min-w-[15rem] lg:flex-1",
        COLUMN_TONE[stage],
        dragActive && !accepts && "opacity-60",
        dragActive && accepts && "outline-2 outline-dashed outline-offset-2 outline-primary/50",
        over && "shadow-card-hover outline-primary",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 id={headingId} className="font-display text-title font-extrabold text-fg">
          {t.dynamic(`board.columns.${stage}`)}
        </h2>
        <span className="inline-flex min-w-7 items-center justify-center rounded-chip bg-surface/85 px-2 py-0.5 text-caption font-bold text-fg tabular">
          <span aria-hidden="true">{orders.length}</span>
          <span className="sr-only">{t.plural("board.count", orders.length)}</span>
        </span>
      </header>
      <p className="mb-3 px-1 text-meta text-fg-tertiary">{t.dynamic(`board.hints.${stage}`)}</p>
      {orders.length ? (
        <ul className="flex flex-col gap-2.5">{children}</ul>
      ) : (
        <p className={cn("flex min-h-24 items-center justify-center rounded-card border-2 border-dashed border-fg-tertiary/25 px-3 text-center text-meta text-fg-tertiary", over && "border-primary/60")}>
          {over ? t("board.dropHere") : t("board.empty")}
        </p>
      )}
    </section>
  );
}

function BoardCard({
  order,
  index,
  now,
  selected,
  busy,
  dragging,
  onOpen,
  onMove,
  onNext,
  onDragStart,
  onDragEnd,
  focusRequested,
  onFocused,
}: {
  order: Order;
  index: number;
  now: number;
  selected: boolean;
  busy: boolean;
  dragging: boolean;
  onOpen: () => void;
  onMove: () => void;
  onNext: (status: AdvanceStatus) => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  focusRequested: boolean;
  onFocused: () => void;
}) {
  const t = useT("orders");
  const locale = useLocale();
  const codeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!focusRequested) return;
    // Runs after the closing dialog's cleanup (passive unmounts run before mounts in a commit),
    // which tried to restore focus to its now-detached opener.
    codeButton.current?.focus();
    onFocused();
  }, [focusRequested, onFocused]);
  const step = nextStatus(order);
  const closed = order.status === "delivered" || order.status === "picked_up" || order.status === "cancelled";
  const ride = order.courierRide && !closed ? order.courierRide : undefined;
  return (
    <li
      draggable={!closed}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        onOpen();
      }}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        "group relative animate-fade-up rounded-card border bg-surface p-3.5 shadow-thumb transition-[box-shadow,transform,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        closed ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        selected ? "border-primary" : "border-border",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {!closed ? <GripVertical aria-hidden="true" size={16} className="-ml-1 shrink-0 text-fg-secondary/70" /> : null}
          <button ref={codeButton} type="button" onClick={onOpen} className="truncate text-body font-semibold text-fg underline-offset-4 hover:underline">
            {order.code}
          </button>
        </div>
        <TimeAgo value={order.createdAt} now={now} className="shrink-0 text-meta text-fg-secondary" />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="line-clamp-2 min-w-0 text-body-sm font-semibold text-fg">{order.clientName}</p>
        <span className="shrink-0 font-display text-title font-extrabold tabular text-fg">{formatMoney(order.totalAZN, locale)}</span>
      </div>
      <p className="line-clamp-2 text-meta text-fg-secondary">{itemsSummary(order, (first, count) => t("itemsMore", { first, count }))}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <FulfilmentTag fulfilment={order.fulfilment} />
        {ride ? <RideStatus ride={ride} /> : null}
        {order.status === "cancelled" ? <StatusPill kind="order" status="cancelled" size="sm" /> : null}
      </div>
      {!closed ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {step ? (
            <Button size="sm" variant={order.status === "new" ? "accent" : "secondary"} loading={busy} onClick={() => onNext(step)} className="min-w-0 flex-1">
              {t(actionKey(order, step))}
            </Button>
          ) : null}
          <IconButton label={t("actions.moveToLabel", { code: order.code })} icon={<ArrowRightLeft size={18} />} variant="outline" onClick={onMove} disabled={busy} />
        </div>
      ) : null}
    </li>
  );
}
