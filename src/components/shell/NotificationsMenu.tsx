"use client";

import { Bell, CalendarPlus, CalendarX, Car, MessageSquareHeart, PackageX, ShoppingBag, Syringe, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState, ErrorState, IconButton, Popover, SkeletonRows } from "@/components/ui";
import { useApiMutation } from "@/lib/api/hooks";
import type { NotificationKind, PartnerNotification } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref } from "@/lib/i18n/navigation";

import { useShellCounts } from "./useShellCounts";

const ICONS: Record<NotificationKind, LucideIcon> = {
  new_request: CalendarPlus,
  request_cancelled: CalendarX,
  ride_onway: Car,
  ride_arriving: Car,
  ride_arrived: Car,
  new_order: ShoppingBag,
  order_cancelled: PackageX,
  new_review: MessageSquareHeart,
  vaccine_due: Syringe,
};

/** Bell with unread count → popover list. Clicking an item opens its page and marks it read. */
export function NotificationsMenu({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useT("shell");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { unread, notifications } = useShellCounts();
  const markRead = useApiMutation((api, id: string) => api.markNotificationRead(id), { invalidates: ["notifications"] });
  const markAll = useApiMutation((api) => api.markAllNotificationsRead(), { invalidates: ["notifications"] });

  const openItem = (n: PartnerNotification) => {
    if (!n.read) void markRead.mutate(n.id);
    setOpen(false);
    if (n.href) router.push(localizedHref(locale, n.href.split("?")[0], Object.fromEntries(new URLSearchParams(n.href.split("?")[1] ?? ""))));
  };

  const label = unread > 0 ? `${t("topbar.notifications")}, ${t.plural("topbar.unread", unread)}` : t("topbar.notifications");

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("topbar.notifications")}
      trigger={(props) => (
        <IconButton {...props} label={label} icon={<Bell size={20} />} badge={unread} variant={tone === "dark" ? "onDark" : "ghost"} />
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-display text-title font-extrabold">{t("topbar.notifications")}</p>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            className="min-h-9 rounded-tile px-2 text-body-sm font-semibold text-primary hover:bg-primary-tint"
          >
            {t("topbar.markAllRead")}
          </button>
        ) : null}
      </div>
      <div className="max-h-[min(28rem,70dvh)] overflow-y-auto">
        {notifications.data === undefined ? (
          notifications.error ? (
            <ErrorState error={notifications.error} onRetry={notifications.refetch} compact />
          ) : (
            <SkeletonRows rows={4} className="px-4" />
          )
        ) : notifications.data.length === 0 ? (
          <EmptyState compact title={t("topbar.noNotificationsTitle")} description={t("topbar.noNotificationsBody")} pet="cream" />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.data.map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted", !n.read && "bg-primary-selected/60")}
                  >
                    <span aria-hidden="true" className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-body-sm font-semibold text-fg">{n.title}</span>
                        {!n.read ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent-strong" /> : null}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-meta text-fg-secondary">{n.body}</span>
                      <span className="mt-1 block text-caption text-fg-secondary">{formatRelative(n.createdAt, locale)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Popover>
  );
}
