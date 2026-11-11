"use client";

import { BedDouble, Building2, ImagePlus, MapPin, Scissors, ShoppingBag, Stethoscope, Trash2 } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { BrandTile } from "@/components/illustrations";
import {
  EMAIL_RE,
  EXTRAS_TAG,
  extrasApi,
  normalizeAzPhone,
  Notice,
  SaveBar,
  useDraft,
  useExtras,
  type PartnerExtras,
} from "@/components/services-settings";
import { Button, Checkbox, Input, Panel, useToast } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { LocalizedText, PartnerProfile, ServiceCategory } from "@/lib/api/types";
import { formatDate, formatFixed, formatPhone } from "@/lib/format";
import { LOCALE_NAMES } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

import { ChoiceCard, SectionGate, useReportDirty } from "./shared";
import type { SectionProps } from "./sections";

const CATEGORIES: { id: ServiceCategory; icon: typeof Stethoscope }[] = [
  { id: "vet", icon: Stethoscope },
  { id: "groom", icon: Scissors },
  { id: "hotel", icon: BedDouble },
  { id: "shop", icon: ShoppingBag },
];
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

type ProfileDraft = {
  name: string;
  address: LocalizedText;
  phone: string;
  email: string;
  categories: ServiceCategory[];
  logo: string | null;
};

type Errors = Partial<Record<"name" | "addressAz" | "phone" | "email" | "categories", string>>;

const phoneKey = (raw: string) => normalizeAzPhone(raw) ?? raw.trim();
const equals = (a: ProfileDraft, b: ProfileDraft) =>
  a.name.trim() === b.name.trim() &&
  a.address.az.trim() === b.address.az.trim() &&
  a.address.ru.trim() === b.address.ru.trim() &&
  a.address.en.trim() === b.address.en.trim() &&
  phoneKey(a.phone) === phoneKey(b.phone) &&
  a.email.trim().toLowerCase() === b.email.trim().toLowerCase() &&
  [...a.categories].sort().join() === [...b.categories].sort().join() &&
  a.logo === b.logo;

function toDraft(partner: PartnerProfile, extras: PartnerExtras): ProfileDraft {
  return {
    name: extras.profile.name,
    address: { ...extras.profile.address },
    phone: formatPhone(partner.phone),
    email: partner.email,
    categories: [...extras.profile.categories],
    logo: extras.profile.logoDataUrl,
  };
}

/** Partner profile: logo, name, address (az/ru/en), contacts, service lines and the map pin. */
export function ProfileSection({ onDirtyChange }: SectionProps) {
  const t = useT("settings");
  const partnerQ = useApiQuery(["partner"], (api) => api.getPartner());
  const extrasQ = useExtras();
  return (
    <SectionGate queries={[partnerQ, extrasQ]} title={t("profile.title")}>
      {() => <ProfileForm partner={partnerQ.data!} extras={extrasQ.data!} onDirtyChange={onDirtyChange} />}
    </SectionGate>
  );
}

function ProfileForm({ partner, extras, onDirtyChange }: { partner: PartnerProfile; extras: PartnerExtras } & SectionProps) {
  const t = useT("settings");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const base = useMemo(() => toDraft(partner, extras), [partner, extras]);
  const { draft = base, base: savedBase = base, setDraft, dirty, reset, commit } = useDraft(base, equals);
  useReportDirty(dirty, onDirtyChange);
  const [errors, setErrors] = useState<Errors>({});
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const set = (patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    // Editing a field clears its error; saving checks everything again.
    setErrors((e) => ({
      ...e,
      ...(patch.name !== undefined && { name: undefined }),
      ...(patch.address && { addressAz: undefined }),
      ...(patch.phone !== undefined && { phone: undefined }),
      ...(patch.email !== undefined && { email: undefined }),
      ...(patch.categories && { categories: undefined }),
    }));
  };

  const save = useApiMutation(
    async (api, next: ProfileDraft, saved: ProfileDraft) => {
      const jobs: Promise<unknown>[] = [];
      const phone = normalizeAzPhone(next.phone) ?? next.phone;
      if (phoneKey(next.phone) !== phoneKey(saved.phone) || next.email.trim() !== saved.email.trim()) {
        jobs.push(api.updatePartner({ phone, email: next.email.trim() }));
      }
      // Send only what changed: name / address / categories go to PetRide review, so a logo-only
      // (or whitespace-only) edit must not resend them and trigger a review.
      const nameChanged = next.name.trim() !== saved.name.trim();
      const addressChanged = (["az", "ru", "en"] as const).some((l) => next.address[l].trim() !== saved.address[l].trim());
      const categoriesChanged = [...next.categories].sort().join() !== [...saved.categories].sort().join();
      const reviewed = nameChanged || addressChanged || categoriesChanged;
      if (reviewed || next.logo !== saved.logo) {
        const az = next.address.az.trim();
        jobs.push(
          extrasApi.updateProfile(api.partnerId, {
            ...(nameChanged && { name: next.name.trim() }),
            ...(addressChanged && { address: { az, ru: next.address.ru.trim() || az, en: next.address.en.trim() || az } }),
            ...(categoriesChanged && { categories: next.categories }),
            ...(next.logo !== saved.logo && { logoDataUrl: next.logo }),
          }),
        );
      }
      await Promise.all(jobs);
      return { reviewed };
    },
    { invalidates: ["partner", EXTRAS_TAG, "overview"] },
  );

  const validate = (d: ProfileDraft): Errors => {
    const e: Errors = {};
    if (!d.name.trim()) e.name = t("profile.errors.name");
    if (!d.address.az.trim()) e.addressAz = t("profile.errors.address");
    if (!normalizeAzPhone(d.phone)) e.phone = t("profile.errors.phone");
    if (!EMAIL_RE.test(d.email.trim())) e.email = t("profile.errors.email");
    if (d.categories.length === 0) e.categories = t("profile.errors.categories");
    return e;
  };

  const onSave = async () => {
    const e = validate(draft);
    setErrors(e);
    const first = (["name", "addressAz", "phone", "email", "categories"] as const).find((k) => e[k]);
    if (first) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${formId}-${first}"]`)?.focus());
      return;
    }
    const sent = draft;
    try {
      const result = await save.mutateAsync(sent, savedBase);
      commit(({ draft: current }) => ({ base: sent, draft: current }));
      toast({ title: t("toast.saved"), description: result.reviewed ? t("profile.reviewToast") : t("profile.savedToast") });
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  const onLogo = (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      setLogoError(t("profile.logo.typeError"));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError(t("profile.logo.sizeError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && set({ logo: reader.result });
    reader.onerror = () => setLogoError(t("profile.logo.readError"));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {extras.profile.reviewPendingAt ? (
        <Notice tone="info" title={t("profile.reviewTitle")} role="status">
          {t("profile.reviewBody", { date: formatDate(extras.profile.reviewPendingAt, locale) })}
        </Notice>
      ) : null}

      <Panel title={t("profile.title")} description={t("profile.description")} icon={<Building2 size={20} />} bodyClassName="@container">
        <div className="grid gap-6 @min-[46rem]:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-5">
            <Input
              data-field={`${formId}-name`}
              label={t("profile.name")}
              required
              maxLength={80}
              value={draft.name}
              error={errors.name}
              hint={t("profile.nameHint")}
              onChange={(e) => set({ name: e.target.value })}
            />
            <fieldset className="space-y-3">
              <legend className="text-body-sm font-semibold text-fg">{t("profile.address")}</legend>
              <p className="text-meta text-fg-secondary">{t("profile.addressHint")}</p>
              {(["az", "ru", "en"] as const).map((l) => (
                <Input
                  key={l}
                  lang={l}
                  data-field={l === "az" ? `${formId}-addressAz` : undefined}
                  label={LOCALE_NAMES[l]}
                  required={l === "az"}
                  maxLength={140}
                  value={draft.address[l]}
                  placeholder={l === "az" ? undefined : draft.address.az}
                  error={l === "az" ? errors.addressAz : undefined}
                  onChange={(e) => set({ address: { ...draft.address, [l]: e.target.value } })}
                />
              ))}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                data-field={`${formId}-phone`}
                label={t("profile.phone")}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                value={draft.phone}
                error={errors.phone}
                hint={t("profile.phoneHint")}
                onChange={(e) => set({ phone: e.target.value })}
                onBlur={() => {
                  const n = normalizeAzPhone(draft.phone);
                  if (n && formatPhone(n) !== draft.phone) set({ phone: formatPhone(n) });
                }}
              />
              <Input
                data-field={`${formId}-email`}
                label={t("profile.email")}
                type="email"
                autoComplete="email"
                required
                value={draft.email}
                error={errors.email}
                hint={t("profile.emailHint")}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <p className="text-body-sm font-semibold text-fg">{t("profile.logo.title")}</p>
              <div className="mt-2 flex items-center gap-4">
                {draft.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                  <img src={draft.logo} alt={t("profile.logo.alt", { name: draft.name })} className="size-20 shrink-0 rounded-card bg-surface object-cover shadow-card" />
                ) : (
                  <span className="inline-flex size-20 shrink-0 items-center justify-center rounded-card bg-soft-mint">
                    <BrandTile size={52} />
                  </span>
                )}
                <div className="flex min-w-0 flex-col items-start gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={LOGO_TYPES.join(",")}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => {
                      onLogo(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button variant="secondary" size="sm" leftIcon={<ImagePlus aria-hidden="true" size={16} />} onClick={() => fileRef.current?.click()}>
                    {draft.logo ? t("profile.logo.replace") : t("profile.logo.upload")}
                  </Button>
                  {draft.logo ? (
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 aria-hidden="true" size={16} />} onClick={() => set({ logo: null })}>
                      {t("profile.logo.remove")}
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-meta text-fg-secondary">{t("profile.logo.hint")}</p>
              {logoError ? (
                <p role="alert" className="mt-1 text-meta font-medium text-error-text">
                  {logoError}
                </p>
              ) : null}
            </div>

            <MapPlaceholder lat={partner.lat} lng={partner.lng} />
          </div>
        </div>
      </Panel>

      <Panel title={t("profile.categories.title")} description={t("profile.categories.description")}>
        <fieldset aria-describedby={errors.categories ? `${formId}-cat-error` : undefined}>
          <legend className="sr-only">{t("profile.categories.title")}</legend>
          <div className="grid gap-3 sm:grid-cols-2" data-field={`${formId}-categories`} tabIndex={-1}>
            {CATEGORIES.map(({ id, icon: Icon }) => {
              const checked = draft.categories.includes(id);
              return (
                <ChoiceCard key={id} checked={checked}>
                  <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-tile bg-soft-mint text-fg">
                    <Icon size={20} />
                  </span>
                  <Checkbox
                    className="min-w-0 flex-1"
                    checked={checked}
                    onCheckedChange={(on) => set({ categories: on ? [...draft.categories, id] : draft.categories.filter((c) => c !== id) })}
                    label={<span className="font-semibold">{t(`profile.categories.${id}.title`)}</span>}
                    description={t(`profile.categories.${id}.body`)}
                  />
                </ChoiceCard>
              );
            })}
          </div>
          {errors.categories ? (
            <p id={`${formId}-cat-error`} className="mt-2 text-meta font-medium text-error-text">
              {errors.categories}
            </p>
          ) : null}
        </fieldset>
        <p className="mt-4 text-meta text-fg-secondary">{t("profile.reviewHint")}</p>
      </Panel>

      <SaveBar
        visible={dirty}
        saving={save.isPending}
        label={t("saveBar.label")}
        message={t("saveBar.message")}
        hint={t("profile.saveHint")}
        saveLabel={t("saveBar.save")}
        discardLabel={t("saveBar.discard")}
        onSave={onSave}
        onDiscard={() => {
          reset();
          setErrors({});
          setLogoError(null);
        }}
      />
    </div>
  );
}

/** Map placeholder with the pin's coordinates (the map picker comes later). */
function MapPlaceholder({ lat, lng }: { lat: number; lng: number }) {
  const t = useT("settings");
  const locale = useLocale();
  return (
    <div>
      <p className="text-body-sm font-semibold text-fg">{t("profile.map.title")}</p>
      <div className="relative mt-2 h-36 overflow-hidden rounded-card bg-soft-mint" role="img" aria-label={t("profile.map.alt")}>
        <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 240 144" preserveAspectRatio="xMidYMid slice">
          <g stroke="var(--color-ill-blob-mint)" strokeWidth="1">
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`v${i}`} x1={i * 22} y1="0" x2={i * 22} y2="144" />
            ))}
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 22} x2="240" y2={i * 22} />
            ))}
          </g>
          <path d="M-10 110 C 60 90, 90 40, 250 30" stroke="var(--color-surface)" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M40 -10 C 70 60, 120 100, 140 160" stroke="var(--color-surface)" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M150 144 C 180 110, 210 120, 250 96" stroke="var(--color-pastel-sky)" strokeWidth="14" fill="none" strokeLinecap="round" />
        </svg>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full animate-paw-bob">
          <span className="inline-flex size-10 items-center justify-center rounded-full rounded-bl-none bg-primary text-on-primary shadow-floating -rotate-45">
            <MapPin aria-hidden="true" size={18} className="rotate-45" />
          </span>
        </span>
      </div>
      <p className="mt-2 text-meta text-fg-secondary tabular">
        {t("profile.map.coords", { lat: formatFixed(lat, 4, locale), lng: formatFixed(lng, 4, locale) })}
      </p>
      <p className="mt-1 text-meta text-fg-secondary">{t("profile.map.hint")}</p>
    </div>
  );
}
