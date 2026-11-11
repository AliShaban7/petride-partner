"use client";

import { useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { useDismiss } from "./overlay";

export type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Render the trigger; spread `props` on the button. */
  trigger: (props: { "aria-expanded": boolean; "aria-controls": string; "aria-haspopup": "dialog"; onClick: () => void }) => ReactNode;
  /** Accessible name of the panel. */
  label: string;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
};

/**
 * Non-modal popup panel anchored under its trigger (notifications, filters). Closes on outside
 * click, Esc (focus returns to the trigger) or focus leaving it. Fits 360px screens.
 */
export function Popover({ open, onOpenChange, trigger, label, children, align = "end", className }: PopoverProps) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  useDismiss(open, [wrap], (reason) => {
    onOpenChange(false);
    if (reason === "escape") wrap.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
  });
  return (
    <div ref={wrap} className="relative">
      {trigger({ "aria-expanded": open, "aria-controls": id, "aria-haspopup": "dialog", onClick: () => onOpenChange(!open) })}
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-40 w-[min(24rem,calc(100vw-2rem))] animate-pop overflow-hidden rounded-card border border-border bg-surface shadow-floating",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
