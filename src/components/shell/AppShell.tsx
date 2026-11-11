"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { stripLocale } from "@/lib/i18n/navigation";

import { BottomTabBar } from "./BottomTabBar";
import { MoreSheet } from "./MoreSheet";
import { getNavItems, isActive } from "./nav";
import { Sidebar } from "./Sidebar";
import { MobileTopBar, TopBar } from "./TopBar";
import { useShellCounts } from "./useShellCounts";

// Desktop "collapsed" preference in localStorage, read through useSyncExternalStore (no flash, no effect).
const KEY = "petride.sidebar.collapsed";
const listeners = new Set<() => void>();
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // storage blocked: keep it in memory for this page view only
  }
  for (const l of listeners) l();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Dashboard frame for every (dash) page: sidebar (≥ 640px), top bar, phone top bar + bottom tab
 * bar + More sheet (< 640px), skip link and the <main> landmark. Pages render only their content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const t = useT("shell");
  const tc = useT("common");
  const path = stripLocale(usePathname());
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [expanded, setExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { requests, orders } = useShellCounts();
  const counts = { requests, orders };

  const current = getNavItems(session).find((i) => isActive(i, path));
  // The phone top bar is narrow (logo + 3 icon buttons): use the short label ("Qiymətlər", "Gedişlər").
  const title = current ? t(`navShort.${current.shortKey}`) : tc("appName");

  // Tablet overlay sidebar: Esc closes it.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const toggle = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      writeCollapsed(!collapsed);
      setExpanded(false);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[70] rounded-button bg-primary px-4 py-3 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {tc("a11y.skipToContent")}
      </a>

      <Sidebar mode={{ collapsed, expanded }} onToggle={toggle} onNavigate={() => setExpanded(false)} counts={counts} />
      {expanded ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 hidden animate-fade-in bg-overlay sm:block lg:hidden"
          onClick={() => setExpanded(false)}
        />
      ) : null}

      <div className={cn("flex min-h-dvh min-w-0 flex-col transition-[padding] duration-300", collapsed ? "sm:pl-[var(--sidebar-rail-w)]" : "sm:pl-[var(--sidebar-rail-w)] lg:pl-[var(--sidebar-w)]")}>
        <TopBar counts={counts} />
        <MobileTopBar title={title} counts={counts} />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 pb-[calc(var(--tabbar-h)+2rem+env(safe-area-inset-bottom))] pt-5 outline-none sm:px-6 sm:pb-12 sm:pt-8 lg:px-8"
        >
          {children}
        </main>
      </div>

      <BottomTabBar counts={counts} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
