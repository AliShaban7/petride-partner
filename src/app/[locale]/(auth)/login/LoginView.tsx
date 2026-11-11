"use client";

import { CircleAlert, Eye, EyeOff, LogIn, Mail, Stethoscope, Store } from "lucide-react";
import { useActionState, useState } from "react";

import { PawMark, PeekingPaws, SoftBackground } from "@/components/illustrations";
import { LanguageButtons } from "@/components/shell/LanguageSwitcher";
import { Button, Input } from "@/components/ui";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/accounts";
import { login, type LoginState } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";

const INITIAL: LoginState = { error: null, email: "" };

/** Partner login: soft pastel background, paws peeking from the bottom, demo credentials. */
export function LoginView({ locale, next }: { locale: Locale; next?: string }) {
  const t = useT("auth");
  const tc = useT("common");
  const [state, action, pending] = useActionState(login, INITIAL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const errorId = "login-error";

  const fill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <SoftBackground className="-z-10" />
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-tile bg-primary-dark shadow-thumb">
            <PawMark size={24} color="var(--color-surface)" />
          </span>
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-[1.375rem] font-extrabold leading-none tracking-tight text-fg">PetRide</span>
            <span className="rounded-chip bg-accent px-2 py-0.5 text-caption font-bold text-fg">Partner</span>
          </p>
        </div>
        <LanguageButtons />
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pb-44 pt-8 sm:items-center sm:pb-48 sm:pt-6">
        <div className="w-full max-w-md animate-fade-up rounded-panel bg-surface/95 p-6 shadow-sheet backdrop-blur sm:p-8">
          <p className="text-body-sm font-semibold text-primary">{t("partnersOnly")}</p>
          <h1 className="mt-1 font-display text-[2.25rem] font-extrabold leading-[1.05] tracking-tight text-fg sm:text-[2.75rem]">{t("title")}</h1>
          <p className="mt-2 text-body text-fg-secondary">{t("subtitle")}</p>

          <form action={action} className="mt-6 space-y-4" noValidate aria-describedby={state.error ? errorId : undefined}>
            <input type="hidden" name="locale" value={locale} />
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <Input
              label={t("email")}
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail aria-hidden="true" size={18} />}
              required
              aria-invalid={state.error ? true : undefined}
            />
            <Input
              label={t("password")}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-invalid={state.error ? true : undefined}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? tc("a11y.hidePassword") : tc("a11y.showPassword")}
                  aria-pressed={showPassword}
                  className="inline-flex size-9 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-muted hover:text-fg"
                >
                  {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                </button>
              }
            />
            {state.error ? (
              <p id={errorId} role="alert" className="flex items-start gap-2 rounded-tile bg-error-bg px-3 py-2.5 text-body-sm font-medium text-error-text">
                <CircleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
                {t(state.error === "missing" ? "errors.missing" : "errors.invalid")}
              </p>
            ) : null}
            <Button type="submit" size="lg" fullWidth loading={pending} leftIcon={<LogIn aria-hidden="true" size={20} />}>
              {pending ? t("submitting") : t("submit")}
            </Button>
          </form>

          <section aria-labelledby="demo-title" className="mt-6 rounded-card bg-soft-sand p-4">
            <h2 id="demo-title" className="text-body-sm font-bold text-fg">
              {t("demo.title")}
            </h2>
            <p className="mt-0.5 text-meta text-fg-tertiary">{t("demo.body", { password: DEMO_PASSWORD })}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fill(account.email)}
                  aria-label={t("demo.fill", { email: account.email })}
                  className="flex min-h-12 items-center gap-2.5 rounded-tile bg-surface px-3 py-2 text-left shadow-thumb transition-transform hover:-translate-y-0.5"
                >
                  <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                    {account.partnerKind === "petshop" ? <Store size={16} /> : <Stethoscope size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-caption font-semibold text-fg-tertiary">{t(account.partnerKind === "petshop" ? "demo.shop" : "demo.clinic")}</span>
                    <span className="block truncate text-meta font-medium text-fg">{account.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <p className="mt-4 text-center text-caption text-fg-secondary">{t("help")}</p>
        </div>
      </div>

      <PeekingPaws height={160} className="pointer-events-auto absolute inset-x-0 bottom-0 hidden sm:block" />
      <PeekingPaws height={120} density={3} className="absolute inset-x-0 bottom-0 sm:hidden" />
    </main>
  );
}
