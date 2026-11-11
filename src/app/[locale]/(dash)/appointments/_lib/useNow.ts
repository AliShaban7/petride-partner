"use client";

import { useSyncExternalStore } from "react";

/*
 * A shared "now" clock for the appointments page. It ticks every 30 s while something is
 * subscribed, and is 0 during the server render and hydration (so nothing time-dependent is
 * rendered on the server and there is no hydration mismatch). Callers treat 0 as "not ready".
 */

const TICK_MS = 30_000;
let current = 0;
let timer: number | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    timer = window.setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  if (current === 0) current = Date.now();
  return current;
}

const getServerSnapshot = () => 0;

/** Current time in ms (0 until the client has hydrated). Re-renders every 30 s. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
