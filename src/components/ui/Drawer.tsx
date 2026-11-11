"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

import { IconButton } from "./IconButton";
import { Portal, useModalLayer } from "./overlay";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action bar at the bottom. */
  footer?: ReactNode;
  /** Extra buttons next to the × in the header. */
  headerActions?: ReactNode;
  /** "auto": bottom sheet on phones (< 640px), right panel from 640px. */
  side?: "auto" | "right" | "left" | "bottom";
  size?: "sm" | "md" | "lg";
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Hide the visible title (still labels the dialog). */
  hideTitle?: boolean;
  className?: string;
};

const WIDTHS = { sm: "sm:w-[min(24rem,100vw)]", md: "sm:w-[min(32rem,100vw)]", lg: "sm:w-[min(44rem,100vw)]" } as const;

/**
 * Side panel / bottom sheet (details of an appointment, order, client; the mobile "More" sheet).
 * Modal: aria-modal, focus trap, Esc, scroll lock, focus return, backdrop click closes.
 */
export function Drawer({ open, onClose, title, description, children, footer, headerActions, side = "auto", size = "md", initialFocusRef, hideTitle, className }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const t = useT("common");
  useModalLayer(open, ref, onClose, initialFocusRef);
  if (!open) return null;

  const position = {
    auto: cn("inset-x-0 bottom-0 max-h-[92dvh] rounded-t-panel animate-sheet-up sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:rounded-l-panel sm:animate-sheet-left", WIDTHS[size]),
    right: cn("inset-y-0 right-0 w-full rounded-l-panel animate-sheet-left", WIDTHS[size]),
    left: cn("inset-y-0 left-0 w-[min(20rem,88vw)] rounded-r-panel animate-fade-in"),
    bottom: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-panel animate-sheet-up",
  }[side];

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-overlay" onClick={onClose} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn("absolute flex flex-col overflow-hidden bg-surface shadow-sheet", position, className)}
        >
          {side === "bottom" || side === "auto" ? (
            <div aria-hidden="true" className={cn("mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-chip bg-border", side === "auto" && "sm:hidden")} />
          ) : null}
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className={cn("font-display text-h2 font-extrabold tracking-tight", hideTitle && "sr-only")}>
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-body-sm text-fg-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="-mr-2 flex shrink-0 items-center gap-1">
              {headerActions}
              <IconButton label={t("a11y.closeDialog")} icon={<X size={20} />} onClick={onClose} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">{children}</div>
          {footer ? <div className="safe-bottom flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3 sm:px-6">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}

/** Alias: a bottom/side sheet is the same component. */
export const Sheet = Drawer;
