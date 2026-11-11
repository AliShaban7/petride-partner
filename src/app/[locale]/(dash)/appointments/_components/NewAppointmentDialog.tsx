"use client";

import { useEffect, useState } from "react";

import { Avatar, Button, Dialog, SearchField, SegmentedControl, Select, Skeleton, Textarea } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, NewAppointmentInput, OpeningHoursDay, Pet } from "@/lib/api/types";
import { formatDuration, formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { MINUTE, combineDateTime } from "../_lib/time";
import { SlotPicker, initialSlot, type SlotValue } from "./dialogs";

export type NewAppointmentPrefill = { petId?: string; serviceId?: string; start?: number };

/** Staff booking for walk-ins and phone calls: pick a pet from the client base, a service and a time. */
export function NewAppointmentDialog({
  prefill,
  hours,
  now,
  onClose,
  onCreate,
}: {
  prefill?: NewAppointmentPrefill;
  hours?: OpeningHoursDay[];
  now: number;
  onClose: () => void;
  onCreate: (input: NewAppointmentInput, petName: string) => Promise<Appointment | undefined>;
}) {
  const t = useT("appointments");
  const tc = useT("common");
  const ts = useT("status");
  const locale = useLocale();

  const [source, setSource] = useState<NewAppointmentInput["source"]>(prefill?.start && prefill.start > now ? "phone" : "walk_in");
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [picked, setPicked] = useState<Pet | null>(null);
  const [dropPrefillPet, setDropPrefillPet] = useState(false);
  const [serviceId, setServiceId] = useState(prefill?.serviceId ?? "");
  const [slot, setSlot] = useState<SlotValue>(() => initialSlot(prefill?.start ?? now, prefill?.start ? 0 : now));
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Debounce the pet search.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQ(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const services = useApiQuery(["services"], (api) => api.listServices());
  const prefillPet = useApiQuery(["pets", "detail", prefill?.petId], (api) => api.getPet(prefill?.petId ?? ""), { enabled: Boolean(prefill?.petId) && !dropPrefillPet });
  const pet = picked ?? (dropPrefillPet ? null : (prefillPet.data ?? null));
  const results = useApiQuery(["pets", "picker", searchQ], (api) => api.listPets({ search: searchQ, pageSize: 6, sort: "name_asc" }), {
    enabled: searchQ.length >= 2 && !pet,
  });

  const options = (services.data ?? []).filter((s) => s.active && (!pet || s.species.includes(pet.species)));
  const service = options.find((s) => s.id === serviceId);
  const start = combineDateTime(slot.date, slot.time);

  const errors = {
    pet: touched && !pet ? t("dialogs.new.petError") : undefined,
    service: touched && !service ? t("dialogs.new.serviceError") : undefined,
    time: !touched ? undefined : start === null ? t("dialogs.slot.invalid") : source === "phone" && start < now - 5 * MINUTE ? t("dialogs.slot.past") : undefined,
  };

  const submit = async () => {
    setTouched(true);
    if (!pet || !service || start === null || (source === "phone" && start < now - 5 * MINUTE)) return;
    setSaving(true);
    const created = await onCreate(
      { petId: pet.id, serviceId: service.id, start: new Date(start).toISOString(), source, staffNote: note.trim() || undefined },
      pet.name,
    );
    setSaving(false);
    if (created) onClose();
  };

  return (
    <Dialog
      open
      size="lg"
      onClose={saving ? () => {} : onClose}
      hideClose={saving}
      title={t("dialogs.new.title")}
      description={t("dialogs.new.body")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tc("actions.cancel")}
          </Button>
          <Button onClick={submit} loading={saving}>
            {t("dialogs.new.confirm")}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <SegmentedControl
          label={t("dialogs.new.source")}
          options={[
            { value: "walk_in", label: t("dialogs.new.walkIn") },
            { value: "phone", label: t("dialogs.new.phone") },
          ]}
          value={source}
          onChange={setSource}
          fullWidth
        />

        {/* Pet */}
        <div className="space-y-2">
          <p className="text-body-sm font-semibold text-fg">{t("dialogs.new.pet")}</p>
          {pet ? (
            <div className="flex items-center gap-3 rounded-card border border-primary/40 bg-primary-selected p-3">
              <Avatar name={pet.name} species={pet.species} tint={pet.tint} shape="tile" size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-fg">
                  {pet.name} <span className="font-normal text-fg-secondary">· {pet.breed}</span>
                </p>
                <p className="truncate text-meta text-fg-secondary">
                  {pet.ownerName} · <span className="tabular">{pet.code}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPicked(null);
                  setDropPrefillPet(true);
                }}
              >
                {t("dialogs.new.change")}
              </Button>
            </div>
          ) : prefill?.petId && !dropPrefillPet && prefillPet.isLoading ? (
            <Skeleton className="h-16 w-full rounded-card" />
          ) : (
            <>
              <SearchField label={t("dialogs.new.searchPet")} placeholder={t("dialogs.new.searchPet")} value={search} onValueChange={setSearch} showLabel={false} />
              {errors.pet ? <p className="text-meta font-medium text-error-text">{errors.pet}</p> : null}
              {searchQ.length < 2 ? (
                <p className="text-meta text-fg-secondary">{t("dialogs.new.searchHint")}</p>
              ) : results.isLoading ? (
                <Skeleton className="h-28 w-full rounded-card" />
              ) : results.data && results.data.items.length ? (
                <ul className="space-y-1.5" aria-label={t("dialogs.new.results")}>
                  {results.data.items.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(p)}
                        className="flex min-h-12 w-full items-center gap-3 rounded-tile border border-border px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-surface-muted"
                      >
                        <Avatar name={p.name} species={p.species} tint={p.tint} shape="tile" size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-sm font-semibold text-fg">
                            {p.name} <span className="font-normal text-fg-secondary">· {p.breed}</span>
                          </span>
                          <span className="block truncate text-meta text-fg-secondary">
                            {p.ownerName} · <span className="tabular">{p.code}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-meta font-semibold text-primary">{t("dialogs.new.choose")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-fg-secondary">{results.error ? tc("states.errorBody") : t("dialogs.new.noPets")}</p>
              )}
            </>
          )}
        </div>

        {/* Service */}
        <Select
          label={t("dialogs.new.service")}
          placeholder={t("dialogs.new.pickService")}
          value={service ? serviceId : ""}
          onChange={(e) => setServiceId(e.target.value)}
          options={options.map((s) => ({
            value: s.id,
            label: `${ts.dynamic(`category.${s.category}`)} · ${s.name} · ${formatDuration(s.durationMin, locale)}`,
          }))}
          error={errors.service}
          hint={service ? (service.priceAZN === null ? tc("money.pricedOnSite") : t("dialogs.new.price", { price: formatMoney(service.priceAZN, locale, { decimals: "auto" }) })) : undefined}
          required
        />

        {/* When */}
        <SlotPicker value={slot} onChange={setSlot} durationMin={service?.durationMin} category={service?.category} hours={hours} now={now} error={errors.time} />

        <Textarea label={t("dialogs.new.note")} hint={t("drawer.staffNoteHint")} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-meta text-fg-secondary">{t("dialogs.new.existingOnly")}</p>
      </form>
    </Dialog>
  );
}
