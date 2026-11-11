/**
 * The live mock databases (one per demo partner), seeded lazily on first use and mutated in place.
 * They live in the browser tab: navigation keeps them, a full reload re-seeds from "now".
 *
 * Dev controls for page builders (no UI needed):
 *   ?mock=empty  → every list comes back empty (check empty states)
 *   ?mock=error  → every call rejects with ApiError("network") (check error states)
 *   ?mock=slow   → 2–3 s latency (check skeletons)       ?mock=fast → no latency
 * The URL param wins; otherwise `localStorage["petride.mock"]` (same values) is used.
 */
import { ApiError } from "../types";
import { PARTNERS, type DemoPartnerId } from "./catalog";
import type { PartnerDb } from "./records";
import { seedPartner } from "./seed";

const dbs = new Map<string, PartnerDb>();

export function isDemoPartnerId(id: string): id is DemoPartnerId {
  return id in PARTNERS;
}

export function getDb(partnerId: string): PartnerDb {
  if (!isDemoPartnerId(partnerId)) throw new ApiError("forbidden", `Unknown partner ${partnerId}`);
  let db = dbs.get(partnerId);
  if (!db) {
    db = seedPartner(partnerId);
    dbs.set(partnerId, db);
  }
  return db;
}

/** Drops the in-memory data so the next call re-seeds (e.g. a "Reset demo data" button). */
export function resetMockData(partnerId?: string): void {
  if (partnerId) dbs.delete(partnerId);
  else dbs.clear();
}

export type MockMode = "normal" | "slow" | "fast" | "error" | "empty";
const MODES: MockMode[] = ["normal", "slow", "fast", "error", "empty"];

export function mockMode(): MockMode {
  if (typeof window === "undefined") return "fast";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("mock");
    if (fromUrl && (MODES as string[]).includes(fromUrl)) return fromUrl as MockMode;
    const stored = window.localStorage.getItem("petride.mock");
    if (stored && (MODES as string[]).includes(stored)) return stored as MockMode;
  } catch {
    // storage blocked — fall through
  }
  return "normal";
}

/** Simulated network: 200–600 ms (or per mock mode), then the result or an ApiError. */
export async function latency(): Promise<void> {
  const mode = mockMode();
  const ms = mode === "fast" ? 0 : mode === "slow" ? 2000 + Math.random() * 1000 : 200 + Math.random() * 400;
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
  if (mode === "error") throw new ApiError("network", "Mock network error (?mock=error)");
}
