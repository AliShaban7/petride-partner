"use client";

import { Smartphone } from "lucide-react";
import { useId, useRef, useState } from "react";

import { parsePrice, parseWhole } from "@/components/services-settings";
import { Button, Checkbox, Dialog, Field, Input, Select, Switch, TabPanel, Tabs, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from "@/lib/i18n/config";
import { formatDuration, formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { appPriceText } from "./AppPreview";
import { DEFAULT_DURATION, SPECIES, type PriceError, type ServiceCat, type ServiceDraft } from "./model";
import { PriceInput } from "./PriceInput";

const NAME_MAX = 60;
const DESC_MAX = 120;

type Errors = Partial<Record<"nameAz" | "duration" | "price" | "species", string>>;

const PRESETS: Record<ServiceCat, number[]> = {
  vet: [15, 20, 30, 45, 60],
  groom: [30, 60, 90, 120, 180],
  hotel: [240, 480, 1440],
};

/**
 * Add / edit a service: names and descriptions in az / ru / en, category, duration, price
 * ("show in the app" off → "Priced on site"), starting price, species and visibility.
 * Validates on submit, focuses the first problem and shows a live line of how the app shows it.
 */
export function ServiceDialog({
  open,
  mode,
  initial,
  categories,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: ServiceDraft;
  categories: readonly ServiceCat[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (item: ServiceDraft) => void;
}) {
  const t = useT("services");
  const tc = useT("common");
  const uiLocale = useLocale();
  const [form, setForm] = useState<ServiceDraft>(initial);
  const [duration, setDuration] = useState(String(initial.durationMin));
  const [lang, setLang] = useState<Locale>("az");
  const [errors, setErrors] = useState<Errors>({});
  const nameAzRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const tabsPrefix = `svc${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  const set = (patch: Partial<ServiceDraft>) => {
    setForm((f) => ({ ...f, ...patch }));
    // A field's error goes away as soon as it's edited (the next submit re-checks everything).
    setErrors((e) => ({
      ...e,
      ...(patch.nameI18n && { nameAz: undefined }),
      ...((patch.price !== undefined || patch.showPrice !== undefined) && { price: undefined }),
      ...(patch.species && { species: undefined }),
    }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.nameI18n.az.trim()) e.nameAz = t("dialog.errors.nameRequired");
    const minutes = parseWhole(duration, 5, 1440);
    if (minutes === null) e.duration = t("dialog.errors.duration");
    if (form.showPrice) {
      const parsed = parsePrice(form.price);
      if (!parsed.ok) e.price = t.dynamic(`errors.price.${parsed.reason === "empty" ? "emptyOrHide" : (parsed.reason satisfies PriceError)}`, { max: formatMoney(9999, uiLocale, { decimals: 0 }) });
    } else if (form.price.trim() && !parsePrice(form.price).ok) {
      e.price = t("errors.price.invalid");
    }
    if (form.species.length === 0) e.species = t("dialog.errors.species");
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      // Focus the first problem (switch to the AZ tab for the name).
      if (e.nameAz) {
        setLang("az");
        requestAnimationFrame(() => nameAzRef.current?.focus());
        return;
      }
      const field = e.duration ? "duration" : e.price ? "price" : "species";
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${formId}-${field}"]`)?.focus());
      return;
    }
    onSubmit({ ...form, durationMin: parseWhole(duration, 5, 1440) ?? form.durationMin });
  };

  const previewName = form.nameI18n[uiLocale].trim() || form.nameI18n.az.trim() || t("dialog.namePlaceholder");
  const minutes = parseWhole(duration, 5, 1440);

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      hideClose={saving}
      size="lg"
      title={mode === "create" ? t("dialog.createTitle") : t("dialog.editTitle")}
      description={t("dialog.description")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tc("actions.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {mode === "create" ? t("dialog.create") : tc("actions.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-6 pb-2"
      >
        <Select
          label={t("dialog.category")}
          value={form.category}
          disabled={mode === "edit"}
          hint={mode === "edit" ? t("dialog.categoryLocked") : undefined}
          onChange={(e) => {
            const category = e.target.value as ServiceCat;
            // Follow the new category's default length unless the partner already typed one.
            if (duration === String(DEFAULT_DURATION[form.category])) setDuration(String(DEFAULT_DURATION[category]));
            set({ category });
          }}
          options={categories.map((c) => ({ value: c, label: t(`categories.${c}.title`) }))}
        />

        <fieldset className="space-y-3">
          <legend className="text-body-sm font-semibold text-fg">{t("dialog.namesLegend")}</legend>
          <p className="text-meta text-fg-secondary">{t("dialog.namesHint")}</p>
          <Tabs
            variant="pills"
            idPrefix={tabsPrefix}
            label={t("dialog.languageTabs")}
            value={lang}
            onChange={(id) => setLang(id as Locale)}
            tabs={LOCALES.map((l) => ({
              id: l,
              label: `${LOCALE_SHORT[l]}${l === "az" ? " *" : ""}`,
              icon: l === "az" && errors.nameAz ? <span aria-hidden="true" className="size-2 rounded-full bg-error-text" /> : undefined,
            }))}
          />
          {LOCALES.map((l) =>
            l === lang ? (
              <TabPanel key={l} idPrefix={tabsPrefix} value={l} className="space-y-4 pt-1">
                <Input
                  ref={l === "az" ? nameAzRef : undefined}
                  lang={l}
                  label={t("dialog.name", { language: LOCALE_NAMES[l] })}
                  required={l === "az"}
                  maxLength={NAME_MAX}
                  value={form.nameI18n[l]}
                  placeholder={l === "az" ? t("dialog.namePlaceholder") : form.nameI18n.az || t("dialog.namePlaceholder")}
                  error={l === "az" ? errors.nameAz : undefined}
                  hint={l === "az" ? t("dialog.nameAzHint") : t("dialog.nameFallbackHint")}
                  onChange={(e) => set({ nameI18n: { ...form.nameI18n, [l]: e.target.value } })}
                />
                <Textarea
                  lang={l}
                  rows={2}
                  label={t("dialog.descriptionField", { language: LOCALE_NAMES[l] })}
                  maxLength={DESC_MAX}
                  value={form.descriptionI18n[l]}
                  placeholder={t("dialog.descriptionPlaceholder")}
                  hint={t("dialog.descriptionHint", { count: form.descriptionI18n[l].length, max: DESC_MAX })}
                  onChange={(e) => set({ descriptionI18n: { ...form.descriptionI18n, [l]: e.target.value } })}
                />
              </TabPanel>
            ) : null,
          )}
        </fieldset>

        <div className="space-y-2">
          <Input
            data-field={`${formId}-duration`}
            label={t("dialog.duration")}
            inputMode="numeric"
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value.replace(/[^\d]/g, ""));
              setErrors((x) => ({ ...x, duration: undefined }));
            }}
            error={errors.duration}
            hint={minutes !== null ? t("dialog.durationHint", { duration: formatDuration(minutes, uiLocale) }) : t("dialog.durationRange")}
            rightSlot={<span className="pr-2 text-body-sm font-semibold text-fg-secondary">{t("dialog.minutesUnit")}</span>}
            className="tabular"
            required
          />
          <div role="group" aria-label={t("dialog.durationPresets")} className="flex flex-wrap gap-2">
            {PRESETS[form.category].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => {
                  setDuration(String(m));
                  setErrors((x) => ({ ...x, duration: undefined }));
                }}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-chip border px-3 text-meta font-semibold transition-colors",
                  minutes === m ? "border-primary bg-primary-tint text-primary" : "border-border bg-surface text-fg hover:bg-surface-muted",
                )}
              >
                {formatDuration(m, uiLocale)}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-4 rounded-card border border-border p-4">
          <legend className="px-1 text-body-sm font-semibold text-fg">{t("dialog.priceLegend")}</legend>
          <Switch
            checked={form.showPrice}
            onCheckedChange={(showPrice) => set({ showPrice })}
            label={t("dialog.showPrice")}
            description={t("dialog.showPriceHint", { label: tc("money.pricedOnSite") })}
          />
          <Field label={t("row.price")} error={errors.price} hint={form.showPrice ? undefined : t("dialog.priceKeptHint")} required={form.showPrice}>
            {({ id, describedBy, invalid }) => (
              <PriceInput
                id={id}
                data-field={`${formId}-price`}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.price}
                locale={uiLocale}
                onValueChange={(price) => set({ price })}
              />
            )}
          </Field>
          <Checkbox
            checked={form.priceFrom}
            onCheckedChange={(priceFrom) => set({ priceFrom })}
            label={t("dialog.priceFrom")}
            description={t("dialog.priceFromHint", { example: tc("money.from", { price: formatMoney(35, uiLocale, { decimals: "auto" }) }) })}
            disabled={!form.showPrice}
          />
        </fieldset>

        <fieldset aria-describedby={errors.species ? `${formId}-species-error` : undefined} className="space-y-3">
          <legend className="text-body-sm font-semibold text-fg">{t("dialog.species")}</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-3" data-field={`${formId}-species`} tabIndex={-1}>
            {SPECIES.map((s) => (
              <Checkbox
                key={s}
                checked={form.species.includes(s)}
                onCheckedChange={(on) => set({ species: on ? [...form.species, s] : form.species.filter((x) => x !== s) })}
                label={tc(`species.${s}`)}
              />
            ))}
          </div>
          {errors.species ? (
            <p id={`${formId}-species-error`} className="text-meta font-medium text-error-text">
              {errors.species}
            </p>
          ) : null}
        </fieldset>

        <Switch checked={form.active} onCheckedChange={(active) => set({ active })} label={t("dialog.active")} description={t("dialog.activeHint")} />

        <div className="flex items-start gap-3 rounded-card bg-soft-lilac p-4">
          <Smartphone aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-fg" />
          <div className="min-w-0">
            <p className="text-meta font-semibold text-fg-tertiary">{t("dialog.previewLabel")}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
              <span className="font-semibold text-fg">{previewName}</span>
              <span className="font-semibold text-fg tabular">{form.active ? appPriceText(form, uiLocale, tc) : t("dialog.previewHidden")}</span>
            </p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
