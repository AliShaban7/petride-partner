"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatWeekday, formatWeekdayShort } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * Swipeable strip of the week's days (phones, and the Day view): weekday, date and how many
 * appointments each day has. The selected day scrolls into view.
 */
export function DayChips({
  days,
  selected,
  today,
  counts,
  onSelect,
  onWeek,
}: {
  days: number[];
  selected: number;
  today: number;
  /** Appointments per day (undefined while loading). */
  counts?: Map<number, number>;
  onSelect: (day: number) => void;
  onWeek: (dir: -1 | 1) => void;
}) {
  const t = useT("appointments");
  const locale = useLocale();
  const strip = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>("[aria-pressed=true]");
    const box = strip.current;
    if (!el || !box) return;
    const target = el.offsetLeft - (box.clientWidth - el.clientWidth) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selected]);

  return (
    <div className="flex items-center gap-1">
      <IconButton label={t("nav.prevWeek")} icon={<ChevronLeft size={20} />} onClick={() => onWeek(-1)} className="shrink-0" />
      <ul ref={strip} className="scrollbar-none flex min-w-0 flex-1 snap-x snap-mandatory gap-1.5 overflow-x-auto py-1" aria-label={t("calendar.days")}>
        {days.map((day) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const count = counts?.get(day);
          return (
            <li key={day} className="snap-center">
              <button
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${formatWeekday(day, locale)}, ${formatDayMonth(day, locale)}${count !== undefined ? `, ${t.plural("calendar.count", count)}` : ""}`}
                onClick={() => onSelect(day)}
                className={cn(
                  "flex min-h-16 w-12 flex-col items-center justify-center gap-0.5 rounded-card border text-center transition-colors duration-150",
                  isSelected ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-fg hover:bg-surface-muted",
                )}
              >
                <span className={cn("text-caption font-semibold", !isSelected && (isToday ? "text-primary" : "text-fg-secondary"))}>
                  {formatWeekdayShort(day, locale)}
                </span>
                <span className="font-display text-title font-extrabold leading-5 tabular">{new Date(day).getDate()}</span>
                <span aria-hidden="true" className={cn("h-4 text-caption tabular", !isSelected && "text-fg-secondary")}>
                  {count ? count : isToday && !isSelected ? "•" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <IconButton label={t("nav.nextWeek")} icon={<ChevronRight size={20} />} onClick={() => onWeek(1)} className="shrink-0" />
    </div>
  );
}
