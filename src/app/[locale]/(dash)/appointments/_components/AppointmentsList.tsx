"use client";

import { Clock, Ellipsis, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, Button, IconButton, Pagination, ResponsiveTable, StatusPill, type Column, type SortState } from "@/components/ui";
import type { Appointment, Paged } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayLabel, formatDayMonth, formatDuration, formatPhone, formatTimeRange } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { isStay } from "../_lib/time";
import { availableActions, quickActions, type ActionKind } from "../_lib/useAppointmentActions";
import { ActionMenu } from "./ActionMenu";
import { CategoryDot, PriceText, RideBadge, useActionItems } from "./bits";

export type AppointmentsListProps = {
  data: Paged<Appointment>;
  merge: (a: Appointment) => Appointment;
  isPending: (id: string) => boolean;
  now: number;
  selectedId?: string;
  sort: "start_asc" | "start_desc";
  onSortChange: (sort: "start_asc" | "start_desc") => void;
  onPageChange: (page: number) => void;
  onOpen: (id: string) => void;
  onAction: (kind: ActionKind, a: Appointment) => void;
};

/** Body cells (td and the row-header th) from 1024px: 6px instead of 8px top and bottom. Header cells keep theirs. */
const DENSE = "lg:[tbody_&]:py-1.5";

/** "Bu gün · 09:30–10:00", or "14 noy – 17 noy" for hotel stays. */
export function useWhen() {
  const locale = useLocale();
  return (a: Appointment, now: number) => {
    const today = now ? new Date(now) : undefined;
    if (isStay(a) && a.durationMin >= 1440) {
      return {
        primary: formatDayMonth(a.start, locale),
        secondary: `→ ${formatDayMonth(a.end, locale)} · ${formatDuration(a.durationMin, locale)}`,
        compact: `${formatDayMonth(a.start, locale)} → ${formatDayMonth(a.end, locale)}`,
      };
    }
    const day = today ? formatDayLabel(a.start, locale, today) : formatDayMonth(a.start, locale);
    return { primary: formatTimeRange(a.start, a.end), secondary: day, compact: `${day} · ${formatTimeRange(a.start, a.end)}` };
  };
}

/** List view: sortable table on ≥ 640px, cards with quick actions on phones, pagination. */
export function AppointmentsList({ data, merge, isPending, now, selectedId, sort, onSortChange, onPageChange, onOpen, onAction }: AppointmentsListProps) {
  const t = useT("appointments");
  const locale = useLocale();
  const when = useWhen();
  const menuItems = useActionItems();
  const rows = data.items.map(merge);

  // In the table the "…" button is 36px from 1024px (dense desktop rows); phone cards keep 44px.
  const actionsMenu = (a: Appointment, dense = false) => {
    const acts = availableActions(a, now);
    return (
      <ActionMenu
        label={t("table.rowActions", { pet: a.petName })}
        items={menuItems(acts, (kind) => onAction(kind, a))}
        trigger={(p) => (
          <IconButton {...p} label={t("table.rowActions", { pet: a.petName })} icon={<Ellipsis size={20} />} disabled={isPending(a.id)} className={dense ? "lg:size-9" : undefined} />
        )}
      />
    );
  };

  // Widths: the table has to fit next to the full sidebar, or the row menu ends up behind a sideways
  // scroll. Measured (az / ru, the widest rows of the demo data): the ride gets its own column from
  // 1440px (at 1280px it made the table 33 / 73px wider than the card), the price from 1536px, owner +
  // phone from 1728px. Below that the owner sits under the pet name and the ride badge under the
  // status. Body cells are denser from 1024px (DENSE).
  const columns: Column<Appointment>[] = [
    {
      id: "when",
      header: t("table.when"),
      sortable: true,
      className: cn("px-3", DENSE),
      cell: (a) => {
        const w = when(a, now);
        return (
          <span className="block tabular">
            <span className="block whitespace-nowrap font-semibold text-fg">{w.primary}</span>
            <span className="block whitespace-nowrap text-meta text-fg-secondary">{w.secondary}</span>
          </span>
        );
      },
    },
    {
      id: "pet",
      header: t("table.pet"),
      rowHeader: true,
      className: cn("px-3", DENSE),
      cell: (a) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} shape="tile" size="sm" className="hidden xl:inline-flex" />
          <span className="min-w-0">
            <span className="block max-w-[9rem] truncate xl:max-w-[11rem]">{a.petName}</span>
            <span className="block max-w-[9rem] truncate text-meta font-normal text-fg-secondary xl:max-w-[11rem] min-[108rem]:hidden">{a.clientName}</span>
            <span className="hidden max-w-[11rem] truncate text-meta font-normal text-fg-secondary min-[108rem]:block">{a.petBreed}</span>
          </span>
        </span>
      ),
    },
    {
      id: "owner",
      header: t("table.owner"),
      className: cn("hidden px-3 min-[108rem]:table-cell", DENSE),
      cell: (a) => (
        <span className="block min-w-0">
          <span className="block max-w-[12rem] truncate font-medium">{a.clientName}</span>
          <span className="block whitespace-nowrap text-meta text-fg-secondary tabular">{formatPhone(a.clientPhone)}</span>
        </span>
      ),
    },
    {
      id: "service",
      header: t("table.service"),
      className: cn("px-3", DENSE),
      cell: (a) => (
        <span className="block min-w-0">
          <span className="flex items-center gap-2 font-medium">
            <CategoryDot category={a.category} />
            <span className="max-w-[7.5rem] truncate xl:max-w-[10rem]">{a.serviceName}</span>
          </span>
          <span className="block text-meta text-fg-secondary">{formatDuration(a.durationMin, locale)}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: t("table.status"),
      className: cn("px-3", DENSE),
      cell: (a) => (
        <span className="flex flex-col items-start gap-1">
          <StatusPill kind="appointment" status={a.status} size="sm" />
          <span className="min-[90rem]:hidden">
            <RideBadge appointment={a} showNone={false} />
          </span>
        </span>
      ),
    },
    { id: "ride", header: t("table.ride"), className: cn("hidden px-3 min-[90rem]:table-cell", DENSE), cell: (a) => <RideBadge appointment={a} /> },
    { id: "price", header: t("table.price"), align: "end", className: cn("hidden whitespace-nowrap px-3 2xl:table-cell", DENSE), cell: (a) => <PriceText appointment={a} /> },
    // The header text stays for screen readers but takes no width ([th&] = only the header cell).
    { id: "actions", header: t("table.actions"), align: "end", className: cn("w-12 px-1.5 [th&]:text-[0px]", DENSE), cell: (a) => actionsMenu(a, true) },
  ];

  const sortState: SortState = { id: "when", direction: sort === "start_desc" ? "desc" : "asc" };

  return (
    <div className="space-y-3">
      <ResponsiveTable
        caption={t("table.caption")}
        columns={columns}
        rows={rows}
        getRowId={(a) => a.id}
        onRowClick={(a) => onOpen(a.id)}
        selectedId={selectedId ?? null}
        sort={sortState}
        onSortChange={(s) => onSortChange(s?.direction === "desc" ? "start_desc" : "start_asc")}
        mobileCard={(a) => <MobileCard a={a} now={now} pending={isPending(a.id)} onOpen={onOpen} onAction={onAction} menu={actionsMenu(a)} />}
      />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPageChange={onPageChange} />
    </div>
  );
}

/** Phone card: who, when, what, status, ride, and the one-tap actions for requests / arrivals. */
function MobileCard({
  a,
  now,
  pending,
  onOpen,
  onAction,
  menu,
}: {
  a: Appointment;
  now: number;
  pending: boolean;
  onOpen: (id: string) => void;
  onAction: (kind: ActionKind, a: Appointment) => void;
  menu: ReactNode;
}) {
  const t = useT("appointments");
  const when = useWhen();
  const w = when(a, now);
  const acts = availableActions(a, now);
  const quick = quickActions(acts, a);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} shape="tile" size="sm" />
        <div className="min-w-0 flex-1">
          {/*
            The "…" menu sits in the name's row (its 44px hit area reaches a little above and below), so
            the time and the price below get the card's full width: next to the price in a narrower
            column, ru "Сегодня · 09:20–11:20" and "7 ноября → 12 ноября" were cut off at 390px.
          */}
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <button type="button" onClick={() => onOpen(a.id)} className="text-left text-body font-semibold text-fg underline-offset-4 hover:underline">
                {a.petName}
              </button>
              <StatusPill kind="appointment" status={a.status} size="sm" />
            </div>
            <span className="-my-2.5 -mr-2 shrink-0">{menu}</span>
          </div>
          {/* Time and price; wraps (never truncates) when both don't fit. */}
          <p className="mt-0.5 flex min-w-0 flex-wrap items-start justify-between gap-x-2 text-meta font-semibold text-fg tabular">
            <span className="inline-flex min-w-0 items-start gap-1">
              <Clock aria-hidden="true" size={13} className="mt-0.5 shrink-0 text-fg-secondary" />
              <span className="min-w-0">{w.compact}</span>
            </span>
            <PriceText appointment={a} className="ml-auto font-semibold" />
          </p>
          <p className="break-words text-meta text-fg-secondary">
            {a.serviceName} · {a.clientName}
          </p>
        </div>
      </div>
      {/* Ride, note and the one-tap actions share one row (the buttons wrap under when there's no room). */}
      {a.withRide || a.clientNote || quick.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-meta">
          <RideBadge appointment={a} showNone={false} />
          {a.clientNote ? (
            <span className="inline-flex items-center gap-1 text-fg-secondary">
              <MessageSquareText aria-hidden="true" size={14} />
              {t("table.hasNote")}
            </span>
          ) : null}
          {quick.length ? (
            <span className="ml-auto flex gap-2">
              {quick.map((kind) => (
                <Button key={kind} size="sm" variant={kind === "decline" ? "outline" : "primary"} className="min-h-11" disabled={pending} onClick={() => onAction(kind, a)}>
                  {t.dynamic(`actions.${kind}`)}
                </Button>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
