"use client";

import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, CountBadge, DateInput, IconButton, Popover, SearchField, SegmentedControl, Select, type SelectOption } from "@/components/ui";
import type { Service } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

import { RANGE_PRESETS, parseIsoDay, startOfDay, toIsoDay, type RangePreset } from "../_lib/time";
import { STATUS_CHIPS, type StatusChip, type UrlPatch, type UrlState, type ViewMode } from "../_lib/url-state";

export type ToolbarProps = {
  state: UrlState;
  update: (patch: UrlPatch) => void;
  /** Local midnight of the calendar anchor day. */
  anchor: number;
  /** Local midnight of today (0 before hydration). */
  today: number;
  services: Service[] | undefined;
  /** Upcoming requests waiting for an answer (badge on the chip). */
  requests: number;
  categories: Service["category"][];
  /** The section heading (h2): date range / day, with the number of appointments. */
  heading: ReactNode;
  headingId: string;
};

/** List / Week / Day switch (lives in the page header's actions, on the title row). */
export function ViewSwitch({ value, onChange }: { value: ViewMode; onChange: (view: ViewMode) => void }) {
  const t = useT("appointments");
  // Icons from 640px only: on phones the switch and the "+" button then share one row (in ru the
  // three labels with icons pushed "+" onto a row of its own).
  const options: { value: ViewMode; label: string; icon: ReactNode }[] = [
    { value: "list", label: t("views.list"), icon: <List aria-hidden="true" size={16} className="max-sm:hidden" /> },
    { value: "week", label: t("views.week"), icon: <CalendarRange aria-hidden="true" size={16} className="max-sm:hidden" /> },
    { value: "day", label: t("views.day"), icon: <CalendarDays aria-hidden="true" size={16} className="max-sm:hidden" /> },
  ];
  return <SegmentedControl label={t("views.label")} options={options} value={value} onChange={onChange} />;
}

/**
 * The section's toolbar, as few rows as the width allows:
 *   row 1: calendar navigation + heading, search, period (list, ≥ 640px) and a "Filters" popover
 *          (service, go-to-date, and the period on phones);
 *   row 2: status chips (the "Requests" chip carries the waiting count).
 * Sticky under the top bar in the list view on desktops, so the filters stay at hand while scrolling.
 */
export function Toolbar({ state, update, anchor, today, services, requests, categories, heading, headingId }: ToolbarProps) {
  const t = useT("appointments");
  const tc = useT("common");
  const ts = useT("status");
  const calendar = state.view !== "list";

  const serviceOptions: SelectOption[] = [
    ...categories.map((c) => ({ value: `cat:${c}`, label: t("filters.allInCategory", { category: ts.dynamic(`category.${c}`) }) })),
    ...(services ?? []).map((s) => ({ value: s.id, label: `${ts.dynamic(`category.${s.category}`)} · ${s.name}` })),
  ];
  // A service id from the URL that isn't in the list (archived) still shows something sensible.
  if (state.service && !serviceOptions.some((o) => o.value === state.service)) {
    serviceOptions.push({ value: state.service, label: t("filters.unknownService") });
  }

  const step = (dir: -1 | 1) => update({ date: toIsoDay(startOfDay(anchor, state.view === "week" ? dir * 7 : dir)) });

  const toggleChip = (chip: StatusChip) => {
    const has = state.status.includes(chip);
    update({ status: has ? state.status.filter((c) => c !== chip) : STATUS_CHIPS.filter((c) => c === chip || state.status.includes(c)) });
  };

  const setRange = (range: RangePreset) => {
    if (range === "custom" && today) {
      update({ range, from: state.from ?? toIsoDay(today), to: state.to ?? toIsoDay(startOfDay(today, 6)) });
    } else update({ range });
  };
  const rangeSelect = (className?: string) => (
    <Select
      label={t("range.label")}
      hideLabel={className !== undefined}
      wrapperClassName={className}
      value={state.range}
      onChange={(e) => setRange(e.target.value as RangePreset)}
      options={RANGE_PRESETS.map((p) => ({ value: p, label: t.dynamic(`range.${p}`) }))}
    />
  );

  return (
    <div
      className={cn(
        "space-y-3 rounded-t-panel border-b border-border bg-surface px-3 py-3 sm:px-4 lg:px-5",
        // Sticky only where the page itself scrolls (the list); the calendars scroll inside their own box.
        !calendar && "lg:sticky-toolbar",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 basis-full items-center gap-1.5 sm:flex-1 sm:basis-auto">
          {calendar ? (
            <>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => update({ date: undefined })}>
                {t("nav.today")}
              </Button>
              {/* Phones step through days with the day strip (and a swipe) instead. */}
              <IconButton
                label={state.view === "week" ? t("nav.prevWeek") : t("nav.prevDay")}
                icon={<ChevronLeft size={18} />}
                variant="outline"
                size="sm"
                className="max-sm:hidden"
                onClick={() => step(-1)}
              />
              <IconButton
                label={state.view === "week" ? t("nav.nextWeek") : t("nav.nextDay")}
                icon={<ChevronRight size={18} />}
                variant="outline"
                size="sm"
                className="max-sm:hidden"
                onClick={() => step(1)}
              />
            </>
          ) : null}
          <h2 id={headingId} className={cn("min-w-0 font-display text-title font-extrabold tracking-tight text-fg", calendar && "ml-1.5")}>
            {heading}
          </h2>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-3">
          <DebouncedSearch
            value={state.q}
            onCommit={(q) => update({ q })}
            label={t("filters.searchLabel")}
            placeholder={t("filters.search")}
            className="min-w-0 flex-1 sm:w-56 sm:flex-none xl:w-72"
          />
          {calendar ? null : rangeSelect("hidden w-48 sm:flex xl:w-52")}
          <FiltersPopover label={tc("actions.filter")} count={state.service ? 1 : 0}>
            {calendar ? (
              <DateInput
                kind="date"
                label={t("nav.goTo")}
                value={anchor ? toIsoDay(anchor) : ""}
                onChange={(e) => {
                  if (parseIsoDay(e.target.value) !== null) update({ date: e.target.value });
                }}
              />
            ) : (
              <div className="sm:hidden">{rangeSelect()}</div>
            )}
            <Select
              label={t("filters.service")}
              value={state.service}
              onChange={(e) => update({ service: e.target.value })}
              placeholder={t("filters.allServices")}
              options={serviceOptions}
            />
          </FiltersPopover>
        </div>
      </div>

      {state.view === "list" && state.range === "custom" ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <DateInput kind="date" label={t("range.from")} value={state.from ?? ""} max={state.to} onChange={(e) => update({ range: "custom", from: e.target.value || undefined })} />
          <DateInput kind="date" label={t("range.to")} value={state.to ?? ""} min={state.from} onChange={(e) => update({ range: "custom", to: e.target.value || undefined })} />
        </div>
      ) : null}

      <div role="group" aria-label={t("filters.status")} className="scrollbar-none relative -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        <Chip pressed={state.status.length === 0} onClick={() => update({ status: [] })}>
          {t("filters.all")}
        </Chip>
        {STATUS_CHIPS.map((chip) => (
          <Chip key={chip} pressed={state.status.includes(chip)} onClick={() => toggleChip(chip)}>
            {t.dynamic(`filters.${chip}`)}
            {chip === "requested" && requests > 0 ? (
              <>
                <CountBadge count={requests} />
                <span className="sr-only">{t.plural("filters.waiting", requests)}</span>
              </>
            ) : null}
          </Chip>
        ))}
        {state.status.length || state.service || state.q || state.rangeExplicit ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-primary"
            onClick={() => update({ status: [], service: "", q: "", range: undefined, from: undefined, to: undefined })}
          >
            {tc("actions.reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** "Filters" button with a popover for the less used filters; the badge counts the ones set inside. */
function FiltersPopover({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={label}
      trigger={(p) => (
        <Button {...p} variant="outline" className="shrink-0 max-sm:px-3" leftIcon={<SlidersHorizontal size={18} aria-hidden="true" />}>
          <span className="max-sm:sr-only">{label}</span>
          <CountBadge count={count} />
        </Button>
      )}
    >
      <div className="space-y-3 p-4">{children}</div>
    </Popover>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        // 44px on touch widths, 36px from 1024px (mouse).
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border px-3.5 text-body-sm font-semibold transition-colors duration-150 lg:min-h-9 lg:px-3",
        pressed ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-fg hover:border-control-border/60 hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Search box that writes to the URL 300 ms after the last keystroke. */
function DebouncedSearch({
  value,
  onCommit,
  label,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (q: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [written, setWritten] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  // The URL changed from outside (global search, back/forward, "reset"): show it.
  if (value !== seen) {
    setSeen(value);
    if (value !== written) setDraft(value);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const change = (next: string) => {
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        const q = next.trim();
        setWritten(q);
        onCommit(q);
      },
      next ? 300 : 0,
    );
  };
  return <SearchField label={label} placeholder={placeholder} value={draft} onValueChange={change} wrapperClassName={className} />;
}
