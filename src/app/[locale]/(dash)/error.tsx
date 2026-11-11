"use client";

import { ErrorState } from "@/components/ui";

/** Error boundary for dashboard pages (keeps the shell; offers a retry). */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-panel bg-surface shadow-card">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
