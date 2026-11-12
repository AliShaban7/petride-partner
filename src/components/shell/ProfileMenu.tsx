"use client";

import { LogOut, Settings } from "lucide-react";
import { useTransition } from "react";

import { Avatar, Menu } from "@/components/ui";
import { logout } from "@/lib/auth/actions";
import { useSession } from "@/lib/auth/client";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

/** Avatar button → menu with the signed-in user, Settings and Log out. */
export function ProfileMenu() {
  const session = useSession();
  const t = useT("shell");
  const locale = useLocale();
  const [, start] = useTransition();
  return (
    <Menu
      label={t("topbar.profile")}
      header={
        <div className="min-w-0">
          <p className="text-caption text-fg-secondary">{t("profile.signedInAs")}</p>
          <p className="truncate text-body-sm font-semibold text-fg">{session.userName}</p>
          <p className="truncate text-meta text-fg-secondary">{session.email}</p>
        </div>
      }
      items={[
        { id: "settings", label: t("profile.settings"), icon: <Settings aria-hidden="true" size={18} />, href: localizedHref(locale, ROUTES.settings) },
        {
          id: "logout",
          label: t("profile.logout"),
          icon: <LogOut aria-hidden="true" size={18} />,
          tone: "danger",
          separatorBefore: true,
          onSelect: () => start(() => logout(locale)),
        },
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="inline-flex min-h-11 items-center gap-2 rounded-chip p-1 pr-1 transition-colors hover:bg-surface-muted sm:pr-3"
        >
          {/* Named by its content ("Profile menu: IDEA Admin"), so the visible user name is part of the name (label-in-name). */}
          <Avatar name={session.partnerShortName} size="sm" tint="peach" />
          <span className="sr-only">{t("topbar.profile")}: </span>
          <span className="sr-only xl:hidden">{session.userName}</span>
          <span className="hidden max-w-36 truncate text-body-sm font-semibold text-fg xl:inline-block">{session.userName}</span>
        </button>
      )}
    />
  );
}
