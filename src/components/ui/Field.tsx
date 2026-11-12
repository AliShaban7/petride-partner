"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

// ---- Field wrapper ----------------------------------------------------------------------------------

export type FieldProps = {
  label: ReactNode;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Error text — also sets aria-invalid on the control. */
  error?: ReactNode;
  /** Visually hide the label (it stays for screen readers). */
  hideLabel?: boolean;
  required?: boolean;
  className?: string;
  /** Render prop gets the ids to wire into a custom control. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/** Label + control + hint/error with correct ids (use for custom controls). */
export function Field({ label, hint, error, hideLabel, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const t = useT("common");
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className={cn("text-body-sm font-semibold text-fg", hideLabel && "sr-only")}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="text-error-text">
              {" "}
              *
            </span>
            <span className="sr-only"> ({t("a11y.required")})</span>
          </>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-meta font-medium text-error-text">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-meta text-fg-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Joins the field's own hint/error ids with a caller's aria-describedby. */
function mergeIds(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}

const control =
  "w-full min-h-11 lg:min-h-10 rounded-input border border-control-border/70 bg-surface px-3.5 text-body text-fg placeholder:text-fg-secondary/80 transition-[border-color,box-shadow] duration-150 hover:border-control-border focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-secondary aria-[invalid=true]:border-error-text aria-[invalid=true]:ring-error-text/20";

type ControlBase = { label: ReactNode; hint?: ReactNode; error?: ReactNode; hideLabel?: boolean; wrapperClassName?: string };

// ---- Input ------------------------------------------------------------------------------------------------

export type InputProps = Omit<ComponentProps<"input">, "size"> &
  ControlBase & {
    /** Icon inside the left edge. */
    leftIcon?: ReactNode;
    /** Element inside the right edge (unit "₼", a show-password button…). */
    rightSlot?: ReactNode;
  };

/** Text input with label, hint and error. */
export function Input({ label, hint, error, hideLabel, required, wrapperClassName, leftIcon, rightSlot, className, "aria-describedby": ariaDescribedBy, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leftIcon ? <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-secondary">{leftIcon}</span> : null}
          <input
            id={id}
            aria-describedby={mergeIds(describedBy, ariaDescribedBy)}
            aria-invalid={invalid || undefined}
            required={required}
            className={cn(control, leftIcon && "pl-10", rightSlot && "pr-12", className)}
            {...rest}
          />
          {rightSlot ? <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">{rightSlot}</span> : null}
        </div>
      )}
    </Field>
  );
}

// ---- Textarea ---------------------------------------------------------------------------------------------

export type TextareaProps = ComponentProps<"textarea"> & ControlBase;

export function Textarea({ label, hint, error, hideLabel, required, wrapperClassName, className, rows = 4, "aria-describedby": ariaDescribedBy, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={mergeIds(describedBy, ariaDescribedBy)}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(control, "min-h-24 resize-y py-2.5 leading-relaxed", className)}
          {...rest}
        />
      )}
    </Field>
  );
}

// ---- Select -----------------------------------------------------------------------------------------------

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<ComponentProps<"select">, "children"> &
  ControlBase & {
    options: SelectOption[];
    /** Optional first empty option ("All services"). */
    placeholder?: string;
  };

/** Native select (best keyboard/screen-reader support on every platform), styled. */
export function Select({ label, hint, error, hideLabel, required, wrapperClassName, options, placeholder, className, "aria-describedby": ariaDescribedBy, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={mergeIds(describedBy, ariaDescribedBy)}
            aria-invalid={invalid || undefined}
            required={required}
            className={cn(control, "appearance-none pr-10", className)}
            {...rest}
          >
            {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-secondary" />
        </div>
      )}
    </Field>
  );
}

// ---- DateInput --------------------------------------------------------------------------------------------

export type DateInputProps = Omit<InputProps, "type"> & {
  /** "date" (YYYY-MM-DD), "time" (HH:MM) or "datetime-local". */
  kind?: "date" | "time" | "datetime-local";
};

/** Native date/time picker (localised by the browser), same look as Input. */
export function DateInput({ kind = "date", className, ...rest }: DateInputProps) {
  return <Input type={kind} className={cn("tabular", className)} {...rest} />;
}

// ---- SearchField ------------------------------------------------------------------------------------------

export type SearchFieldProps = Omit<ComponentProps<"input">, "onChange" | "value" | "size"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Show the label visually (default hidden — the placeholder + icon explain it). */
  showLabel?: boolean;
  wrapperClassName?: string;
};

/** Search box with icon and clear button. Debounce in the page if the query hits the API. */
export function SearchField({ label, value, onValueChange, showLabel, wrapperClassName, className, placeholder, ...rest }: SearchFieldProps) {
  const t = useT("common");
  const id = useId();
  return (
    // A named search landmark, so two search boxes on one page (top bar + a list) stay distinguishable.
    <div className={cn("flex min-w-0 flex-col gap-1.5", wrapperClassName)} role="search" aria-label={label}>
      <label htmlFor={id} className={cn("text-body-sm font-semibold", !showLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-secondary" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder ?? label}
          className={cn(control, "rounded-chip pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden", className)}
          {...rest}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onValueChange("")}
            aria-label={t("actions.clear")}
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-muted hover:text-fg"
          >
            <X aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
