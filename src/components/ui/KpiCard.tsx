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
  /** false = the label is read out but not shown next to the chip (the caller shows it elsewhere, or not at all). */
  showLabel?: boolean;
  className?: string;
};

/** "↑ 12% vs last week" chip. Direction is shown by arrow + sign + words, not by colour alone. */
export function DeltaChip({ value, label, positiveIsGood = true, showLabel = true, className }: DeltaChipProps) {
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
      {showLabel && label && direction !== "none" ? (
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
  /**
   * false = `deltaLabel` is read out with the change but not shown (for narrow cards whose page already
   * states the comparison, e.g. in the header). Default true.
   */
  deltaLabelVisible?: boolean;
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
   * "md" (default): compact card, about 130px tall (32px number, small paw); two fit side by side at 360px.
   * "sm": dense card, value and change chip on one line with the "vs …" label and footnote under them
   *   (about 90–110px tall), for strips and side panels.
   * "lg": the old big card (40px number, big paw, 160px min height) for a page's single hero metric.
   */
  size?: "lg" | "md" | "sm";
  className?: string;
};

/** Per-size classes. Text on pastels is text-fg / text-fg-tertiary only. */
const KPI_SIZES = {
  lg: {
    card: "min-h-32 p-4 sm:min-h-40 sm:p-5",
    label: "text-meta sm:text-body-sm",
    icon: "size-7 sm:size-8",
    value: "mt-3 text-[1.75rem] sm:text-kpi",
    unit: "text-body-sm sm:text-title",
    foot: "mt-3 pr-8 sm:pr-[4.75rem]",
    paw: { width: 58, reach: 64, className: "max-sm:translate-x-4 max-sm:translate-y-5 max-sm:scale-[0.62]" },
  },
  md: {
    card: "p-4",
    label: "text-meta sm:text-body-sm",
    icon: "size-7",
    value: "mt-2 text-[1.75rem] sm:text-kpi-md",
    unit: "text-body-sm",
    foot: "mt-2 pr-12",
    paw: { width: 40, reach: 44, className: "" },
  },
  sm: {
    card: "rounded-card px-4 py-3",
    label: "text-meta",
    icon: "size-6 [&_svg]:size-3.5",
    value: "text-kpi-sm",
    unit: "text-meta",
    foot: "pr-10",
    paw: { width: 32, reach: 34, className: "" },
  },
} as const;

/**
 * Pastel KPI card: label with icon, big number, "↑ 10% vs last week" chip and a pet paw peeking
 * from the corner. Text on pastels is text-fg / text-fg-tertiary only.
 */
export function KpiCard({
  label,
  icon,
  value,
  unit,
  delta,
  deltaLabel,
  deltaLabelVisible = true,
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
  const z = KPI_SIZES[size];
  const inline = size === "sm";
  // "sm": the chip sits next to the value and its "vs yesterday" label moves to the line under them, so a
  // narrow card (4 or 6 across) keeps value + chip on one line instead of wrapping into three.
  const chip =
    delta !== undefined ? (
      <DeltaChip value={delta} label={deltaLabel} positiveIsGood={positiveIsGood} showLabel={!inline && deltaLabelVisible} />
    ) : null;
  const smLabel = inline && deltaLabelVisible && deltaLabel && delta !== undefined && delta !== null ? deltaLabel : null;
  const smBottom = inline && (smLabel || footnote);
  const body = (
    <>
      <div className={cn("relative z-10 flex items-center gap-2 font-semibold text-fg-tertiary", z.label)}>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full bg-surface/75 text-fg transition-transform duration-200 ease-out group-hover:-rotate-6 group-hover:scale-110",
              z.icon,
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="line-clamp-2 min-w-0 break-words">{label}</span>
      </div>
      {loading ? (
        <div className={cn("relative z-10 space-y-2", inline ? "mt-1.5" : "mt-2.5")}>
          <Skeleton className={cn("bg-surface/60", inline ? "h-6 w-24" : "h-8 w-28")} />
          {inline ? null : <Skeleton className="h-5 w-36 bg-surface/60" />}
        </div>
      ) : (
        <>
          {/* The paw art sits in the bottom-right corner: reserve room for it on whichever line is last. */}
          <div className={cn("relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1", inline && "mt-1.5", inline && !smBottom && "pr-10")}>
            <p className={cn("flex flex-wrap items-baseline gap-x-1.5 font-display font-extrabold leading-none tracking-tight text-fg tabular", z.value)}>
              <span className="whitespace-nowrap">{value}</span>
              {unit ? <span className={cn("font-bold text-fg-tertiary", z.unit)}>{unit}</span> : null}
            </p>
            {inline ? chip : null}
          </div>
          {inline ? (
            smBottom ? (
              <div className={cn("relative z-10 mt-1 text-meta text-fg-tertiary", z.foot)}>
                {smLabel ? (
                  <p aria-hidden="true" className="text-caption font-medium">
                    {smLabel}
                  </p>
                ) : null}
                {footnote ? <p>{footnote}</p> : null}
              </div>
            ) : null
          ) : (
            <div className={cn("relative z-10 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1", z.foot)}>
              {chip}
              {footnote ? <span className="text-meta text-fg-tertiary">{footnote}</span> : null}
            </div>
          )}
        </>
      )}
      {pet ? <CornerPaw pet={pet} width={z.paw.width} reach={z.paw.reach} className={cn("transition-[scale,translate] duration-300", z.paw.className)} /> : null}
    </>
  );
  const classes = cn(
    "group relative isolate block overflow-hidden rounded-panel animate-fade-up",
    z.card,
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
