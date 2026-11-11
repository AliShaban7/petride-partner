"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

import { accountForPartner, findAccount } from "./accounts";
import { encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from "./session";

export type LoginState = { error: "invalid" | "missing" | null; email: string };

async function setSessionCookie(partnerId: string, email: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession({ partnerId, email, iat: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Only same-site dashboard paths are allowed as `next` (no open redirects). */
function safeNext(next: unknown, locale: Locale): string {
  if (typeof next === "string" && /^\/(az|ru|en)\/(?!login)[\w\-/?=&%.]*$/.test(next) && !next.startsWith("//")) return next;
  return localizedHref(locale, ROUTES.overview);
}

/** Login form action (useActionState). Demo: idea@petride.az / shop@petride.az, password petride123. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const localeValue = formData.get("locale");
  const locale: Locale = isLocale(localeValue) ? localeValue : DEFAULT_LOCALE;
  if (!email || !password) return { error: "missing", email };
  const account = findAccount(email);
  if (!account || account.password !== password) return { error: "invalid", email };
  await setSessionCookie(account.partnerId, account.email);
  redirect(safeNext(formData.get("next"), locale));
}

export async function logout(locale: Locale): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect(localizedHref(isLocale(locale) ? locale : DEFAULT_LOCALE, ROUTES.login));
}

/** Demo only: jump between the two demo partners without logging out (sidebar partner card). */
export async function switchDemoPartner(partnerId: string): Promise<{ ok: boolean }> {
  const account = accountForPartner(partnerId);
  if (!account) return { ok: false };
  await setSessionCookie(account.partnerId, account.email);
  return { ok: true };
}

/** Remembers the language for bare URLs (the proxy reads it). */
export async function rememberLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
