import { LOCALES, type Locale } from "./config";

/** Dashboard routes (relative to /[locale]). Keep in sync with app/[locale]/(dash)/*. */
export const ROUTES = {
  overview: "/overview",
  appointments: "/appointments",
  orders: "/orders",
  clients: "/clients",
  stats: "/stats",
  services: "/services",
  settings: "/settings",
  login: "/login",
} as const;

export type RouteKey = keyof typeof ROUTES;

/** `/az/appointments?status=requested` from ("az", "/appointments", { status: "requested" }). */
export function localizedHref(
  locale: Locale,
  path: string,
  query?: Record<string, string | number | undefined | null>,
): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return `/${locale}${clean === "/" ? "" : clean}${qs ? `?${qs}` : ""}`;
}

/** Same page in another language: `/az/orders?x=1` → `/ru/orders?x=1`. */
export function switchLocalePath(pathname: string, search: string, target: Locale): string {
  const parts = pathname.split("/");
  if ((LOCALES as readonly string[]).includes(parts[1] ?? "")) parts[1] = target;
  else parts.splice(1, 0, target);
  return `${parts.join("/") || `/${target}`}${search}`;
}

/** Path without the locale prefix: `/az/orders/42` → `/orders/42`. */
export function stripLocale(pathname: string): string {
  const parts = pathname.split("/");
  if ((LOCALES as readonly string[]).includes(parts[1] ?? "")) parts.splice(1, 1);
  return parts.join("/") || "/";
}
