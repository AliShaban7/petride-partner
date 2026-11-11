"use client";

import { ResponsiveTable, StatusPill, type Column } from "@/components/ui";
import type { Vaccine, VaccineStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, toDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { DAY_MS, startOfDay } from "../_lib/stores";

const ORDER: Record<VaccineStatus, number> = { overdue: 0, due_soon: 1, scheduled: 2, done: 3 };

export function sortVaccines(list: Vaccine[]): Vaccine[] {
  return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.nextDate ?? a.dueDate).localeCompare(b.nextDate ?? b.dueDate));
}

/** Days from today to the due date (negative = overdue). */
export function daysUntil(isoDay: string, now: number): number {
  return Math.round((toDate(isoDay).getTime() - startOfDay(now)) / DAY_MS);
}

/** Vaccination plan: status, last dose, next due, "in 5 days" / "12 days late". */
export function VaccinesTable({ vaccines, now, caption }: { vaccines: Vaccine[]; now: number; caption: string }) {
  const t = useT("clients");
  const locale = useLocale();
  const today = new Date(now);
  const relative = (v: Vaccine) => {
    if (v.status === "done") return null;
    const days = daysUntil(v.nextDate ?? v.dueDate, now);
    if (days === 0) return t("health.dueToday");
    return days < 0 ? t.plural("health.overdueBy", -days) : t.plural("health.dueIn", days);
  };
  const columns: Column<Vaccine>[] = [
    { id: "name", header: t("health.vaccine"), rowHeader: true, mobile: "title", cell: (v) => v.name },
    { id: "status", header: t("health.status"), mobile: "badge", cell: (v) => <StatusPill kind="vaccine" status={v.status} size="sm" /> },
    {
      id: "last",
      header: t("health.lastDose"),
      cell: (v) => (v.doneDate ? <span className="whitespace-nowrap">{formatDate(v.doneDate, locale, today)}</span> : <span className="text-fg-secondary">{t("health.noRecord")}</span>),
    },
    {
      id: "next",
      header: t("health.nextDue"),
      cell: (v) => {
        const rel = relative(v);
        return (
          <span>
            <span className="whitespace-nowrap">{formatDate(v.nextDate ?? v.dueDate, locale, today)}</span>
            {rel ? (
              <span className={cn("ml-2 inline-block whitespace-nowrap text-meta font-semibold", v.status === "overdue" ? "text-error-text" : v.status === "due_soon" ? "text-warning-text" : "text-fg-secondary")}>
                {rel}
              </span>
            ) : null}
          </span>
        );
      },
    },
  ];
  return <ResponsiveTable caption={caption} columns={columns} rows={sortVaccines(vaccines)} getRowId={(v) => v.id} />;
}
