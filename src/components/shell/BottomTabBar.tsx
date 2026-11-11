"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, stripLocale } from "@/lib/i18n/navigation";

import { getMoreItems, getTabItems, isActive } from "./nav";

/** Phone tab bar (< 640px): 4 key sections + "More" (opens the More sheet). */
export function BottomTabBar({ counts, onMore, moreOpen }: { counts: { requests: number; orders: number }; onMore: () => void; moreOpen: boolean }) {
  const session = useSession();
  const locale = useLocale();
  const t = useT("shell");
  const path = stripLocale(usePathname());
  const tabs = getTabItems(session);
  const moreActive = getMoreItems(session).some((i) => isActive(i, path));
  const cell = "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-tile text-caption font-semibold";
  const pill = (active: boolean) =>
    cn("inline-flex h-8 w-14 items-center justify-center rounded-chip transition-colors duration-200", active ? "bg-accent text-fg" : "text-fg-secondary");
  return (
    <nav aria-label={t("nav.label")} className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md sm:hidden">
      <ul className="flex h-[var(--tabbar-h)] items-stretch gap-1 px-2">
        {tabs.map((item) => {
          const active = isActive(item, path);
          const count = item.badge === "requests" ? counts.requests : item.badge === "orders" ? counts.orders : 0;
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex flex-1">
              <Link href={localizedHref(locale, item.href)} aria-current={active ? "page" : undefined} className={cn(cell, active ? "text-fg" : "text-fg-secondary")}>
                <span className={pill(active)}>
                  <Icon aria-hidden="true" size={21} strokeWidth={active ? 2.1 : 1.8} />
                </span>
                <span className="max-w-full truncate px-0.5">{t(`navShort.${item.shortKey}`)}</span>
                {count > 0 ? (
                  <>
                    <span aria-hidden="true" className="absolute right-[calc(50%-1.75rem)] top-1 min-w-4.5 rounded-chip bg-accent-strong px-1 text-center text-[11px] font-bold leading-4.5 text-on-primary">
                      {count > 9 ? "9+" : count}
                    </span>
                    <span className="sr-only">{item.badge === "requests" ? t.plural("topbar.newRequests", count) : t.plural("topbar.newOrders", count)}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} aria-expanded={moreOpen} aria-haspopup="dialog" className={cn(cell, moreActive || moreOpen ? "text-fg" : "text-fg-secondary")}>
            <span className={pill(moreActive)}>
              <Ellipsis aria-hidden="true" size={22} />
            </span>
            <span>{t("navShort.more")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
