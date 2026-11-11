import { cn } from "@/lib/cn";

import { PawMark } from "./PawMark";

/** White rounded app tile with the PetRide paw mark (app BrandTile). Decorative. */
export function BrandTile({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-tile bg-surface shadow-thumb", className)}
      style={{ width: size, height: size }}
    >
      <PawMark size={Math.round(size * 0.62)} />
    </span>
  );
}
