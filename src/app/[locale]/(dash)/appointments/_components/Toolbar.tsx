"use client";

import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button, CountBadge, DateInput, IconButton, SearchField, SegmentedControl, Select, type SelectOption } from "@/components/ui";
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
};

/** Filters: view switch, date range / calendar navigation, search, service, status chips. */
export function Toolbar({ state, update, anchor, today, services, requests, categories }: ToolbarProps) {
  const t = useT("appointments");
  const tc = useT("common");
  const ts = useT("status");

  const viewOptions: { value: ViewMode; label: string; icon: ReactNode }[] = [
    { value: "list", label: t("views.list"), icon: <List aria-hidden="true" size={16} /> },
    { value: "week", label: t("views.week"), icon: <CalendarRange aria-hidden="true" size={16} /> },
    { value: "day", label: t("views.day"), icon: <CalendarDays aria-hidden="true" size={16} /> },
  ];

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

  return (
    <div className="space-y-4 rounded-panel bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label={t("views.label")} options={viewOptions} value={state.view} onChange={(view) => update({ view })} />

        {state.view === "list" ? null : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => update({ date: undefined })}
            >
              {t("nav.today")}
            </Button>
            <IconButton label={state.view === "week" ? t("nav.prevWeek") : t("nav.prevDay")} icon={<ChevronLeft size={20} />} variant="outline" onClick={() => step(-1)} />
            <IconButton label={state.view === "week" ? t("nav.nextWeek") : t("nav.nextDay")} icon={<ChevronRight size={20} />} variant="outline" onClick={() => step(1)} />
            <DateInput
              kind="date"
              label={t("nav.goTo")}
              hideLabel
              wrapperClassName="hidden w-[10.5rem] sm:flex"
              value={anchor ? toIsoDay(anchor) : ""}
              onChange={(e) => {
                if (parseIsoDay(e.target.value) !== null) update({ date: e.target.value });
              }}
            />
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid grid-cols-2 gap-2 sm:gap-3",
          state.view === "list" ? "lg:grid-cols-[minmax(0,1fr)_13rem_16rem]" : "lg:grid-cols-[minmax(0,1fr)_18rem]",
        )}
      >
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <DebouncedSearch value={state.q} onCommit={(q) => update({ q })} label={t("filters.searchLabel")} placeholder={t("filters.search")} />
        </div>
        {state.view === "list" ? (
          <Select
            label={t("range.label")}
            hideLabel
            value={state.range}
            onChange={(e) => {
              const range = e.target.value as RangePreset;
              if (range === "custom" && today) {
                update({ range, from: state.from ?? toIsoDay(today), to: state.to ?? toIsoDay(startOfDay(today, 6)) });
              } else update({ range });
            }}
            options={RANGE_PRESETS.map((p) => ({ value: p, label: t.dynamic(`range.${p}`) }))}
          />
        ) : null}
        <Select
          label={t("filters.service")}
          hideLabel
          wrapperClassName={state.view === "list" ? undefined : "col-span-2 lg:col-span-1"}
          value={state.service}
          onChange={(e) => update({ service: e.target.value })}
          placeholder={t("filters.allServices")}
          options={serviceOptions}
        />
      </div>

      {state.view === "list" && state.range === "custom" ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <DateInput kind="date" label={t("range.from")} value={state.from ?? ""} max={state.to} onChange={(e) => update({ range: "custom", from: e.target.value || undefined })} />
          <DateInput kind="date" label={t("range.to")} value={state.to ?? ""} min={state.from} onChange={(e) => update({ range: "custom", to: e.target.value || undefined })} />
        </div>
      ) : null}

      <div role="group" aria-label={t("filters.status")} className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
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
            className="min-h-10 shrink-0 text-primary"
            onClick={() => update({ status: [], service: "", q: "", range: undefined, from: undefined, to: undefined })}
          >
            {tc("actions.reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border px-3.5 text-body-sm font-semibold transition-colors duration-150",
        pressed ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-fg hover:border-control-border/60 hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Search box that writes to the URL 300 ms after the last keystroke. */
function DebouncedSearch({ value, onCommit, label, placeholder }: { value: string; onCommit: (q: string) => void; label: string; placeholder: string }) {
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
  return <SearchField label={label} placeholder={placeholder} value={draft} onValueChange={change} />;
}
