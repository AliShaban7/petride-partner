"use client";

import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { PawPeek, type PawPet } from "@/components/illustrations";
import { errorCode } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

import { Button } from "./Button";

export type EmptyStateProps = {
  /** Defaults to common "Nothing here yet". */
  title?: string;
  description?: ReactNode;
  /** Buttons (e.g. "Clear filters"). */
  action?: ReactNode;
  pet?: PawPet;
  /** Smaller padding / paw: use it inside panels, cards and charts (full size only for a whole empty page). */
  compact?: boolean;
  className?: string;
};

/** Friendly empty state with a paw peeking out of a round window (warm copy, TONE.md). */
export function EmptyState({ title, description, action, pet = "ginger", compact, className }: EmptyStateProps) {
  const t = useT("common");
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-1.5 px-4 py-4" : "gap-2 px-6 py-8", className)}>
      <PawPeek size={compact ? 48 : 72} pet={pet} />
      <p className={cn("mt-0.5 font-display font-extrabold text-fg", compact ? "text-title" : "text-h2")}>{title ?? t("states.emptyTitle")}</p>
      <p className="max-w-sm text-body-sm text-fg-secondary">{description ?? t("states.emptyBody")}</p>
      {action ? <div className="mt-1.5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export type ErrorStateProps = {
  /** The error (ApiError codes map to common.errors.<code>). */
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
};

/** Calm error message with a retry button (no jokes in errors — TONE.md). role="alert". */
export function ErrorState({ error, title, description, onRetry, compact, className }: ErrorStateProps) {
  const t = useT("common");
  const body = description ?? (error ? t.dynamic(`errors.${errorCode(error)}`) : t("states.errorBody"));
  return (
    <div role="alert" className={cn("flex flex-col items-center text-center", compact ? "gap-1.5 px-4 py-4" : "gap-2 px-6 py-8", className)}>
      <PawPeek size={compact ? 48 : 64} pet="tabby" />
      <p className={cn("mt-0.5 font-display font-extrabold text-fg", compact ? "text-title" : "text-h2")}>{title ?? t("states.errorTitle")}</p>
      <p className="max-w-sm text-body-sm text-fg-secondary">{body}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw size={16} aria-hidden="true" />} onClick={onRetry} className="mt-1.5">
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}
