"use client";

import { BadgeCheck, Car, Inbox, Truck } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { EXTRAS_TAG, extrasApi, Notice, SaveBar, useDraft, useExtras, type PartnerExtras } from "@/components/services-settings";
import { partnerFeatures } from "@/components/shell";
import { Panel, Pill, Select, Switch, useToast } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import type { PartnerProfile } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { formatDuration } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { SectionGate, useReportDirty } from "./shared";
import type { SectionProps } from "./sections";

type IntegrationDraft = {
  autoConfirm: boolean;
  responseWindowMin: number;
  acceptsRides: boolean;
  pickupBufferMin: number;
  offersCourierDelivery: boolean;
};

const RESPONSE_WINDOWS = [15, 30, 60, 120];
const BUFFERS = [0, 5, 10, 15, 20, 30];

const toDraft = (p: PartnerProfile, e: PartnerExtras): IntegrationDraft => ({
  autoConfirm: p.autoConfirm,
  responseWindowMin: p.responseWindowMin,
  acceptsRides: p.acceptsRides,
  pickupBufferMin: e.integration.pickupBufferMin,
  offersCourierDelivery: p.offersCourierDelivery,
});

/** How the partner works with the PetRide app: auto-accept, answer window, rides, courier. */
export function IntegrationSection({ onDirtyChange }: SectionProps) {
  const t = useT("settings");
  const partnerQ = useApiQuery(["partner"], (api) => api.getPartner());
  const extrasQ = useExtras();
  return (
    <SectionGate queries={[partnerQ, extrasQ]} title={t("petride.title")}>
      {() => <IntegrationForm partner={partnerQ.data!} extras={extrasQ.data!} onDirtyChange={onDirtyChange} />}
    </SectionGate>
  );
}

function IntegrationForm({ partner, extras, onDirtyChange }: { partner: PartnerProfile; extras: PartnerExtras } & SectionProps) {
  const t = useT("settings");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const features = partnerFeatures(useSession());
  const serverBase = useMemo(() => toDraft(partner, extras), [partner, extras]);
  const { draft = serverBase, setDraft, dirty, reset, commit } = useDraft(serverBase);
  useReportDirty(dirty, onDirtyChange);
  const set = (patch: Partial<IntegrationDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = useApiMutation(
    async (api, d: IntegrationDraft) => {
      await api.updatePartner({
        autoConfirm: d.autoConfirm,
        responseWindowMin: d.responseWindowMin,
        acceptsRides: d.acceptsRides,
        offersCourierDelivery: d.offersCourierDelivery,
      });
      await extrasApi.updateIntegration(api.partnerId, { pickupBufferMin: d.pickupBufferMin });
    },
    { invalidates: ["partner", EXTRAS_TAG, "overview", "rides"] },
  );

  const onSave = async () => {
    const sent = draft;
    try {
      await save.mutateAsync(sent);
      commit(({ draft: current }) => ({ base: sent, draft: current }));
      toast({ title: t("toast.saved"), description: t("petride.savedToast") });
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  const minutes = (m: number) => (m === 0 ? t("petride.noBuffer") : formatDuration(m, locale));

  return (
    <div className="space-y-6 @container">
      <div className="grid gap-6 @min-[56rem]:grid-cols-[minmax(0,1fr)_20rem] @min-[56rem]:items-start">
        <div className="min-w-0 space-y-6">
          {features.appointments ? (
            <Panel title={t("petride.requests.title")} description={t("petride.requests.description")} icon={<Inbox size={20} />}>
              <div className="space-y-5">
                <Switch
                  checked={draft.autoConfirm}
                  onCheckedChange={(autoConfirm) => set({ autoConfirm })}
                  label={t("petride.requests.autoConfirm")}
                  description={t("petride.requests.autoConfirmHint")}
                />
                <Select
                  label={t("petride.requests.window")}
                  hint={draft.autoConfirm ? t("petride.requests.windowOff") : t("petride.requests.windowHint")}
                  value={String(draft.responseWindowMin)}
                  disabled={draft.autoConfirm}
                  onChange={(e) => set({ responseWindowMin: Number(e.target.value) })}
                  options={RESPONSE_WINDOWS.map((m) => ({ value: String(m), label: formatDuration(m, locale) }))}
                  wrapperClassName="max-w-xs"
                />
              </div>
            </Panel>
          ) : null}

          {features.appointments ? (
            <Panel title={t("petride.rides.title")} description={t("petride.rides.description")} icon={<Car size={20} />}>
              <div className="space-y-5">
                <Switch
                  checked={draft.acceptsRides}
                  onCheckedChange={(acceptsRides) => set({ acceptsRides })}
                  label={t("petride.rides.accept")}
                  description={t("petride.rides.acceptHint")}
                />
                <Select
                  label={t("petride.rides.buffer")}
                  hint={draft.acceptsRides ? t("petride.rides.bufferHint") : t("petride.rides.bufferOff")}
                  value={String(draft.pickupBufferMin)}
                  disabled={!draft.acceptsRides}
                  onChange={(e) => set({ pickupBufferMin: Number(e.target.value) })}
                  options={BUFFERS.map((m) => ({ value: String(m), label: minutes(m) }))}
                  wrapperClassName="max-w-xs"
                />
                {!draft.acceptsRides && partner.acceptsRides ? (
                  <Notice tone="warning" title={t("petride.rides.offWarningTitle")}>
                    {t("petride.rides.offWarningBody")}
                  </Notice>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {features.orders ? (
            <Panel title={t("petride.courier.title")} description={t("petride.courier.description")} icon={<Truck size={20} />}>
              <Switch
                checked={draft.offersCourierDelivery}
                onCheckedChange={(offersCourierDelivery) => set({ offersCourierDelivery })}
                label={t("petride.courier.accept")}
                description={t("petride.courier.acceptHint")}
              />
            </Panel>
          ) : null}
        </div>

        <Panel tone="dark" title={t("petride.connection.title")} icon={<BadgeCheck size={20} />} className="text-on-primary">
          <div className="space-y-4">
            <Pill tone="success" icon={<BadgeCheck aria-hidden="true" size={14} />}>
              {t("petride.connection.connected")}
            </Pill>
            <DetailListOnDark
              items={[
                { label: t("petride.connection.listing"), value: partner.title },
                { label: t("petride.connection.partnerId"), value: <span className="tabular">{partner.id}</span> },
                {
                  label: t("petride.connection.mode"),
                  value: draft.autoConfirm ? t("petride.connection.modeAuto") : t("petride.connection.modeManual", { window: formatDuration(draft.responseWindowMin, locale) }),
                },
              ]}
            />
            <p className="text-meta text-on-primary-muted">{t("petride.connection.note")}</p>
          </div>
        </Panel>
      </div>

      <SaveBar
        visible={dirty}
        saving={save.isPending}
        label={t("saveBar.label")}
        message={t("saveBar.message")}
        hint={t("petride.saveHint")}
        saveLabel={t("saveBar.save")}
        discardLabel={t("saveBar.discard")}
        onSave={onSave}
        onDiscard={reset}
      />
    </div>
  );
}

/** DetailList colours for the dark connection card (the shared one is styled for light surfaces). */
function DetailListOnDark({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-meta text-on-primary-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-body font-semibold text-on-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
