"use client";

import { MapPin, Star } from "lucide-react";

import { AppPreviewFrame, parsePrice } from "@/components/services-settings";
import { BrandTile } from "@/components/illustrations";
import type { PartnerProfile } from "@/lib/api/types";
import { formatDuration, formatFixed, formatMoney, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n/types";

import { SERVICE_CATS, serviceName, type ServiceDraft, type ServicesDraft } from "./model";

/** What the app shows as the price: `35 ₼`, `35 ₼-dan`, or "Priced on site". */
export function appPriceText(item: Pick<ServiceDraft, "showPrice" | "price" | "priceFrom">, locale: Locale, tc: Translator<"common">): string {
  if (!item.showPrice) return tc("money.pricedOnSite");
  const parsed = parsePrice(item.price);
  if (!parsed.ok) return tc("money.pricedOnSite");
  const price = formatMoney(parsed.value, locale, { decimals: "auto" });
  return item.priceFrom ? tc("money.from", { price }) : price;
}

const MAX_ROWS = 8;

/**
 * Live preview of the partner's listing in the PetRide app, built from the editor draft: active
 * services in the saved order with the price or "Priced on site" (the app's link style).
 */
export function AppPreview({ draft, partner, logo }: { draft: ServicesDraft; partner: PartnerProfile | undefined; logo: string | null }) {
  const t = useT("services");
  const tc = useT("common");
  const locale = useLocale();
  const rows = SERVICE_CATS.flatMap((c) => draft.order[c].map((k) => draft.items[k]).filter((i) => i && i.active && serviceName(i, locale)));
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <AppPreviewFrame label={t("preview.label")} caption={t("preview.caption")}>
      <div className="bg-soft-mint px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={logo} alt="" className="size-11 shrink-0 rounded-tile bg-surface object-cover shadow-thumb" />
          ) : (
            <BrandTile size={44} />
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-title font-extrabold text-fg">{partner?.title ?? "…"}</p>
            {partner ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-fg-tertiary">
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" size={12} />
                  {partner.area}
                </span>
                {partner.reviewsCount > 0 ? (
                  <span className="inline-flex items-center gap-1 tabular">
                    <Star aria-hidden="true" size={12} className="fill-current" />
                    {t("preview.rating", { rating: formatFixed(partner.rating, 1, locale), count: formatNumber(partner.reviewsCount, locale) })}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        <p className="text-caption font-semibold uppercase tracking-wide text-fg-secondary">{t("preview.services")}</p>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-meta text-fg-secondary">{t("preview.empty")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {shown.map((item) => {
              const price = appPriceText(item, locale, tc);
              const onSite = price === tc("money.pricedOnSite");
              const description = item.descriptionI18n[locale] || item.descriptionI18n.az;
              return (
                <li key={item.key} className="flex items-start justify-between gap-3 rounded-tile bg-surface px-3 py-2.5 shadow-thumb">
                  <div className="min-w-0">
                    <p className="text-meta font-semibold text-fg">{serviceName(item, locale)}</p>
                    <p className="mt-0.5 text-caption text-fg-secondary">{description || formatDuration(item.durationMin, locale)}</p>
                  </div>
                  <p className={onSite ? "shrink-0 text-meta font-semibold text-primary" : "shrink-0 text-meta font-semibold text-fg tabular"}>{price}</p>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > shown.length ? <p className="mt-2 text-center text-caption text-fg-secondary">{t.plural("preview.more", rows.length - shown.length)}</p> : null}
      </div>
    </AppPreviewFrame>
  );
}
