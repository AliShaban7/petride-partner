"use client";

import { ChartColumnBig, Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

import type { PawPet } from "@/components/illustrations";
import {
  ChartLegend,
  EmptyState,
  SegmentedControl,
  TBody,
  THead,
  TONE_CLASSES,
  Table,
  Td,
  Th,
  Tr,
  type CardTone,
  type LegendItem,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

export type FigureTable = {
  columns: { id: string; header: string; align?: "start" | "end" }[];
  /** The first cell of each row is its header (`<th scope="row">`). */
  rows: { id: string; cells: ReactNode[] }[];
};

export type StatsFigureProps = {
  title: string;
  description?: ReactNode;
  /** One or two plain sentences with the key numbers, read out by screen readers. */
  summary: string;
  legend?: LegendItem[];
  /** Extra controls next to the Chart / Table switch. */
  actions?: ReactNode;
  /** Height in px of a Recharts `chart`. */
  height?: number;
  /** One Recharts chart (wrapped in a ResponsiveContainer)… */
  chart?: ReactNode;
  /** …or custom visual content (heatmap, rating bars, donut with a centre label). */
  content?: ReactNode;
  /** The numbers behind the visual, shown by the "Table" view. */
  table: FigureTable;
  /** Shown instead of the visual (and the view switch) when there's nothing to draw. */
  empty?: { title: string; description?: string; pet?: PawPet } | null;
  tone?: CardTone;
  /** Stagger index for the entrance animation. */
  index?: number;
  className?: string;
};

/**
 * A chart card for the statistics page: like the shared ChartCard (title, legend, responsive chart,
 * screen-reader summary), plus a Chart / Table switch so every chart can be read as a real table —
 * by screen-reader users, and by anyone who wants the exact numbers.
 */
export function StatsFigure({
  title,
  description,
  summary,
  legend,
  actions,
  height = 260,
  chart,
  content,
  table,
  empty,
  tone = "white",
  index = 0,
  className,
}: StatsFigureProps) {
  const t = useT("stats");
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = `fig${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const asTable = view === "table" && !empty;
  const onPastel = tone !== "white" && tone !== "muted";
  return (
    <figure
      role="group"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-s`}
      className={cn("relative m-0 flex min-w-0 animate-fade-up flex-col rounded-panel p-5 sm:p-6", TONE_CLASSES[tone], tone === "white" && "shadow-card", className)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="font-display text-h2 font-extrabold tracking-tight">
            {title}
          </h2>
          {description ? <p className={cn("mt-0.5 text-body-sm", onPastel ? "text-fg-tertiary" : "text-fg-secondary")}>{description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {empty ? null : (
            <SegmentedControl
              size="sm"
              label={`${t("view.label")}: ${title}`}
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: t("view.chart"), icon: <ChartColumnBig aria-hidden="true" size={14} /> },
                { value: "table", label: t("view.table"), icon: <Table2 aria-hidden="true" size={14} /> },
              ]}
            />
          )}
        </div>
      </div>

      {legend?.length && !empty && !asTable ? <ChartLegend items={legend} className="mb-3" /> : null}

      {empty ? (
        <EmptyState compact title={empty.title} description={empty.description} pet={empty.pet ?? "cream"} />
      ) : asTable ? (
        <FigureDataTable caption={title} table={table} maxHeight={`${Math.max(height, 288)}px`} />
      ) : chart ? (
        // Grows with the card when its grid row is taller (side-by-side cards stay level).
        <div style={{ minHeight: height }} className="relative w-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%" debounce={50} className="absolute inset-0">
            {chart}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col justify-center">{content}</div>
      )}

      <figcaption id={`${id}-s`} className="sr-only">
        {summary}
      </figcaption>
    </figure>
  );
}

function FigureDataTable({ caption, table, maxHeight }: { caption: string; table: FigureTable; maxHeight: string }) {
  return (
    <Table caption={caption} stickyHeader maxHeight={maxHeight} className="tabular">
      <THead>
        <Tr>
          {table.columns.map((c) => (
            <Th key={c.id} align={c.align}>
              {c.header}
            </Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {table.rows.map((row) => (
          <Tr key={row.id}>
            {row.cells.map((cell, i) =>
              i === 0 ? (
                <Th key={i} scope="row" align={table.columns[0]?.align} className="whitespace-nowrap">
                  {cell}
                </Th>
              ) : (
                <Td key={i} align={table.columns[i]?.align} className="whitespace-nowrap">
                  {cell}
                </Td>
              ),
            )}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
