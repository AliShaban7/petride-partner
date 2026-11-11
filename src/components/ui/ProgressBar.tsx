import { cn } from "@/lib/cn";

/** Determinate progress (ride progress, stock, shares). `value` 0–1. Pass a label for screen readers. */
export function ProgressBar({
  value,
  label,
  tone = "primary",
  className,
}: {
  value: number;
  label: string;
  tone?: "primary" | "accent" | "success" | "warning";
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-chip bg-progress-track", className)}
    >
      <div
        className={cn(
          "h-full rounded-chip transition-[width] duration-500 ease-out",
          tone === "primary" && "bg-primary",
          tone === "accent" && "bg-accent",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
