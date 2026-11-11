import { cn } from "@/lib/cn";

/**
 * Full-bleed pastel backdrop (app SoftBackground): mint → cream → peach with large soft blobs.
 * Absolute-fills its `relative` parent, decorative. Text on it keeps text-fg / text-fg-secondary /
 * text-primary (≥ 4.5:1 everywhere — see tokens `illustration`).
 */
export function SoftBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        background: [
          "radial-gradient(60% 45% at 8% 6%, var(--color-ill-blob-mint) 0%, transparent 70%)",
          "radial-gradient(55% 45% at 102% 58%, var(--color-ill-blob-peach) 0%, transparent 70%)",
          "radial-gradient(50% 40% at -5% 86%, var(--color-ill-blob-lilac) 0%, transparent 70%)",
          "linear-gradient(180deg, var(--color-ill-bg-mint) 0%, var(--color-ill-bg-cream) 50%, var(--color-ill-bg-peach) 100%)",
        ].join(", "),
      }}
    />
  );
}
