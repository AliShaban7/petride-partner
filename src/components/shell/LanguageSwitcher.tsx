"use client";

import { Check, Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Menu } from "@/components/ui";
import { rememberLocale } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";
import { LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { switchLocalePath } from "@/lib/i18n/navigation";

/** Changes the URL locale segment (same page) and remembers the choice in a cookie. */
export function useSwitchLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const switchTo = (locale: Locale) => {
    // Read the query at click time (no useSearchParams → no Suspense boundary needed).
    const search = window.location.search;
    startTransition(async () => {
      await rememberLocale(locale);
      router.replace(switchLocalePath(pathname, search, locale), { scroll: false });
    });
  };
  return { switchTo, pending };
}

/** Compact "AZ ▾" menu for the top bar. `tone="dark"` for the sidebar / dark surfaces. */
export function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const locale = useLocale();
  const t = useT("shell");
  const { switchTo, pending } = useSwitchLocale();
  return (
    <Menu
      label={t("language.choose")}
      align="end"
      items={LOCALES.map((l) => ({
        id: l,
        label: LOCALE_NAMES[l],
        icon: l === locale ? <Check aria-hidden="true" size={16} className="text-primary" /> : <span aria-hidden="true" className="inline-block w-4" />,
        onSelect: () => (l !== locale ? switchTo(l) : undefined),
      }))}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`${t("language.label")}: ${LOCALE_NAMES[locale]}`}
          aria-busy={pending || undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-chip px-3 text-body-sm font-semibold transition-colors",
            tone === "dark" ? "text-on-primary hover:bg-primary-dark-raised" : "text-fg hover:bg-surface-muted",
            className,
          )}
        >
          <Languages aria-hidden="true" size={18} />
          <span aria-hidden="true">{LOCALE_SHORT[locale]}</span>
        </button>
      )}
    />
  );
}

/** Three big buttons (login page, "More" sheet). */
export function LanguageButtons({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT("shell");
  const { switchTo } = useSwitchLocale();
  return (
    <div role="group" aria-label={t("language.choose")} className={cn("inline-flex gap-1 rounded-chip bg-segment-track p-1", className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() => l !== locale && switchTo(l)}
          className={cn(
            "inline-flex min-h-10 min-w-12 items-center justify-center rounded-chip px-3 text-body-sm font-semibold transition-colors",
            l === locale ? "bg-surface text-fg shadow-thumb" : "text-fg-secondary hover:text-fg",
          )}
        >
          <span aria-hidden="true">{LOCALE_SHORT[l]}</span>
          <span className="sr-only">{LOCALE_NAMES[l]}</span>
        </button>
      ))}
    </div>
  );
}
