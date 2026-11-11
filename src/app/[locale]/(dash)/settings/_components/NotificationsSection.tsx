"use client";

import { BellRing, Mail, Newspaper } from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  EMAIL_RE,
  extrasApi,
  EXTRAS_TAG,
  SaveBar,
  useDraft,
  useExtras,
  useExtrasMutation,
  type NotificationEvent,
  type NotificationPrefs,
} from "@/components/services-settings";
import { partnerFeatures } from "@/components/shell";
import { Checkbox, Input, Panel, Select, Switch, useToast } from "@/components/ui";
import { errorCode } from "@/lib/api/hooks";
import { useSession } from "@/lib/auth/client";
import { useT } from "@/lib/i18n/client";

import { SectionGate, useReportDirty } from "./shared";
import type { SectionProps } from "./sections";

const SUMMARY_TIMES = ["07:00", "08:00", "09:00", "18:00", "20:00", "21:00"];

/** Which events reach the partner, where (dashboard / e-mail), the sound and the daily summary. */
export function NotificationsSection({ onDirtyChange }: SectionProps) {
  const t = useT("settings");
  const extrasQ = useExtras();
  return (
    <SectionGate queries={[extrasQ]} title={t("notifications.title")}>
      {() => <NotificationsForm prefs={extrasQ.data!.notifications} onDirtyChange={onDirtyChange} />}
    </SectionGate>
  );
}

function NotificationsForm({ prefs, onDirtyChange }: { prefs: NotificationPrefs } & SectionProps) {
  const t = useT("settings");
  const tc = useT("common");
  const { toast } = useToast();
  const features = partnerFeatures(useSession());
  const serverBase = useMemo(() => structuredClone(prefs), [prefs]);
  const { draft = serverBase, setDraft, dirty, reset, commit } = useDraft(serverBase);
  useReportDirty(dirty, onDirtyChange);
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailId = useId();

  const events: NotificationEvent[] = [
    ...(features.appointments ? (["newRequest", "rideArriving"] as const) : []),
    ...(features.orders ? (["newOrder"] as const) : []),
    "newReview",
  ];

  const save = useExtrasMutation((partnerId, next: NotificationPrefs) => extrasApi.updateNotifications(partnerId, next), { invalidates: [EXTRAS_TAG] });

  const setChannel = (event: NotificationEvent, channel: "panel" | "email", on: boolean) =>
    setDraft((d) => ({ ...d, events: { ...d.events, [event]: { ...d.events[event], [channel]: on } } }));

  const onSave = async () => {
    if (draft.dailySummary && !EMAIL_RE.test(draft.summaryEmail.trim())) {
      setEmailError(t("notifications.errors.email"));
      requestAnimationFrame(() => document.getElementById(emailId)?.querySelector("input")?.focus());
      return;
    }
    setEmailError(null);
    const sent = { ...draft, summaryEmail: draft.summaryEmail.trim() };
    try {
      await save.mutateAsync(sent);
      commit(({ draft: current }) => ({ base: sent, draft: current }));
      toast({ title: t("toast.saved"), description: t("notifications.savedToast") });
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  return (
    <div className="space-y-6">
      <Panel title={t("notifications.title")} description={t("notifications.description")} icon={<BellRing size={20} />}>
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem] gap-x-4 border-b border-border pb-2 text-meta font-semibold text-fg-secondary sm:grid">
          <span>{t("notifications.columns.event")}</span>
          <span>{t("notifications.columns.panel")}</span>
          <span>{t("notifications.columns.email")}</span>
        </div>
        <ul className="divide-y divide-border">
          {events.map((event) => {
            const name = t(`notifications.events.${event}.title`);
            return (
              <li key={event} className="grid gap-x-4 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-fg">{name}</p>
                  <p className="mt-0.5 text-meta text-fg-secondary">{t(`notifications.events.${event}.body`)}</p>
                </div>
                <div className="flex gap-6 sm:contents">
                  <Checkbox
                    checked={draft.events[event].panel}
                    onCheckedChange={(on) => setChannel(event, "panel", on)}
                    label={
                      <span className="text-body-sm">
                        <span className="sm:sr-only">{t("notifications.columns.panel")}</span>
                        <span className="sr-only">: {name}</span>
                      </span>
                    }
                  />
                  <Checkbox
                    checked={draft.events[event].email}
                    onCheckedChange={(on) => setChannel(event, "email", on)}
                    label={
                      <span className="text-body-sm">
                        <span className="sm:sr-only">{t("notifications.columns.email")}</span>
                        <span className="sr-only">: {name}</span>
                      </span>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 rounded-card bg-surface-muted p-4">
          <Switch
            checked={draft.sound}
            onCheckedChange={(sound) => setDraft((d) => ({ ...d, sound }))}
            label={t("notifications.sound")}
            description={t("notifications.soundHint")}
          />
        </div>
      </Panel>

      <Panel title={t("notifications.summary.title")} description={t("notifications.summary.description")} icon={<Newspaper size={20} />}>
        <div className="space-y-5">
          <Switch
            checked={draft.dailySummary}
            onCheckedChange={(dailySummary) => setDraft((d) => ({ ...d, dailySummary }))}
            label={t("notifications.summary.toggle")}
            description={t("notifications.summary.toggleHint")}
          />
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <Select
              label={t("notifications.summary.time")}
              value={draft.dailySummaryTime}
              disabled={!draft.dailySummary}
              onChange={(e) => setDraft((d) => ({ ...d, dailySummaryTime: e.target.value }))}
              options={SUMMARY_TIMES.map((time) => ({ value: time, label: time }))}
            />
            <div id={emailId}>
              <Input
                label={t("notifications.summary.email")}
                type="email"
                autoComplete="email"
                leftIcon={<Mail aria-hidden="true" size={18} />}
                value={draft.summaryEmail}
                disabled={!draft.dailySummary}
                error={emailError ?? undefined}
                required={draft.dailySummary}
                onChange={(e) => setDraft((d) => ({ ...d, summaryEmail: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-meta text-fg-secondary">{t("notifications.demoNote")}</p>
        </div>
      </Panel>

      <SaveBar
        visible={dirty}
        saving={save.isPending}
        label={t("saveBar.label")}
        message={t("saveBar.message")}
        saveLabel={t("saveBar.save")}
        discardLabel={t("saveBar.discard")}
        onSave={onSave}
        onDiscard={() => {
          reset();
          setEmailError(null);
        }}
      />
    </div>
  );
}
