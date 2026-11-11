"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Hide the visible label (keep it for screen readers). */
  hideLabel?: boolean;
  className?: string;
};

/** On/off toggle (role="switch"), 52×32 like the app. The whole row is clickable. */
export function Switch({ checked, onCheckedChange, label, description, disabled, hideLabel, className }: SwitchProps) {
  const id = useId();
  const descId = description ? `${id}-d` : undefined;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      {!hideLabel || description ? (
        <div className="min-w-0">
          <label htmlFor={id} className={cn("block text-body font-semibold text-fg", hideLabel && "sr-only")}>
            {label}
          </label>
          {description ? (
            <p id={descId} className="mt-0.5 text-meta text-fg-secondary">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descId}
        aria-label={hideLabel && typeof label === "string" ? label : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-8 w-13 shrink-0 items-center rounded-chip border-2 transition-colors duration-200 disabled:opacity-50",
          checked ? "border-primary bg-primary" : "border-control-border bg-segment-track",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-6 rounded-full bg-surface shadow-thumb transition-transform duration-200 ease-[var(--ease-spring)]",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
