import { NextResponse, type NextRequest } from "next/server";

import { decodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE, matchLocale } from "@/lib/i18n/config";

/**
 * 1. Every page lives under /az | /ru | /en — bare URLs get the remembered / browser language.
 * 2. Dashboard routes need a session cookie (mock auth) → otherwise /{locale}/login?next=…
 * 3. Signed-in partners skip the login page.
 * The (dash) layout checks the session again on the server (defence in depth).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first, ...rest] = pathname.split("/");

  if (!isLocale(first)) {
    const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(remembered) ? remembered : matchLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = first;
  const section = rest[0] ?? "";
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (section === "login") {
    if (session) return NextResponse.redirect(new URL(`/${locale}/overview`, request.url));
    return NextResponse.next();
  }
  if (!session) {
    const url = new URL(`/${locale}/login`, request.url);
    if (section) url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (!section) return NextResponse.redirect(new URL(`/${locale}/overview`, request.url));
  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API routes and files with an extension (icons, images, fonts).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
