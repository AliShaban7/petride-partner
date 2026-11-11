/**
 * Order "stages" for the Orders page. The API knows six order statuses; partners think in stages,
 * which add one derived state: a courier order that is `ready` while the PetRide courier is driving
 * it to the customer is "on the way". Everything here is pure (no React).
 */
import type { PartnerApi } from "@/lib/api/partner-api";
import type { Fulfilment, Order, OrderSort, OrderStatus, Paged } from "@/lib/api/types";

export const ORDER_TABS = ["all", "new", "preparing", "ready", "on_the_way", "done", "cancelled"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export type Stage = Exclude<OrderTab, "all">;

/** Kanban columns, left to right. */
export const BOARD_STAGES: readonly Stage[] = ["new", "preparing", "ready", "on_the_way", "done", "cancelled"];

/** Tabs whose count means "work waiting for you" (coral badge); the others get a neutral count. */
export const ATTENTION_TABS: readonly OrderTab[] = ["new", "preparing", "ready"];

export function isOrderTab(value: string | null | undefined): value is OrderTab {
  return (ORDER_TABS as readonly string[]).includes(value ?? "");
}

export type AdvanceStatus = Exclude<OrderStatus, "new" | "cancelled">;

export const isCourier = (o: Pick<Order, "fulfilment">) => o.fulfilment === "petride_courier";

/** The last status of an order's flow: delivered (courier) or picked_up (pickup). */
export function finalStatusOf(o: Pick<Order, "fulfilment">): "delivered" | "picked_up" {
  return isCourier(o) ? "delivered" : "picked_up";
}

/** The courier has the order: the ride is driving to the customer (or already got there). */
function courierHasIt(o: Order): boolean {
  const s = o.courierRide?.status;
  return s === "intrip" || s === "completed";
}

/**
 * The shop can close a courier order only once the courier has it. A cancelled courier ride does
 * NOT mean the parcel reached the customer, so it never unlocks "Delivered" (the shop can still
 * cancel the order; re-booking a courier needs an API method, see the report).
 */
const courierReleased = courierHasIt;

export function stageOf(o: Order): Stage {
  switch (o.status) {
    case "new":
    case "preparing":
      return o.status;
    case "ready":
      return isCourier(o) && courierHasIt(o) ? "on_the_way" : "ready";
    case "delivered":
    case "picked_up":
      return "done";
    case "cancelled":
      return "cancelled";
  }
}

const RANK: Record<OrderStatus, number> = { new: 0, preparing: 1, ready: 2, delivered: 3, picked_up: 3, cancelled: -1 };

export const canCancel = (o: Pick<Order, "status">) => o.status === "new" || o.status === "preparing" || o.status === "ready";

/**
 * What moving `o` to `stage` means: the status to set, "cancel" (needs a reason first), or null
 * when the move isn't allowed. Only forward moves; "on the way" belongs to the courier; a courier
 * order can be marked delivered only once it is ready (the courier is booked on "ready").
 */
export function statusForStage(o: Order, stage: Stage): AdvanceStatus | "cancel" | null {
  if (stage === "on_the_way") return null;
  if (stage === "cancelled") return canCancel(o) ? "cancel" : null;
  if (o.status === "cancelled" || stage === "new") return null;
  const target: AdvanceStatus = stage === "done" ? finalStatusOf(o) : stage;
  if (RANK[target] <= RANK[o.status]) return null;
  if (target === "delivered" && (o.status !== "ready" || !courierReleased(o))) return null;
  return target;
}

/** Stage an order lands in right after its status becomes `status`. */
export function stageForStatus(status: AdvanceStatus): Stage {
  return status === "delivered" || status === "picked_up" ? "done" : status;
}

/** The one-tap next step (quick action), or null when the order waits for someone else. */
export function nextStatus(o: Order): AdvanceStatus | null {
  switch (o.status) {
    case "new":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      if (!isCourier(o)) return "picked_up";
      return o.courierRide?.status === "completed" ? "delivered" : null;
    default:
      return null;
  }
}

/** Key in orders.actions for the button that sets `status` on `o`. */
export function actionKey(o: Pick<Order, "fulfilment">, status: AdvanceStatus) {
  switch (status) {
    case "preparing":
      return "actions.toPreparing" as const;
    case "ready":
      return isCourier(o) ? ("actions.toReadyCourier" as const) : ("actions.toReady" as const);
    case "picked_up":
      return "actions.toPickedUp" as const;
    case "delivered":
      return "actions.toDelivered" as const;
  }
}

// ---- Fetching ---------------------------------------------------------------------------------------

export type OrderFilters = { search?: string; fulfilment?: Fulfilment; sort: OrderSort };

const TAB_STATUSES: Record<OrderTab, OrderStatus[] | undefined> = {
  all: undefined,
  new: ["new"],
  preparing: ["preparing"],
  ready: ["ready"],
  on_the_way: ["ready"],
  done: ["delivered", "picked_up"],
  cancelled: ["cancelled"],
};

/** Ready orders are few (they leave the shop within the hour), so one page holds all of them. */
const ALL_READY = 200;

function paginate<T>(items: T[], page: number, pageSize: number): Paged<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), total: items.length, page: current, pageSize, pageCount };
}

function sortOrders(items: Order[], sort: OrderSort): Order[] {
  const time = (o: Order) => new Date(o.createdAt).getTime();
  return [...items].sort((a, b) => (sort === "total_desc" ? b.totalAZN - a.totalAZN : sort === "created_asc" ? time(a) - time(b) : time(b) - time(a)));
}

/** One page of the table for a tab. "Ready" and "On the way" split the ready orders on the client. */
export async function fetchOrderPage(api: PartnerApi, tab: OrderTab, filters: OrderFilters, page: number, pageSize: number): Promise<Paged<Order>> {
  if (tab === "ready" || tab === "on_the_way") {
    const all = await api.listOrders({ ...filters, status: ["ready"], page: 1, pageSize: ALL_READY });
    return paginate(sortOrders(all.items.filter((o) => stageOf(o) === tab), filters.sort), page, pageSize);
  }
  return api.listOrders({ ...filters, status: TAB_STATUSES[tab], page, pageSize });
}

export type OrderCounts = Record<OrderTab, number>;

/** Counts for every tab with the current search / delivery filter. */
export async function fetchOrderCounts(api: PartnerApi, filters: OrderFilters): Promise<OrderCounts> {
  const base = { search: filters.search, fulfilment: filters.fulfilment, pageSize: 1 };
  const total = (status?: OrderStatus[]) => api.listOrders({ ...base, status }).then((p) => p.total);
  const [all, fresh, preparing, ready, done, cancelled] = await Promise.all([
    total(),
    total(["new"]),
    total(["preparing"]),
    api.listOrders({ ...base, status: ["ready"], pageSize: ALL_READY }),
    total(["delivered", "picked_up"]),
    total(["cancelled"]),
  ]);
  const onTheWay = ready.items.filter((o) => stageOf(o) === "on_the_way").length;
  return { all, new: fresh, preparing, ready: ready.total - onTheWay, on_the_way: onTheWay, done, cancelled };
}

/** Orders are closed within a few days of being placed; older ones can't have been closed today. */
const CLOSED_LOOKBACK_DAYS = 7;

/**
 * Kanban data: every open order (oldest first) plus the orders handed over or cancelled TODAY.
 * `listOrders({ from })` filters on `createdAt`, so this fetches the last week's closed orders and
 * keeps the ones whose last change (`updatedAt`) is today; an order placed yesterday and handed
 * over this morning belongs in today's column.
 */
export async function fetchBoard(api: PartnerApi, filters: Omit<OrderFilters, "sort">, todayStartISO: string): Promise<Order[]> {
  const todayStart = new Date(todayStartISO);
  const lookback = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() - CLOSED_LOOKBACK_DAYS).toISOString();
  const [open, closed] = await Promise.all([
    api.listOrders({ ...filters, status: ["new", "preparing", "ready"], sort: "created_asc", pageSize: ALL_READY }),
    api.listOrders({ ...filters, status: ["delivered", "picked_up", "cancelled"], from: lookback, sort: "created_desc", pageSize: 1000 }),
  ]);
  const since = todayStart.getTime();
  const closedToday = closed.items
    .filter((o) => new Date(o.updatedAt).getTime() >= since)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return [...open.items, ...closedToday];
}

/** "Dry cat food · 2 kg and 2 more" for tables and cards. */
export function itemsSummary(o: Order, more: (first: string, count: number) => string): string {
  const [first, ...rest] = o.items;
  if (!first) return "";
  const head = first.qty > 1 ? `${first.qty} × ${first.name}` : first.name;
  return rest.length ? more(head, rest.length) : head;
}
