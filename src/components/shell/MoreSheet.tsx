"use client";

import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useTransition } from "react";

import { Drawer } from "@/components/ui";
import { logout } from "@/lib/auth/actions";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, stripLocale } from "@/lib/i18n/navigation";

import { LanguageButtons } from "./LanguageSwitcher";
import { getMoreItems, isActive } from "./nav";
import { PartnerCard } from "./PartnerCard";

/** Phone "More" bottom sheet: remaining sections, language, partner (demo switch), log out. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useSession();
  const locale = useLocale();
  const t = useT("shell");
  const tc = useT("common");
  const path = stripLocale(usePathname());
  const [, start] = useTransition();
  // The sheet is phone-only: close it if the window grows past 640px.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 640px)");
    const onChange = () => {
      if (mq.matches) onClose();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open, onClose]);
  return (
    <Drawer open={open} onClose={onClose} title={t("more.title")} side="bottom">
      <nav aria-label={t("more.title")}>
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
          {getMoreItems(session).map((item) => {
            const Icon = item.icon;
            const active = isActive(item, path);
            return (
              <li key={item.key}>
                <Link
                  href={localizedHref(locale, item.href)}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 items-center gap-3 px-4 text-body font-semibold", active ? "bg-primary-selected text-primary" : "text-fg hover:bg-surface-muted")}
                >
                  <Icon aria-hidden="true" size={20} />
                  <span className="flex-1">{t(`nav.${item.labelKey}`)}</span>
                  <ChevronRight aria-hidden="true" size={18} className="text-fg-secondary" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-body-sm font-semibold">{t("language.label")}</p>
        <LanguageButtons />
      </div>
      <div data-surface="dark" className="mt-5 rounded-card bg-primary-dark p-1">
        <PartnerCard onSwitched={onClose} />
      </div>
      <p className="mt-3 text-center text-caption text-fg-secondary">{tc("demo.hint")}</p>
      <button
        type="button"
        onClick={() => start(() => logout(locale))}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-button border border-border text-body font-semibold text-error-text hover:bg-error-bg"
      >
        <LogOut aria-hidden="true" size={18} />
        {t("profile.logout")}
      </button>
    </Drawer>
  );
}
