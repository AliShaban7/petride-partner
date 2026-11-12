import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "outline" | "onDark";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // white on teal 6.3:1
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-thumb",
  // teal text on mint tint 5.4:1
  secondary: "bg-primary-tint text-primary hover:bg-pastel-mint",
  ghost: "bg-transparent text-fg hover:bg-surface-muted",
  // coral is a FILL ONLY with dark text (6.3:1)
  accent: "bg-accent text-fg hover:bg-accent-hover shadow-thumb",
  // white on accent-strong 4.9:1
  danger: "bg-accent-strong text-on-primary hover:bg-accent-strong-hover",
  outline: "bg-surface text-fg border border-control-border/60 hover:bg-surface-muted",
  // for dark teal surfaces (sidebar)
  onDark: "bg-primary-dark-raised text-on-primary hover:bg-primary-dark-deep",
};

const SIZES: Record<ButtonSize, string> = {
  // Touch widths (< 1024px): every size has a ≥ 44px hit area (sm: 40px plus an invisible ::after
  // reaching 2px above and below). From 1024px (mouse) sm and md are 4px denser.
  sm: "min-h-10 px-3.5 text-body-sm gap-1.5 rounded-tile relative max-lg:after:absolute max-lg:after:inset-x-0 max-lg:after:-inset-y-0.5 max-lg:after:content-[''] lg:min-h-9 lg:px-3",
  md: "min-h-11 px-4.5 text-body gap-2 rounded-button lg:min-h-10 lg:px-4",
  lg: "min-h-13 px-6 text-title gap-2.5 rounded-button lg:min-h-12",
};

/** Shared classes so links and other elements can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; className?: string } = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon before the label (a lucide icon element, e.g. <Check size={18} />). */
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

export type ButtonProps = ComponentProps<"button"> &
  CommonProps & {
    /** Shows a spinner, disables the button and sets aria-busy. Keep the label (it stays visible). */
    loading?: boolean;
  };

/**
 * Buttons: primary (teal), secondary (mint tint), ghost, accent (coral fill + dark text), danger,
 * outline, onDark. Sizes sm (40px; 36px from 1024px), md (44px; 40px), lg (52px; 48px). Labels start with a verb (TONE.md).
 */
export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  loading = false,
  fullWidth,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 16 : 18} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & CommonProps;

/** A next/link styled as a button (navigation, not actions). */
export function ButtonLink({ variant = "primary", size = "md", leftIcon, rightIcon, fullWidth, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
