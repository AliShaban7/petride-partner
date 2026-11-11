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

const PADDING = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

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
  /** Small line under the title. */
  description?: ReactNode;
  /** Buttons / links on the right of the header ("View all"). */
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
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-tile bg-surface/70 text-primary-dark">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <Heading id={id} className="font-display text-h2 font-extrabold tracking-tight">
              {title}
            </Heading>
            {description ? <p className={cn("mt-0.5 text-body-sm", tone === "white" || tone === "muted" ? "text-fg-secondary" : tone === "dark" ? "text-on-primary/80" : "text-fg-tertiary")}>{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}
