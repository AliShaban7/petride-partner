"use client";

import { ArrowRight, Clock } from "lucide-react";
import { useMemo } from "react";

import { buildWeek, dayRangeLabel, groupWeek, Notice, openState, useMinuteNow, type OpenState, type PartnerExtras } from "@/components/services-settings";
import { ButtonLink, ErrorState, Panel, Pill, Skeleton } from "@/components/ui";
import type { PartnerProfile } from "@/lib/api/types";
import { formatTimeRange, weekdayName } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

const toClock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m);
};

/** Summary of the opening hours as the app shows them, with a link to edit them in Settings. */
export function HoursCard({
  partner,
  extras,
  error,
  onRetry,
}: {
  partner: PartnerProfile | undefined;
  extras: PartnerExtras | undefined;
  error?: Error;
  onRetry?: () => void;
}) {
  const t = useT("services");
  const locale = useLocale();
  const now = useMinuteNow();
  const week = useMemo(() => (partner ? buildWeek(partner.hours, extras?.hours) : []), [partner, extras]);
  const groups = useMemo(() => groupWeek(week), [week]);
  const alwaysOpen = Boolean(extras?.hours.alwaysOpen);
  const state = partner && now ? openState(week, extras?.hours.exceptions ?? [], alwaysOpen, now) : null;
  const href = localizedHref(locale, ROUTES.settings, { tab: "hours" });

  return (
    <Panel
      title={t("hours.title")}
      description={t("hours.description")}
      icon={<Clock size={20} />}
      actions={
        <ButtonLink href={href} variant="ghost" size="sm" rightIcon={<ArrowRight aria-hidden="true" size={16} />}>
          {partner && !partner.hoursConfirmed ? t("hours.confirm") : t("hours.edit")}
        </ButtonLink>
      }
    >
      {!partner && error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : !partner ? (
        <div aria-hidden="true" className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-chip" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : (
        <div className="space-y-4">
          {!partner.hoursConfirmed ? (
            <Notice tone="warning" title={t("hours.unconfirmedTitle")}>
              {t("hours.unconfirmedBody")}
            </Notice>
          ) : state && now ? (
            <StateLine state={state} now={now} />
          ) : null}
          {alwaysOpen ? (
            <p className="text-body-sm text-fg">{t("hours.alwaysOpen")}</p>
          ) : (
            <dl className="divide-y divide-border">
              {groups.map((g) => (
                <div key={g.days.join()} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-body-sm text-fg-secondary">
                    <span aria-hidden="true">{dayRangeLabel(g.days, locale)}</span>
                    <span className="sr-only">
                      {g.days.length > 1 ? `${weekdayName(g.days[0], locale)} – ${weekdayName(g.days[g.days.length - 1], locale)}` : weekdayName(g.days[0], locale)}
                    </span>
                  </dt>
                  <dd className="text-right text-body-sm font-semibold text-fg tabular">
                    {g.open ? formatTimeRange(toClock(g.from), toClock(g.to)) : t("hours.closed")}
                    {g.open && g.breaks.length ? (
                      <span className="block text-meta font-normal text-fg-secondary">
                        {t("hours.breaks", { list: g.breaks.map((b) => formatTimeRange(toClock(b.from), toClock(b.to))).join(", ") })}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </Panel>
  );
}

function StateLine({ state, now }: { state: OpenState; now: Date }) {
  const t = useT("services");
  const locale = useLocale();
  if (state.kind === "always") return <Pill tone="success">{t("hours.state.always")}</Pill>;
  if (state.kind === "open") return <Pill tone="success">{t("hours.state.open", { time: state.until })}</Pill>;
  if (state.kind === "break") return <Pill tone="warning">{t("hours.state.break", { time: state.until })}</Pill>;
  if (!state.next) return <Pill tone="neutral">{t("hours.state.closed")}</Pill>;
  const { dayOffset, at } = state.next;
  if (dayOffset === 0) return <Pill tone="neutral">{t("hours.state.opensToday", { time: at })}</Pill>;
  if (dayOffset === 1) return <Pill tone="neutral">{t("hours.state.opensTomorrow", { time: at })}</Pill>;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  return <Pill tone="neutral">{t("hours.state.opensOn", { day: weekdayName(day.getDay() || 7, locale), time: at })}</Pill>;
}
