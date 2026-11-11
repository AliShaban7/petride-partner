"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { IconButton, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

/** "12,80" / "12.80" / " 12 " → 12.8; null when it isn't a number. */
export function parseLocaleNumber(raw: string): number | null {
  const clean = raw.replace(/[\s ₼]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/**
 * Value with a pencil button; editing shows an input with Save / Cancel. Enter saves, Esc cancels,
 * focus goes back to the pencil after either. `validate` returns an error message or null.
 */
export function InlineNumberEdit({
  display,
  initial,
  editLabel,
  inputLabel,
  saveLabel,
  cancelLabel,
  inputMode,
  validate,
  onSave,
  suffix,
  className,
}: {
  /** Formatted value shown when not editing. */
  display: ReactNode;
  /** Raw text put in the input when editing starts. */
  initial: string;
  editLabel: string;
  inputLabel: string;
  saveLabel: string;
  cancelLabel: string;
  inputMode: "decimal" | "numeric";
  validate: (raw: string) => { value: number } | { error: string };
  /** Resolves true when saved. */
  onSave: (value: number) => Promise<boolean>;
  /** Unit inside the input ("₼"). */
  suffix?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pencil = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  /** Where focus goes after the next render (the element only exists / is enabled then). */
  const focusNext = useRef<"pencil" | "input" | null>(null);
  /** Set after a save: the refetch can re-sort the table and move this row, which drops focus. */
  const keepFocus = useRef(false);
  const errorId = useId();

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    (target === "pencil" ? pencil : input).current?.focus();
  });

  // After the saved value comes back (`initial` changes), put focus back on the pencil if the
  // row move left it on <body>.
  useEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) pencil.current?.focus();
  }, [initial]);

  const close = () => {
    setEditing(false);
    setError(null);
    focusNext.current = "pencil";
  };

  const save = async () => {
    const result = validate(text);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSaving(true);
    const ok = await onSave(result.value);
    setSaving(false);
    if (ok) {
      keepFocus.current = true;
      close();
    } else {
      // The input was disabled while saving, which dropped focus: give it back so the user can retry.
      focusNext.current = "input";
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      // Don't let Esc reach a dialog / drawer behind.
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  if (!editing) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <span className="tabular">{display}</span>
        <IconButton
          ref={pencil}
          label={editLabel}
          icon={<Pencil size={15} />}
          className="-my-2 text-fg-secondary hover:text-fg"
          onClick={() => {
            setText(initial);
            setEditing(true);
          }}
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      <span className="inline-flex items-center gap-1">
        <span className="relative">
          <input
            ref={input}
            // The user just asked to edit: put the cursor in the field.
            autoFocus
            aria-label={inputLabel}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            inputMode={inputMode}
            value={text}
            disabled={saving}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKey}
            onFocus={(e) => e.currentTarget.select()}
            className={cn(
              "h-10 w-20 rounded-input border border-control-border/70 bg-surface px-2.5 text-right text-body-sm text-fg tabular focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              suffix && "pr-6",
              error && "border-error-text",
            )}
          />
          {suffix ? <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-meta text-fg-secondary">{suffix}</span> : null}
        </span>
        {saving ? (
          <span className="inline-flex size-11 items-center justify-center">
            <Spinner size={16} />
          </span>
        ) : (
          <>
            <IconButton label={saveLabel} icon={<Check size={16} />} variant="secondary" onClick={() => void save()} />
            <IconButton label={cancelLabel} icon={<X size={16} />} onClick={close} />
          </>
        )}
      </span>
      {error ? (
        <span id={errorId} role="alert" className="max-w-56 text-right text-caption font-medium text-error-text">
          {error}
        </span>
      ) : null}
    </span>
  );
}
