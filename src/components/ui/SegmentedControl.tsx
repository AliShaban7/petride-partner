"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type SegmentOption<V extends string> = { value: V; label: string; icon?: ReactNode };

export type SegmentedControlProps<V extends string> = {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the group ("Period"). */
  label: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
};

/** Single choice from 2–5 options (period switcher, view mode). radiogroup + arrow keys. */
export function SegmentedControl<V extends string>({ options, value, onChange, label, size = "md", fullWidth, className }: SegmentedControlProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !back) return;
    e.preventDefault();
    const next = forward ? (index === last ? 0 : index + 1) : index === 0 ? last : index - 1;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-chip bg-segment-track p-1 scrollbar-none", fullWidth && "flex w-full", className)}
    >
      {options.map((opt, i) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-chip font-semibold transition-[background-color,color,box-shadow] duration-200",
              size === "sm" ? "min-h-8 px-3 text-meta" : "min-h-10 px-4 text-body-sm",
              fullWidth && "flex-1",
              checked ? "bg-surface text-fg shadow-thumb" : "text-fg-secondary hover:text-fg",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
