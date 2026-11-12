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
  actions?: ReactNode;
};

/**
 * The big playful greeting ("SABAHIN XEYİR, IDEA!") with today's date above it. No summary line:
 * the KPI cards and the panels right under it already say how many visits, requests and rides
 * there are. Time-dependent text only appears after hydration (useNow is null on the server).
 */
export function OverviewHero({ name, actions }: OverviewHeroProps) {
  const t = useT("overview");
  const locale = useLocale();
  const now = useNow(60_000);
  const key = now === null ? "hello" : greetingKey(now);
  return (
    <PageHeader
      size="hero"
      eyebrow={now === null ? " " : formatWeekdayDate(now, locale)}
      title={<span className={cn("inline-block", now === null ? "invisible" : "animate-fade-up")}>{t(`greeting.${key}`, { name })}</span>}
      actions={actions}
    />
  );
}
