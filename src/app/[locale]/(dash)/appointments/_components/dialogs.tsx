"use client";

import { CalendarCheck, CircleAlert, Clock } from "lucide-react";
import { useId, useState } from "react";

import { Button, ConfirmDialog, DateInput, Dialog, Input, Spinner, Textarea } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, OpeningHoursDay } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatDuration, formatMoney, formatNumber, formatTime, formatTimeRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

import { checkSlot, suggestSlots } from "../_lib/conflicts";
import { MINUTE, ceilToQuarter, combineDateTime, parseIsoDay, startOfDay, toClock, toIsoDay } from "../_lib/time";

// ---- Decline / cancel with a reason -------------------------------------------------------------------

const REASONS = {
  decline: ["busy", "unavailable", "notOffered", "other"],
  cancel: ["clientAsked", "staff", "closed", "other"],
} as const;

/** Decline a request or cancel an appointment. The reason goes to the client in the app. */
export function ReasonDialog({ kind, appointment, onClose, onConfirm }: { kind: "decline" | "cancel"; appointment: Appointment; onClose: () => void; onConfirm: (reason: string) => void }) {
  const t = useT("appointments");
  const name = useId();
  const [choice, setChoice] = useState<string>(REASONS[kind][0]);
  const [other, setOther] = useState("");
  const reason = choice === "other" ? other.trim() : t.dynamic(`dialogs.${kind}.reasons.${choice}`);
  const client = appointment.clientName.split(" ")[0];
  return (
    <ConfirmDialog
      open
      tone="danger"
      onClose={onClose}
      onConfirm={() => reason && onConfirm(reason)}
      confirmDisabled={!reason}
      title={t.dynamic(`dialogs.${kind}.title`, { pet: appointment.petName })}
      description={[t.dynamic(`dialogs.${kind}.body`, { client }), appointment.withRide ? t("dialogs.rideCancelled") : ""].filter(Boolean).join(" ")}
      confirmLabel={t.dynamic(`dialogs.${kind}.confirm`)}
      cancelLabel={t("dialogs.keep")}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-body-sm font-semibold text-fg">{t("dialogs.reasonLabel")}</legend>
        {REASONS[kind].map((r) => (
          <label
            key={r}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-tile border border-border px-3 py-2 text-body-sm text-fg transition-colors hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-primary-selected"
          >
            <input type="radio" name={name} value={r} checked={choice === r} onChange={() => setChoice(r)} className="size-4 shrink-0 accent-primary" />
            {t.dynamic(`dialogs.${kind}.reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      {choice === "other" ? (
        <Textarea
          label={t("dialogs.otherReason")}
          hint={t("dialogs.reasonHint")}
          rows={3}
          maxLength={300}
          value={other}
          onChange={(e) => setOther(e.target.value)}
          wrapperClassName="mt-3"
          required
        />
      ) : null}
    </ConfirmDialog>
  );
}

// ---- No-show ----------------------------------------------------------------------------------------------

export function NoShowDialog({ appointment, onClose, onConfirm }: { appointment: Appointment; onClose: () => void; onConfirm: () => void }) {
  const t = useT("appointments");
  return (
    <ConfirmDialog
      open
      tone="danger"
      onClose={onClose}
      onConfirm={onConfirm}
      title={t("dialogs.noShow.title", { pet: appointment.petName })}
      description={[t("dialogs.noShow.body"), appointment.returnRide ? t("dialogs.noShow.ride") : ""].filter(Boolean).join(" ")}
      confirmLabel={t("dialogs.noShow.confirm")}
      cancelLabel={t("dialogs.keep")}
    />
  );
}

// ---- Complete with the final amount -----------------------------------------------------------------------

/**
 * What staff type into the amount field → manat, or null. Accepts both decimal marks and the
 * grouping each locale prints (az/ru `1 200,50`, en `1,200.50`), so the prefilled value always
 * parses back to itself: "12,80" / "12.80" → 12.8, "1 200" → 1200, en "1,200" → 1200.
 */
export function parseAmount(value: string, locale: Locale): number | null {
  let clean = value.replace(/[\s\u00a0\u202f]/g, "").replace(/₼/g, "");
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma !== -1 && dot !== -1) {
    // Both marks: the last one is the decimal mark, the other one groups thousands.
    const decimalMark = comma > dot ? "," : ".";
    const groupMark = decimalMark === "," ? "." : ",";
    clean = clean.split(groupMark).join("").replace(decimalMark, ".");
  } else if (comma !== -1) {
    // English groups with commas ("1,200"); everywhere else a comma is the decimal mark.
    clean = locale === "en" && /^\d{1,3}(,\d{3})+$/.test(clean) ? clean.replace(/,/g, "") : clean.replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function amountInput(n: number, locale: Locale): string {
  return formatNumber(n, locale, Number.isInteger(n) ? 0 : 2);
}

export function CompleteDialog({ appointment, onClose, onConfirm }: { appointment: Appointment; onClose: () => void; onConfirm: (amount: number, note?: string) => void }) {
  const t = useT("appointments");
  const tc = useT("common");
  const locale = useLocale();
  const [amount, setAmount] = useState(appointment.priceAZN !== null ? amountInput(appointment.priceAZN, locale) : "");
  const [note, setNote] = useState(appointment.staffNote ?? "");
  const [touched, setTouched] = useState(false);
  const parsed = parseAmount(amount, locale);
  const error = touched && parsed === null ? t("dialogs.complete.amountError") : undefined;
  const submit = () => {
    setTouched(true);
    if (parsed === null) return;
    onConfirm(parsed, note.trim() !== (appointment.staffNote ?? "").trim() ? note.trim() : undefined);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t("dialogs.complete.title", { pet: appointment.petName })}
      description={`${appointment.serviceName} · ${formatTimeRange(appointment.start, appointment.end)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("actions.cancel")}
          </Button>
          <Button onClick={submit}>
            {t("dialogs.complete.confirm")}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <Input
          label={t("dialogs.complete.amount")}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => setTouched(true)}
          error={error}
          hint={
            appointment.priceAZN === null
              ? t("dialogs.complete.pricedOnSite")
              : t("dialogs.complete.listPrice", { price: formatMoney(appointment.priceAZN, locale, { decimals: "auto" }) })
          }
          rightSlot={<span className="px-2.5 text-body font-semibold text-fg-secondary">₼</span>}
          required
          className="tabular"
        />
        <Textarea label={t("dialogs.complete.note")} hint={t("drawer.staffNoteHint")} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Dialog>
  );
}

// ---- Slot picker with conflict check (reschedule + new appointment) ----------------------------------------

export type SlotValue = { date: string; time: string };

/** Initial date/time for a picker: the given start, or the next quarter hour if that has passed. */
export function initialSlot(start: number, now: number): SlotValue {
  const s = start > now ? start : ceilToQuarter(now);
  return { date: toIsoDay(s), time: toClock(s) };
}

/**
 * Date + time inputs, then what the schedule says about that slot: clashes with other
 * appointments of the same service line, opening hours, and free times nearby to pick from.
 */
export function SlotPicker({
  value,
  onChange,
  durationMin,
  category,
  ignoreId,
  hours,
  now,
  error,
}: {
  value: SlotValue;
  onChange: (value: SlotValue) => void;
  /** Without a service yet there is nothing to check: only the inputs show. */
  durationMin?: number;
  category?: Appointment["category"];
  ignoreId?: string;
  hours?: OpeningHoursDay[];
  now: number;
  error?: string;
}) {
  const t = useT("appointments");
  const locale = useLocale();
  const day0 = parseIsoDay(value.date);
  const start = combineDateTime(value.date, value.time);
  const dayQuery = useApiQuery(
    ["appointments", "day-slots", value.date],
    (api) => api.listAppointments({ from: new Date(day0 ?? 0).toISOString(), to: new Date(startOfDay(day0 ?? 0, 1)).toISOString(), pageSize: 200 }),
    { enabled: day0 !== null },
  );
  const dayAppointments = dayQuery.data?.items ?? [];
  const check =
    start !== null && dayQuery.data && category && durationMin ? checkSlot({ start, durationMin, category, dayAppointments, ignoreId, hours }) : null;
  const suggestions =
    start !== null && check && category && durationMin && (check.conflicts.length > 0 || check.outsideHours || start < now)
      ? suggestSlots({ around: start, durationMin, category, dayAppointments, ignoreId, hours, notBefore: now })
      : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <DateInput kind="date" label={t("dialogs.slot.date")} value={value.date} min={toIsoDay(now)} onChange={(e) => onChange({ ...value, date: e.target.value })} required />
        <DateInput kind="time" label={t("dialogs.slot.time")} value={value.time} step={300} onChange={(e) => onChange({ ...value, time: e.target.value })} required error={error} />
      </div>
      {start !== null && durationMin ? (
        <p className="flex items-center gap-1.5 text-meta text-fg-secondary">
          <Clock aria-hidden="true" size={14} />
          {t("dialogs.slot.ends", { time: formatTime(start + durationMin * MINUTE), duration: formatDuration(durationMin, locale) })}
        </p>
      ) : null}

      <div aria-live="polite" className="space-y-2">
        {dayQuery.isLoading && category ? (
          <p className="flex items-center gap-2 text-meta text-fg-secondary">
            <Spinner size={14} />
            {t("dialogs.slot.checking")}
          </p>
        ) : check ? (
          <>
            {check.conflicts.length ? (
              <div className="rounded-card bg-warning-bg px-4 py-3 text-body-sm text-warning-text">
                <p className="flex items-center gap-2 font-semibold">
                  <CircleAlert aria-hidden="true" size={16} />
                  {t.plural("dialogs.slot.conflicts", check.conflicts.length)}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {check.conflicts.slice(0, 4).map((c) => (
                    <li key={c.id} className="tabular">
                      {formatTimeRange(c.start, c.end)} · {c.petName} · {c.serviceName}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-meta">{t("dialogs.slot.conflictHint")}</p>
              </div>
            ) : null}
            {check.outsideHours ? (
              <p className="rounded-card bg-surface-muted px-4 py-3 text-body-sm text-fg">
                {check.hours && day0 !== null
                  ? t("dialogs.slot.outsideHours", { hours: formatTimeRange(day0 + check.hours.open * MINUTE, day0 + check.hours.close * MINUTE) })
                  : t("dialogs.slot.closedDay")}
              </p>
            ) : null}
            {!check.conflicts.length && !check.outsideHours && start !== null && start >= now ? (
              <p className="flex items-center gap-2 text-body-sm font-medium text-success-text">
                <CalendarCheck aria-hidden="true" size={16} />
                {category === "hotel" ? t("dialogs.slot.hotelOk") : t("dialogs.slot.free")}
              </p>
            ) : null}
          </>
        ) : null}
        {suggestions.length ? (
          <div>
            <p className="mb-1.5 text-meta font-semibold text-fg">{t("dialogs.slot.suggestions")}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ date: toIsoDay(s), time: toClock(s) })}
                  className={cn(
                    "min-h-10 rounded-chip border border-primary/50 bg-surface px-3.5 text-body-sm font-semibold text-primary tabular transition-colors hover:bg-primary-selected",
                  )}
                >
                  <span className="sr-only">{t("dialogs.slot.pick")} </span>
                  {formatTime(s)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---- Reschedule -------------------------------------------------------------------------------------------

export function RescheduleDialog({
  appointment,
  hours,
  now,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  hours?: OpeningHoursDay[];
  now: number;
  onClose: () => void;
  onConfirm: (start: number) => void;
}) {
  const t = useT("appointments");
  const tc = useT("common");
  const locale = useLocale();
  const [slot, setSlot] = useState<SlotValue>(() => initialSlot(new Date(appointment.start).getTime(), now));
  const [touched, setTouched] = useState(false);
  const start = combineDateTime(slot.date, slot.time);
  const error = !touched ? undefined : start === null ? t("dialogs.slot.invalid") : start < now ? t("dialogs.slot.past") : undefined;
  const submit = () => {
    setTouched(true);
    if (start === null || start < now) return;
    onConfirm(start);
  };
  const notes = [
    appointment.status === "requested" ? t("dialogs.reschedule.confirmsRequest") : "",
    appointment.withRide ? t("dialogs.reschedule.ride") : "",
    appointment.source === "app" ? t("dialogs.reschedule.notify", { client: appointment.clientName.split(" ")[0] }) : t("toast.callOwner"),
  ].filter(Boolean);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("dialogs.reschedule.title", { pet: appointment.petName })}
      description={t("dialogs.reschedule.current", {
        service: appointment.serviceName,
        when: `${formatDayMonth(appointment.start, locale)}, ${formatTimeRange(appointment.start, appointment.end)}`,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("actions.cancel")}
          </Button>
          <Button onClick={submit}>{t("dialogs.reschedule.confirm")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <SlotPicker
          value={slot}
          onChange={(v) => {
            setSlot(v);
            setTouched(true);
          }}
          durationMin={appointment.durationMin}
          category={appointment.category}
          ignoreId={appointment.id}
          hours={hours}
          now={now}
          error={error}
        />
        <ul className="space-y-1 text-meta text-fg-secondary">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
