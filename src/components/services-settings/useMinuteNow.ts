"use client";

import { useSyncExternalStore } from "react";

const subscribeMinute = (cb: () => void) => {
  const id = window.setInterval(cb, 30_000);
  return () => window.clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);

/** "Now" to the minute, re-rendered as the minute changes; null during SSR (time-based UI renders on the client). */
export function useMinuteNow(): Date | null {
  const minute = useSyncExternalStore(subscribeMinute, minuteNow, () => null);
  return minute === null ? null : new Date(minute * 60_000);
}
