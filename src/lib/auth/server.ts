import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

import { decodeSession, SESSION_COOKIE, type Session } from "./session";

/** The signed-in partner session (Server Components, server actions, route handlers), or null. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

/** Like getSession, but redirects to the login page when signed out. */
export async function requireSession(locale: Locale): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(localizedHref(locale, ROUTES.login));
  return session;
}
