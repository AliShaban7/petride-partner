"use client";

import { Car, Check, Hourglass, PawPrint, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type QuickFilterId = "all" | "overdue" | "due_soon" | "ride";

const TONES: Record<QuickFilterId, string> = {
  all: "bg-pastel-mint",
  overdue: "bg-pastel-peach",
  due_soon: "bg-pastel-sand",
  ride: "bg-pastel-lilac",
};

const ICONS: Record<QuickFilterId, ReactNode> = {
  all: <PawPrint size={16} />,
  overdue: <TriangleAlert size={16} />,
  due_soon: <Hourglass size={16} />,
  ride: <Car size={16} />,
};

const IDS: QuickFilterId[] = ["all", "overdue", "due_soon", "ride"];

/**
 * The directory's counters, which are also one-tap filters: all, overdue vaccines, due soon and
 * came with PetRide. Pastel chips with the count inside (toggle buttons: aria-pressed plus a check
 * mark). One row: wraps from 640px, scrolls sideways on phones. 44px tall below 1024px, 40px above.
 */
export function QuickFilters({
  counts,
  active,
  labels,
  onToggle,
  loading,
  className,
}: {
  counts: Record<QuickFilterId, number> | undefined;
  active: Record<QuickFilterId, boolean>;
  labels: Record<QuickFilterId, string>;
  onToggle: (id: QuickFilterId) => void;
  loading?: boolean;
  className?: string;
}) {
  const t = useT("clients");
  const locale = useLocale();
  return (
    <div role="group" aria-label={t("quick.label")} className={cn("flex gap-2", className)}>
      {IDS.map((id) => {
        const pressed = active[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={pressed}
            disabled={loading}
            onClick={() => onToggle(id)}
            className={cn(
              // Text on pastel fills: text-fg only.
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-chip pl-3 pr-1.5 text-body-sm font-semibold text-fg transition-[box-shadow] duration-150 disabled:pointer-events-none lg:min-h-10",
              TONES[id],
              pressed ? "ring-2 ring-inset ring-primary-dark" : "hover:shadow-card-hover",
            )}
          >
            <span aria-hidden="true" className="inline-flex">
              {pressed ? <Check size={16} strokeWidth={3} /> : ICONS[id]}
            </span>
            <span className="whitespace-nowrap">{labels[id]}</span>{" "}
            {loading || !counts ? (
              <Skeleton className="h-7 w-9 rounded-chip bg-surface/60" />
            ) : (
              <span className="inline-flex min-h-7 min-w-8 items-center justify-center rounded-chip bg-surface/80 px-2 text-meta font-bold tabular">
                {formatNumber(counts[id], locale)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
