"use client";

import { Menu as MenuIcon, Search, Sparkles } from "lucide-react";
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

/** "3 new requests" / "2 new orders" quick link (coral fill, dark text). */
function NewBadge({ requests, orders, className }: { requests: number; orders: number; className?: string }) {
  const t = useT("shell");
  const locale = useLocale();
  const session = useSession();
  const f = partnerFeatures(session);
  const showOrders = f.orders && (!f.appointments || orders > 0);
  const count = showOrders ? orders : requests;
  if (count <= 0) return null;
  const href = showOrders ? localizedHref(locale, ROUTES.orders, { status: "new" }) : localizedHref(locale, ROUTES.appointments, { status: "requested" });
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-chip bg-accent px-3 text-body-sm font-semibold text-fg shadow-thumb transition-transform hover:-translate-y-0.5",
        className,
      )}
    >
      <Sparkles aria-hidden="true" size={16} />
      {showOrders ? t.plural("topbar.newOrders", count) : t.plural("topbar.newRequests", count)}
    </Link>
  );
}

/** Desktop / tablet top bar (≥ 640px). */
export function TopBar({ counts, onMenu }: { counts: { requests: number; orders: number }; onMenu: () => void }) {
  const t = useT("shell");
  const tc = useT("common");
  return (
    <header className="sticky top-0 z-30 hidden h-[var(--topbar-h)] items-center gap-3 border-b border-border/70 bg-bg/85 px-4 backdrop-blur-md sm:flex lg:px-8">
      <IconButton label={t("sidebar.expand")} icon={<MenuIcon size={20} />} onClick={onMenu} className="lg:hidden" />
      <GlobalSearch className="w-full max-w-md" />
      <div className="ml-auto flex items-center gap-1.5">
        <NewBadge requests={counts.requests} orders={counts.orders} className="hidden md:inline-flex" />
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
export function MobileTopBar({ title, counts }: { title: string; counts: { requests: number; orders: number } }) {
  const t = useT("shell");
  const locale = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur-md sm:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
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
      {/* Not sticky: scrolls away so the phone keeps its vertical space. */}
      {counts.requests + counts.orders > 0 ? (
        <div className="px-4 pt-3 sm:hidden">
          <NewBadge requests={counts.requests} orders={counts.orders} className="min-h-10 w-full justify-center" />
        </div>
      ) : null}
    </>
  );
}
