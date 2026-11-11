"use client";

import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PawMark } from "@/components/illustrations";
import { CountBadge } from "@/components/ui";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, stripLocale } from "@/lib/i18n/navigation";

import { getNavItems, isActive } from "./nav";
import { PartnerCard } from "./PartnerCard";

export type SidebarMode = {
  /** Desktop user collapsed it to the icon rail. */
  collapsed: boolean;
  /** Tablet: the rail is expanded as an overlay. */
  expanded: boolean;
};

/**
 * Dark teal sidebar: logo tile + "Partner" with the collapse toggle beside it (under the logo on
 * the icon rail), nav with a coral active pill, live count badges, partner card at the bottom. ≥ 1024px full width (collapsible to a rail); 640–1023px icon rail
 * that expands as an overlay; hidden below 640px (bottom tab bar instead).
 */
export function Sidebar({
  mode,
  onToggle,
  onNavigate,
  counts,
}: {
  mode: SidebarMode;
  onToggle: () => void;
  onNavigate: () => void;
  counts: { requests: number; orders: number };
}) {
  const session = useSession();
  const locale = useLocale();
  const t = useT("shell");
  const path = stripLocale(usePathname());
  const items = getNavItems(session);
  // Label visibility per mode (labels stay in the DOM as sr-only so the rail keeps accessible names).
  const labelClass = mode.expanded ? "" : mode.collapsed ? "sr-only" : "sr-only lg:not-sr-only";
  const wide = mode.expanded ? "w-[var(--sidebar-w)]" : mode.collapsed ? "w-[var(--sidebar-rail-w)]" : "w-[var(--sidebar-rail-w)] lg:w-[var(--sidebar-w)]";
  const railOnly = mode.expanded ? "hidden" : mode.collapsed ? "flex" : "flex lg:hidden";
  const fullOnly = mode.expanded ? "flex" : mode.collapsed ? "hidden" : "hidden lg:flex";

  return (
    <aside
      data-surface="dark"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col overflow-x-hidden bg-primary-dark text-on-primary transition-[width] duration-300 ease-[var(--ease-out-soft)] sm:flex",
        wide,
        mode.expanded && "shadow-sheet",
      )}
    >
      {/* Brand + collapse (full sidebar: the toggle sits at the end of the logo row) */}
      <div className="flex h-[var(--topbar-h)] shrink-0 items-center gap-2 px-4">
        <Link
          href={localizedHref(locale, "/overview")}
          onClick={onNavigate}
          aria-label={t("homeLink")}
          className="flex min-w-0 items-center gap-2.5 rounded-tile"
        >
          <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-tile bg-surface shadow-thumb">
            <PawMark size={28} />
          </span>
          <span className={cn("min-w-0 items-baseline gap-1.5", fullOnly)} aria-hidden="true">
            <span className="font-display text-[1.375rem] font-extrabold leading-none tracking-tight">PetRide</span>
            <span className="rounded-chip bg-accent px-2 py-0.5 text-caption font-bold text-fg">{t("partnerLabel")}</span>
          </span>
        </Link>
        {/* Two buttons instead of one, so each has a name that matches what it does at this width. */}
        <SidebarToggle
          label={t("sidebar.collapse")}
          icon={PanelLeftClose}
          onClick={onToggle}
          expanded={mode.expanded || undefined}
          className={cn("-mr-1.5 ml-auto", fullOnly)}
        />
      </div>

      {/* Icon rail: the expand toggle sits right under the logo */}
      <div className={cn("shrink-0 justify-center px-3 pb-1", railOnly)}>
        <SidebarToggle label={t("sidebar.expand")} icon={PanelLeftOpen} onClick={onToggle} />
      </div>

      {/* Nav */}
      <nav aria-label={t("nav.label")} className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isActive(item, path);
            const count = item.badge === "requests" ? counts.requests : item.badge === "orders" ? counts.orders : 0;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={localizedHref(locale, item.href)}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={mode.expanded ? undefined : t(`nav.${item.labelKey}`)}
                  className={cn(
                    "group relative flex min-h-12 items-center gap-3 rounded-chip px-3.5 text-body font-semibold transition-[background-color,color] duration-200",
                    active ? "bg-accent text-fg shadow-thumb" : "text-on-primary-muted hover:bg-primary-dark-raised hover:text-on-primary",
                  )}
                >
                  <Icon aria-hidden="true" size={21} strokeWidth={active ? 2.1 : 1.9} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className={cn("min-w-0 flex-1 truncate", labelClass)}>{t(`nav.${item.labelKey}`)}</span>
                  {count > 0 ? (
                    <>
                      <CountBadge
                        count={count}
                        className={cn(
                          active ? "bg-primary-dark text-on-primary" : "",
                          !mode.expanded && (mode.collapsed ? "absolute right-1 top-1" : "absolute right-1 top-1 lg:static"),
                        )}
                      />
                      <span className="sr-only">
                        {item.badge === "requests" ? t.plural("topbar.newRequests", count) : t.plural("topbar.newOrders", count)}
                      </span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Partner */}
      <div className="shrink-0 p-3">
        <div className={fullOnly}>
          <div className="w-full">
            <PartnerCard />
          </div>
        </div>
        <div className={railOnly}>
          <div className="w-full">
            <PartnerCard compact labelClass="sr-only" />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** 44px icon-only sidebar toggle with a tooltip; its name is the action it performs. */
function SidebarToggle({
  label,
  icon: Icon,
  onClick,
  expanded,
  className,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  expanded?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className={cn(
        "size-11 shrink-0 items-center justify-center rounded-chip text-on-primary-muted transition-colors duration-200 hover:bg-primary-dark-raised hover:text-on-primary",
        className,
      )}
    >
      <Icon aria-hidden="true" size={20} />
    </button>
  );
}
