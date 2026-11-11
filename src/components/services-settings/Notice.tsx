import { CircleAlert, Info, Smartphone, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "warning" | "app" | "danger";

const TONES: Record<NoticeTone, { box: string; icon: typeof Info }> = {
  info: { box: "bg-soft-mint", icon: Info },
  app: { box: "bg-soft-lilac", icon: Smartphone },
  warning: { box: "bg-soft-sand", icon: TriangleAlert },
  danger: { box: "bg-error-bg", icon: CircleAlert },
};

/**
 * Inline callout on a soft pastel fill (text-fg / text-fg-tertiary only, per the pastel rule).
 * `app` = "this shows in the PetRide app" notes.
 */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  icon,
  className,
  role,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={role} className={cn("flex flex-col gap-3 rounded-card p-4 sm:flex-row sm:items-center", box, className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface/80 text-fg">
          {icon ?? <Icon size={16} strokeWidth={2.2} />}
        </span>
        <div className="min-w-0">
          {title ? <p className="text-body-sm font-semibold text-fg">{title}</p> : null}
          {children ? <div className={cn("text-body-sm text-fg-tertiary", title && "mt-0.5")}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div> : null}
    </div>
  );
}
