"use client";

/**
 * A ticking "now" for the overview (greeting, ETA countdowns, the "Now" line in the schedule).
 * One shared 1-second timer while anything is subscribed. During SSR and hydration it returns
 * `null`, so time-dependent text never causes a hydration mismatch.
 */
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    current = Date.now();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function read(stepMs: number): number {
  // No ticker running (first mount, or coming back to the page later): don't render a stale "now".
  if (timer === undefined && Date.now() - current >= 1000) current = Date.now();
  return current - (current % stepMs);
}

const serverSnapshot = () => null;

/** Current time in ms, rounded down to `stepMs` (re-renders only when that value changes). */
export function useNow(stepMs = 60_000): number | null {
  return useSyncExternalStore(subscribe, () => read(stepMs), serverSnapshot);
}

/** Local midnight of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight of the next day (calendar-safe, no fixed 24 h). */
export function nextDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export type GreetingKey = "morning" | "afternoon" | "evening" | "hello";

/** 05–11 morning, 12–17 afternoon, 18–22 evening, otherwise a plain hello. */
export function greetingKey(ms: number): GreetingKey {
  const hour = new Date(ms).getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "hello";
}

/** (value − previous) / previous, or null when there is nothing to compare with. */
export function ratioDelta(value: number, previous: number): number | null {
  return previous > 0 ? (value - previous) / previous : null;
}

/** Minutes until `iso` from `now` (rounded up, like the app's ETA). */
export function minutesLeft(iso: string, now: number): number {
  return Math.ceil((new Date(iso).getTime() - now) / 60_000);
}
