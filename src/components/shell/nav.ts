import {
  CalendarDays,
  CarFront,
  ChartColumnBig,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingBag,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Session } from "@/lib/auth/session";
import { ROUTES } from "@/lib/i18n/navigation";

export type NavKey = "overview" | "appointments" | "orders" | "clients" | "stats" | "services" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** Key in the "shell" namespace: nav.<labelKey> / navShort.<shortKey>. */
  labelKey: "overview" | "appointments" | "orders" | "rides" | "clients" | "stats" | "services" | "servicesShop" | "settings";
  shortKey: NavKey | "rides";
  /** Live count bubble. */
  badge?: "requests" | "orders";
};

const ITEMS: Record<NavKey | "rides", NavItem> = {
  overview: { key: "overview", href: ROUTES.overview, icon: LayoutDashboard, labelKey: "overview", shortKey: "overview" },
  appointments: { key: "appointments", href: ROUTES.appointments, icon: CalendarDays, labelKey: "appointments", shortKey: "appointments", badge: "requests" },
  orders: { key: "orders", href: ROUTES.orders, icon: ShoppingBag, labelKey: "orders", shortKey: "orders", badge: "orders" },
  // Same route as orders: clinics, salons and hotels see the PetRide rides to and from them there.
  rides: { key: "orders", href: ROUTES.orders, icon: CarFront, labelKey: "rides", shortKey: "rides" },
  clients: { key: "clients", href: ROUTES.clients, icon: UsersRound, labelKey: "clients", shortKey: "clients" },
  stats: { key: "stats", href: ROUTES.stats, icon: ChartColumnBig, labelKey: "stats", shortKey: "stats" },
  services: { key: "services", href: ROUTES.services, icon: ReceiptText, labelKey: "services", shortKey: "services" },
  settings: { key: "settings", href: ROUTES.settings, icon: Settings, labelKey: "settings", shortKey: "settings" },
};

/** Which sections a partner has, from its service lines. */
export function partnerFeatures(session: Pick<Session, "categories">) {
  return {
    appointments: session.categories.some((c) => c !== "shop"),
    orders: session.categories.includes("shop"),
  };
}

/**
 * Sidebar order, driven by the partner type: clinics / salons / hotels lead with Appointments,
 * pet shops lead with Orders. Sections a partner doesn't have are hidden.
 */
export function getNavItems(session: Pick<Session, "categories">): NavItem[] {
  const f = partnerFeatures(session);
  const shopFirst = f.orders && !f.appointments;
  const primary: NavItem[] = shopFirst
    ? [ITEMS.orders, ...(f.appointments ? [ITEMS.appointments] : [])]
    : [ITEMS.appointments, f.orders ? ITEMS.orders : ITEMS.rides];
  const services: NavItem = shopFirst ? { ...ITEMS.services, labelKey: "servicesShop" } : ITEMS.services;
  return [ITEMS.overview, ...primary, ITEMS.clients, ITEMS.stats, services, ITEMS.settings];
}

/** Bottom tab bar (< 640px): 4 key sections + "More". */
export function getTabItems(session: Pick<Session, "categories">): NavItem[] {
  const items = getNavItems(session);
  const primary = items[1];
  return [ITEMS.overview, primary, ITEMS.clients, ITEMS.stats];
}

/** Items that live in the "More" sheet on phones. */
export function getMoreItems(session: Pick<Session, "categories">): NavItem[] {
  const tabs = new Set(getTabItems(session).map((i) => i.key));
  return getNavItems(session).filter((i) => !tabs.has(i.key));
}

/** Active when the path (without locale) is the item or below it. */
export function isActive(item: NavItem, path: string): boolean {
  return path === item.href || path.startsWith(`${item.href}/`);
}
