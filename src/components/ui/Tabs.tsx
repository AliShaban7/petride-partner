"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n/client";

import { CountBadge } from "./Badge";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  /** "attention" (default): coral badge, hidden at 0 — work waiting. "neutral": grey count, shown even at 0 — history. */
  countTone?: "attention" | "neutral";
};

export type TabsProps = {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for tab/panel ids — pass the same to <TabPanel>. Generated when omitted (then use getTabIds). */
  idPrefix?: string;
  variant?: "underline" | "pills";
  className?: string;
};

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * WAI-ARIA tabs: roving tabindex, ←/→/Home/End move focus and select (automatic activation).
 * Scrolls horizontally on small screens. Pair with <TabPanel idPrefix value={id}>.
 */
export function Tabs({ tabs, value, onChange, label, idPrefix, variant = "underline", className }: TabsProps) {
  const auto = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const prefix = idPrefix ?? auto;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const locale = useLocale();

  const onKey = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (index === last ? 0 : index + 1) : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "scrollbar-none flex max-w-full gap-1 overflow-x-auto",
        variant === "underline" ? "border-b border-border" : "rounded-chip bg-segment-track p-1",
        className,
      )}
    >
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(prefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(prefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-body-sm font-semibold transition-colors",
              variant === "underline"
                ? cn("-mb-px border-b-2", selected ? "border-primary text-primary" : "border-transparent text-fg-secondary hover:text-fg")
                : cn("rounded-chip", selected ? "bg-surface text-fg shadow-thumb" : "text-fg-secondary hover:text-fg"),
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count === undefined ? null : tab.countTone === "neutral" ? (
              <span
                className={cn(
                  "inline-flex min-w-6 items-center justify-center rounded-chip px-1.5 text-caption font-bold leading-5 tabular",
                  selected ? "bg-primary-tint text-primary" : "bg-neutral-bg text-neutral-text",
                )}
              >
                {formatNumber(tab.count, locale)}
              </span>
            ) : (
              <CountBadge count={tab.count} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The panel for one tab. Render only the active one (or all with `hidden`). */
export function TabPanel({ idPrefix, value, children, className }: { idPrefix: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, value)} aria-labelledby={tabId(idPrefix, value)} tabIndex={0} className={cn("focus-visible:outline-offset-4", className)}>
      {children}
    </div>
  );
}
