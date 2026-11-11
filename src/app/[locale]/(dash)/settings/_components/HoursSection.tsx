"use client";

import { CalendarPlus, CalendarX2, Clock, Copy, MoreHorizontal, Plus, X } from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  buildWeek,
  controlClass,
  EXTRAS_TAG,
  extrasApi,
  isClock,
  localDateKey,
  Notice,
  SaveBar,
  toMinutes,
  useDraft,
  useExtras,
  useMinuteNow,
  type HoursException,
  type PartnerExtras,
} from "@/components/services-settings";
import { Button, ConfirmDialog, IconButton, Input, Menu, Panel, Switch, Tag, useToast } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { IsoWeekday, OpeningHoursDay, PartnerProfile } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, weekdayName } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { HoursPreview } from "./HoursPreview";
import { SectionGate, useReportDirty } from "./shared";
import type { SectionProps } from "./sections";

type BreakDraft = { id: string; from: string; to: string };
type DayDraft = { day: IsoWeekday; open: boolean; from: string; to: string; breaks: BreakDraft[] };
export type HoursDraft = { alwaysOpen: boolean; days: DayDraft[]; exceptions: HoursException[] };

const MAX_BREAKS = 3;
let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

function toDraft(partner: PartnerProfile, extras: PartnerExtras): HoursDraft {
  return {
    alwaysOpen: extras.hours.alwaysOpen,
    days: buildWeek(partner.hours, extras.hours).map((d) => ({ ...d, breaks: d.breaks.map((b, i) => ({ id: `b${d.day}-${i}`, ...b })) })),
    exceptions: extras.hours.exceptions.map((e) => ({ ...e })),
  };
}

/** Equality without the client-only break ids. */
function equals(a: HoursDraft, b: HoursDraft): boolean {
  const strip = (d: HoursDraft) => ({
    alwaysOpen: d.alwaysOpen,
    days: d.days.map((x) => ({ day: x.day, open: x.open, from: x.from, to: x.to, breaks: x.breaks.map((br) => [br.from, br.to]) })),
    exceptions: d.exceptions.map((e) => [e.id, e.date, e.closed, e.closed ? "" : e.from, e.closed ? "" : e.to, e.note.trim()]),
  });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

// ---- Validation ------------------------------------------------------------------------------------

type DayErrors = { range?: string; breaks: Record<string, string> };
type Errors = { days: Partial<Record<IsoWeekday, DayErrors>>; exceptions: Record<string, { date?: string; range?: string }>; count: number };

type ErrorKey = "range" | "breakOrder" | "breakOutside" | "breakOverlap" | "dateMissing" | "datePast" | "dateDuplicate";

function validate(draft: HoursDraft, today: string, savedExceptions: HoursException[], msg: (key: ErrorKey) => string, showMissing: boolean): Errors {
  const errors: Errors = { days: {}, exceptions: {}, count: 0 };
  if (!draft.alwaysOpen) {
    for (const d of draft.days) {
      if (!d.open) continue;
      const e: DayErrors = { breaks: {} };
      const valid = isClock(d.from) && isClock(d.to) && toMinutes(d.from) < toMinutes(d.to);
      if (!valid) e.range = msg("range");
      const sorted = [...d.breaks].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
      sorted.forEach((b, i) => {
        if (!isClock(b.from) || !isClock(b.to) || toMinutes(b.from) >= toMinutes(b.to)) e.breaks[b.id] = msg("breakOrder");
        else if (valid && (toMinutes(b.from) <= toMinutes(d.from) || toMinutes(b.to) >= toMinutes(d.to))) e.breaks[b.id] = msg("breakOutside");
        else if (i > 0 && toMinutes(b.from) < toMinutes(sorted[i - 1].to)) e.breaks[b.id] = msg("breakOverlap");
      });
      const count = (e.range ? 1 : 0) + Object.keys(e.breaks).length;
      if (count) {
        errors.days[d.day] = e;
        errors.count += count;
      }
    }
  }
  const seen = new Set<string>();
  for (const ex of draft.exceptions) {
    const e: { date?: string; range?: string } = {};
    const saved = savedExceptions.find((s) => s.id === ex.id && s.date === ex.date);
    if (!ex.date) {
      if (showMissing) e.date = msg("dateMissing");
    } else if (seen.has(ex.date)) e.date = msg("dateDuplicate");
    else if (ex.date < today && !saved) e.date = msg("datePast");
    if (ex.date) seen.add(ex.date);
    if (!ex.closed && (!isClock(ex.from) || !isClock(ex.to) || toMinutes(ex.from) >= toMinutes(ex.to))) e.range = msg("range");
    const count = (e.date ? 1 : 0) + (e.range ? 1 : 0);
    if (count) {
      errors.exceptions[ex.id] = e;
      errors.count += count;
    }
  }
  return errors;
}

/** Working hours: weekly schedule with breaks, closed days, dated exceptions and the 24/7 switch. */
export function HoursSection({ onDirtyChange }: SectionProps) {
  const t = useT("settings");
  const partnerQ = useApiQuery(["partner"], (api) => api.getPartner());
  const extrasQ = useExtras();
  return (
    <SectionGate queries={[partnerQ, extrasQ]} title={t("hours.title")}>
      {() => <HoursForm partner={partnerQ.data!} extras={extrasQ.data!} onDirtyChange={onDirtyChange} />}
    </SectionGate>
  );
}

function HoursForm({ partner, extras, onDirtyChange }: { partner: PartnerProfile; extras: PartnerExtras } & SectionProps) {
  const t = useT("settings");
  const tc = useT("common");
  const { toast } = useToast();
  const now = useMinuteNow();
  const today = now ? localDateKey(now) : "";
  const todayIso = now ? ((now.getDay() || 7) as IsoWeekday) : null;

  const serverBase = useMemo(() => toDraft(partner, extras), [partner, extras]);
  const { draft = serverBase, base = serverBase, setDraft, dirty, reset, commit } = useDraft(serverBase, equals);
  useReportDirty(dirty, onDirtyChange);
  const [showErrors, setShowErrors] = useState(false);
  const [confirm247, setConfirm247] = useState(false);
  const instructionsId = useId();

  const msg = (key: ErrorKey) => t(`hours.errors.${key}`);
  const errors = validate(draft, today, base.exceptions, msg, showErrors);

  const save = useApiMutation(
    async (api, d: HoursDraft) => {
      const weekly: OpeningHoursDay[] = d.days.map(({ day, open, from, to }) => ({ day, open, from, to }));
      const hours = d.alwaysOpen ? weekly.map((h) => ({ day: h.day, open: true, from: "00:00", to: "23:59" })) : weekly;
      await api.updatePartner({ hours });
      await extrasApi.updateHours(api.partnerId, {
        alwaysOpen: d.alwaysOpen,
        weekly: d.alwaysOpen ? weekly : null,
        breaks: Object.fromEntries(d.days.filter((x) => x.breaks.length).map((x) => [x.day, x.breaks.map(({ from, to }) => ({ from, to }))])),
        exceptions: d.exceptions.map((e) => ({ ...e, note: e.note.trim() })).sort((a, b) => a.date.localeCompare(b.date)),
      });
    },
    { invalidates: ["partner", EXTRAS_TAG, "overview"] },
  );

  const onSave = async () => {
    const full = validate(draft, today, base.exceptions, msg, true);
    if (full.count) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-hours-form="${instructionsId}"] [aria-invalid="true"]`)?.focus());
      return;
    }
    const sent = draft;
    try {
      await save.mutateAsync(sent);
      commit(({ draft: current }) => ({ base: sent, draft: current }));
      setShowErrors(false);
      toast({ title: partner.hoursConfirmed ? t("hours.toast.saved") : t("hours.toast.confirmed"), description: t("hours.toast.body") });
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  const setDay = (day: IsoWeekday, patch: Partial<DayDraft>) => setDraft((d) => ({ ...d, days: d.days.map((x) => (x.day === day ? { ...x, ...patch } : x)) }));
  const copyDay = (source: DayDraft, targets: IsoWeekday[]) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((x) =>
        targets.includes(x.day) && x.day !== source.day
          ? { ...x, open: source.open, from: source.from, to: source.to, breaks: source.breaks.map((b) => ({ ...b, id: uid("b") })) }
          : x,
      ),
    }));
  const setException = (id: string, patch: Partial<HoursException>) =>
    setDraft((d) => ({ ...d, exceptions: d.exceptions.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const saveMessage = showErrors && errors.count ? t.plural("saveBar.fix", errors.count) : t("saveBar.message");

  return (
    <div className="space-y-6 @container" data-hours-form={instructionsId}>
      <Notice tone="app" title={t("hours.appTitle")}>
        {t("hours.appBody")}
      </Notice>
      {!partner.hoursConfirmed ? (
        <Notice
          tone="warning"
          role="status"
          title={t("hours.unconfirmedTitle")}
          action={
            <Button variant="primary" size="sm" onClick={onSave} loading={save.isPending}>
              {dirty ? t("hours.saveAndConfirm") : t("hours.confirm")}
            </Button>
          }
        >
          {t("hours.unconfirmedBody")}
        </Notice>
      ) : null}

          <Panel title={t("hours.weekTitle")} description={t("hours.weekDescription")} icon={<Clock size={20} />} bodyClassName="@container">
            <div className="mb-5 rounded-card bg-surface-muted p-4">
              <Switch
                checked={draft.alwaysOpen}
                onCheckedChange={(on) => (on ? setConfirm247(true) : setDraft((d) => ({ ...d, alwaysOpen: false })))}
                label={t("hours.alwaysOpen")}
                description={t("hours.alwaysOpenHint")}
              />
            </div>

            {draft.alwaysOpen ? (
              <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-body-sm text-fg-secondary">{t("hours.alwaysOpenOn")}</p>
            ) : (
              <>
                <div
                  aria-hidden="true"
                  className="hidden grid-cols-[9.5rem_8rem_minmax(0,1fr)_2.75rem] gap-x-3 border-b border-border pb-2 text-meta font-semibold text-fg-secondary @min-[42rem]:grid"
                >
                  <span>{t("hours.columns.day")}</span>
                  <span>{t("hours.columns.status")}</span>
                  <span>{t("hours.columns.hours")}</span>
                  <span />
                </div>
                <ul className="space-y-3 @min-[42rem]:space-y-0">
                  {draft.days.map((d) => (
                    <DayRow
                      key={d.day}
                      day={d}
                      isToday={d.day === todayIso}
                      errors={errors.days[d.day]}
                      onChange={(patch) => setDay(d.day, patch)}
                      onCopy={(targets) => copyDay(d, targets)}
                    />
                  ))}
                </ul>
              </>
            )}
          </Panel>

        <div className="grid gap-6 @min-[52rem]:grid-cols-[minmax(0,1fr)_20rem] @min-[52rem]:items-start">
          <Panel
            title={t("hours.exceptions.title")}
            description={t("hours.exceptions.description")}
            icon={<CalendarX2 size={20} />}
            bodyClassName="@container"
            actions={
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CalendarPlus aria-hidden="true" size={16} />}
                onClick={() =>
                  setDraft((d) => ({ ...d, exceptions: [...d.exceptions, { id: uid("ex"), date: "", closed: true, from: "10:00", to: "16:00", note: "" }] }))
                }
              >
                {t("hours.exceptions.add")}
              </Button>
            }
          >
            {draft.exceptions.length === 0 ? (
              <p className="rounded-card bg-surface-muted px-4 py-6 text-center text-body-sm text-fg-secondary">{t("hours.exceptions.empty")}</p>
            ) : (
              <ul className="space-y-3">
                {draft.exceptions.map((ex) => (
                  <ExceptionRow
                    key={ex.id}
                    ex={ex}
                    min={today}
                    past={Boolean(today && ex.date && ex.date < today)}
                    errors={errors.exceptions[ex.id]}
                    onChange={(patch) => setException(ex.id, patch)}
                    onRemove={() => setDraft((d) => ({ ...d, exceptions: d.exceptions.filter((e) => e.id !== ex.id) }))}
                  />
                ))}
              </ul>
            )}
          </Panel>
          <div className="min-w-0 @min-[52rem]:sticky @min-[52rem]:top-[calc(var(--topbar-h)+1.5rem)]">
            <HoursPreview partner={partner} draft={draft} confirmed={partner.hoursConfirmed} now={now} />
          </div>
        </div>

      <SaveBar
        visible={dirty}
        saving={save.isPending}
        label={t("saveBar.label")}
        message={saveMessage}
        hint={partner.hoursConfirmed ? t("hours.saveHint") : t("hours.saveHintConfirm")}
        saveLabel={partner.hoursConfirmed ? t("saveBar.save") : t("hours.saveAndConfirm")}
        discardLabel={t("saveBar.discard")}
        onSave={onSave}
        onDiscard={() => {
          reset();
          setShowErrors(false);
        }}
      />

      <ConfirmDialog
        open={confirm247}
        onClose={() => setConfirm247(false)}
        onConfirm={() => {
          setDraft((d) => ({ ...d, alwaysOpen: true }));
          setConfirm247(false);
        }}
        title={t("hours.confirm247.title")}
        description={t("hours.confirm247.body")}
        confirmLabel={t("hours.confirm247.confirm")}
      />
    </div>
  );
}

// ---- Rows ------------------------------------------------------------------------------------------

function TimeField({
  label,
  srPrefix,
  value,
  onChange,
  invalid,
  describedBy,
  visibleLabelClass = "@min-[42rem]:sr-only",
}: {
  label: string;
  srPrefix: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  visibleLabelClass?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-meta font-semibold text-fg-secondary">
        <span className="sr-only">{srPrefix}: </span>
        <span className={visibleLabelClass}>{label}</span>
      </span>
      <input
        type="time"
        step={300}
        value={value}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={cn(controlClass, "w-[7.75rem] px-3 tabular")}
      />
    </label>
  );
}

const WEEKDAYS_ONLY: IsoWeekday[] = [1, 2, 3, 4, 5];
const WEEKEND: IsoWeekday[] = [6, 7];
const ALL_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

function DayRow({
  day,
  isToday,
  errors,
  onChange,
  onCopy,
}: {
  day: DayDraft;
  isToday: boolean;
  errors: DayErrors | undefined;
  onChange: (patch: Partial<DayDraft>) => void;
  onCopy: (targets: IsoWeekday[]) => void;
}) {
  const t = useT("settings");
  const locale = useLocale();
  const id = useId();
  const name = weekdayName(day.day, locale);
  const rangeErrorId = `${id}-range`;

  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 gap-y-3 rounded-card border border-border p-3",
        "@min-[42rem]:grid-cols-[9.5rem_8rem_minmax(0,1fr)_2.75rem] @min-[42rem]:items-start @min-[42rem]:rounded-none @min-[42rem]:border-0 @min-[42rem]:border-b @min-[42rem]:px-0 @min-[42rem]:py-3",
        !day.open && "bg-surface-muted @min-[42rem]:bg-transparent",
      )}
    >
      <div className="col-start-1 row-start-1 flex min-w-0 flex-wrap items-center gap-2 @min-[42rem]:pt-2.5">
        <p className="text-body font-semibold text-fg">{name}</p>
        {isToday ? <Tag tone="white">{t("hours.today")}</Tag> : null}
      </div>
      <div className="col-start-2 row-start-1 @min-[42rem]:pt-1.5">
        <Switch
          checked={day.open}
          onCheckedChange={(open) => onChange({ open })}
          label={
            <span className="text-body-sm">
              <span className="sr-only">{name}: </span>
              {t("hours.open")}
            </span>
          }
          className="items-center justify-start gap-3"
        />
      </div>
      <div className="col-span-3 col-start-1 row-start-2 min-w-0 @min-[42rem]:col-span-1 @min-[42rem]:col-start-3 @min-[42rem]:row-start-1">
        {day.open ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <TimeField
                label={t("hours.from")}
                srPrefix={name}
                value={day.from}
                invalid={Boolean(errors?.range)}
                describedBy={errors?.range ? rangeErrorId : undefined}
                onChange={(from) => onChange({ from })}
              />
              <span aria-hidden="true" className="pb-3 text-fg-secondary">
                –
              </span>
              <TimeField
                label={t("hours.to")}
                srPrefix={name}
                value={day.to}
                invalid={Boolean(errors?.range)}
                describedBy={errors?.range ? rangeErrorId : undefined}
                onChange={(to) => onChange({ to })}
              />
            </div>
            {errors?.range ? (
              <p id={rangeErrorId} className="text-meta font-medium text-error-text">
                {errors.range}
              </p>
            ) : null}

            {day.breaks.length ? (
              <ul className="space-y-2" aria-label={t("hours.breaksLabel", { day: name })}>
                {day.breaks.map((b, i) => {
                  const err = errors?.breaks[b.id];
                  const errId = `${id}-b${i}`;
                  return (
                    <li key={b.id} className="rounded-tile bg-soft-sand p-2.5">
                      <p className="mb-1.5 text-meta font-semibold text-fg-tertiary">{t("hours.breakN", { n: i + 1 })}</p>
                      <div className="flex flex-wrap items-end gap-2">
                        <TimeField
                          label={t("hours.breakFrom")}
                          srPrefix={`${name}, ${t("hours.breakN", { n: i + 1 })}`}
                          visibleLabelClass="sr-only"
                          value={b.from}
                          invalid={Boolean(err)}
                          describedBy={err ? errId : undefined}
                          onChange={(from) => onChange({ breaks: day.breaks.map((x) => (x.id === b.id ? { ...x, from } : x)) })}
                        />
                        <span aria-hidden="true" className="pb-3 text-fg-tertiary">
                          –
                        </span>
                        <TimeField
                          label={t("hours.breakTo")}
                          srPrefix={`${name}, ${t("hours.breakN", { n: i + 1 })}`}
                          visibleLabelClass="sr-only"
                          value={b.to}
                          invalid={Boolean(err)}
                          describedBy={err ? errId : undefined}
                          onChange={(to) => onChange({ breaks: day.breaks.map((x) => (x.id === b.id ? { ...x, to } : x)) })}
                        />
                        <IconButton
                          label={t("hours.removeBreak", { day: name, n: i + 1 })}
                          icon={<X size={18} />}
                          onClick={() => onChange({ breaks: day.breaks.filter((x) => x.id !== b.id) })}
                        />
                      </div>
                      {err ? (
                        <p id={errId} className="mt-1 text-meta font-medium text-error-text">
                          {err}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {day.breaks.length < MAX_BREAKS ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus aria-hidden="true" size={16} />}
                onClick={() => onChange({ breaks: [...day.breaks, { id: uid("b"), from: "13:00", to: "14:00" }] })}
              >
                {t("hours.addBreak")}
                <span className="sr-only">: {name}</span>
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-body-sm text-fg-secondary @min-[42rem]:pt-2.5">{t("hours.closedAllDay")}</p>
        )}
      </div>
      <div className="col-start-3 row-start-1 flex justify-end @min-[42rem]:col-start-4 @min-[42rem]:pt-0.5">
        <Menu
          label={t("hours.copyMenu", { day: name })}
          items={[
            { id: "all", label: t("hours.copyAll"), icon: <Copy aria-hidden="true" size={16} />, onSelect: () => onCopy(ALL_DAYS) },
            { id: "weekdays", label: t("hours.copyWeekdays"), icon: <Copy aria-hidden="true" size={16} />, onSelect: () => onCopy(WEEKDAYS_ONLY) },
            { id: "weekend", label: t("hours.copyWeekend"), icon: <Copy aria-hidden="true" size={16} />, onSelect: () => onCopy(WEEKEND) },
          ]}
          trigger={(props) => <IconButton {...props} label={t("hours.copyMenu", { day: name })} icon={<MoreHorizontal size={20} />} />}
        />
      </div>
    </li>
  );
}

function ExceptionRow({
  ex,
  min,
  past,
  errors,
  onChange,
  onRemove,
}: {
  ex: HoursException;
  min: string;
  past: boolean;
  errors: { date?: string; range?: string } | undefined;
  onChange: (patch: Partial<HoursException>) => void;
  onRemove: () => void;
}) {
  const t = useT("settings");
  const locale = useLocale();
  const id = useId();
  const label = ex.date ? formatDate(ex.date, locale) : t("hours.exceptions.newDate");
  return (
    <li className="rounded-card border border-border p-3 sm:p-4">
      <div className="grid gap-3 @min-[36rem]:grid-cols-[11rem_minmax(0,1fr)_2.75rem] @min-[36rem]:items-start">
        <div className="min-w-0">
          <Input
            type="date"
            label={t("hours.exceptions.date")}
            value={ex.date}
            min={min || undefined}
            required
            error={errors?.date}
            className="tabular"
            onChange={(e) => onChange({ date: e.target.value })}
          />
          {past ? (
            <Tag className="mt-2" tone="white">
              {t("hours.exceptions.past")}
            </Tag>
          ) : null}
        </div>
        <div className="min-w-0 space-y-3">
          <Switch
            checked={ex.closed}
            onCheckedChange={(closed) => onChange({ closed })}
            label={
              <span className="text-body-sm">
                {t("hours.exceptions.closed")}
                <span className="sr-only">: {label}</span>
              </span>
            }
            className="items-center justify-start gap-3"
          />
          {!ex.closed ? (
            <div>
              <div className="flex flex-wrap items-end gap-2">
                <TimeField
                  label={t("hours.from")}
                  srPrefix={label}
                  visibleLabelClass=""
                  value={ex.from}
                  invalid={Boolean(errors?.range)}
                  describedBy={errors?.range ? `${id}-range` : undefined}
                  onChange={(from) => onChange({ from })}
                />
                <span aria-hidden="true" className="pb-3 text-fg-secondary">
                  –
                </span>
                <TimeField
                  label={t("hours.to")}
                  srPrefix={label}
                  visibleLabelClass=""
                  value={ex.to}
                  invalid={Boolean(errors?.range)}
                  describedBy={errors?.range ? `${id}-range` : undefined}
                  onChange={(to) => onChange({ to })}
                />
              </div>
              {errors?.range ? (
                <p id={`${id}-range`} className="mt-1 text-meta font-medium text-error-text">
                  {errors.range}
                </p>
              ) : null}
            </div>
          ) : null}
          <Input
            label={t("hours.exceptions.note")}
            value={ex.note}
            maxLength={60}
            placeholder={t("hours.exceptions.notePlaceholder")}
            hint={t("hours.exceptions.noteHint")}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </div>
        <div className="flex justify-end @min-[36rem]:pt-7">
          <IconButton label={t("hours.exceptions.remove", { date: label })} icon={<X size={18} />} onClick={onRemove} />
        </div>
      </div>
    </li>
  );
}
