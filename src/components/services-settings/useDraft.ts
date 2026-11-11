"use client";

import { useCallback, useEffect, useState } from "react";

/** Structural equality for plain data (objects, arrays, primitives). Key order doesn't matter. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  const ak = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const bk = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export type Draft<T> = {
  /** The editable copy (undefined until the base data has loaded). */
  draft: T | undefined;
  /** The last saved / loaded value the draft is compared with. */
  base: T | undefined;
  setDraft: (next: T | ((current: T) => T)) => void;
  /** Throw away the edits. */
  reset: () => void;
  /**
   * After a successful save: treat the draft as saved right away, so the save bar hides without
   * waiting for the refetch (the refetched data replaces it later). Pass `update` to commit only
   * part of it (e.g. one row saved from a dialog) or to adjust the saved value (new ids).
   */
  commit: (update?: (current: { base: T; draft: T }) => { base: T; draft: T }) => void;
  dirty: boolean;
};

type DraftState<T> = {
  /** The last `base` argument seen (identity), to notice refetches. */
  source: T | undefined;
  /** What the draft is compared with (the source, or a just-committed value). */
  base: T | undefined;
  draft: T | undefined;
};

/**
 * Form state with dirty-state detection against server data.
 *   const { draft, setDraft, dirty, reset, commit } = useDraft(baseFromQuery, equals);
 * - When the base changes (refetch after a save, another mutation…) and the draft had no edits,
 *   the draft follows it. Unsaved edits are kept.
 * - `base` should be memoised (a new object only when the data changed).
 */
export function useDraft<T>(base: T | undefined, equals: (a: T, b: T) => boolean = deepEqual): Draft<T> {
  const [state, setState] = useState<DraftState<T>>({ source: base, base, draft: base });

  let current = state;
  if (state.source !== base) {
    // Adjusting state while rendering (React docs: "storing information from previous renders").
    const clean = state.draft === undefined || state.base === undefined || equals(state.draft, state.base);
    current = { source: base, base, draft: clean ? base : state.draft };
    setState(current);
  }

  const setDraft = useCallback((next: T | ((value: T) => T)) => {
    setState((s) => {
      if (s.draft === undefined) return s;
      const value = typeof next === "function" ? (next as (value: T) => T)(s.draft) : next;
      return { ...s, draft: value };
    });
  }, []);

  const reset = useCallback(() => setState((s) => ({ ...s, draft: s.base })), []);

  const commit = useCallback(
    (update?: (current: { base: T; draft: T }) => { base: T; draft: T }) =>
      setState((s) => {
        if (s.draft === undefined || s.base === undefined) return s;
        const next = update ? update({ base: s.base, draft: s.draft }) : { base: s.draft, draft: s.draft };
        return { ...s, base: next.base, draft: next.draft };
      }),
    [],
  );

  const dirty = current.draft !== undefined && current.base !== undefined && !equals(current.draft, current.base);
  return { draft: current.draft, base: current.base, setDraft, reset, commit, dirty };
}

/**
 * Warns before unsaved edits are lost: on reload / tab close (browser prompt) and on clicks on
 * links that leave the current page (in-page `?tab=` links are allowed).
 */
export function useUnsavedGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need returnValue set.
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
