"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import type { AppointmentQuery, AppointmentStatus } from "@/lib/api/types";

import { isRangePreset, parseIsoDay, type RangePreset } from "./time";

/*
 * Every filter of the page lives in the URL so back/forward, reload and sharing keep it:
 *   view=list|week|day · range=<preset> · from/to=YYYY-MM-DD (custom) · date=YYYY-MM-DD (calendar)
 *   status=requested,confirmed… · service=<service id>|cat:vet · q=… · page=2 · sort=start_desc · id=apt-12
 * Links from other screens: ?status=requested (top-bar badge), ?id=apt-12 (notifications), ?q=A-1042 (search).
 * Updates use history.replaceState (Next syncs useSearchParams with it), so no server round trip.
 */

export const VIEWS = ["list", "week", "day"] as const;
export type ViewMode = (typeof VIEWS)[number];

/** Status filter chips. `cancelled` covers cancelled + declined. */
export const STATUS_CHIPS = ["requested", "confirmed", "checked_in", "completed", "no_show", "cancelled"] as const;
export type StatusChip = (typeof STATUS_CHIPS)[number];

export type ListSort = "start_asc" | "start_desc";

export type UrlState = {
  view: ViewMode;
  /** Effective range preset (explicit `range`, or the default for the current filters). */
  range: RangePreset;
  /** True when `range` came from the URL (not a default). */
  rangeExplicit: boolean;
  from?: string;
  to?: string;
  /** Calendar anchor (YYYY-MM-DD); undefined = today. */
  date?: string;
  status: StatusChip[];
  /** "" (all) · "cat:vet" · a service id. */
  service: string;
  q: string;
  page: number;
  sort: ListSort;
  id?: string;
};

export type UrlPatch = Partial<Omit<UrlState, "rangeExplicit">>;

function parse(params: URLSearchParams): UrlState {
  const viewParam = params.get("view");
  const view: ViewMode = (VIEWS as readonly string[]).includes(viewParam ?? "") ? (viewParam as ViewMode) : "list";
  const status = (params.get("status") ?? "")
    .split(",")
    .map((s) => (s === "declined" ? "cancelled" : s))
    .filter((s, i, all): s is StatusChip => (STATUS_CHIPS as readonly string[]).includes(s) && all.indexOf(s) === i);
  const q = params.get("q")?.trim() ?? "";
  const rangeParam = params.get("range");
  const rangeExplicit = isRangePreset(rangeParam);
  // Defaults: a search looks everywhere; the "new requests" badge looks at everything ahead.
  const range: RangePreset = rangeExplicit
    ? (rangeParam as RangePreset)
    : q
      ? "all"
      : status.length === 1 && status[0] === "requested"
        ? "upcoming"
        : "next7";
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const date = params.get("date");
  return {
    view,
    range,
    rangeExplicit,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    date: parseIsoDay(date) !== null ? (date as string) : undefined,
    status,
    service: params.get("service") ?? "",
    q,
    page,
    sort: params.get("sort") === "start_desc" ? "start_desc" : "start_asc",
    id: params.get("id") ?? undefined,
  };
}

function serialize(state: UrlState): string {
  const out = new URLSearchParams();
  if (state.view !== "list") out.set("view", state.view);
  if (state.rangeExplicit) out.set("range", state.range);
  if (state.range === "custom") {
    if (state.from) out.set("from", state.from);
    if (state.to) out.set("to", state.to);
  }
  if (state.date) out.set("date", state.date);
  if (state.status.length) out.set("status", state.status.join(","));
  if (state.service) out.set("service", state.service);
  if (state.q) out.set("q", state.q);
  if (state.page > 1) out.set("page", String(state.page));
  if (state.sort !== "start_asc") out.set("sort", state.sort);
  if (state.id) out.set("id", state.id);
  // Keep dev switches (?mock=…) while filtering.
  const mock = new URLSearchParams(window.location.search).get("mock");
  if (mock) out.set("mock", mock);
  return out.toString();
}

const FILTER_KEYS: (keyof UrlPatch)[] = ["range", "from", "to", "status", "service", "q", "view", "date", "sort"];

/** The query string as the browser has it right now (normalised like URLSearchParams#toString). */
function liveQuery(fallback: string): string {
  return typeof window === "undefined" ? fallback : new URLSearchParams(window.location.search).toString();
}

/**
 * URL-backed page state. `update` merges a patch (filter changes reset the page to 1), shows it at
 * once and writes it to the URL with history.replaceState. Next syncs useSearchParams with that a
 * little later (in a transition), so the page renders from its own copy and only adopts the URL
 * when it changes from outside: a link (?id= from a notification, ?q= from global search) or
 * back / forward.
 */
export function useUrlState(): [UrlState, (patch: UrlPatch) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const key = params.toString();
  const [state, setState] = useState(() => parse(new URLSearchParams(key)));
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    // Ignore late echoes of our own earlier writes: adopt only what the address bar shows now.
    if (liveQuery(key) === key) setState(parse(new URLSearchParams(key)));
  }

  const update = useCallback(
    (patch: UrlPatch) => {
      const current = parse(new URLSearchParams(window.location.search));
      const next: UrlState = { ...current, ...patch, range: patch.range ?? current.range };
      // `range: undefined` goes back to the default range; any other value pins it in the URL.
      if ("range" in patch) next.rangeExplicit = patch.range !== undefined;
      if (!("page" in patch) && FILTER_KEYS.some((k) => k in patch)) next.page = 1;
      const qs = serialize(next);
      window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
      // Re-parse so defaults that depend on other filters (the range for a search) are applied.
      setState(parse(new URLSearchParams(qs)));
    },
    [pathname],
  );

  return [state, update];
}

/** Status chips → API statuses. */
export function chipStatuses(chips: StatusChip[]): AppointmentStatus[] {
  return chips.flatMap((c) => (c === "cancelled" ? (["cancelled", "declined"] as AppointmentStatus[]) : [c]));
}

/** Service filter → API query fields. */
export function serviceFilter(service: string): Pick<AppointmentQuery, "serviceId" | "category"> {
  if (!service) return {};
  if (service.startsWith("cat:")) {
    const category = service.slice(4);
    if (category === "vet" || category === "groom" || category === "hotel") return { category: [category] };
    return {};
  }
  return { serviceId: service };
}
