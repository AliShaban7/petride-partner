"use client";

import { Languages, Mail } from "lucide-react";
import { useId } from "react";

import { extrasApi, useExtras, useExtrasMutation } from "@/components/services-settings";
import { useSwitchLocale } from "@/components/shell/LanguageSwitcher";
import { ErrorState, Panel, Select, Spinner, useToast } from "@/components/ui";
import { errorCode } from "@/lib/api/hooks";
import { isLocale, LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

import { ChoiceCard } from "./shared";

/**
 * Dashboard language (switches right away, same page) and the language of e-mails and the daily
 * summary (saved right away). Messages to clients follow each client's app language.
 */
export function LanguageSection({ confirmLeave }: { confirmLeave: () => boolean }) {
  const t = useT("settings");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const { switchTo, pending } = useSwitchLocale();
  const extrasQ = useExtras();
  const name = useId();
  const setEmailLocale = useExtrasMutation((partnerId, value: Locale) => extrasApi.updateEmailLocale(partnerId, value));

  return (
    <div className="space-y-section">
      <Panel title={t("language.title")} description={t("language.description")} icon={<Languages size={20} />}>
        <fieldset aria-busy={pending || undefined}>
          <legend className="sr-only">{t("language.title")}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {LOCALES.map((l) => (
              <ChoiceCard key={l} checked={l === locale}>
                <label className="flex w-full cursor-pointer items-center gap-3" lang={l}>
                  <input
                    type="radio"
                    name={name}
                    value={l}
                    checked={l === locale}
                    onChange={() => {
                      if (l !== locale && confirmLeave()) switchTo(l);
                    }}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-mint font-display text-body font-extrabold text-fg">
                    {LOCALE_SHORT[l]}
                  </span>
                  <span className="min-w-0 font-semibold text-fg">{LOCALE_NAMES[l]}</span>
                </label>
              </ChoiceCard>
            ))}
          </div>
        </fieldset>
        {pending ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-meta text-fg-secondary">
            <Spinner size={14} />
            {tc("states.loading")}
          </p>
        ) : null}
      </Panel>

      <Panel title={t("language.emailTitle")} description={t("language.emailDescription")} icon={<Mail size={20} />}>
        {extrasQ.error && !extrasQ.data ? (
          <ErrorState error={extrasQ.error} onRetry={extrasQ.refetch} compact />
        ) : (
        <Select
          label={t("language.emailLabel")}
          value={extrasQ.data?.emailLocale ?? "az"}
          disabled={!extrasQ.data || setEmailLocale.isPending}
          wrapperClassName="max-w-xs"
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
          onChange={async (e) => {
            const value = e.target.value;
            if (!isLocale(value)) return;
            try {
              await setEmailLocale.mutateAsync(value);
              toast({ title: t("language.emailSaved", { language: LOCALE_NAMES[value] }) });
            } catch (err) {
              toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
            }
          }}
        />
        )}
        <p className="mt-4 text-meta text-fg-secondary">{t("language.clientsNote")}</p>
      </Panel>
    </div>
  );
}
