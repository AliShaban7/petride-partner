import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  title: ReactNode;
  /**
   * Optional secondary line under the title (small, grey). Only use it for something the page does
   * not already show: never restate the title or repeat numbers that are in the KPI cards.
   */
  description?: ReactNode;
  /** Small label above the title ("Wednesday, 11 November"). */
  eyebrow?: ReactNode;
  /**
   * Buttons, a period switcher or a search on the right, on the title's row from 640px (they wrap
   * under the title on phones and when the row runs out of room).
   */
  actions?: ReactNode;
  /** "hero" = the friendly uppercase greeting (overview); "page" = regular page title. */
  size?: "hero" | "page";
  /** false hides the description below 640px (helper text that only earns its space on wide screens). Default true. */
  descriptionOnMobile?: boolean;
  className?: string;
};

/**
 * Page title block in the chunky rounded display face. Every page renders exactly one <h1> —
 * use this component for it. Compact by design: title and actions share one row on ≥ 640px.
 */
export function PageHeader({ title, description, eyebrow, actions, size = "page", descriptionOnMobile = true, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4", className)}>
      {/* Grows, but keeps 16rem before the actions wrap under it (instead of squeezing the title). */}
      <div className="min-w-0 sm:min-w-64 sm:flex-1">
        {eyebrow ? <p className="mb-0.5 text-meta font-semibold text-fg-secondary">{eyebrow}</p> : null}
        <h1 className={cn("font-display font-extrabold tracking-tight text-fg", size === "hero" ? "text-hero uppercase" : "text-h1")}>{title}</h1>
        {description ? (
          <p className={cn("mt-0.5 max-w-3xl text-fg-secondary", size === "hero" ? "text-body" : "text-body-sm", !descriptionOnMobile && "max-sm:hidden")}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        // Hidden on phones when every action inside is phone-hidden (no empty gap).
        <div className="flex max-w-full flex-wrap items-center gap-2 max-sm:has-[>.max-sm\:hidden:only-child]:hidden">{actions}</div>
      ) : null}
    </header>
  );
}
