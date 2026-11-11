import type { ReactNode } from "react";

import { PawMark } from "@/components/illustrations";
import { cn } from "@/lib/cn";

/**
 * A small phone-shaped card: "this is roughly how it looks in the PetRide app". The frame is
 * decorative; the content inside is real text (screen readers read it as a normal group).
 */
export function AppPreviewFrame({
  label,
  caption,
  children,
  className,
}: {
  /** Visible label above the phone ("In the app"). */
  label: ReactNode;
  /** Small line under the phone ("Updates as you type"). */
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="mb-3 flex items-center gap-2 text-body-sm font-semibold text-fg">
        <PawMark size={18} />
        {label}
      </figcaption>
      <div className="relative mx-auto w-full max-w-[22rem] rounded-[2rem] border-[6px] border-primary-dark bg-primary-dark shadow-card">
        <div aria-hidden="true" className="mx-auto mb-1 mt-1 h-1.5 w-16 rounded-chip bg-primary-dark-raised" />
        <div className="overflow-hidden rounded-[1.5rem] bg-bg">{children}</div>
      </div>
      {caption ? <p className="mt-3 text-center text-meta text-fg-secondary">{caption}</p> : null}
    </figure>
  );
}
