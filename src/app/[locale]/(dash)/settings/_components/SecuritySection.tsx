"use client";

import { Check, Circle, Eye, EyeOff, KeyRound, LogOut, Monitor, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore, type Ref } from "react";

import { controlClass, extrasApi, useExtras, useExtrasMutation, useMinuteNow, type DeviceSession } from "@/components/services-settings";
import { Button, ConfirmDialog, ErrorState, Field, IconButton, Panel, Pill, SkeletonRows, useToast } from "@/components/ui";
import { errorCode } from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

const noop = () => () => {};

/** "Chrome · macOS" from the user agent (client only; "" on the server). */
function useThisDevice(): string {
  return useSyncExternalStore(
    noop,
    () => {
      const ua = navigator.userAgent;
      const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
      const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
      return [browser, os].filter(Boolean).join(" · ");
    },
    () => "",
  );
}

type Rules = { length: boolean; letter: boolean; digit: boolean };
const rulesOf = (pw: string): Rules => ({ length: pw.length >= 8, letter: /\p{L}/u.test(pw), digit: /\d/.test(pw) });

/** Change password (mock) and devices signed in to the dashboard. */
export function SecuritySection() {
  return (
    <div className="space-y-6">
      <PasswordPanel />
      <SessionsPanel />
    </div>
  );
}

function PasswordInput({ label, value, onChange, error, autoComplete, describedBy, inputRef }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const tc = useT("common");
  const [show, setShow] = useState(false);
  // Field (not Input) so the extra description (the rules list) is added to the error id instead
  // of replacing it: Input's own aria-describedby would be overwritten by a passed one.
  return (
    <Field label={label} error={error} required>
      {({ id, describedBy: fieldDescribedBy, invalid }) => (
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            type={show ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            required
            aria-invalid={invalid || undefined}
            aria-describedby={[fieldDescribedBy, describedBy].filter(Boolean).join(" ") || undefined}
            onChange={(e) => onChange(e.target.value)}
            className={cn(controlClass, "pr-12")}
          />
          <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            <IconButton
              size="sm"
              label={show ? tc("a11y.hidePassword") : tc("a11y.showPassword")}
              icon={show ? <EyeOff size={18} /> : <Eye size={18} />}
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
            />
          </span>
        </div>
      )}
    </Field>
  );
}

function PasswordPanel() {
  const t = useT("settings");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const extrasQ = useExtras();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"current" | "next" | "repeat", string>>>({});
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const repeatRef = useRef<HTMLInputElement>(null);
  const rulesId = useId();
  const change = useExtrasMutation((partnerId, a: string, b: string) => extrasApi.changePassword(partnerId, a, b));
  const rules = rulesOf(next);

  const submit = async () => {
    const e: typeof errors = {};
    if (!current) e.current = t("security.errors.current");
    if (!rules.length || !rules.letter || !rules.digit) e.next = t("security.errors.rules");
    else if (next === current) e.next = t("security.errors.same");
    if (repeat !== next) e.repeat = t("security.errors.repeat");
    setErrors(e);
    if (e.current) return currentRef.current?.focus();
    if (e.next) return nextRef.current?.focus();
    if (e.repeat) return repeatRef.current?.focus();
    try {
      await change.mutateAsync(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      toast({ title: t("security.toast.changed"), description: t("security.demoNote") });
    } catch (err) {
      if (err instanceof ApiError && err.message === "wrong_password") {
        setErrors({ current: t("security.errors.wrong") });
        currentRef.current?.focus();
      } else {
        toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
      }
    }
  };

  const changedAt = extrasQ.data?.passwordChangedAt;

  return (
    <Panel
      title={t("security.passwordTitle")}
      description={changedAt ? t("security.changedAt", { date: formatDate(changedAt, locale) }) : t("security.passwordDescription")}
      icon={<KeyRound size={20} />}
      bodyClassName="@container"
    >
      <form
        noValidate
        className="grid gap-5 @min-[40rem]:grid-cols-[minmax(0,1fr)_16rem]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="max-w-md space-y-4">
          <PasswordInput inputRef={currentRef} label={t("security.current")} value={current} onChange={setCurrent} error={errors.current} autoComplete="current-password" />
          <PasswordInput
            inputRef={nextRef}
            label={t("security.next")}
            value={next}
            onChange={setNext}
            error={errors.next}
            autoComplete="new-password"
            describedBy={rulesId}
          />
          <PasswordInput inputRef={repeatRef} label={t("security.repeat")} value={repeat} onChange={setRepeat} error={errors.repeat} autoComplete="new-password" />
          <Button type="submit" loading={change.isPending}>
            {t("security.change")}
          </Button>
        </div>
        <div className="rounded-card bg-surface-muted p-4 @min-[40rem]:self-start">
          <p className="text-body-sm font-semibold text-fg">{t("security.rulesTitle")}</p>
          <ul id={rulesId} className="mt-2 space-y-1.5">
            {(["length", "letter", "digit"] as const).map((rule) => (
              <li key={rule} className={cn("flex items-center gap-2 text-meta", rules[rule] ? "text-success-text" : "text-fg-secondary")}>
                {rules[rule] ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : <Circle aria-hidden="true" size={12} />}
                <span>
                  {t(`security.rules.${rule}`)}
                  <span className="sr-only"> — {rules[rule] ? t("security.rules.met") : t("security.rules.notMet")}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </form>
    </Panel>
  );
}

const DEVICE_ICONS = { desktop: Monitor, phone: Smartphone, tablet: Tablet } as const;

function SessionsPanel() {
  const t = useT("settings");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const now = useMinuteNow();
  const thisDevice = useThisDevice();
  const extrasQ = useExtras();
  // The target stays set while the dialog closes, so its title doesn't flip mid-animation.
  const [target, setTarget] = useState<DeviceSession | "others" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ask = (next: DeviceSession | "others") => {
    setTarget(next);
    setConfirmOpen(true);
  };
  const revoke = useExtrasMutation((partnerId, id: string) => extrasApi.revokeSession(partnerId, id));
  const revokeOthers = useExtrasMutation((partnerId) => extrasApi.revokeOtherSessions(partnerId));
  const sessions = extrasQ.data?.sessions ?? [];
  const others = sessions.filter((s) => !s.current);

  const confirm = async () => {
    try {
      if (target === "others") await revokeOthers.mutateAsync();
      else if (target) await revoke.mutateAsync(target.id);
      toast({ title: target === "others" ? t("security.toast.othersOut") : t("security.toast.sessionOut") });
      setConfirmOpen(false);
    } catch (err) {
      toast({ tone: "error", title: t("security.toast.failed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
    }
  };

  return (
    <Panel
      title={t("security.sessionsTitle")}
      description={t("security.sessionsDescription")}
      icon={<MonitorSmartphone size={20} />}
      actions={
        others.length ? (
          <Button variant="outline" size="sm" leftIcon={<LogOut aria-hidden="true" size={16} />} onClick={() => ask("others")}>
            {t("security.signOutOthers")}
          </Button>
        ) : null
      }
    >
      {extrasQ.data === undefined ? (
        extrasQ.error ? (
          <ErrorState error={extrasQ.error} onRetry={extrasQ.refetch} compact />
        ) : (
          <div aria-busy="true">
            <span className="sr-only">{tc("states.loading")}</span>
            <SkeletonRows rows={3} />
          </div>
        )
      ) : (
        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const Icon = DEVICE_ICONS[s.device];
            const client = s.current ? thisDevice || t("security.thisBrowser") : s.client;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-tile bg-soft-mint text-fg">
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                    {client}
                    {s.current ? <Pill tone="success" size="sm">{t("security.thisDevice")}</Pill> : null}
                  </p>
                  <p className="mt-0.5 text-meta text-fg-secondary">
                    {s.place} · {s.current ? t("security.activeNow") : now ? formatRelative(s.lastActiveAt, locale, now) : "…"}
                  </p>
                </div>
                {!s.current ? (
                  <Button variant="ghost" size="sm" onClick={() => ask(s)}>
                    {t("security.signOut")}
                    <span className="sr-only">: {client}</span>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-meta text-fg-secondary">{t("security.sessionsNote")}</p>

      <ConfirmDialog
        open={confirmOpen && target !== null}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirm}
        tone="danger"
        loading={revoke.isPending || revokeOthers.isPending}
        title={target === "others" ? t("security.confirmOthersTitle") : t("security.confirmTitle", { device: target?.client ?? "" })}
        description={t("security.confirmBody")}
        confirmLabel={t("security.signOut")}
      />
    </Panel>
  );
}
