"use client";

import { useEffect, type ReactNode } from "react";

import { ErrorState, Panel, Skeleton, SkeletonText } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { QueryResult } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n/client";

/** Tells the view whether this section has unsaved edits. */
export function useReportDirty(dirty: boolean, onDirtyChange: (dirty: boolean) => void) {
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
}

/**
 * Loading (skeleton panel) / error (retry) wrapper for a section that needs several queries.
 * Renders `children` once every query has data.
 */
export function SectionGate({ queries, title, children }: { queries: QueryResult<unknown>[]; title: string; children: () => ReactNode }) {
  const tc = useT("common");
  const failed = queries.find((q) => q.data === undefined && q.error);
  if (failed) {
    return (
      <Panel title={title}>
        <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => q.data === undefined && q.refetch())} />
      </Panel>
    );
  }
  if (queries.some((q) => q.data === undefined)) {
    return (
      <Panel title={title}>
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">{tc("states.loading")}</span>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <SkeletonText lines={3} />
        </div>
      </Panel>
    );
  }
  return <>{children()}</>;
}

/** Card-like choice with an icon (categories, roles, languages). */
export function ChoiceCard({
  checked,
  children,
  className,
}: {
  checked: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-full items-start gap-3 rounded-card border-2 p-4 transition-colors",
        checked ? "border-primary bg-primary-selected" : "border-border bg-surface hover:border-control-border/50",
        className,
      )}
    >
      {children}
    </div>
  );
}
