"use client";

import { useId, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/cn";

import { TONE_CLASSES, type CardTone } from "./Card";
import { EmptyState, ErrorState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

/** Series colours (CSS vars from globals.css). Always pair a colour with a legend label. */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

/** Shared axis / grid styling for Recharts: <XAxis {...chartAxisProps} />. */
export const chartAxisProps = {
  stroke: "var(--color-chart-grid)",
  tick: { fill: "var(--color-chart-axis)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const chartGridProps = { stroke: "var(--color-chart-grid)", strokeDasharray: "4 4", vertical: false } as const;

export type LegendItem = { label: string; color: string; /** "line" | "dashed" | "square" marker */ shape?: "square" | "line" | "dashed" };

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-fg-secondary", className)}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn("inline-block shrink-0", item.shape === "line" || item.shape === "dashed" ? "h-0.5 w-4" : "size-3 rounded-[4px]")}
            style={
              item.shape === "dashed"
                ? { backgroundImage: `linear-gradient(90deg, ${item.color} 60%, transparent 0)`, backgroundSize: "6px 2px" }
                : { background: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

type TooltipEntry = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown };

export type ChartTooltipContentProps = {
  active?: boolean;
  label?: unknown;
  payload?: readonly TooltipEntry[];
  /** Format each value (money, %, counts). */
  valueFormatter?: (value: number, name: string) => string;
  labelFormatter?: (label: unknown) => ReactNode;
};

/** Styled tooltip body: <Tooltip content={<ChartTooltipContent valueFormatter={…} />} />. */
export function ChartTooltipContent({ active, label, payload, valueFormatter, labelFormatter }: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-tile border border-border bg-surface px-3 py-2 text-meta shadow-floating">
      {label !== undefined ? <p className="mb-1 font-semibold text-fg">{labelFormatter ? labelFormatter(label) : String(label)}</p> : null}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => {
          const name = String(entry.name ?? entry.dataKey ?? "");
          const value = typeof entry.value === "number" ? entry.value : Number(entry.value);
          return (
            <li key={`${name}-${i}`} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-fg-secondary">
                <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: entry.color }} />
                {name}
              </span>
              <span className="font-semibold text-fg tabular">{valueFormatter ? valueFormatter(value, name) : String(entry.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type ChartCardProps = {
  title: ReactNode;
  description?: ReactNode;
  /**
   * Required plain-language summary of what the chart shows (read by screen readers; the
   * chart itself is visual). E.g. "Revenue rose from 820 ₼ to 1 140 ₼ over the last 7 days."
   */
  summary: string;
  /** Show the summary visibly under the chart too. */
  showSummary?: boolean;
  legend?: LegendItem[];
  /** Controls on the right of the header (period SegmentedControl…). */
  actions?: ReactNode;
  /** Chart height in px (default 220; 160–200 for small side charts). The width always follows the card. */
  height?: number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Render the empty state instead of the chart. */
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  tone?: CardTone;
  className?: string;
  /** One Recharts chart element (it is wrapped in a ResponsiveContainer). */
  children: ReactNode;
};

/**
 * Card for one chart: title, legend, responsive container, accessible summary, and its own
 * loading / error / empty states.
 */
export function ChartCard({
  title,
  description,
  summary,
  showSummary,
  legend,
  actions,
  height = 220,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle,
  emptyDescription,
  tone = "white",
  className,
  children,
}: ChartCardProps) {
  const titleId = useId();
  const summaryId = useId();
  return (
    // A <figure> already has the "figure" role (named by the title); role="group" isn't allowed on it.
    <figure
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      aria-busy={loading || undefined}
      className={cn("relative min-w-0 rounded-panel p-4 lg:p-5", TONE_CLASSES[tone], tone === "white" && "shadow-card", className)}
    >
      {/* Title and actions share a row; the description runs under both (phones: title → description → actions). */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
        <h2 id={titleId} className="min-w-0 font-display text-h2 font-extrabold tracking-tight">
          {title}
        </h2>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:order-last max-sm:mt-1.5">{actions}</div> : null}
        {description ? <p className="basis-full text-body-sm text-fg-secondary">{description}</p> : null}
      </div>
      {legend?.length && !loading && !error && !empty ? <ChartLegend items={legend} className="mb-2" /> : null}
      <div style={{ height }} className="w-full min-w-0">
        {loading ? (
          <Skeleton className="h-full w-full rounded-card" />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact className="h-full justify-center" />
        ) : empty ? (
          <EmptyState title={emptyTitle} description={emptyDescription} compact pet="cream" className="h-full justify-center" />
        ) : (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            {children}
          </ResponsiveContainer>
        )}
      </div>
      <figcaption id={summaryId} className={showSummary ? "mt-2 text-meta text-fg-secondary" : "sr-only"}>
        {summary}
      </figcaption>
    </figure>
  );
}
