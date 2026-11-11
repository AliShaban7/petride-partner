"use client";

import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatWeekdayDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { greetingKey, useNow } from "./now";

export type OverviewHeroProps = {
  /** Partner short name ("IDEA"). */
  name: string;
  /** Summary sentences; null while loading (skeleton), [] when there is nothing to say (error). */
  summary: string[] | null;
  actions?: ReactNode;
};

/**
 * The big playful greeting ("SABAHIN XEYİR, IDEA!") with today's date above it and a one-line
 * summary under it. Time-dependent text only appears after hydration (useNow is null on the server).
 */
export function OverviewHero({ name, summary, actions }: OverviewHeroProps) {
  const t = useT("overview");
  const locale = useLocale();
  const now = useNow(60_000);
  const key = now === null ? "hello" : greetingKey(now);
  return (
    <PageHeader
      size="hero"
      eyebrow={now === null ? " " : formatWeekdayDate(now, locale)}
      title={<span className={cn("inline-block", now === null ? "invisible" : "animate-fade-up")}>{t(`greeting.${key}`, { name })}</span>}
      description={summary === null ? <SummarySkeleton /> : summary.length ? summary.join(" ") : undefined}
      actions={actions}
    />
  );
}

function SummarySkeleton() {
  const t = useT("overview");
  return (
    <span className="inline-flex w-full max-w-xl flex-col gap-2 align-middle">
      <span className="sr-only">{t("summary.loading")}</span>
      <span aria-hidden="true" className="block h-4 w-full animate-skeleton rounded-tile bg-segment-track" />
      <span aria-hidden="true" className="block h-4 w-3/5 animate-skeleton rounded-tile bg-segment-track" />
    </span>
  );
}
