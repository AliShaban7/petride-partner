"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Patches the current query string (filters, tab, page, drawer id live in the URL so back/forward,
 * sharing and the global search all work). Uses the native History API, which Next.js syncs into
 * useSearchParams without a server round trip, so filters and tabs react instantly.
 * `null`/"" removes a key; unknown keys (e.g. the `mock` dev switch) stay.
 */
export function useQueryUpdater() {
  return useCallback((patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);
}

/** Marks history entries pushed by `useRecordParam().open`. */
const RECORD_MARK = "petrideRecord";

function hasRecordMark(state: unknown): boolean {
  return Boolean(state && typeof state === "object" && RECORD_MARK in state);
}

/** Same path and the same query keys / values (order ignored). */
function sameLocation(a: URL, b: URL): boolean {
  if (a.origin !== b.origin || a.pathname !== b.pathname) return false;
  const norm = (u: URL) => [...u.searchParams].map(([k, v]) => `${k}=${v}`).sort().join("&");
  return norm(a) === norm(b);
}

/** The Navigation API (Chromium, Safari 26+, Firefox 147+); not in TypeScript's DOM lib yet. */
type NavigationLike = { currentEntry: { index: number } | null; entries(): { url: string | null; sameDocument: boolean }[] };

/**
 * True when the history entry right before this one is `target` in this same document (an in-app
 * link such as a notification, not a typed or reloaded URL, where Back would reload the page).
 * Navigation API only; elsewhere false.
 */
function previousEntryIs(target: URL): boolean {
  const nav = (window as Window & { navigation?: NavigationLike }).navigation;
  const index = nav?.currentEntry?.index ?? -1;
  if (!nav || index < 1) return false;
  const previous = nav.entries()[index - 1];
  return Boolean(previous?.url && previous.sameDocument) && sameLocation(new URL(previous.url as string), target);
}

/**
 * A record overlay in the URL (`?id=…`). `open` pushes a new history entry, so Back closes the
 * overlay instead of leaving the page. While an id is already set (a double click, or a second
 * owner clicked before the modal showed) it swaps the id in place, so one close / Back still
 * leaves. `close` steps back over the pushed entry; when the page was opened with `?id=` from a
 * link it steps back too if the entry before is the same list (a notification opened from this
 * page), otherwise it just removes the key.
 */
export function useRecordParam() {
  const update = useQueryUpdater();
  const open = useCallback((id: string) => {
    const next = new URLSearchParams(window.location.search);
    const current = next.get("id");
    if (current === id) return;
    next.set("id", id);
    const url = `${window.location.pathname}?${next.toString()}`;
    if (current) window.history.replaceState(hasRecordMark(window.history.state) ? { [RECORD_MARK]: true } : null, "", url);
    else window.history.pushState({ [RECORD_MARK]: true }, "", url);
  }, []);
  const close = useCallback(() => {
    if (hasRecordMark(window.history.state)) {
      window.history.back();
      return;
    }
    const target = new URL(window.location.href);
    target.searchParams.delete("id");
    if (previousEntryIs(target)) window.history.back();
    else update({ id: null });
  }, [update]);
  return { open, close };
}

/** Keeps `mock=…` (dev switch) on links between the clients pages. */
export function useMockParam(): Record<string, string> {
  const mock = useSearchParams().get("mock");
  return mock ? { mock } : {};
}
