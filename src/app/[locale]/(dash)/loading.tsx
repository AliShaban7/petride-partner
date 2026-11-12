import { Skeleton, SkeletonCard } from "@/components/ui";

/** Route-level skeleton while a dashboard page's server part loads. */
export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-section">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-panel" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  );
}
