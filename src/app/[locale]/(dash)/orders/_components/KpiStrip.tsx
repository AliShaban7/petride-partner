"use client";

import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { useIsPhone } from "./hooks";

/**
 * KPI cards: a swipeable strip on phones (four stacked pastel cards would push the orders a whole
 * screen down), a grid from 640px. On phones the strip is a focusable region so keyboard users can
 * scroll it too.
 */
export function KpiStrip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const phone = useIsPhone();
  return (
    <div
      role={phone ? "region" : undefined}
      aria-label={phone ? label : undefined}
      tabIndex={phone ? 0 : undefined}
      className={cn(
        "scrollbar-none relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1",
        "sm:mx-0 sm:grid sm:snap-none sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0",
        className,
      )}
    >
      {Children.map(children, (child) =>
        isValidElement(child) ? <div className="w-[80%] max-w-80 shrink-0 snap-start sm:w-auto sm:max-w-none [&>*]:h-full">{child}</div> : child,
      )}
    </div>
  );
}
