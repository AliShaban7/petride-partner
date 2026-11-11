"use client";

import type { ReactNode } from "react";

import type { QueryResult } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n/client";

import { EmptyState, ErrorState } from "./EmptyState";
import { SkeletonRows } from "./Skeleton";

export type AsyncViewProps<T> = {
  query: QueryResult<T>;
  /** Skeleton while loading the first time (default: 5 skeleton rows). */
  loading?: ReactNode;
  /** When true, `empty` renders instead of children. Default: empty arrays / Paged with 0 items. */
  isEmpty?: (data: T) => boolean;
  /** Empty state (default: generic EmptyState). */
  empty?: ReactNode;
  /** Compact error / empty variants inside panels. */
  compact?: boolean;
  children: (data: T) => ReactNode;
};

function defaultIsEmpty(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items: unknown[] }).items)) {
    return (data as { items: unknown[] }).items.length === 0;
  }
  return false;
}

/**
 * The loading / error / empty / data switch every data view needs:
 *   <AsyncView query={q} loading={<SkeletonRows rows={6} />} empty={<EmptyState … />}>
 *     {(data) => <List items={data.items} />}
 *   </AsyncView>
 * Keeps showing old data while refetching (aria-busy on the wrapper).
 */
export function AsyncView<T>({ query, loading, isEmpty = defaultIsEmpty, empty, compact, children }: AsyncViewProps<T>) {
  const t = useT("common");
  if (query.data === undefined) {
    if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} compact={compact} />;
    return (
      <div aria-busy="true">
        <span className="sr-only">{t("states.loading")}</span>
        {loading ?? <SkeletonRows />}
      </div>
    );
  }
  if (isEmpty(query.data)) return <>{empty ?? <EmptyState compact={compact} />}</>;
  return (
    <div aria-busy={query.isRefreshing || undefined} className="min-w-0">
      {children(query.data)}
    </div>
  );
}
