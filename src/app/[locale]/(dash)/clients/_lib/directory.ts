/**
 * The Clients directory: every pet and owner the partner has seen, plus who came with PetRide.
 *
 * The PartnerApi list methods don't filter by last-visit range or "came with PetRide" yet
 * (PetQuery/ClientQuery), so the directory loads the full lists once (pages of 200, in parallel)
 * and filters, sorts and pages in the browser. Partners have hundreds of clients, not millions;
 * when the Supabase backend adds those filters, `loadDirectory` + `filterPets/filterOwners`
 * are the only places to change.
 */
import type { PartnerApi } from "@/lib/api";
import type { Client, Paged, Pet, PetHealthStatus, Species } from "@/lib/api/types";

import { DAY_MS } from "./stores";

export type DirectoryMode = "visits" | "orders";

export type Directory = {
  pets: Pet[];
  clients: Client[];
  /** Pets that came to the partner in a PetRide ride (clinic) / whose owner got a PetRide courier delivery (shop). */
  ridePetIds: Set<string>;
  /** Owners that came with PetRide (clinic) / got a PetRide courier delivery (shop). */
  rideClientIds: Set<string>;
  /** Species of each owner's pets (owner species filter). */
  speciesByClient: Map<string, Set<Species>>;
};

async function fetchAll<T>(fetchPage: (page: number) => Promise<Paged<T>>): Promise<T[]> {
  const first = await fetchPage(1);
  if (first.pageCount <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: first.pageCount - 1 }, (_, i) => fetchPage(i + 2)));
  return [first, ...rest].flatMap((p) => p.items);
}

export async function loadDirectory(api: PartnerApi, mode: DirectoryMode): Promise<Directory> {
  const [pets, clients, rides] = await Promise.all([
    fetchAll((page) => api.listPets({ page, pageSize: 200, sort: "name_asc" })),
    fetchAll((page) => api.listClients({ page, pageSize: 200, sort: "last_visit_desc" })),
    api.listRides({ direction: mode === "visits" ? "to_partner" : "delivery", status: ["completed"] }),
  ]);
  const rideClientIds = new Set(rides.map((r) => r.clientId));
  for (const c of clients) if (c.rideVisits > 0) rideClientIds.add(c.id);
  const ridePetIds = new Set(mode === "visits" ? rides.flatMap((r) => r.petIds) : pets.filter((p) => rideClientIds.has(p.ownerId)).map((p) => p.id));
  const speciesByClient = new Map<string, Set<Species>>();
  for (const p of pets) {
    const set = speciesByClient.get(p.ownerId) ?? new Set<Species>();
    set.add(p.species);
    speciesByClient.set(p.ownerId, set);
  }
  return { pets, clients, ridePetIds, rideClientIds, speciesByClient };
}

// ---- Filters ---------------------------------------------------------------------------------------

export type DirectoryView = "pets" | "owners";
export type LastVisitFilter = "7" | "30" | "90" | "over90" | "never";
export type PetSort = "next" | "name" | "last";
export type OwnerSortId = "name" | "pets" | "visits" | "spent" | "last";

export const SPECIES: Species[] = ["dog", "cat", "other"];
export const HEALTH: PetHealthStatus[] = ["overdue", "due_soon", "ok"];
export const LAST_VISIT: LastVisitFilter[] = ["7", "30", "90", "over90", "never"];

export type DirectoryFilters = {
  q: string;
  species: Species | null;
  vaccine: PetHealthStatus | null;
  last: LastVisitFilter | null;
  ride: boolean;
};

export const isSpecies = (v: string | null): v is Species => v !== null && (SPECIES as string[]).includes(v);
export const isHealth = (v: string | null): v is PetHealthStatus => v !== null && (HEALTH as string[]).includes(v);
export const isLastVisit = (v: string | null): v is LastVisitFilter => v !== null && (LAST_VISIT as string[]).includes(v);

// "İ" lower-cases to "i" + U+0307, which the NFD step below strips.
const AZ_FOLD: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g" };

/** Case/diacritic-insensitive search key: "Məmmədova" matches "memmedova", "Мамедова" stays Cyrillic. */
export function fold(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[əıöüşçğ]/g, (ch) => AZ_FOLD[ch] ?? ch)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesText(haystack: string, phone: string | undefined, q: string): boolean {
  const query = fold(q.trim());
  if (!query) return true;
  if (fold(haystack).includes(query)) return true;
  const digits = q.replace(/\D/g, "");
  return Boolean(phone && digits.length >= 3 && phone.replace(/\D/g, "").includes(digits));
}

export function matchesLastVisit(lastVisitAt: string | undefined, filter: LastVisitFilter | null, now: number): boolean {
  if (!filter) return true;
  if (filter === "never") return !lastVisitAt;
  if (!lastVisitAt) return false;
  const age = now - new Date(lastVisitAt).getTime();
  if (filter === "over90") return age > 90 * DAY_MS;
  return age <= Number(filter) * DAY_MS;
}

export function filterPets(dir: Directory, f: DirectoryFilters, now: number, skip?: keyof DirectoryFilters): Pet[] {
  return dir.pets.filter((p) => {
    if (skip !== "q" && !matchesText(`${p.name} ${p.code} ${p.ownerName} ${p.breed}`, undefined, f.q)) return false;
    if (skip !== "species" && f.species && p.species !== f.species) return false;
    if (skip !== "vaccine" && f.vaccine && p.healthStatus !== f.vaccine) return false;
    if (skip !== "last" && !matchesLastVisit(p.lastVisitAt, f.last, now)) return false;
    if (skip !== "ride" && f.ride && !dir.ridePetIds.has(p.id)) return false;
    return true;
  });
}

export function filterOwners(dir: Directory, f: DirectoryFilters, now: number, skip?: keyof DirectoryFilters): Client[] {
  return dir.clients.filter((c) => {
    if (skip !== "q" && !matchesText(`${c.fullName} ${c.petNames.join(" ")}`, c.phone, f.q)) return false;
    if (skip !== "species" && f.species && !dir.speciesByClient.get(c.id)?.has(f.species)) return false;
    if (skip !== "vaccine" && f.vaccine && c.vaccineAlert !== f.vaccine) return false;
    if (skip !== "last" && !matchesLastVisit(c.lastVisitAt, f.last, now)) return false;
    if (skip !== "ride" && f.ride && !dir.rideClientIds.has(c.id)) return false;
    return true;
  });
}

// ---- Sorting ---------------------------------------------------------------------------------------

const byDateDesc = (a?: string, b?: string) => (b ?? "").localeCompare(a ?? "");

export function sortPets(pets: Pet[], sort: PetSort, locale: string): Pet[] {
  return [...pets].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, locale);
    if (sort === "last") return byDateDesc(a.lastVisitAt, b.lastVisitAt) || a.name.localeCompare(b.name, locale);
    const an = a.nextAppointment?.start ?? "9999";
    const bn = b.nextAppointment?.start ?? "9999";
    return an.localeCompare(bn) || byDateDesc(a.lastVisitAt, b.lastVisitAt) || a.name.localeCompare(b.name, locale);
  });
}

export function sortOwners(clients: Client[], id: OwnerSortId, direction: "asc" | "desc", locale: string): Client[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...clients].sort((a, b) => {
    let diff = 0;
    switch (id) {
      case "name":
        diff = a.fullName.localeCompare(b.fullName, locale);
        break;
      case "pets":
        diff = a.petIds.length - b.petIds.length;
        break;
      case "visits":
        diff = a.visitsCount + a.ordersCount - (b.visitsCount + b.ordersCount);
        break;
      case "spent":
        diff = a.totalSpentAZN - b.totalSpentAZN;
        break;
      case "last":
        // Never visited sorts last in both directions.
        if (!a.lastVisitAt || !b.lastVisitAt) return a.lastVisitAt ? -1 : b.lastVisitAt ? 1 : 0;
        diff = a.lastVisitAt.localeCompare(b.lastVisitAt);
        break;
    }
    return diff * factor || a.fullName.localeCompare(b.fullName, locale);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, total: items.length, pageSize };
}
