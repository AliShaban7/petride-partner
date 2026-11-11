/** Draft model of the pet-shop price list (Products & prices). */
import { parsePrice, parseWhole, priceInputText } from "@/components/services-settings";
import type { PartnerApi } from "@/lib/api/partner-api";
import type { LocalizedText, Product, ProductCategory, ProductPatch, Species } from "@/lib/api/types";
import type { Locale } from "@/lib/i18n/config";
import { stockStatus } from "@/lib/status";

export const PRODUCT_CATS: readonly ProductCategory[] = ["food", "treats", "toys", "care", "accessories", "health"];
export const STOCK_MAX = 99_999;

export type ProductDraft = {
  id: string;
  sku: string;
  category: ProductCategory;
  nameI18n: LocalizedText;
  species: Species[];
  /** Raw inputs. */
  price: string;
  stock: string;
  lowStockAt: number;
  active: boolean;
  sold30d: number;
};

export type ProductsDraft = Record<string, ProductDraft>;

export function toProductsDraft(products: Product[], locale: Locale): ProductsDraft {
  return Object.fromEntries(
    products.map((p) => [
      p.id,
      {
        id: p.id,
        sku: p.sku,
        category: p.category,
        nameI18n: { ...p.nameI18n },
        species: [...p.species],
        price: priceInputText(p.priceAZN, locale),
        stock: String(p.stock),
        lowStockAt: p.lowStockAt,
        active: p.active,
        sold30d: p.sold30d,
      } satisfies ProductDraft,
    ]),
  );
}

const priceKey = (raw: string) => {
  const parsed = parsePrice(raw);
  return parsed.ok ? String(parsed.value) : raw.trim();
};
const stockKey = (raw: string) => {
  const n = parseWhole(raw, 0, STOCK_MAX);
  return n === null ? raw.trim() : String(n);
};

export function productEquals(a: ProductDraft, b: ProductDraft): boolean {
  return (
    a.nameI18n.az === b.nameI18n.az &&
    a.nameI18n.ru === b.nameI18n.ru &&
    a.nameI18n.en === b.nameI18n.en &&
    priceKey(a.price) === priceKey(b.price) &&
    stockKey(a.stock) === stockKey(b.stock) &&
    a.lowStockAt === b.lowStockAt &&
    a.active === b.active
  );
}

export function productsEqual(a: ProductsDraft, b: ProductsDraft): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => b[k] && productEquals(a[k], b[k]));
}

export type ProductErrors = { price?: "empty" | "invalid" | "zero" | "tooBig"; stock?: "invalid" };

export function productErrors(p: ProductDraft): ProductErrors {
  const e: ProductErrors = {};
  const price = parsePrice(p.price);
  if (!price.ok) e.price = price.reason;
  if (parseWhole(p.stock, 0, STOCK_MAX) === null) e.stock = "invalid";
  return e;
}

export const hasErrors = (e: ProductErrors) => Boolean(e.price || e.stock);

/** Stock status from the draft (falls back to the saved number while the input is invalid). */
export function draftStockStatus(p: ProductDraft) {
  const n = parseWhole(p.stock, 0, STOCK_MAX);
  return stockStatus(n ?? 0, p.lowStockAt);
}

export function productPatch(p: ProductDraft, saved: ProductDraft): ProductPatch {
  const patch: ProductPatch = {};
  const az = p.nameI18n.az.trim();
  if (p.nameI18n.az !== saved.nameI18n.az || p.nameI18n.ru !== saved.nameI18n.ru || p.nameI18n.en !== saved.nameI18n.en) {
    patch.nameI18n = { az, ru: p.nameI18n.ru.trim() || az, en: p.nameI18n.en.trim() || az };
  }
  const price = parsePrice(p.price);
  if (price.ok && priceKey(p.price) !== priceKey(saved.price)) patch.priceAZN = price.value;
  const stock = parseWhole(p.stock, 0, STOCK_MAX);
  if (stock !== null && stockKey(p.stock) !== stockKey(saved.stock)) patch.stock = stock;
  if (p.lowStockAt !== saved.lowStockAt) patch.lowStockAt = p.lowStockAt;
  if (p.active !== saved.active) patch.active = p.active;
  return patch;
}

/** Saves the given products; returns the ids that failed. */
export async function saveProducts(api: PartnerApi, patches: { id: string; patch: ProductPatch }[]) {
  const results = await Promise.allSettled(patches.map((p) => api.updateProduct(p.id, p.patch)));
  const failed: string[] = [];
  let firstError: unknown;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed.push(patches[i].id);
      firstError ??= r.reason;
    }
  });
  return { failed, firstError };
}

export const productName = (p: ProductDraft, locale: Locale) => p.nameI18n[locale].trim() || p.nameI18n.az.trim();
