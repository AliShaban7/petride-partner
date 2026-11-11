"use client";

import { Clock, Ellipsis, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, Button, IconButton, Pagination, ResponsiveTable, StatusPill, type Column, type SortState } from "@/components/ui";
import type { Appointment, Paged } from "@/lib/api/types";
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

  const actionsMenu = (a: Appointment) => {
    const acts = availableActions(a, now);
    return (
      <ActionMenu
        label={t("table.rowActions", { pet: a.petName })}
        items={menuItems(acts, (kind) => onAction(kind, a))}
        trigger={(p) => <IconButton {...p} label={t("table.rowActions", { pet: a.petName })} icon={<Ellipsis size={20} />} disabled={isPending(a.id)} />}
      />
    );
  };

  // Widths: the table has to fit next to the full sidebar from 1024px, so secondary columns
  // (owner + phone, ride, price) appear only where there is room; below that the owner sits under
  // the pet name and the ride badge under the status.
  const columns: Column<Appointment>[] = [
    {
      id: "when",
      header: t("table.when"),
      sortable: true,
      className: "px-3",
      cell: (a) => {
        const w = when(a, now);
        return (
          <span className="block tabular">
            <span className="block whitespace-nowrap font-semibold text-fg">{w.primary}</span>
            <span className="block max-w-[7.5rem] text-meta text-fg-secondary">{w.secondary}</span>
          </span>
        );
      },
    },
    {
      id: "pet",
      header: t("table.pet"),
      rowHeader: true,
      className: "px-3",
      cell: (a) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} shape="tile" size="sm" className="hidden xl:inline-flex" />
          <span className="min-w-0">
            <span className="block max-w-[9rem] truncate xl:max-w-[11rem]">{a.petName}</span>
            <span className="block max-w-[9rem] truncate text-meta font-normal text-fg-secondary xl:max-w-[11rem] 2xl:hidden">{a.clientName}</span>
            <span className="hidden max-w-[11rem] truncate text-meta font-normal text-fg-secondary 2xl:block">{a.petBreed}</span>
          </span>
        </span>
      ),
    },
    {
      id: "owner",
      header: t("table.owner"),
      className: "hidden px-3 2xl:table-cell",
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
      className: "px-3",
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
      className: "px-3",
      cell: (a) => (
        <span className="flex flex-col items-start gap-1">
          <StatusPill kind="appointment" status={a.status} size="sm" />
          <span className="xl:hidden">
            <RideBadge appointment={a} showNone={false} />
          </span>
        </span>
      ),
    },
    { id: "ride", header: t("table.ride"), className: "hidden px-3 xl:table-cell", cell: (a) => <RideBadge appointment={a} /> },
    { id: "price", header: t("table.price"), align: "end", className: "hidden whitespace-nowrap px-3 2xl:table-cell", cell: (a) => <PriceText appointment={a} /> },
        // The header text stays for screen readers but takes no width ([th&] = only the header cell).
    { id: "actions", header: t("table.actions"), align: "end", className: "w-12 px-1.5 [th&]:text-[0px]", cell: (a) => actionsMenu(a) },
  ];

  const sortState: SortState = { id: "when", direction: sort === "start_desc" ? "desc" : "asc" };

  return (
    <div className="space-y-4">
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
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-meta font-semibold text-fg tabular">
          <Clock aria-hidden="true" size={14} className="shrink-0 text-fg-secondary" />
          <span className="truncate">{w.compact}</span>
        </span>
        <span className="-my-1.5 -mr-2 shrink-0">{menu}</span>
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-3">
        <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} shape="tile" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={() => onOpen(a.id)} className="text-left text-body font-semibold text-fg underline-offset-4 hover:underline">
              {a.petName}
            </button>
            <StatusPill kind="appointment" status={a.status} size="sm" />
          </div>
          <p className="break-words text-meta text-fg-secondary">{a.serviceName}</p>
          <p className="break-words text-meta text-fg-secondary">{a.clientName}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta">
        <RideBadge appointment={a} showNone={false} />
        {a.clientNote ? (
          <span className="inline-flex items-center gap-1 text-fg-secondary">
            <MessageSquareText aria-hidden="true" size={14} />
            {t("table.hasNote")}
          </span>
        ) : null}
        <PriceText appointment={a} className="ml-auto font-semibold" />
      </div>
      {quick.length ? (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          {quick.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={kind === "decline" ? "outline" : "primary"}
              className="min-h-11 flex-1"
              disabled={pending}
              onClick={() => onAction(kind, a)}
            >
              {t.dynamic(`actions.${kind}`)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
