"use client";

import { RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

export type SaveBarProps = {
  /** Show the bar (there are unsaved edits, or a save is running). */
  visible: boolean;
  /** "2 unsaved changes" / "Fix 1 field to save". */
  message: ReactNode;
  /** Smaller second line ("The app updates right after you save"). */
  hint?: ReactNode;
  saveLabel: string;
  discardLabel: string;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Accessible name of the bar region. */
  label: string;
  className?: string;
};

/**
 * Sticky bar at the bottom of a form while it has unsaved edits: stays above the phone tab bar,
 * sits in the content column (never under the sidebar). Dark teal like the sidebar; the save
 * button is the coral fill with dark text.
 */
export function SaveBar({ visible, message, hint, saveLabel, discardLabel, saving, onSave, onDiscard, label, className }: SaveBarProps) {
  if (!visible && !saving) return null;
  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        "sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-20 mt-6 animate-fade-up sm:bottom-5",
        className,
      )}
    >
      <div
        data-surface="dark"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-primary-dark px-4 py-3 text-on-primary shadow-sheet sm:flex-nowrap"
      >
        <span aria-hidden="true" className="relative inline-flex size-2.5 shrink-0 rounded-full bg-accent">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold">{message}</p>
          {hint ? <p className="mt-0.5 hidden text-meta text-on-primary-muted sm:block">{hint}</p> : null}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="onDark"
            size="sm"
            onClick={onDiscard}
            disabled={saving}
            leftIcon={<RotateCcw aria-hidden="true" size={16} />}
            className="flex-1 sm:flex-none"
          >
            {discardLabel}
          </Button>
          <Button variant="accent" size="sm" onClick={onSave} loading={saving} leftIcon={<Save aria-hidden="true" size={16} />} className="flex-1 sm:flex-none">
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
