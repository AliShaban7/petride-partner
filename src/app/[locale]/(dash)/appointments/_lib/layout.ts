/** Calendar geometry: overlapping blocks side by side (lanes), multi-day stays in rows. */
import type { Appointment } from "@/lib/api/types";

import { MINUTE, startOfDay } from "./time";

export type PlacedBlock = {
  item: Appointment;
  /** Minutes after midnight, clamped to the visible window. */
  startMin: number;
  endMin: number;
  /** Cascade depth (0 = flush left). Later-starting overlaps are indented and drawn on top. */
  depth: number;
  /** Position inside a side-by-side group (blocks that start within 20 min of each other). */
  slot: number;
  slots: number;
  /** Starts before / ends after the visible window. */
  clippedStart: boolean;
  clippedEnd: boolean;
};

/** Blocks starting this close together sit side by side; later ones cascade on top. */
const SIDE_BY_SIDE_MIN = 20;

/**
 * Lays out one day's timed appointments inside [windowStart, windowEnd) minutes, the way paper
 * diaries and Google Calendar do: appointments that start at (nearly) the same time share the width;
 * an appointment that starts later inside a longer one is indented and drawn over it, so every
 * block keeps its first line (pet name) visible and gets most of the column width.
 */
export function placeDay(items: Appointment[], day0: number, windowStart: number, windowEnd: number): PlacedBlock[] {
  const blocks = items
    .map((item) => {
      const s = (new Date(item.start).getTime() - day0) / MINUTE;
      const e = (new Date(item.end).getTime() - day0) / MINUTE;
      const startMin = Math.min(Math.max(s, windowStart), windowEnd - 15);
      const endMin = Math.min(Math.max(e, startMin + 15), windowEnd);
      return { item, startMin, endMin, clippedStart: s < windowStart, clippedEnd: e > windowEnd, depth: 0, slot: 0, slots: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  type Group = { start: number; end: number; depth: number; members: typeof blocks };
  const groups: Group[] = [];
  for (const block of blocks) {
    const open = groups.find((g) => block.startMin - g.start < SIDE_BY_SIDE_MIN && g.end > block.startMin);
    if (open) {
      open.members.push(block);
      open.end = Math.max(open.end, block.endMin);
      continue;
    }
    const under = groups.filter((g) => g.end > block.startMin);
    const depth = under.length ? Math.max(...under.map((g) => g.depth)) + 1 : 0;
    groups.push({ start: block.startMin, end: block.endMin, depth, members: [block] });
  }
  for (const g of groups) {
    g.members.forEach((m, i) => {
      m.depth = g.depth;
      m.slot = i;
      m.slots = g.members.length;
    });
  }
  return blocks;
}

export type PlacedStay = {
  item: Appointment;
  /** 0-based first visible day column and the number of columns it spans. */
  col: number;
  span: number;
  row: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/** Hotel stays across the week's day columns, packed into as few rows as possible. */
export function placeStays(items: Appointment[], days: number[]): PlacedStay[] {
  const weekStart = days[0];
  const weekEnd = startOfDay(days[days.length - 1], 1);
  const dayIndex = (ms: number) => {
    const d0 = startOfDay(ms);
    const i = days.findIndex((d) => d === d0);
    return i === -1 ? (d0 < weekStart ? 0 : days.length - 1) : i;
  };
  const rowsEnd: number[] = [];
  return items
    .map((item) => ({ item, s: new Date(item.start).getTime(), e: new Date(item.end).getTime() }))
    .filter(({ s, e }) => e > weekStart && s < weekEnd)
    .sort((a, b) => a.s - b.s || b.e - a.e)
    .map(({ item, s, e }) => {
      const col = dayIndex(Math.max(s, weekStart));
      const last = dayIndex(Math.min(e - 1, weekEnd - 1));
      let row = rowsEnd.findIndex((end) => end < col);
      if (row === -1) {
        row = rowsEnd.length;
        rowsEnd.push(last);
      } else rowsEnd[row] = last;
      return { item, col, span: last - col + 1, row, continuesBefore: s < weekStart, continuesAfter: e > weekEnd };
    });
}
