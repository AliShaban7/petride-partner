"use client";

import { cloneElement, useId, useState, type ReactElement } from "react";

import { cn } from "@/lib/cn";

export type TooltipProps = {
  /** Short supplementary text (never the only label of an icon button — use aria-label for that). */
  content: string;
  /** One focusable element. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom" | "right" | "left";
  className?: string;
};

/**
 * Hover/focus tooltip, dismissible with Esc (WCAG 1.4.13), linked with aria-describedby.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const position = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
  }[side];
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-max max-w-60 rounded-tile bg-live-surface px-2.5 py-1.5 text-meta font-medium text-on-primary shadow-floating transition-opacity duration-150",
          position,
          open ? "opacity-100" : "opacity-0",
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
