"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Portal, useModalLayer } from "./overlay";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons row (right-aligned, stacked on phones). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Element to focus first (default: first focusable). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** "alertdialog" for destructive confirmations. */
  role?: "dialog" | "alertdialog";
  /** Hide the × button (e.g. while saving). */
  hideClose?: boolean;
};

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" } as const;

/** Centered modal: aria-modal, focus trap, Esc, scroll lock, focus return. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", initialFocusRef, role = "dialog", hideClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const t = useT("common");
  useModalLayer(open, ref, onClose, initialFocusRef);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
        <div aria-hidden="true" className="absolute inset-0 animate-fade-in bg-overlay" onClick={onClose} />
        <div
          ref={ref}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn("relative flex max-h-[calc(100dvh-1.5rem)] w-full animate-pop flex-col overflow-hidden rounded-panel bg-surface shadow-sheet", SIZES[size])}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-h2 font-extrabold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-body-sm text-fg-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            {!hideClose ? <IconButton label={t("a11y.closeDialog")} icon={<X size={20} />} onClick={onClose} className="-mr-2 -mt-2" /> : null}
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div> : null}
          {footer ? <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">{footer}</div> : null}
        </div>
      </div>
    </Portal>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger → red confirm button + role="alertdialog". */
  tone?: "primary" | "danger";
  loading?: boolean;
  /** Extra fields (e.g. a reason textarea). */
  children?: ReactNode;
  confirmDisabled?: boolean;
};

/** Yes/no confirmation built on Dialog. The cancel button gets initial focus for destructive actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, tone = "primary", loading, children, confirmDisabled }: ConfirmDialogProps) {
  const t = useT("common");
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      role={tone === "danger" ? "alertdialog" : "dialog"}
      initialFocusRef={tone === "danger" ? cancelRef : undefined}
      hideClose={loading}
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("actions.cancel")}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
