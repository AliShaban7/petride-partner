"use client";

import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PawMark } from "@/components/illustrations";
import { Dialog, IconButton, Tag, Tooltip } from "@/components/ui";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

import { GlobalSearch } from "./GlobalSearch";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { partnerFeatures } from "./nav";
import { NotificationsMenu } from "./NotificationsMenu";
import { ProfileMenu } from "./ProfileMenu";

/** Where the "3 new requests" / "2 new orders" quick link goes, or null when there is nothing new. */
function useNewBadge({ requests, orders }: { requests: number; orders: number }) {
  const t = useT("shell");
  const locale = useLocale();
  const session = useSession();
  const f = partnerFeatures(session);
  const showOrders = f.orders && (!f.appointments || orders > 0);
  const count = showOrders ? orders : requests;
  if (count <= 0) return null;
  const route = showOrders ? ROUTES.orders : ROUTES.appointments;
  return {
    route,
    href: showOrders ? localizedHref(locale, route, { status: "new" }) : localizedHref(locale, route, { status: "requested" }),
    label: showOrders ? t.plural("topbar.newOrders", count) : t.plural("topbar.newRequests", count),
  };
}

/** "3 new requests" / "2 new orders" quick link (coral fill, dark text). */
function NewBadge({ badge, className }: { badge: NonNullable<ReturnType<typeof useNewBadge>>; className?: string }) {
  return (
    <Link
      href={badge.href}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-chip bg-accent px-3 text-body-sm font-semibold text-fg shadow-thumb transition-transform hover:-translate-y-0.5",
        className,
      )}
    >
      <Sparkles aria-hidden="true" size={16} />
      {badge.label}
    </Link>
  );
}

/**
 * Phone-only quick link (< 640px), the first thing in <main> so it sits inside the main landmark and scrolls
 * away with the page. Hidden on the Overview and on the page it links to: both already lead with the same
 * count and list (requests / new orders panel, the Requests chip, the New tab).
 */
export function MobileNewBadge({ counts, path }: { counts: { requests: number; orders: number }; path: string }) {
  const badge = useNewBadge(counts);
  if (!badge || path === ROUTES.overview || path.startsWith(badge.route)) return null;
  return (
    <div className="-mt-1 mb-3 sm:hidden">
      <NewBadge badge={badge} className="w-full justify-center" />
    </div>
  );
}

/** Desktop / tablet top bar (≥ 640px). */
export function TopBar({ counts }: { counts: { requests: number; orders: number } }) {
  const tc = useT("common");
  const badge = useNewBadge(counts);
  return (
    // The sidebar's half-circle tab sticks 24px into this bar (it replaces the old hamburger), so the
    // left padding keeps the search clear of it.
    <header className="sticky top-0 z-30 hidden h-[var(--topbar-h)] items-center gap-3 border-b border-border/70 bg-bg/85 pl-10 pr-4 backdrop-blur-md sm:flex lg:px-8">
      <GlobalSearch className="w-full max-w-md" />
      <div className="ml-auto flex items-center gap-1.5">
        {badge ? <NewBadge badge={badge} className="hidden md:inline-flex" /> : null}
        <Tooltip content={tc("demo.hint")} side="bottom">
          <span tabIndex={0} className="hidden rounded-chip xl:inline-flex">
            <Tag tone="white">{tc("demo.badge")}</Tag>
          </span>
        </Tooltip>
        <LanguageSwitcher />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}

/** Phone top bar (< 640px): logo, page title, search, bell, profile. */
export function MobileTopBar({ title }: { title: string }) {
  const t = useT("shell");
  const locale = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md sm:hidden">
      <div className="flex h-[var(--mobile-topbar-h)] items-center gap-2 px-4">
        <Link href={localizedHref(locale, ROUTES.overview)} aria-label={t("homeLink")} className="shrink-0 rounded-tile">
          <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-tile bg-primary-dark">
            <PawMark size={22} color="var(--color-surface)" />
          </span>
        </Link>
        <p className="min-w-0 flex-1 truncate font-display text-title font-extrabold" aria-hidden="true">
          {title}
        </p>
        <IconButton label={t("topbar.searchLabel")} icon={<Search size={20} />} onClick={() => setSearchOpen(true)} />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} title={t("topbar.searchLabel")} size="sm">
        <GlobalSearch autoFocus onDone={() => setSearchOpen(false)} className="pb-3" />
      </Dialog>
    </header>
  );
}
