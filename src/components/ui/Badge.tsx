import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Small count bubble (nav items, tabs). Coral fill with dark text. Pass the meaning to screen readers yourself. */
export function CountBadge({ count, className, max = 99 }: { count: number; className?: string; max?: number }) {
  if (count <= 0) return null;
  return (
    <span className={cn("inline-flex min-w-5 items-center justify-center rounded-chip bg-accent px-1.5 text-caption font-bold leading-5 text-fg tabular", className)}>
      {count > max ? `${max}+` : count}
    </span>
  );
}

/** Neutral chip for metadata (species, source, travel notes). */
export function Tag({ children, icon, className, tone = "muted" }: { children: ReactNode; icon?: ReactNode; className?: string; tone?: "muted" | "white" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-chip px-2.5 py-1 text-caption font-medium",
        tone === "muted" && "bg-surface-muted text-fg-tertiary",
        tone === "white" && "border border-border bg-surface text-fg-tertiary",
        tone === "warning" && "bg-warning-bg text-warning-text",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
