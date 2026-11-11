"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** With total + pageSize the "21–40 of 230" range is shown. */
  total?: number;
  pageSize?: number;
  className?: string;
};

function pages(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p += 1) out.push(p);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}

/** Page navigation: numbers with ellipses on ≥ 640px, "Page 2 of 9" on phones. */
export function Pagination({ page, pageCount, onPageChange, total, pageSize, className }: PaginationProps) {
  const t = useT("common");
  const locale = useLocale();
  if (pageCount <= 1 && !total) return null;
  const from = total && pageSize ? (page - 1) * pageSize + 1 : 0;
  const to = total && pageSize ? Math.min(total, page * pageSize) : 0;
  const btn = "inline-flex size-10 items-center justify-center rounded-full text-body-sm font-semibold transition-colors";
  return (
    <nav aria-label={t("table.pagination")} className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-meta text-fg-secondary tabular" aria-live="polite">
        {total && pageSize
          ? t("table.range", { from: formatNumber(from, locale), to: formatNumber(to, locale), total: formatNumber(total, locale) })
          : t("table.pageOf", { page, count: pageCount })}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(btn, "hover:bg-surface-muted disabled:opacity-40")}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label={t("table.previous")}
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <ul className="hidden items-center gap-1 sm:flex">
            {pages(page, pageCount).map((p, i) =>
              p === "…" ? (
                <li key={`e${i}`} aria-hidden="true" className="px-1 text-fg-secondary">
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    aria-current={p === page ? "page" : undefined}
                    aria-label={t("table.page", { page: p })}
                    className={cn(btn, p === page ? "bg-primary text-on-primary" : "text-fg hover:bg-surface-muted")}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
          </ul>
          <span className="px-2 text-meta text-fg-secondary sm:hidden">{t("table.pageOf", { page, count: pageCount })}</span>
          <button
            type="button"
            className={cn(btn, "hover:bg-surface-muted disabled:opacity-40")}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label={t("table.next")}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
