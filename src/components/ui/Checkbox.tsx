"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
};

/** Native checkbox (keyboard + forms for free) with a custom box. */
export function Checkbox({ checked, onCheckedChange, label, description, indeterminate, disabled, hideLabel, className }: CheckboxProps) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  const descId = description ? `${id}-d` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 inline-flex size-5 shrink-0">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={descId}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-checkbox border-[1.5px] border-control-border bg-surface transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 hidden items-center justify-center text-on-primary peer-checked:flex peer-indeterminate:flex">
          {indeterminate ? <Minus size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
        </span>
      </span>
      <div className="min-w-0">
        <label htmlFor={id} className={cn("cursor-pointer text-body text-fg", hideLabel && "sr-only")}>
          {label}
        </label>
        {description ? (
          <p id={descId} className="text-meta text-fg-secondary">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
