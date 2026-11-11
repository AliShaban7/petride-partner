"use client";

import { Car, Check, Hourglass, PawPrint, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { CornerPaw, type PawPet } from "@/components/illustrations";
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

const PAWS: Record<QuickFilterId, PawPet> = { all: "golden", overdue: "ginger", due_soon: "cream", ride: "tabby" };

const ICONS: Record<QuickFilterId, ReactNode> = {
  all: <PawPrint size={16} />,
  overdue: <TriangleAlert size={16} />,
  due_soon: <Hourglass size={16} />,
  ride: <Car size={16} />,
};

/**
 * Big pastel counters that double as one-tap filters (Dribbble-style KPI row): all, overdue
 * vaccines, due soon, came with PetRide. Toggle buttons with aria-pressed + a check mark.
 */
export function QuickFilters({
  counts,
  active,
  labels,
  onToggle,
  loading,
}: {
  counts: Record<QuickFilterId, number> | undefined;
  active: Record<QuickFilterId, boolean>;
  labels: Record<QuickFilterId, string>;
  onToggle: (id: QuickFilterId) => void;
  loading?: boolean;
}) {
  const t = useT("clients");
  const locale = useLocale();
  const ids: QuickFilterId[] = ["all", "overdue", "due_soon", "ride"];
  return (
    <section aria-label={t("quick.label")} className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {ids.map((id, i) => {
        const pressed = active[id];
        return (
          <button
            key={id}
            type="button"
            aria-pressed={pressed}
            disabled={loading}
            onClick={() => onToggle(id)}
            className={cn(
              "group relative isolate min-h-28 animate-fade-up overflow-hidden rounded-panel p-4 text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover disabled:pointer-events-none sm:min-h-32 sm:p-5",
              TONES[id],
              pressed && "ring-2 ring-primary-dark ring-offset-2 ring-offset-bg",
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="relative z-10 flex items-center gap-2 text-meta font-semibold text-fg-tertiary sm:text-body-sm">
              <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface/75 text-fg">
                {ICONS[id]}
              </span>
              <span className="min-w-0">{labels[id]}</span>
            </span>
            {loading || !counts ? (
              <Skeleton className="relative z-10 mt-3 h-8 w-16 bg-surface/60" />
            ) : (
              <span className="relative z-10 mt-2 block font-display text-h1 font-extrabold tracking-tight text-fg tabular sm:text-[2.25rem] sm:leading-[2.5rem]">
                {formatNumber(counts[id], locale)}
              </span>
            )}
            {pressed ? (
              <span aria-hidden="true" className="absolute right-3 top-3 z-20 inline-flex size-6 items-center justify-center rounded-full bg-primary-dark text-on-primary">
                <Check size={14} strokeWidth={3} />
              </span>
            ) : null}
            <CornerPaw pet={PAWS[id]} width={40} reach={44} />
          </button>
        );
      })}
    </section>
  );
}
