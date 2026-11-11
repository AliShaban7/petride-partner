"use client";

/**
 * Tiny data layer for Client Components (no react-query needed):
 *
 *   const { data, error, isLoading, refetch } = useApiQuery(["appointments", query], (api) => api.listAppointments(query));
 *   const confirm = useApiMutation((api, id: string) => api.confirmAppointment(id));
 *   await confirm.mutate(id);   // then every query refetches (or only `invalidates` tags)
 *
 * - The first key element is the resource tag ("appointments", "orders", "stats" …) used by
 *   `invalidate(tag)`. The whole key (JSON) identifies the request.
 * - Results are cached per partner + locale + key, so going back to a page shows the last data
 *   instantly while it refreshes (`isRefreshing`).
 * - `refreshMs` polls (live rides: 15 000).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useLocale } from "@/lib/i18n/client";

import type { PartnerApi } from "./partner-api";
import { usePartnerApi } from "./provider";
import { ApiError } from "./types";

export type ResourceTag =
  | "partner"
  | "services"
  | "products"
  | "appointments"
  | "rides"
  | "clients"
  | "pets"
  | "orders"
  | "reviews"
  | "notifications"
  | "stats"
  | "overview"
  | (string & {});

// ---- Invalidation bus --------------------------------------------------------------------------------

type Listener = (tags: readonly string[] | null) => void;
const listeners = new Set<Listener>();

/** Refetch every mounted query whose tag is in `tags` (no argument = everything). */
export function invalidate(tags?: ResourceTag | readonly ResourceTag[]): void {
  const list = tags === undefined ? null : Array.isArray(tags) ? tags : [tags as string];
  for (const listener of listeners) listener(list);
}

// ---- Query cache (external store: effects update it, components read it via useSyncExternalStore) ----

type Entry = { data?: unknown; error?: Error; inFlight: boolean; requestId: number };

const entries = new Map<string, Entry>();
const storeListeners = new Set<() => void>();

function setEntry(key: string, entry: Entry) {
  entries.set(key, entry);
  for (const l of storeListeners) l();
}

function subscribeStore(listener: () => void) {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

/** Starts a request for `key`; the latest request wins. */
function runQuery(key: string, run: () => Promise<unknown>) {
  const prev = entries.get(key);
  const requestId = (prev?.requestId ?? 0) + 1;
  setEntry(key, { data: prev?.data, error: prev?.error, inFlight: true, requestId });
  run().then(
    (data) => {
      if (entries.get(key)?.requestId !== requestId) return;
      setEntry(key, { data, error: undefined, inFlight: false, requestId });
    },
    (err: unknown) => {
      if (entries.get(key)?.requestId !== requestId) return;
      const error = err instanceof Error ? err : new ApiError("unknown", String(err));
      setEntry(key, { data: entries.get(key)?.data, error, inFlight: false, requestId });
    },
  );
}

// ---- useApiQuery ------------------------------------------------------------------------------------

export type QueryResult<T> = {
  data: T | undefined;
  /** Last error (with `data` still set when a refetch failed). */
  error: Error | undefined;
  /** First load with nothing to show yet → render a skeleton. */
  isLoading: boolean;
  /** Refetching while showing previous data. */
  isRefreshing: boolean;
  status: "loading" | "error" | "success";
  refetch: () => void;
};

export type QueryOptions = {
  /** Skip the request while false (e.g. waiting for an id). */
  enabled?: boolean;
  /** Poll every N ms while mounted. */
  refreshMs?: number;
};

export function useApiQuery<T>(
  key: readonly [ResourceTag, ...unknown[]],
  fetcher: (api: PartnerApi) => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const api = usePartnerApi();
  const locale = useLocale();
  const { enabled = true, refreshMs } = options;
  const cacheKey = `${api.partnerId}|${locale}|${JSON.stringify(key)}`;
  const tag = String(key[0]);

  const entry = useSyncExternalStore(
    subscribeStore,
    () => entries.get(cacheKey),
    () => undefined,
  );
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(() => runQuery(cacheKey, () => fetcherRef.current(api)), [api, cacheKey]);

  // Initial load + whenever the key changes (cached data shows meanwhile).
  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // Invalidation
  useEffect(() => {
    if (!enabled) return;
    const listener: Listener = (tags) => {
      if (tags === null || tags.includes(tag)) load();
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [enabled, load, tag]);

  // Polling
  useEffect(() => {
    if (!enabled || !refreshMs) return;
    const timer = window.setInterval(load, refreshMs);
    return () => window.clearInterval(timer);
  }, [enabled, refreshMs, load]);

  const data = entry?.data as T | undefined;
  const error = entry?.error;
  const status: QueryResult<T>["status"] = error && data === undefined ? "error" : data === undefined ? "loading" : "success";
  return {
    data,
    error,
    isLoading: enabled && data === undefined && !error,
    isRefreshing: Boolean(entry?.inFlight) && data !== undefined,
    status,
    refetch: load,
  };
}

// ---- useApiMutation ---------------------------------------------------------------------------------

export type MutationResult<A extends unknown[], R> = {
  /** Runs the mutation. Resolves with the result, or `undefined` when it failed (see `error`). */
  mutate: (...args: A) => Promise<R | undefined>;
  /** Same, but rethrows the error (for try/catch flows). */
  mutateAsync: (...args: A) => Promise<R>;
  isPending: boolean;
  error: Error | undefined;
  reset: () => void;
};

export type MutationOptions<R> = {
  /** Tags to refetch after success (default: everything — data is in memory, so it is cheap). */
  invalidates?: readonly ResourceTag[];
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
};

export function useApiMutation<A extends unknown[], R>(
  fn: (api: PartnerApi, ...args: A) => Promise<R>,
  options: MutationOptions<R> = {},
): MutationResult<A, R> {
  const api = usePartnerApi();
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const fnRef = useRef(fn);
  const optionsRef = useRef(options);
  useEffect(() => {
    fnRef.current = fn;
    optionsRef.current = options;
  });

  const mutateAsync = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(undefined);
      try {
        const result = await fnRef.current(api, ...args);
        invalidate(optionsRef.current.invalidates);
        optionsRef.current.onSuccess?.(result);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new ApiError("unknown", String(err));
        setError(e);
        optionsRef.current.onError?.(e);
        throw e;
      } finally {
        setPending(false);
      }
    },
    [api],
  );

  const mutate = useCallback(
    async (...args: A) => {
      try {
        return await mutateAsync(...args);
      } catch {
        return undefined;
      }
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error, reset: () => setError(undefined) };
}

/** `ApiError` code for copy lookup: t(`errors.${errorCode(error)}`) in the "common" namespace. */
export function errorCode(error: unknown): ApiError["code"] {
  return error instanceof ApiError ? error.code : "unknown";
}
