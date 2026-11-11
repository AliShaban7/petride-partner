"use client";

import { ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Avatar, Spinner } from "@/components/ui";
import { switchDemoPartner } from "@/lib/auth/actions";
import { DEMO_ACCOUNTS } from "@/lib/auth/accounts";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

/** Switches the session to the other demo partner and reloads the dashboard data. */
export function useDemoSwitch(onSwitched?: () => void) {
  const session = useSession();
  const router = useRouter();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const other = DEMO_ACCOUNTS.find((a) => a.partnerId !== session.partnerId);
  const switchPartner = () => {
    if (!other) return;
    start(async () => {
      const res = await switchDemoPartner(other.partnerId);
      if (res.ok) {
        onSwitched?.();
        router.push(localizedHref(locale, ROUTES.overview));
        router.refresh();
      }
    });
  };
  return { other, switchPartner, pending };
}

/**
 * Partner block at the bottom of the sidebar: name, type and the demo switch.
 * `compact` = rail mode (avatar only, name in the accessible label).
 */
export function PartnerCard({ compact = false, labelClass, onSwitched }: { compact?: boolean; labelClass?: string; onSwitched?: () => void }) {
  const session = useSession();
  const t = useT("shell");
  const ts = useT("status");
  const { other, switchPartner, pending } = useDemoSwitch(onSwitched);
  const kind = ts.dynamic(`kind.${session.partnerKind}`);
  const categories = session.categories.map((c) => ts.dynamic(`category.${c}`)).join(" · ");
  return (
    <div className={cn("rounded-card bg-primary-dark-raised/70 p-3", compact && "p-2")}>
      <div className="flex items-center gap-3">
        <Avatar name={session.partnerShortName} tint="mint" size="sm" shape="tile" />
        <div className={cn("min-w-0", labelClass)}>
          <p className="truncate text-body-sm font-semibold text-on-primary">{session.partnerName}</p>
          <p className="line-clamp-2 text-caption text-on-primary-muted">{session.categories.length > 1 ? categories : kind}</p>
        </div>
      </div>
      {other ? (
        <button
          type="button"
          onClick={switchPartner}
          disabled={pending}
          title={t("partner.switchLabel")}
          className={cn(
            "mt-3 flex min-h-10 w-full items-center gap-2 rounded-tile px-2.5 text-left text-caption font-semibold text-on-primary-muted transition-colors hover:bg-primary-dark-deep hover:text-on-primary disabled:opacity-60",
            compact && "justify-center px-0",
          )}
        >
          {pending ? <Spinner size={16} /> : <ArrowLeftRight aria-hidden="true" size={16} className="shrink-0" />}
          <span className={cn("min-w-0", labelClass)}>
            <span className="block text-on-dark-muted">{t("partner.switchLabel")}</span>
            <span className="block truncate text-on-primary">{pending ? t("partner.switching") : t("partner.switchTo", { name: other.partnerShortName })}</span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
