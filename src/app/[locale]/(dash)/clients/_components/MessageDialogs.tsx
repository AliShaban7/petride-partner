"use client";

import { Info, Send } from "lucide-react";
import { useState, type ReactNode } from "react";

import { PawMark } from "@/components/illustrations";
import { Button, Checkbox, Dialog, Select, StatusPill, Textarea, useToast } from "@/components/ui";
import type { Appointment, Client, Pet, Vaccine } from "@/lib/api/types";
import { formatDayMonth, formatDateTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { sendViaApp } from "../_lib/stores";
import { sortVaccines } from "./VaccinesTable";

/** How the client will see it: a PetRide app notification card. */
function NotificationPreview({ partnerName, children, label }: { partnerName: string; children: ReactNode; label: string }) {
  return (
    <figure className="rounded-card border border-border bg-surface-muted p-4">
      <figcaption className="mb-2 flex items-center gap-2 text-caption font-semibold text-fg-secondary">
        <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-[8px] bg-primary">
          <PawMark size={14} color="var(--color-on-primary)" />
        </span>
        <span>
          {label} · PetRide · {partnerName}
        </span>
      </figcaption>
      <div className="whitespace-pre-line text-body-sm text-fg">{children}</div>
    </figure>
  );
}

function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-tile bg-info-bg px-3 py-2 text-meta text-info-text">
      <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ---- Vaccine reminder ------------------------------------------------------------------------------

/** "Send reminder via PetRide app" for overdue / due-soon vaccines (mocked: no messaging API yet). */
export function ReminderDialog({
  open,
  onClose,
  pet,
  owner,
  partnerName,
  offerRide,
}: {
  open: boolean;
  onClose: () => void;
  pet: Pet;
  owner: Client | undefined;
  partnerName: string;
  offerRide: boolean;
}) {
  const t = useT("clients");
  const locale = useLocale();
  const { toast } = useToast();
  const due = sortVaccines(pet.vaccines.filter((v) => v.status === "overdue" || v.status === "due_soon"));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(due.map((v) => v.id)));
  const [withRide, setWithRide] = useState(offerRide);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const chosen = due.filter((v) => picked.has(v.id));
  const ownerFirst = owner?.firstName ?? pet.ownerName.split(" ")[0];
  const list = chosen.map((v: Vaccine) => `${v.name} — ${formatDayMonth(v.nextDate ?? v.dueDate, locale)}`).join(", ");
  const message = [
    t("reminder.message", { name: ownerFirst, pet: pet.shortName, list, partner: partnerName }),
    withRide ? t("reminder.rideLine") : "",
    note.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const send = async () => {
    setSending(true);
    await sendViaApp(`pet:${pet.id}`, { kind: "vaccine_reminder", to: owner?.fullName ?? pet.ownerName });
    setSending(false);
    toast({ title: t("reminder.sent"), description: t("reminder.sentBody", { name: owner?.fullName ?? pet.ownerName }) });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={sending ? () => {} : onClose}
      hideClose={sending}
      title={t("reminder.title", { pet: pet.shortName })}
      description={t("reminder.description", { name: owner?.fullName ?? pet.ownerName })}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            {t("dialog.cancel")}
          </Button>
          <Button onClick={send} loading={sending} disabled={!chosen.length} leftIcon={<Send aria-hidden="true" size={18} />}>
            {t("reminder.send")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-body-sm font-semibold text-fg">{t("reminder.which")}</legend>
          {due.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 rounded-tile border border-border px-3 py-2.5">
              <Checkbox
                checked={picked.has(v.id)}
                onCheckedChange={(on) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(v.id);
                    else next.delete(v.id);
                    return next;
                  })
                }
                label={v.name}
                description={t("health.dueOn", { date: formatDayMonth(v.nextDate ?? v.dueDate, locale) })}
              />
              <StatusPill kind="vaccine" status={v.status} size="sm" />
            </div>
          ))}
        </fieldset>
        {offerRide ? <Checkbox checked={withRide} onCheckedChange={setWithRide} label={t("reminder.offerRide")} description={t("reminder.offerRideHint")} /> : null}
        <Textarea label={t("reminder.note")} hint={t("reminder.noteHint")} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="space-y-2">
          <p className="text-body-sm font-semibold text-fg">{t("dialog.preview")}</p>
          {chosen.length ? (
            <NotificationPreview partnerName={partnerName} label={t("dialog.previewLabel")}>
              {message}
            </NotificationPreview>
          ) : (
            <p className="text-meta text-fg-secondary">{t("reminder.pickOne")}</p>
          )}
          {owner ? <p className="text-meta text-fg-secondary">{t("dialog.languageNote", { name: ownerFirst, language: t.dynamic(`languages.${owner.locale}`) })}</p> : null}
        </div>
        <DemoNote>{t("dialog.demoNote")}</DemoNote>
      </div>
    </Dialog>
  );
}

// ---- Free message ----------------------------------------------------------------------------------

type Template = "free" | "reminder" | "thanks" | "checkup";

/** "Send message" to an owner through the PetRide app (mocked: no messaging API yet). */
export function SendMessageDialog({
  open,
  onClose,
  client,
  pets,
  partnerName,
  nextAppointment,
  visits,
}: {
  open: boolean;
  onClose: () => void;
  client: Client;
  pets: Pet[];
  partnerName: string;
  nextAppointment?: Appointment;
  /** Appointment-based partner (clinic / salon / hotel): offers visit reminder and check-up templates. */
  visits: boolean;
}) {
  const t = useT("clients");
  const locale = useLocale();
  const { toast } = useToast();
  const [template, setTemplate] = useState<Template>("free");
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const petName = pets.length === 1 ? pets[0].shortName : client.petNames.join(", ");

  const fill = (id: Template) => {
    setTemplate(id);
    setError(undefined);
    if (id === "free") return setText("");
    if (id === "reminder" && nextAppointment) {
      return setText(
        t("message.templates.reminder", {
          name: client.firstName,
          pet: nextAppointment.petName,
          service: nextAppointment.serviceName,
          when: formatDateTime(nextAppointment.start, locale),
          partner: partnerName,
        }),
      );
    }
    setText(t.dynamic(`message.templates.${id}`, { name: client.firstName, pet: petName, partner: partnerName }));
  };

  const send = async () => {
    if (!text.trim()) {
      setError(t("message.errorEmpty"));
      return;
    }
    setSending(true);
    await sendViaApp(`client:${client.id}`, { kind: "message", to: client.fullName });
    setSending(false);
    toast({ title: t("message.sent"), description: t("message.sentBody", { name: client.fullName }) });
    onClose();
  };

  const templates: { value: Template; label: string; disabled?: boolean }[] = [
    { value: "free", label: t("message.templateFree") },
    ...(visits ? [{ value: "reminder" as const, label: t("message.templateReminder"), disabled: !nextAppointment }] : []),
    { value: "thanks", label: t("message.templateThanks") },
    ...(visits ? [{ value: "checkup" as const, label: t("message.templateCheckup") }] : []),
  ];

  return (
    <Dialog
      open={open}
      onClose={sending ? () => {} : onClose}
      hideClose={sending}
      title={t("message.title", { name: client.fullName })}
      description={t("message.description")}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            {t("dialog.cancel")}
          </Button>
          <Button onClick={send} loading={sending} leftIcon={<Send aria-hidden="true" size={18} />}>
            {t("message.send")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t("message.template")}
          value={template}
          onChange={(e) => fill(e.target.value as Template)}
          options={templates}
          hint={visits && !nextAppointment ? t("message.noUpcoming") : undefined}
        />
        <Textarea
          label={t("message.text")}
          required
          rows={5}
          maxLength={500}
          value={text}
          error={error}
          hint={t("notes.counter", { count: text.length, max: 500 })}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(undefined);
          }}
        />
        <p className="text-meta text-fg-secondary">{t("dialog.languageNoteMessage", { name: client.firstName, language: t.dynamic(`languages.${client.locale}`) })}</p>
        <DemoNote>{t("dialog.demoNote")}</DemoNote>
      </div>
    </Dialog>
  );
}
