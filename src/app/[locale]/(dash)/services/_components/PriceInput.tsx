"use client";

import type { ComponentProps } from "react";

import { controlClass, parsePrice, priceInputText } from "@/components/services-settings";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/config";

export type PriceInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
  locale: Locale;
  invalid?: boolean;
};

/**
 * Manat amount field: decimal keyboard on phones, `₼` after the number (az/ru) or before it (en)
 * like formatMoney, and the text tidied on blur (`12.5` → `12,50`).
 */
export function PriceInput({ value, onValueChange, locale, invalid, className, onBlur, ...rest }: PriceInputProps) {
  const prefix = locale === "en";
  return (
    <div className="relative">
      {prefix ? (
        <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-fg-secondary">
          ₼
        </span>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={(e) => {
          const parsed = parsePrice(value);
          if (parsed.ok) {
            const tidy = priceInputText(parsed.value, locale);
            if (tidy !== value) onValueChange(tidy);
          }
          onBlur?.(e);
        }}
        className={cn(controlClass, "tabular font-semibold", prefix ? "pl-8" : "pr-9", className)}
        {...rest}
      />
      {!prefix ? (
        <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-fg-secondary">
          ₼
        </span>
      ) : null}
    </div>
  );
}
