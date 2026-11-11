"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Filters live in the URL (shareable, back/forward-safe). `window.history.replaceState` keeps
 * Next's router in sync (useSearchParams updates) without a server round trip per keystroke.
 */
export function useUrlState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );
  const get = useCallback((key: string) => params.get(key) ?? "", [params]);
  return { get, set };
}

/** Text input bound to a URL param: types instantly, writes the param after a short pause. */
export function useDebouncedParam(value: string, write: (value: string) => void, delay = 300) {
  const [input, setInput] = useState(value);
  // Follow outside changes (global search, "Reset filters") without an effect.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setInput(value);
  }
  useEffect(() => {
    if (input === value) return;
    const timer = window.setTimeout(() => write(input.trim() ? input : ""), delay);
    return () => window.clearTimeout(timer);
  }, [input, value, write, delay]);
  return [input, setInput] as const;
}

/** Current time, ticking every `intervalMs` ("5 min ago" labels stay fresh). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Local midnight `offsetDays` from `now`, as ISO (stable through the day → stable query keys). */
export function dayStartISO(now: number, offsetDays = 0): string {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).toISOString();
}

const PHONE_QUERY = "(max-width: 639px)";

/** True below the `sm` breakpoint (client only; false during SSR). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
