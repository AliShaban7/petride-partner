import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  /** Accessible name — required, the button has no visible text. */
  label: string;
  /** The icon element, e.g. <Bell size={20} />. */
  icon: ReactNode;
  variant?: "ghost" | "secondary" | "primary" | "outline" | "onDark";
  size?: "sm" | "md" | "lg";
  /** Small count bubble (e.g. unread notifications). Announced as part of the label by the caller. */
  badge?: number;
};

const VARIANTS = {
  ghost: "text-fg hover:bg-surface-muted",
  secondary: "bg-primary-tint text-primary hover:bg-pastel-mint",
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  outline: "bg-surface text-fg border border-border hover:bg-surface-muted",
  onDark: "text-on-primary hover:bg-primary-dark-raised",
} as const;

// sm is 36px; below 1024px an invisible ::after grows its hit area to 44px.
const SIZES = { sm: "size-9 max-lg:after:absolute max-lg:after:-inset-1 max-lg:after:content-['']", md: "size-11", lg: "size-12" } as const;

/** Icon-only button (≥ 44×44 at md). Always pass `label`; it becomes aria-label and the tooltip title. */
export function IconButton({ label, icon, variant = "ghost", size = "md", badge, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-50 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-chip bg-accent px-1 text-caption font-bold text-fg ring-2 ring-surface"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}
