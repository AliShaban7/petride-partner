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

/** Keeps `mock=…` (dev switch) on links between the clients pages. */
export function useMockParam(): Record<string, string> {
  const mock = useSearchParams().get("mock");
  return mock ? { mock } : {};
}
