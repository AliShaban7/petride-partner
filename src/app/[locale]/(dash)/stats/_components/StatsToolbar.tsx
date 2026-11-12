"use client";

import { useState } from "react";

import { DateInput, SegmentedControl, Select, Switch } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/client";

import { customRange, parseDay, presetRange, PRESETS, type CustomRangeError, type PeriodKind, type StatsRange } from "../_lib/range";
import { rangeLabel, windowLabel } from "../_lib/labels";

export type PeriodControlsProps = {
  range: StatsRange;
  compare: boolean;
  today: string;
  onRangeChange: (range: StatsRange) => void;
  onCompareChange: (compare: boolean) => void;
};

/**
 * Period picker (7 / 30 / 90 days / custom dates) + "compare with previous period" switch, made
 * to sit in the PageHeader actions (the title's row). The custom date fields render separately
 * (`CustomRangeFields`) under the header, only while "Custom" is picked.
 */
export function PeriodControls({ range, compare, today, onRangeChange, onCompareChange }: PeriodControlsProps) {
  const t = useT("stats");
  const tc = useT("common");
  const options = [
    ...PRESETS.map((p) => ({ value: p as PeriodKind, label: tc(`periods.${p}`) })),
    { value: "custom" as PeriodKind, label: t("toolbar.custom") },
  ];
  const choose = (kind: PeriodKind) => {
    if (kind === range.kind) return;
    // "Custom" starts from the dates on screen, so the partner only adjusts them.
    onRangeChange(kind === "custom" ? { ...range, kind: "custom" } : presetRange(kind, today));
  };

  return (
    <div role="group" aria-label={t("toolbar.label")} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      {/* Phones: native select (44 px, no squeezed labels). Wider: segmented control. */}
      <Select
        wrapperClassName="w-40 sm:hidden"
        label={tc("periods.label")}
        hideLabel
        value={range.kind}
        onChange={(e) => choose(e.target.value as PeriodKind)}
        options={options}
      />
      <div className="hidden sm:block">
        <SegmentedControl label={tc("periods.label")} value={range.kind} onChange={choose} options={options} />
      </div>
      <Switch
        checked={compare}
        onCheckedChange={onCompareChange}
        // Short visible word; the full phrase is the accessible name (it contains the visible word).
        label={
          <span className="text-body-sm">
            <span aria-hidden="true">{t("toolbar.compareShort")}</span>
            <span className="sr-only">{t("toolbar.compare")}</span>
          </span>
        }
        className="items-center gap-2.5"
      />
    </div>
  );
}

/** The dates on screen and what they're compared with (PageHeader description; read out when it changes). */
export function RangeLine({ range, previous, compare, comparable }: { range: StatsRange; previous: StatsRange; compare: boolean; comparable: boolean }) {
  const t = useT("stats");
  const locale = useLocale();
  return (
    <span aria-live="polite" className="inline-flex flex-wrap gap-x-3 gap-y-0.5">
      <span className="font-semibold text-fg">
        {t("toolbar.range", { range: rangeLabel(range, t, locale), days: t.plural("count.days", range.days) })}
      </span>
      {compare ? <span>{comparable ? t("toolbar.comparedWith", { range: windowLabel(previous, t, locale) }) : t("toolbar.noHistory")}</span> : null}
    </span>
  );
}

type Draft = { from: string; to: string };

/**
 * Two native date fields. A valid pair applies at once (the URL updates); while the pair is
 * invalid the last valid range stays on screen and the field says what's wrong.
 */
export function CustomRangeFields({ from, to, today, onApply }: { from: string; to: string; today: string; onApply: (range: StatsRange) => void }) {
  const t = useT("stats");
  const [draft, setDraft] = useState<Draft>({ from, to });
  const [applied, setApplied] = useState<Draft>({ from, to });
  const [touched, setTouched] = useState(false);
  // The URL changed from outside (back / forward): show its dates.
  if (applied.from !== from || applied.to !== to) {
    setApplied({ from, to });
    setDraft({ from, to });
  }

  const result = customRange(draft.from, draft.to, today);
  const error: CustomRangeError | null = typeof result === "string" ? result : null;
  const visibleError = error && (error !== "invalid" || touched) ? t(`toolbar.errors.${error}`) : undefined;
  const errorOnFrom = error === "tooLong" || (error === "invalid" && parseDay(draft.from) === null);

  const update = (next: Draft) => {
    setDraft(next);
    const range = customRange(next.from, next.to, today);
    if (typeof range !== "string") onApply(range);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start">
      <DateInput
        label={t("toolbar.from")}
        value={draft.from}
        max={draft.to || today}
        onChange={(e) => update({ ...draft, from: e.target.value })}
        onBlur={() => setTouched(true)}
        error={errorOnFrom ? visibleError : undefined}
        wrapperClassName="min-w-0 sm:w-44"
      />
      <DateInput
        label={t("toolbar.to")}
        value={draft.to}
        min={draft.from || undefined}
        max={today}
        onChange={(e) => update({ ...draft, to: e.target.value })}
        onBlur={() => setTouched(true)}
        error={errorOnFrom ? undefined : visibleError}
        wrapperClassName="min-w-0 sm:w-44"
      />
    </div>
  );
}
