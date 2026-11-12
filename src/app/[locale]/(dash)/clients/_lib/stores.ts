"use client";

/**
 * Tiny client-side stores for the Clients pages:
 *  - `useNow()`: a shared clock (ticks every minute) so "in 3 days", "last 30 days" filters and
 *    relative times never call Date.now() during render.
 *  - Outbox: reminders / messages sent "via the PetRide app". The PartnerApi has no messaging
 *    endpoint yet, so these are mocked in the browser tab (like the mock data itself).
 *  - Pet files: uploads kept as object URLs in this tab (the PartnerApi has no file storage yet).
 *  - Note drafts: unsaved internal-note text per record, so closing the owner modal (Esc, a click
 *    outside, Back) or leaving the page doesn't throw it away.
 */
import { useSyncExternalStore } from "react";

type Listener = () => void;

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const l of listeners) l();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ---- Clock -----------------------------------------------------------------------------------------

const clock = createStore(Date.now());
let clockTimer: number | undefined;
let clockSubscribers = 0;

function subscribeClock(listener: Listener) {
  const off = clock.subscribe(listener);
  clockSubscribers += 1;
  if (clockTimer === undefined) {
    // Refresh right away when the first view mounts (the module may have loaded long ago).
    clock.set(Date.now());
    clockTimer = window.setInterval(() => clock.set(Date.now()), 60_000);
  }
  return () => {
    off();
    clockSubscribers -= 1;
    if (clockSubscribers === 0 && clockTimer !== undefined) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

/** Current time in ms, refreshed every minute while mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, clock.get, clock.get);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the local day for `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ---- Outbox (mock "sent via the PetRide app") ------------------------------------------------------

export type OutboxKind = "vaccine_reminder" | "message";
export type OutboxEntry = { at: number; kind: OutboxKind; to: string };

const outbox = createStore<Record<string, OutboxEntry>>({});

/** Simulates sending through the PetRide app (300–700 ms), then records it for `key`. */
export async function sendViaApp(key: string, entry: Omit<OutboxEntry, "at">): Promise<OutboxEntry> {
  await new Promise((resolve) => window.setTimeout(resolve, 300 + Math.random() * 400));
  const saved = { ...entry, at: Date.now() };
  outbox.set({ ...outbox.get(), [key]: saved });
  return saved;
}

/** Last thing sent for `key` (`pet:<id>` reminders, `client:<id>` messages) in this tab. */
export function useOutbox(key: string): OutboxEntry | undefined {
  const all = useSyncExternalStore(outbox.subscribe, outbox.get, outbox.get);
  return all[key];
}

// ---- Pet files (mock storage) ----------------------------------------------------------------------

export type PetFile = { id: string; name: string; type: string; size: number; addedAt: number; url: string };

const files = createStore<Record<string, PetFile[]>>({});
let fileSeq = 0;

export function addPetFiles(petId: string, list: File[]): PetFile[] {
  const added = list.map((file) => {
    fileSeq += 1;
    return { id: `file-${fileSeq}`, name: file.name, type: file.type, size: file.size, addedAt: Date.now(), url: URL.createObjectURL(file) };
  });
  const current = files.get();
  files.set({ ...current, [petId]: [...added, ...(current[petId] ?? [])] });
  return added;
}

export function removePetFile(petId: string, fileId: string): void {
  const current = files.get();
  const target = current[petId]?.find((f) => f.id === fileId);
  if (target) URL.revokeObjectURL(target.url);
  files.set({ ...current, [petId]: (current[petId] ?? []).filter((f) => f.id !== fileId) });
}

const NO_FILES: PetFile[] = [];

export function usePetFiles(petId: string): PetFile[] {
  const all = useSyncExternalStore(files.subscribe, files.get, files.get);
  return all[petId] ?? NO_FILES;
}

// ---- Note drafts ---------------------------------------------------------------------------------

/** Unsaved note text by record key (`client:<id>`), kept for this tab only. Read once on mount. */
const noteDrafts = new Map<string, string>();

export function readNoteDraft(key: string): string | undefined {
  return noteDrafts.get(key);
}

/** Remembers `value` while it differs from the saved note; forgets it once it matches again. */
export function writeNoteDraft(key: string, value: string, saved: string): void {
  if (value.trim() === saved.trim()) noteDrafts.delete(key);
  else noteDrafts.set(key, value);
}

export function clearNoteDraft(key: string): void {
  noteDrafts.delete(key);
}
