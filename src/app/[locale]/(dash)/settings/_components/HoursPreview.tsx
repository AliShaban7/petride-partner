"use client";

import { CalendarDays, MapPin } from "lucide-react";

import { AppPreviewFrame, dayRangeLabel, groupWeek, localDateKey, openState, type DayHours, type OpenState } from "@/components/services-settings";
import { Pill, type PillProps } from "@/components/ui";
import type { PartnerProfile } from "@/lib/api/types";
import { formatDate, formatTimeRange, weekdayName } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { HoursDraft } from "./HoursSection";

const toClock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h || 0, m || 0);
};
const range = (from: string, to: string) => formatTimeRange(toClock(from), toClock(to));

/**
 * Live phone preview of the hours as the PetRide app will show them: open now / closed, the week
 * grouped by equal days, and the next exceptions. Built from the unsaved draft.
 */
export function HoursPreview({ partner, draft, confirmed, now }: { partner: PartnerProfile; draft: HoursDraft; confirmed: boolean; now: Date | null }) {
  const t = useT("settings");
  const locale = useLocale();
  const week: DayHours[] = draft.days.map((d) => ({ day: d.day, open: d.open, from: d.from, to: d.to, breaks: d.breaks.map(({ from, to }) => ({ from, to })) }));
  const groups = groupWeek(week);
  const today = now ? localDateKey(now) : "";
  const upcoming = draft.exceptions.filter((e) => e.date && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const state = now ? openState(week, draft.exceptions.filter((e) => e.date), draft.alwaysOpen, now) : null;

  return (
    <AppPreviewFrame label={t("hours.preview.label")} caption={confirmed ? t("hours.preview.caption") : t("hours.preview.captionUnconfirmed")}>
      <div className="bg-soft-mint px-4 pb-4 pt-5">
        <p className="font-display text-title font-extrabold text-fg">{partner.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-caption text-fg-tertiary">
          <MapPin aria-hidden="true" size={12} />
          {partner.area}
        </p>
        <div className="mt-3">{state ? <StatePill state={state} now={now!} /> : null}</div>
      </div>
      <div className="space-y-4 px-4 pb-5 pt-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-fg-secondary">{t("hours.preview.hours")}</p>
          {draft.alwaysOpen ? (
            <p className="mt-2 text-meta font-semibold text-fg">{t("hours.preview.always")}</p>
          ) : (
            <dl className="mt-1.5 divide-y divide-border">
              {groups.map((g) => (
                <div key={g.days.join()} className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt className="text-meta text-fg-secondary">
                    <span aria-hidden="true">{dayRangeLabel(g.days, locale)}</span>
                    <span className="sr-only">
                      {g.days.length > 1 ? `${weekdayName(g.days[0], locale)} – ${weekdayName(g.days[g.days.length - 1], locale)}` : weekdayName(g.days[0], locale)}
                    </span>
                  </dt>
                  <dd className="text-right text-meta font-semibold text-fg tabular">
                    {g.open ? range(g.from, g.to) : t("hours.closed")}
                    {g.open && g.breaks.length ? (
                      <span className="block text-caption font-normal text-fg-secondary">
                        {t("hours.preview.breaks", { list: g.breaks.map((b) => range(b.from, b.to)).join(", ") })}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {upcoming.length ? (
          <div>
            <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-fg-secondary">
              <CalendarDays aria-hidden="true" size={12} />
              {t("hours.preview.special")}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {upcoming.map((e) => (
                <li key={e.id} className="rounded-tile bg-surface px-3 py-2 text-meta shadow-thumb">
                  <span className="font-semibold text-fg">{formatDate(e.date, locale)}</span>
                  <span className="text-fg-secondary"> · {e.closed ? t("hours.closed") : range(e.from, e.to)}</span>
                  {e.note.trim() ? <span className="block text-caption text-fg-secondary">{e.note.trim()}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </AppPreviewFrame>
  );
}

function StatePill({ state, now }: { state: OpenState; now: Date }) {
  const t = useT("settings");
  const locale = useLocale();
  const pill = (tone: PillProps["tone"], text: string) => <Pill tone={tone}>{text}</Pill>;
  if (state.kind === "always") return pill("success", t("hours.state.always"));
  if (state.kind === "open") return pill("success", t("hours.state.open", { time: state.until }));
  if (state.kind === "break") return pill("warning", t("hours.state.break", { time: state.until }));
  if (!state.next) return pill("neutral", t("hours.state.closed"));
  const { dayOffset, at } = state.next;
  if (dayOffset === 0) return pill("neutral", t("hours.state.opensToday", { time: at }));
  if (dayOffset === 1) return pill("neutral", t("hours.state.opensTomorrow", { time: at }));
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  return pill("neutral", t("hours.state.opensOn", { day: weekdayName(day.getDay() || 7, locale), time: at }));
}
