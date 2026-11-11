/**
 * Draft model of the Services & prices editor: what the partner edits inline (price, "show price in
 * the app", active, order) and in the add/edit dialog, and how a draft turns into API calls.
 */
import { extrasApi, parsePrice, priceInputText, type PartnerExtras } from "@/components/services-settings";
import type { PartnerApi } from "@/lib/api/partner-api";
import type { LocalizedText, NewServiceInput, Service, ServicePatch, Species } from "@/lib/api/types";
import type { Locale } from "@/lib/i18n/config";

export type ServiceCat = Service["category"];
export const SERVICE_CATS: readonly ServiceCat[] = ["vet", "groom", "hotel"];
export const SPECIES: readonly Species[] = ["dog", "cat", "other"];

export type ServiceDraft = {
  /** Service id, or `new-…` for one that isn't created yet. */
  key: string;
  isNew: boolean;
  category: ServiceCat;
  nameI18n: LocalizedText;
  descriptionI18n: LocalizedText;
  durationMin: number;
  /** Raw price input text. */
  price: string;
  /** Off → the app shows "Priced on site" (priceAZN null); the typed price is kept for later. */
  showPrice: boolean;
  priceFrom: boolean;
  species: Species[];
  active: boolean;
  bookings30d: number;
};

export type ServicesDraft = { items: Record<string, ServiceDraft>; order: Record<ServiceCat, string[]> };

export const isTempKey = (key: string) => key.startsWith("new-");

let tempSeq = 0;
export const newTempKey = () => `new-${Date.now().toString(36)}-${(tempSeq += 1)}`;

/** Server data (+ saved display order and hidden prices) → editor draft. */
export function toServicesDraft(services: Service[], meta: PartnerExtras["services"], locale: Locale): ServicesDraft {
  const items: Record<string, ServiceDraft> = {};
  for (const s of services) {
    const hidden = meta.hiddenPrices[s.id];
    items[s.id] = {
      key: s.id,
      isNew: false,
      category: s.category,
      nameI18n: { ...s.nameI18n },
      descriptionI18n: { ...s.descriptionI18n },
      durationMin: s.durationMin,
      price: priceInputText(s.priceAZN ?? hidden ?? null, locale),
      showPrice: s.priceAZN !== null,
      priceFrom: s.priceFrom,
      species: [...s.species],
      active: s.active,
      bookings30d: s.bookings30d,
    };
  }
  const rank = new Map(meta.order.map((id, i) => [id, i]));
  const sorted = [...services].sort((a, b) => (rank.get(a.id) ?? 10_000 + services.indexOf(a)) - (rank.get(b.id) ?? 10_000 + services.indexOf(b)));
  const order = { vet: [], groom: [], hotel: [] } as Record<ServiceCat, string[]>;
  for (const s of sorted) order[s.category].push(s.id);
  return { items, order };
}

/** The price the app gets: a number, or null for "Priced on site" (also when the input is invalid). */
export function effectivePrice(item: ServiceDraft): number | null {
  if (!item.showPrice) return null;
  const parsed = parsePrice(item.price);
  return parsed.ok ? parsed.value : null;
}

/** Comparable form of a price input ("30" and "30,00" are the same). */
function priceKey(raw: string): string {
  const parsed = parsePrice(raw);
  return parsed.ok ? String(parsed.value) : raw.trim();
}

const sameText = (a: LocalizedText, b: LocalizedText) => a.az === b.az && a.ru === b.ru && a.en === b.en;
const sameList = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function itemEquals(a: ServiceDraft, b: ServiceDraft): boolean {
  return (
    a.key === b.key &&
    a.category === b.category &&
    sameText(a.nameI18n, b.nameI18n) &&
    sameText(a.descriptionI18n, b.descriptionI18n) &&
    a.durationMin === b.durationMin &&
    priceKey(a.price) === priceKey(b.price) &&
    a.showPrice === b.showPrice &&
    a.priceFrom === b.priceFrom &&
    sameList([...a.species].sort(), [...b.species].sort()) &&
    a.active === b.active
  );
}

export function draftEquals(a: ServicesDraft, b: ServicesDraft): boolean {
  if (!SERVICE_CATS.every((c) => sameList(a.order[c], b.order[c]))) return false;
  const keys = Object.keys(a.items);
  if (keys.length !== Object.keys(b.items).length) return false;
  return keys.every((k) => b.items[k] !== undefined && itemEquals(a.items[k], b.items[k]));
}

/** Keys of rows that differ from the saved state (new rows included). */
export function changedKeys(draft: ServicesDraft, base: ServicesDraft): Set<string> {
  const changed = new Set<string>();
  for (const [key, item] of Object.entries(draft.items)) {
    const saved = base.items[key];
    if (!saved || !itemEquals(item, saved)) changed.add(key);
  }
  return changed;
}

export function orderChanged(draft: ServicesDraft, base: ServicesDraft): boolean {
  return !SERVICE_CATS.every((c) => sameList(draft.order[c], base.order[c].filter((k) => draft.items[k])));
}

// ---- Validation --------------------------------------------------------------------------------------

export type PriceError = "empty" | "invalid" | "zero" | "tooBig";

/** Inline-row validation: only the price is editable inline. */
export function priceError(item: ServiceDraft): PriceError | null {
  if (!item.showPrice && !item.price.trim()) return null;
  const parsed = parsePrice(item.price);
  if (parsed.ok) return null;
  // Hidden price: an empty field is fine, a typo is not.
  return !item.showPrice && parsed.reason === "empty" ? null : parsed.reason;
}

// ---- Saving --------------------------------------------------------------------------------------------

export type SavePlan = {
  updates: { key: string; patch: ServicePatch }[];
  creates: { key: string; input: NewServiceInput }[];
  /** Display order (keys; temp keys are swapped for the new ids). */
  order: string[];
  /** Prices kept while hidden, by key. */
  hiddenPrices: Record<string, number>;
  metaChanged: boolean;
};

const withFallback = (text: LocalizedText): LocalizedText => {
  const az = text.az.trim();
  return { az, ru: text.ru.trim() || az, en: text.en.trim() || az };
};

function patchFor(item: ServiceDraft, saved: ServiceDraft): ServicePatch {
  const patch: ServicePatch = {};
  if (!sameText(item.nameI18n, saved.nameI18n)) patch.nameI18n = withFallback(item.nameI18n);
  if (!sameText(item.descriptionI18n, saved.descriptionI18n)) patch.descriptionI18n = withFallback(item.descriptionI18n);
  if (item.durationMin !== saved.durationMin) patch.durationMin = item.durationMin;
  const price = effectivePrice(item);
  if (price !== effectivePrice(saved)) patch.priceAZN = price;
  if (item.priceFrom !== saved.priceFrom) patch.priceFrom = item.priceFrom;
  if (!sameList([...item.species].sort(), [...saved.species].sort())) patch.species = [...item.species];
  if (item.active !== saved.active) patch.active = item.active;
  return patch;
}

function hiddenPricesOf(items: ServiceDraft[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (item.showPrice) continue;
    const parsed = parsePrice(item.price);
    if (parsed.ok) out[item.key] = parsed.value;
  }
  return out;
}

const flatOrder = (order: ServicesDraft["order"]) => SERVICE_CATS.flatMap((c) => order[c]);

/**
 * What to send. With `onlyKeys` (a row saved from the dialog) only those rows are saved and the
 * saved order is kept (a new row goes to the end of its category).
 */
export function buildSavePlan(draft: ServicesDraft, base: ServicesDraft, onlyKeys?: string[]): SavePlan {
  const keys = onlyKeys ?? Object.keys(draft.items);
  const updates: SavePlan["updates"] = [];
  const creates: SavePlan["creates"] = [];
  for (const key of keys) {
    const item = draft.items[key];
    if (!item) continue;
    if (item.isNew) {
      creates.push({
        key,
        input: {
          category: item.category,
          nameI18n: withFallback(item.nameI18n),
          descriptionI18n: withFallback(item.descriptionI18n),
          durationMin: item.durationMin,
          priceAZN: effectivePrice(item),
          priceFrom: item.priceFrom,
          species: [...item.species],
          active: item.active,
        },
      });
      continue;
    }
    const saved = base.items[key];
    if (!saved) continue;
    const patch = patchFor(item, saved);
    if (Object.keys(patch).length) updates.push({ key, patch });
  }

  let order: string[];
  let hiddenPrices: Record<string, number>;
  if (onlyKeys) {
    const baseOrder = { ...base.order };
    for (const c of creates) baseOrder[c.input.category] = [...baseOrder[c.input.category], c.key];
    order = flatOrder(baseOrder);
    const merged = { ...base.items, ...Object.fromEntries(keys.filter((k) => draft.items[k]).map((k) => [k, draft.items[k]])) };
    hiddenPrices = hiddenPricesOf(Object.values(merged));
  } else {
    order = flatOrder(draft.order);
    hiddenPrices = hiddenPricesOf(Object.values(draft.items));
  }
  const metaChanged =
    creates.length > 0 ||
    !sameList(order, flatOrder(base.order)) ||
    JSON.stringify(hiddenPrices) !== JSON.stringify(hiddenPricesOf(Object.values(base.items)));
  return { updates, creates, order, hiddenPrices, metaChanged };
}

export type SaveResult = {
  /** temp key → created service id. */
  created: Record<string, string>;
  /** Keys whose save failed. */
  failed: string[];
  /** The order / hidden prices could not be stored. */
  metaFailed: boolean;
  firstError?: unknown;
};

/** Runs a plan against the API. Never throws: failures come back per row. */
export async function executePlan(api: PartnerApi, plan: SavePlan): Promise<SaveResult> {
  const created: Record<string, string> = {};
  const failed: string[] = [];
  let firstError: unknown;
  const jobs = [
    ...plan.updates.map((u) => ({ key: u.key, run: () => api.updateService(u.key, u.patch).then(() => undefined) })),
    ...plan.creates.map((c) => ({
      key: c.key,
      run: () =>
        api.createService(c.input).then((s) => {
          created[c.key] = s.id;
        }),
    })),
  ];
  const results = await Promise.allSettled(jobs.map((j) => j.run()));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed.push(jobs[i].key);
      firstError ??= r.reason;
    }
  });

  let metaFailed = false;
  if (plan.metaChanged) {
    const mapKey = (k: string) => created[k] ?? k;
    const order = plan.order.map(mapKey).filter((k) => !isTempKey(k));
    const hiddenPrices = Object.fromEntries(
      Object.entries(plan.hiddenPrices)
        .map(([k, v]) => [mapKey(k), v] as const)
        .filter(([k]) => !isTempKey(k)),
    );
    try {
      await extrasApi.updateServicesMeta(api.partnerId, { order, hiddenPrices });
    } catch (e) {
      metaFailed = true;
      firstError ??= e;
    }
  }
  return { created, failed, metaFailed, firstError };
}

/** Swaps temp keys for the ids the API gave the new services. */
export function remapKeys(draft: ServicesDraft, created: Record<string, string>): ServicesDraft {
  if (!Object.keys(created).length) return draft;
  const items: Record<string, ServiceDraft> = {};
  for (const [key, item] of Object.entries(draft.items)) {
    const id = created[key];
    items[id ?? key] = id ? { ...item, key: id, isNew: false } : item;
  }
  const order = Object.fromEntries(SERVICE_CATS.map((c) => [c, draft.order[c].map((k) => created[k] ?? k)])) as ServicesDraft["order"];
  return { items, order };
}

/**
 * Marks rows as saved (after a partial save or a dialog save): the base takes `saved`'s version of
 * those rows (the draft as it was sent); temp keys become real ids in both.
 */
export function commitRows(
  current: { base: ServicesDraft; draft: ServicesDraft },
  saved: ServicesDraft,
  keys: string[],
  created: Record<string, string>,
): { base: ServicesDraft; draft: ServicesDraft } {
  const sent = remapKeys(saved, created);
  const draft = remapKeys(current.draft, created);
  const items = { ...current.base.items };
  const order = { ...current.base.order };
  for (const key of keys) {
    const id = created[key] ?? key;
    const item = sent.items[id];
    if (!item) continue;
    items[id] = item;
    if (!order[item.category].includes(id)) order[item.category] = [...order[item.category], id];
  }
  return { base: { items, order }, draft };
}

/** Adds or replaces one row (a new row goes to the end of its category). */
export function withItem(draft: ServicesDraft, item: ServiceDraft): ServicesDraft {
  const order = { ...draft.order };
  if (!order[item.category].includes(item.key)) order[item.category] = [...order[item.category], item.key];
  return { items: { ...draft.items, [item.key]: item }, order };
}

/** Removes one row. */
export function withoutItem(draft: ServicesDraft, key: string): ServicesDraft {
  const items = { ...draft.items };
  delete items[key];
  const order = Object.fromEntries(SERVICE_CATS.map((c) => [c, draft.order[c].filter((k) => k !== key)])) as ServicesDraft["order"];
  return { items, order };
}

/** Duration a new service starts with, per category. */
export const DEFAULT_DURATION: Record<ServiceCat, number> = { vet: 30, groom: 60, hotel: 1440 };

/** An empty row for the "Add service" dialog. */
export function blankService(category: ServiceCat): ServiceDraft {
  return {
    key: newTempKey(),
    isNew: true,
    category,
    nameI18n: { az: "", ru: "", en: "" },
    descriptionI18n: { az: "", ru: "", en: "" },
    durationMin: DEFAULT_DURATION[category],
    price: "",
    showPrice: true,
    priceFrom: false,
    species: ["dog", "cat"],
    active: true,
    bookings30d: 0,
  };
}

/** Display name in the UI language (falls back to Azerbaijani). */
export const serviceName = (item: ServiceDraft, locale: Locale) => item.nameI18n[locale].trim() || item.nameI18n.az.trim();
