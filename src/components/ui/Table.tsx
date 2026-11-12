"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";

import { Skeleton } from "./Skeleton";

// ---- Primitives ---------------------------------------------------------------------------------------

export type TableProps = ComponentProps<"table"> & {
  /** Required: what the table shows ("Today's appointments"). */
  caption: ReactNode;
  /** Show the caption visually (default: screen readers only). */
  captionVisible?: boolean;
  /** Header row sticks while the table body scrolls (inside a max-height box). */
  stickyHeader?: boolean;
  /** Max height of the scroll box when stickyHeader is on (CSS length). Default 36rem. */
  maxHeight?: string;
  wrapperClassName?: string;
};

/** Semantic table in a horizontally scrollable, keyboard-focusable box. */
export function Table({ caption, captionVisible, stickyHeader, maxHeight = "36rem", className, wrapperClassName, children, ...rest }: TableProps) {
  return (
    <div
      className={cn("relative w-full overflow-x-auto rounded-card", stickyHeader && "overflow-y-auto", wrapperClassName)}
      style={stickyHeader ? { maxHeight } : undefined}
      // Scrollable regions must be reachable by keyboard.
      tabIndex={0}
      role="region"
      aria-label={typeof caption === "string" ? caption : undefined}
      data-sticky={stickyHeader ? "" : undefined}
    >
      <table className={cn("w-full border-separate border-spacing-0 text-left text-body-sm", className)} {...rest}>
        <caption className={cn(captionVisible ? "pb-3 text-left font-display text-title font-extrabold" : "sr-only")}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...rest }: ComponentProps<"thead">) {
  return <thead className={cn("[[data-sticky]_&_th]:sticky [[data-sticky]_&_th]:top-0 [[data-sticky]_&_th]:z-10", className)} {...rest} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function Tr({ className, ...rest }: ComponentProps<"tr">) {
  return <tr className={cn("group/row", className)} {...rest} />;
}

const ALIGN = { start: "text-left", end: "text-right", center: "text-center" } as const;

export function Th({ className, align = "start", scope = "col", ...rest }: Omit<ComponentProps<"th">, "align"> & { align?: keyof typeof ALIGN }) {
  return (
    <th
      scope={scope}
      className={cn(
        scope === "row"
          ? "border-b border-border px-4 py-3 align-middle text-body-sm font-medium text-fg lg:py-2"
          : "whitespace-nowrap border-b border-border bg-surface-muted px-4 py-3 text-meta font-semibold text-fg-secondary first:rounded-tl-tile last:rounded-tr-tile lg:py-2.5",
        ALIGN[align],
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, align = "start", ...rest }: Omit<ComponentProps<"td">, "align"> & { align?: keyof typeof ALIGN }) {
  // Dense rows on desktops (36px for a line of text), roomier on touch widths.
  return <td className={cn("border-b border-border px-4 py-3 align-middle text-fg lg:py-2", ALIGN[align], className)} {...rest} />;
}

export type SortDirection = "asc" | "desc";
export type SortState = { id: string; direction: SortDirection } | null;

/** Header cell with a sort button and aria-sort. */
export function SortableTh({
  label,
  active,
  direction,
  onSort,
  align = "start",
  className,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  align?: keyof typeof ALIGN;
  className?: string;
}) {
  const t = useT("common");
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th align={align} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} className={cn("p-0 lg:p-0", className)}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex w-full items-center gap-1.5 px-4 py-3 font-semibold hover:text-fg lg:py-2.5",
          align === "end" && "justify-end",
          active && "text-fg",
        )}
      >
        {label}
        <Icon aria-hidden="true" size={14} className={active ? "opacity-100" : "opacity-50"} />
        <span className="sr-only">
          {t("table.sortBy", { column: label })}
          {active ? `, ${t(direction === "asc" ? "table.sortedAsc" : "table.sortedDesc")}` : ""}
        </span>
      </button>
    </Th>
  );
}

// ---- ResponsiveTable ------------------------------------------------------------------------------------

export type Column<T> = {
  id: string;
  /** Column title; also the label in mobile cards. Must be a string for sortable columns. */
  header: string;
  cell: (row: T) => ReactNode;
  /** Client-side sorting (or server-side via `sort` + `onSortChange`). */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: keyof typeof ALIGN;
  /** Extra classes for the <th>/<td> (e.g. "w-40", "hidden lg:table-cell"). */
  className?: string;
  /** The main identifier column → <th scope="row">, and the link/button target for the row. */
  rowHeader?: boolean;
  /**
   * Placement in the mobile card (< 640px): "title" (bold first line), "subtitle", "badge"
   * (top-right, e.g. StatusPill), "meta" (label: value line — default), "footer", "hidden".
   */
  mobile?: "title" | "subtitle" | "badge" | "meta" | "footer" | "hidden";
};

export type ResponsiveTableProps<T> = {
  caption: string;
  captionVisible?: boolean;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Controlled sort (server-side). Omit for client-side sorting with `defaultSort`. */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  defaultSort?: SortState;
  /** Row navigates (link on the row header + row click). */
  rowHref?: (row: T) => string;
  /**
   * Row opens something (button on the row header + row click), e.g. a Drawer. With `rowHref` too,
   * the row header stays a link to `rowHref` (new tab, copy link) and a plain click opens in place.
   * The second click of a double click never activates a row again (see `isRepeatClick`).
   */
  onRowClick?: (row: T) => void;
  /** Highlights a row (e.g. the one open in a drawer). */
  selectedId?: string | null;
  stickyHeader?: boolean;
  maxHeight?: string;
  /** Show skeleton rows instead of data. */
  loading?: boolean;
  skeletonRows?: number;
  /** Rendered instead of the table when `rows` is empty (and not loading). */
  empty?: ReactNode;
  /** Fully custom mobile card. */
  mobileCard?: (row: T) => ReactNode;
  className?: string;
};

/** A left click without modifier keys (Ctrl/⌘/Shift/Alt clicks keep a link's own behaviour, e.g. a new tab). */
export function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * The 2nd/3rd click of a double or triple click (`detail` > 1; keyboard activation is 0). Rows
 * ignore it, so a double click opens a record once, and the second click of a double click on a
 * modal's backdrop doesn't open the row that appears under the mouse.
 */
export function isRepeatClick(e: MouseEvent): boolean {
  return e.detail > 1;
}

const INTERACTIVE = "a,button,input,select,textarea,label,[role=menuitem],[role=switch],[role=checkbox]";

/**
 * Data table on ≥ 640px, stacked cards below (both rendered; CSS picks one, so no hydration
 * flicker). Sorting, row links/clicks, skeleton and empty state built in.
 */
export function ResponsiveTable<T>({
  caption,
  captionVisible,
  columns,
  rows,
  getRowId,
  sort: controlledSort,
  onSortChange,
  defaultSort = null,
  rowHref,
  onRowClick,
  selectedId,
  stickyHeader,
  maxHeight,
  loading,
  skeletonRows = 6,
  empty,
  mobileCard,
  className,
}: ResponsiveTableProps<T>) {
  const router = useRouter();
  const locale = useLocale();
  const [innerSort, setInnerSort] = useState<SortState>(defaultSort);
  const controlled = controlledSort !== undefined;
  const sort = controlled ? controlledSort : innerSort;

  const sortedRows = useMemo(() => {
    if (controlled || !sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), locale) * factor;
    });
  }, [controlled, sort, rows, columns, locale]);

  const toggleSort = (id: string) => {
    const next: SortState = sort?.id === id ? { id, direction: sort.direction === "asc" ? "desc" : "asc" } : { id, direction: "asc" };
    if (!controlled) setInnerSort(next);
    onSortChange?.(next);
  };

  const activate = (row: T) => {
    if (onRowClick) onRowClick(row);
    else if (rowHref) router.push(rowHref(row));
  };
  const clickable = Boolean(rowHref || onRowClick);
  const onRowMouse = (row: T) => (e: MouseEvent) => {
    if (!clickable || isRepeatClick(e)) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    activate(row);
  };

  const primaryTarget = (row: T, content: ReactNode) => {
    if (rowHref) {
      return (
        <Link
          href={rowHref(row)}
          onClick={
            onRowClick
              ? (e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  if (!isRepeatClick(e)) onRowClick(row);
                }
              : undefined
          }
          className="font-semibold text-fg underline-offset-4 hover:underline"
        >
          {content}
        </Link>
      );
    }
    if (onRowClick) {
      return (
        <button
          type="button"
          onClick={(e) => {
            if (!isRepeatClick(e)) onRowClick(row);
          }}
          className="text-left font-semibold text-fg underline-offset-4 hover:underline"
        >
          {content}
        </button>
      );
    }
    return content;
  };

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("min-w-0", className)}>
      {/* ≥ 640px: table */}
      <div className="hidden sm:block">
        <Table caption={caption} captionVisible={captionVisible} stickyHeader={stickyHeader} maxHeight={maxHeight} aria-busy={loading || undefined}>
          <THead>
            <Tr>
              {columns.map((col) =>
                col.sortable ? (
                  <SortableTh
                    key={col.id}
                    label={col.header}
                    align={col.align}
                    active={sort?.id === col.id}
                    direction={sort?.id === col.id ? sort.direction : "asc"}
                    onSort={() => toggleSort(col.id)}
                    className={col.className}
                  />
                ) : (
                  <Th key={col.id} align={col.align} className={col.className}>
                    {col.header}
                  </Th>
                ),
              )}
            </Tr>
          </THead>
          <TBody>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <Tr key={`s${i}`}>
                    {columns.map((col) => (
                      <Td key={col.id} className={col.className}>
                        <Skeleton className="h-4 w-full max-w-36" />
                      </Td>
                    ))}
                  </Tr>
                ))
              : sortedRows.map((row) => {
                  const id = getRowId(row);
                  return (
                    <Tr
                      key={id}
                      onClick={onRowMouse(row)}
                      aria-selected={selectedId !== undefined ? selectedId === id : undefined}
                      className={cn(
                        clickable && "cursor-pointer",
                        "[&>*]:transition-colors [&:hover>*]:bg-primary-selected",
                        selectedId === id && "[&>*]:bg-primary-selected",
                      )}
                    >
                      {columns.map((col) =>
                        col.rowHeader ? (
                          <Th key={col.id} scope="row" align={col.align} className={col.className}>
                            {primaryTarget(row, col.cell(row))}
                          </Th>
                        ) : (
                          <Td key={col.id} align={col.align} className={col.className}>
                            {col.cell(row)}
                          </Td>
                        ),
                      )}
                    </Tr>
                  );
                })}
          </TBody>
        </Table>
      </div>

      {/* < 640px: stacked cards */}
      <ul className="space-y-2 sm:hidden" aria-label={caption} aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: Math.min(4, skeletonRows) }, (_, i) => (
              <li key={`s${i}`} className="rounded-card border border-border bg-surface p-3.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-3 h-3 w-3/4" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </li>
            ))
          : sortedRows.map((row) => {
              const id = getRowId(row);
              return (
                <li
                  key={id}
                  onClick={onRowMouse(row)}
                  className={cn(
                    "rounded-card border border-border bg-surface p-3.5 shadow-thumb",
                    clickable && "cursor-pointer active:bg-primary-selected",
                    selectedId === id && "border-primary bg-primary-selected",
                  )}
                >
                  {mobileCard ? mobileCard(row) : <DefaultMobileCard row={row} columns={columns} primary={primaryTarget} />}
                </li>
              );
            })}
      </ul>
    </div>
  );
}

function DefaultMobileCard<T>({ row, columns, primary }: { row: T; columns: Column<T>[]; primary: (row: T, content: ReactNode) => ReactNode }) {
  const by = (slot: Column<T>["mobile"]) => columns.filter((c) => (c.mobile ?? (c.rowHeader ? "title" : "meta")) === slot);
  const titles = by("title");
  // A footer cell may render nothing for some rows (e.g. no actions for the owner) — drop the divider then.
  const footers = by("footer")
    .map((c) => ({ id: c.id, node: c.cell(row) }))
    .filter(({ node }) => node !== null && node !== undefined && node !== false && node !== "");
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          {titles.map((c, i) => (
            <div key={c.id} className="text-body font-semibold">
              {i === 0 ? primary(row, c.cell(row)) : c.cell(row)}
            </div>
          ))}
          {by("subtitle").map((c) => (
            <div key={c.id} className="text-meta text-fg-secondary">
              {c.cell(row)}
            </div>
          ))}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {by("badge").map((c) => (
            <div key={c.id}>{c.cell(row)}</div>
          ))}
        </div>
      </div>
      {by("meta").length ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
          {by("meta").map((c) => (
            <div key={c.id} className="contents">
              <dt className="text-fg-secondary">{c.header}</dt>
              <dd className="min-w-0 text-right text-fg">{c.cell(row)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {footers.length ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          {footers.map(({ id, node }) => (
            <div key={id}>{node}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
