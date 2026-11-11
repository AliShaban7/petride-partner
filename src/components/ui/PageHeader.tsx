import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  title: ReactNode;
  /** Line under the title. */
  description?: ReactNode;
  /** Small label above the title ("Wednesday, 11 November"). */
  eyebrow?: ReactNode;
  /** Buttons on the right (wrap under the title on mobile). */
  actions?: ReactNode;
  /** "hero" = the huge playful greeting size (overview); "page" = regular page title. */
  size?: "hero" | "page";
  className?: string;
};

/**
 * Page title block in the chunky rounded display face. Every page renders exactly one <h1> —
 * use this component for it.
 */
export function PageHeader({ title, description, eyebrow, actions, size = "page", className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between", className)}>
      <div className="min-w-0 md:flex-1">
        {eyebrow ? <p className="mb-1 text-body-sm font-semibold text-fg-secondary">{eyebrow}</p> : null}
        <h1
          className={cn(
            "font-display font-extrabold tracking-tight text-fg",
            size === "hero" ? "text-hero uppercase" : "text-h1 sm:text-[2.25rem] sm:leading-[2.5rem]",
          )}
        >
          {title}
        </h1>
        {description ? <p className={cn("mt-2 max-w-2xl text-fg-secondary", size === "hero" ? "text-title" : "text-body")}>{description}</p> : null}
      </div>
      {actions ? (
        // Hidden on phones when every action inside is phone-hidden (no empty 16px gap).
        <div className="flex max-w-full flex-wrap items-center gap-2 max-sm:has-[>.max-sm\:hidden:only-child]:hidden">{actions}</div>
      ) : null}
    </header>
  );
}
