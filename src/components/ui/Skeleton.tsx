import { cn } from "@/lib/cn";

/** Pulsing placeholder block. Wrap a group in an element with aria-busy + a sr-only "Loading". */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-skeleton rounded-tile bg-segment-track", className)} />;
}

/** `lines` text bars, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Row placeholders for lists / tables: avatar + two lines + trailing pill. */
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("divide-y divide-border", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-chip" />
        </div>
      ))}
    </div>
  );
}

/** Card-sized placeholder (KPI / chart). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("rounded-panel bg-surface p-5 shadow-card", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-4 h-9 w-1/2" />
      <Skeleton className="mt-6 h-28 w-full" />
    </div>
  );
}
