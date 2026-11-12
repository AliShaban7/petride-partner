import { useId, type ComponentProps, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Surface tones. Pastels are decorative fills: text on them must be text-fg or text-fg-tertiary
 * (never text-fg-secondary / text-primary — below 4.5:1 on some pastels).
 */
export type CardTone = "white" | "muted" | "mint" | "peach" | "lilac" | "sand" | "sky" | "rose" | "softMint" | "softPeach" | "softLilac" | "softSand" | "dark";

export const TONE_CLASSES: Record<CardTone, string> = {
  white: "bg-surface border border-border",
  muted: "bg-surface-muted",
  mint: "bg-pastel-mint",
  peach: "bg-pastel-peach",
  lilac: "bg-pastel-lilac",
  sand: "bg-pastel-sand",
  sky: "bg-pastel-sky",
  rose: "bg-pastel-rose",
  softMint: "bg-soft-mint",
  softPeach: "bg-soft-peach",
  softLilac: "bg-soft-lilac",
  softSand: "bg-soft-sand",
  dark: "bg-primary-dark text-on-primary",
};

/** Inner padding. md (default) is 16px, 20px from 1024px; xs is for dense side lists. */
const PADDING = { none: "", xs: "p-3", sm: "p-4", md: "p-4 lg:p-5", lg: "p-5 lg:p-6" } as const;

export type CardProps = ComponentProps<"div"> & {
  tone?: CardTone;
  padding?: keyof typeof PADDING;
  /** Lift on hover (for clickable cards). */
  interactive?: boolean;
  as?: ElementType;
};

/** Rounded container. Radius 20 (card); use Panel for titled sections. */
export function Card({ tone = "white", padding = "md", interactive, as: Tag = "div", className, ...rest }: CardProps) {
  return (
    <Tag
      data-surface={tone === "dark" ? "dark" : undefined}
      className={cn(
        "relative rounded-card",
        TONE_CLASSES[tone],
        tone === "white" && "shadow-card",
        PADDING[padding],
        interactive && "transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
      {...rest}
    />
  );
}

export type PanelProps = Omit<ComponentProps<"section">, "title"> & {
  /** Section heading (h2 by default). */
  title: ReactNode;
  /** Small line under the title. Only for what the panel doesn't already show (no "updates every 10 s", no restated title). */
  description?: ReactNode;
  /** Buttons / links on the right of the header ("View all"). Share the title row, so put filters here too. */
  actions?: ReactNode;
  /** Icon before the title. */
  icon?: ReactNode;
  tone?: CardTone;
  padding?: keyof typeof PADDING;
  headingLevel?: 2 | 3;
  /** id for the heading (aria-labelledby). Generated when omitted. */
  headingId?: string;
  bodyClassName?: string;
};

/**
 * Titled section on a rounded surface (radius 28) — the dashboard building block
 * ("Appointments", "Pets data summary", "Grooming schedule"…). Renders <section aria-labelledby>.
 */
export function Panel({
  title,
  description,
  actions,
  icon,
  tone = "white",
  padding = "md",
  headingLevel = 2,
  headingId,
  className,
  bodyClassName,
  children,
  ...rest
}: PanelProps) {
  const autoId = useId();
  const id = headingId ?? `panel${autoId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      aria-labelledby={id}
      data-surface={tone === "dark" ? "dark" : undefined}
      className={cn("relative min-w-0 rounded-panel", TONE_CLASSES[tone], tone === "white" && "shadow-card", PADDING[padding], className)}
      {...rest}
    >
      {/*
        Title and actions share the first row (the actions wrap only when the title runs out of room) and
        the description runs under both, so a long description doesn't push "View all" onto its own row.
        Phones keep title → description → actions. The header is a size container: when it is narrower
        than 21rem (phones, three panels across on a desktop) the decorative icon tile drops out, so the
        title and "View all" can share one row.
      */}
      <header className="@container mb-3 flex items-start gap-2.5">
        {icon ? (
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface/70 text-primary-dark @max-[21rem]:hidden"
          >
            {icon}
          </span>
        ) : null}
        <div className={cn("flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 max-sm:gap-y-1.5", icon && "min-h-9 @max-[21rem]:min-h-0")}>
          <Heading id={id} className="min-w-0 font-display text-h2 font-extrabold tracking-tight">
            {title}
          </Heading>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:order-last">{actions}</div> : null}
          {description ? (
            <p className={cn("basis-full text-body-sm", tone === "white" || tone === "muted" ? "text-fg-secondary" : tone === "dark" ? "text-on-primary/80" : "text-fg-tertiary")}>
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}
