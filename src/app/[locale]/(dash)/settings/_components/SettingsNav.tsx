"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

import { SECTION_ICONS, SECTION_IDS, type SectionId } from "./sections";

/**
 * Settings sub-navigation: a vertical list from 1280px (sticky beside the content), a horizontal
 * scroller above it on smaller screens. Plain links (`?tab=`), so back/forward and sharing work;
 * a dot (plus hidden text) marks sections with unsaved edits.
 */
export function SettingsNav({ active, dirty }: { active: SectionId; dirty: Partial<Record<SectionId, boolean>> }) {
  const t = useT("settings");
  const locale = useLocale();
  const listRef = useRef<HTMLUListElement>(null);

  // Phones / tablets: the pills scroll sideways, so bring the active one into view (e.g. when the
  // page opens on ?tab=security). Only the list scrolls; the page itself never moves.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const left = itemRect.left - listRect.left + list.scrollLeft;
    const right = left + itemRect.width;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.scrollTo({ left: Math.max(0, left - 16), behavior: reduce ? "auto" : "smooth" });
    }
  }, [active]);

  return (
    <nav aria-label={t("nav.label")} className="min-w-0 xl:sticky xl:top-[calc(var(--topbar-h)+1.5rem)]">
      <ul ref={listRef} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 xl:flex-col xl:gap-0.5 xl:overflow-visible xl:rounded-panel xl:bg-surface xl:p-2 xl:shadow-card">
        {SECTION_IDS.map((id) => {
          const Icon = SECTION_ICONS[id];
          const current = id === active;
          return (
            <li key={id} className="shrink-0">
              <Link
                href={localizedHref(locale, ROUTES.settings, { tab: id })}
                replace
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-chip px-4 text-body-sm font-semibold transition-colors xl:min-h-10 xl:whitespace-normal xl:rounded-button xl:px-3 xl:py-1.5",
                  current
                    ? "bg-primary-dark text-on-primary shadow-thumb"
                    : "border border-border bg-surface text-fg hover:bg-surface-muted xl:border-transparent xl:bg-transparent",
                )}
              >
                <Icon aria-hidden="true" size={18} className={current ? "text-live-accent" : "text-fg-secondary"} />
                <span className="xl:flex-1">{t(`nav.${id}`)}</span>
                {dirty[id] ? (
                  <>
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
                    <span className="sr-only">{t("nav.unsaved")}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
