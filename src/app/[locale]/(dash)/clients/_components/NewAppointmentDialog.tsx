"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, DateInput, Dialog, SegmentedControl, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { AppointmentSource, Pet } from "@/lib/api/types";
import { formatDateTime, formatDuration, formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { DAY_MS, useNow } from "../_lib/stores";
import { useMockParam } from "../_lib/url";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Staff booking for a phone or walk-in client (createAppointment → status "confirmed").
 * Mount it with a fresh `key` each time it opens so the form starts clean.
 */
export function NewAppointmentDialog({ open, onClose, pets, defaultPetId }: { open: boolean; onClose: () => void; pets: Pet[]; defaultPetId?: string }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const now = useNow();
  const linkQuery = useMockParam();
  const services = useApiQuery(["services"], (api) => api.listServices(), { enabled: open });

  const [petId, setPetId] = useState(defaultPetId ?? pets[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(() => isoDay(now + DAY_MS));
  const [time, setTime] = useState("10:00");
  const [source, setSource] = useState<Exclude<AppointmentSource, "app">>("phone");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ service?: string; when?: string }>({});

  const pet = pets.find((p) => p.id === petId);
  const options = (services.data ?? [])
    .filter((s) => s.active && (!pet || s.species.includes(pet.species)))
    .map((s) => ({
      value: s.id,
      label: `${s.name} · ${formatDuration(s.durationMin, locale)} · ${
        s.priceAZN === null ? tc("money.pricedOnSite") : s.priceFrom ? tc("money.from", { price: formatMoney(s.priceAZN, locale, { decimals: "auto" }) }) : formatMoney(s.priceAZN, locale, { decimals: "auto" })
      }`,
    }));

  const create = useApiMutation((api, input: Parameters<typeof api.createAppointment>[0]) => api.createAppointment(input));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const start = new Date(`${date}T${time}`);
    const next: typeof errors = {};
    if (!serviceId) next.service = t("newAppointment.errorService");
    if (!date || !time || Number.isNaN(start.getTime())) next.when = t("newAppointment.errorWhen");
    else if (start.getTime() <= Date.now()) next.when = t("newAppointment.errorPast");
    setErrors(next);
    if (next.service || next.when || !pet) return;
    try {
      const created = await create.mutateAsync({ petId: pet.id, serviceId, start: start.toISOString(), source, staffNote: note.trim() || undefined });
      toast({
        title: t("newAppointment.created"),
        description: `${created.petName} · ${created.serviceName} · ${formatDateTime(created.start, locale)}`,
        action: { label: t("newAppointment.view"), onClick: () => router.push(localizedHref(locale, ROUTES.appointments, { id: created.id, ...linkQuery })) },
      });
      onClose();
    } catch (error) {
      toast({ title: tc("states.errorTitle"), description: tc.dynamic(`errors.${errorCode(error)}`), tone: "error" });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={create.isPending ? () => {} : onClose}
      title={t("newAppointment.title")}
      description={t("newAppointment.description")}
      size="md"
      hideClose={create.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            {tc("actions.cancel")}
          </Button>
          <Button type="submit" form="new-appointment-form" loading={create.isPending} leftIcon={<CalendarPlus aria-hidden="true" size={18} />}>
            {t("newAppointment.submit")}
          </Button>
        </>
      }
    >
      <form id="new-appointment-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {pets.length > 1 ? (
          <Select
            label={t("newAppointment.pet")}
            value={petId}
            onChange={(e) => {
              setPetId(e.target.value);
              setServiceId("");
            }}
            options={pets.map((p) => ({ value: p.id, label: `${p.name} · ${p.breed}` }))}
          />
        ) : pet ? (
          <p className="text-body-sm text-fg-secondary">
            {t("newAppointment.for")} <span className="font-semibold text-fg">{pet.name}</span> · {pet.breed}
          </p>
        ) : null}
        {services.data === undefined && !services.error ? (
          <div className="space-y-1.5" aria-busy="true">
            <p className="text-body-sm font-semibold text-fg">{t("newAppointment.service")}</p>
            <Skeleton className="h-11 w-full" />
            <span className="sr-only">{tc("states.loading")}</span>
          </div>
        ) : (
          <Select
            label={t("newAppointment.service")}
            required
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            placeholder={t("newAppointment.servicePlaceholder")}
            options={options}
            error={errors.service ?? (services.error ? tc.dynamic(`errors.${errorCode(services.error)}`) : undefined)}
            hint={services.data && options.length === 0 && pet ? t("newAppointment.noServices", { species: tc.dynamic(`species.${pet.species}`) }) : undefined}
            disabled={Boolean(services.data) && options.length === 0}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <DateInput kind="date" label={t("newAppointment.date")} required value={date} min={isoDay(now)} onChange={(e) => setDate(e.target.value)} error={errors.when} />
          <DateInput kind="time" label={t("newAppointment.time")} required value={time} step={900} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <p aria-hidden="true" className="text-body-sm font-semibold text-fg">
            {t("newAppointment.source")}
          </p>
          <SegmentedControl<Exclude<AppointmentSource, "app">>
            label={t("newAppointment.source")}
            value={source}
            onChange={setSource}
            fullWidth
            options={[
              { value: "phone", label: t("newAppointment.sourcePhone") },
              { value: "walk_in", label: t("newAppointment.sourceWalkIn") },
            ]}
          />
        </div>
        <Textarea label={t("newAppointment.note")} hint={t("notes.privateHint")} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Dialog>
  );
}
