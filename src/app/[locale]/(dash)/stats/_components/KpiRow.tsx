"use client";

import { Banknote, CalendarCheck, Car, ReceiptText, ShoppingBag, Star, Truck, UserPlus } from "lucide-react";
import { memo, type ReactNode } from "react";

import type { PawPet } from "@/components/illustrations";
import { KpiCard, type KpiTone } from "@/components/ui";
import type { Kpi } from "@/lib/api/types";
import { formatFixed, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { StatsReport } from "../_lib/engine";

type Card = {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  unit?: string;
  footnote?: string;
  delta?: number | null;
  tone: KpiTone;
  pet: PawPet | null;
};

const ICON = { size: 16, "aria-hidden": true } as const;

/** Six compact pastel KPI cards in one row on desktops; change chips only when there is a previous period to compare with. */
export const KpiRow = memo(function KpiRow({ report, deltaLabel }: { report: StatsReport; deltaLabel: string }) {
  const t = useT("stats");
  const locale = useLocale();
  const k = report.kpis;
  const visits = report.features.appointments;
  const delta = (kpi: Kpi) => (report.showChange ? kpi.delta : undefined);
  const hasTicket = k.completed > 0;
  const hasRating = k.ratingCount > 0;

  const cards: Card[] = [
    {
      id: "revenue",
      label: t("kpi.revenue"),
      icon: <Banknote {...ICON} />,
      value: formatMoney(k.revenue.value, locale, { decimals: 0 }),
      delta: delta(k.revenue),
      tone: "mint",
      pet: "golden",
    },
    visits
      ? {
          id: "appointments",
          label: t("kpi.appointments"),
          icon: <CalendarCheck {...ICON} />,
          value: formatNumber(k.appointments.value, locale),
          delta: delta(k.appointments),
          tone: "peach",
          pet: "ginger",
        }
      : {
          id: "orders",
          label: t("kpi.orders"),
          icon: <ShoppingBag {...ICON} />,
          value: formatNumber(k.orders.value, locale),
          delta: delta(k.orders),
          tone: "peach",
          pet: "ginger",
        },
    {
      id: "ticket",
      label: t("kpi.averageTicket"),
      icon: <ReceiptText {...ICON} />,
      value: hasTicket ? formatMoney(k.averageTicket.value, locale, { decimals: "auto" }) : "—",
      delta: hasTicket ? delta(k.averageTicket) : undefined,
      tone: "lilac",
      pet: null,
    },
    {
      id: "clients",
      label: t("kpi.newClients"),
      icon: <UserPlus {...ICON} />,
      value: formatNumber(k.newClients.value, locale),
      footnote: t("kpi.returning", { count: formatNumber(k.returningClients.value, locale) }),
      delta: delta(k.newClients),
      tone: "sand",
      pet: "cream",
    },
    {
      id: "share",
      label: visits ? t("kpi.rideShare") : t("kpi.courierShare"),
      icon: visits ? <Car {...ICON} /> : <Truck {...ICON} />,
      value: formatPercent(k.rideShare.value, locale),
      delta: delta(k.rideShare),
      tone: "mint",
      pet: "tabby",
    },
    {
      id: "rating",
      label: t("kpi.rating"),
      icon: <Star {...ICON} />,
      value: hasRating ? formatFixed(k.rating.value, 1, locale) : "—",
      unit: hasRating ? t("kpi.outOf") : undefined,
      footnote: hasRating ? t.plural("count.reviews", k.ratingCount) : t("kpi.noReviews"),
      delta: delta(k.rating),
      tone: "peach",
      pet: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, i) => (
        <KpiCard
          key={card.id}
          size="sm"
          index={i}
          label={card.label}
          icon={card.icon}
          value={card.value}
          unit={card.unit}
          // "vs the previous 30 days" is said once in the page header (the compared dates); on these
          // narrow cards it is read out with the change chip but not shown.
          footnote={card.footnote}
          deltaLabel={deltaLabel}
          deltaLabelVisible={false}
          delta={card.delta}
          tone={card.tone}
          pet={card.pet}
        />
      ))}
    </div>
  );
});

/** Same grid with skeleton cards while the numbers load. */
export function KpiRowSkeleton() {
  const tones: KpiTone[] = ["mint", "peach", "lilac", "sand", "mint", "peach"];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tones.map((tone, i) => (
        <KpiCard key={i} size="sm" index={i} loading label="" value="" tone={tone} pet={null} />
      ))}
    </div>
  );
}
