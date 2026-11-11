"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CornerPaw, type PawPet } from "@/components/illustrations";
import { cn } from "@/lib/cn";
import { formatDeltaPercent, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { TONE_CLASSES } from "./Card";
import { Skeleton } from "./Skeleton";

export type KpiTone = "mint" | "peach" | "lilac" | "sand" | "sky" | "rose";

export type DeltaChipProps = {
  /** Change as a ratio (0.12 = +12%); null = nothing to compare with. */
  value: number | null;
  /** "vs last week" — shown and read out after the number. */
  label?: string;
  /** For "cancellations" or "no-shows" a rise is bad. Default true. */
  positiveIsGood?: boolean;
  className?: string;
};

/** "↑ 12% vs last week" chip. Direction is shown by arrow + sign + words, not by colour alone. */
export function DeltaChip({ value, label, positiveIsGood = true, className }: DeltaChipProps) {
  const t = useT("common");
  const locale = useLocale();
  const rounded = value === null ? null : Math.round(value * 100);
  const direction = rounded === null ? "none" : rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const good = direction === "flat" || direction === "none" ? null : (direction === "up") === positiveIsGood;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  const pct = value === null ? "" : formatDeltaPercent(value, locale);
  const spoken =
    direction === "none"
      ? t("delta.none")
      : direction === "flat"
        ? t("delta.flat")
        : t(direction === "up" ? "delta.up" : "delta.down", { value: formatPercent(Math.abs(value ?? 0), locale) });
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-chip bg-surface/85 px-2 py-0.5 text-caption font-bold",
          good === true ? "text-success-text" : good === false ? "text-error-text" : "text-neutral-text",
        )}
      >
        <Icon aria-hidden="true" size={14} strokeWidth={2.4} />
        <span aria-hidden="true">{direction === "none" ? "—" : pct}</span>
      </span>
      {label && direction !== "none" ? (
        <span aria-hidden="true" className="text-caption font-medium text-fg-tertiary">
          {label}
        </span>
      ) : null}
      <span className="sr-only">
        {spoken}
        {label && direction !== "none" ? ` ${label}` : ""}
      </span>
    </span>
  );
}

export type KpiCardProps = {
  label: string;
  /** Lucide icon element (e.g. <CalendarDays size={18} />). */
  icon?: ReactNode;
  /** Pre-formatted value ("1 240 ₼", "38", "4,8"). */
  value: ReactNode;
  /** Small text after the value ("/ 5", "today"). */
  unit?: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  positiveIsGood?: boolean;
  tone?: KpiTone;
  /** Paw reaching in from the corner; null hides it. */
  pet?: PawPet | null;
  /** Extra line under the value. */
  footnote?: ReactNode;
  /** Makes the whole card a link. */
  href?: string;
  loading?: boolean;
  /** Stagger index for the entrance animation. */
  index?: number;
  /**
   * "md" (default) shrinks itself under 640px so two cards fit side by side at 360px;
   * "sm" is always compact (dense strips, side panels).
   */
  size?: "md" | "sm";
  className?: string;
};

/**
 * Big pastel KPI card: label with icon, huge number, "↑ 10% vs last week" chip and a pet paw
 * peeking from the corner. Text on pastels is text-fg / text-fg-tertiary only.
 */
export function KpiCard({
  label,
  icon,
  value,
  unit,
  delta,
  deltaLabel,
  positiveIsGood,
  tone = "mint",
  pet = "golden",
  footnote,
  href,
  loading,
  index = 0,
  size = "md",
  className,
}: KpiCardProps) {
  const compact = size === "sm";
  const body = (
    <>
      <div className={cn("relative z-10 flex items-center gap-2 font-semibold text-fg-tertiary", compact ? "text-meta" : "text-meta sm:text-body-sm")}>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full bg-surface/75 text-fg transition-transform duration-200 ease-out group-hover:-rotate-6 group-hover:scale-110",
              compact ? "size-7" : "size-7 sm:size-8",
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="line-clamp-2 min-w-0 break-words">{label}</span>
      </div>
      {loading ? (
        <div className="relative z-10 mt-4 space-y-3">
          <Skeleton className="h-10 w-28 bg-surface/60" />
          <Skeleton className="h-5 w-36 bg-surface/60" />
        </div>
      ) : (
        <>
          <p
            className={cn(
              "relative z-10 mt-3 flex flex-wrap items-baseline gap-x-1.5 font-display font-extrabold leading-none tracking-tight text-fg tabular",
              compact ? "text-[1.75rem]" : "text-[1.75rem] sm:text-kpi",
            )}
          >
            <span className="whitespace-nowrap">{value}</span>
            {unit ? <span className={cn("font-bold text-fg-tertiary", compact ? "text-body-sm" : "text-body-sm sm:text-title")}>{unit}</span> : null}
          </p>
          <div className={cn("relative z-10 mt-3 flex min-h-6 flex-wrap items-center gap-2", compact ? "pr-8" : "pr-8 sm:pr-[4.75rem]")}>
            {delta !== undefined ? <DeltaChip value={delta} label={deltaLabel} positiveIsGood={positiveIsGood} /> : null}
            {footnote ? <span className="text-meta text-fg-tertiary">{footnote}</span> : null}
          </div>
        </>
      )}
      {pet ? (
        <CornerPaw
          pet={pet}
          width={58}
          reach={64}
          // Compact cards: a smaller paw tucked further into the corner so it never covers the delta text.
          className={cn(
            "transition-[scale,translate] duration-300",
            compact ? "translate-x-4 translate-y-5 scale-[0.62]" : "max-sm:translate-x-4 max-sm:translate-y-5 max-sm:scale-[0.62]",
          )}
        />
      ) : null}
    </>
  );
  const classes = cn(
    "group relative isolate block overflow-hidden rounded-panel animate-fade-up",
    compact ? "min-h-32 p-4" : "min-h-32 p-4 sm:min-h-40 sm:p-5",
    TONE_CLASSES[tone],
    href && "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-card-hover active:translate-y-0 active:scale-[0.99]",
    className,
  );
  const style = { animationDelay: `${index * 60}ms` };
  if (href) {
    return (
      <Link href={href} className={classes} style={style} aria-busy={loading || undefined}>
        {body}
      </Link>
    );
  }
  return (
    <div className={classes} style={style} aria-busy={loading || undefined}>
      {body}
    </div>
  );
}
