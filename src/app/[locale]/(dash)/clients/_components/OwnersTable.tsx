"use client";

import { Car, History, Wallet } from "lucide-react";
import Link from "next/link";

import { Avatar, ResponsiveTable, StatusPill, Tag, isPlainClick, isRepeatClick, type Column, type SortState } from "@/components/ui";
import type { Client } from "@/lib/api/types";
import { formatDate, formatMoney, formatNumber, formatPhone } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { DirectoryMode } from "../_lib/directory";

/**
 * Owners directory. From 640px a table with one line per owner (phone in its own column; pets and
 * the visit count once the results area is 1024px wide); on phones a compact card: name + vaccine
 * status, phone · pets, then visits / spend / last visit on one line.
 *
 * A click on an owner calls `onOpen` (the profile modal); the name stays a link to `rowHref` (the
 * profile page) for Ctrl/⌘-click, a new tab or copying the link.
 */
export function OwnersTable({
  rows,
  mode,
  sort,
  onSortChange,
  rowHref,
  onOpen,
  selectedId,
  rideClientIds,
  now,
  loading,
  skeletonRows = 8,
}: {
  rows: Client[];
  mode: DirectoryMode;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  rowHref: (client: Client) => string;
  onOpen?: (client: Client) => void;
  /** The owner whose profile is open (row highlight). */
  selectedId?: string | null;
  rideClientIds: Set<string>;
  now: number;
  loading?: boolean;
  skeletonRows?: number;
}) {
  const t = useT("clients");
  const locale = useLocale();
  const today = new Date(now);
  const rideLabel = (c: Client) =>
    mode === "visits" && c.rideVisits > 0 ? t.plural("owners.rideVisits", c.rideVisits) : mode === "visits" ? t("pet.rideTag") : t("pet.courierTag");
  // Phone cards: "N rides" for clinics; shops show the short "Courier" (full label for screen
  // readers) so the tag stays on the card's last line.
  const rideTag = (c: Client) =>
    rideClientIds.has(c.id) ? (
      <Tag icon={<Car aria-hidden="true" size={12} />} className="py-0.5">
        {mode === "visits" ? (
          rideLabel(c)
        ) : (
          <>
            <span aria-hidden="true">{t("owners.courierShort")}</span>
            <span className="sr-only">{rideLabel(c)}</span>
          </>
        )}
      </Tag>
    ) : null;
  // Table: the car icon plus the number of rides (the full label for screen readers and on hover).
  const rideBadge = (c: Client) =>
    rideClientIds.has(c.id) ? (
      <span title={rideLabel(c)} className="inline-flex items-center gap-1 rounded-chip bg-surface-muted px-2 py-0.5 text-caption font-medium text-fg-tertiary">
        <Car aria-hidden="true" size={12} />
        {mode === "visits" && c.rideVisits > 0 ? <span aria-hidden="true" className="tabular">{formatNumber(c.rideVisits, locale)}</span> : null}
        <span className="sr-only">{rideLabel(c)}</span>
      </span>
    ) : null;
  const lastText = (c: Client) => (c.lastVisitAt ? formatDate(c.lastVisitAt, locale, today) : mode === "visits" ? t("pet.noVisits") : t("owner.noOrders"));

  const columns: Column<Client>[] = [
    {
      id: "name",
      header: t("owners.name"),
      sortable: true,
      rowHeader: true,
      className: "min-w-48",
      cell: (c) => (
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <Avatar name={c.fullName} size="xs" />
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words">{c.fullName}</span>
            <span className="font-normal">{rideBadge(c)}</span>
          </span>
        </span>
      ),
    },
    {
      id: "phone",
      header: t("owners.phone"),
      cell: (c) => <span className="whitespace-nowrap tabular text-fg-secondary">{formatPhone(c.phone)}</span>,
    },
    {
      id: "pets",
      header: t("owners.pets"),
      sortable: true,
      // Pets and the visit count show once the results area is ≥ 1024px wide (1440 screens, or a
      // collapsed sidebar): at 1280 they'd squeeze the names onto two lines. Phone cards, the
      // profile and Filters → sort have them otherwise.
      className: "hidden @5xl:table-cell",
      cell: (c) => (
        <span className="block max-w-40 truncate" title={c.petNames.join(", ")}>
          {c.petNames.length ? c.petNames.join(", ") : "—"}
        </span>
      ),
    },
    {
      id: "visits",
      header: mode === "visits" ? t("owners.visits") : t("owners.orders"),
      sortable: true,
      align: "end",
      className: "hidden @5xl:table-cell",
      cell: (c) => <span className="tabular">{formatNumber(mode === "visits" ? c.visitsCount : c.ordersCount, locale)}</span>,
    },
    {
      id: "spent",
      header: t("owners.spent"),
      sortable: true,
      align: "end",
      cell: (c) => <span className="whitespace-nowrap font-semibold tabular">{formatMoney(c.totalSpentAZN, locale, { decimals: "auto" })}</span>,
    },
    {
      id: "last",
      header: mode === "visits" ? t("owners.lastVisit") : t("owners.lastOrder"),
      sortable: true,
      cell: (c) => <span className="whitespace-nowrap">{lastText(c)}</span>,
    },
    {
      id: "health",
      header: t("owners.health"),
      // Short label under the "Vaccines" column header.
      cell: (c) => <StatusPill kind="health" status={c.vaccineAlert} size="sm" label={t.dynamic(`healthShort.${c.vaccineAlert}`)} />,
    },
  ];

  const mobileCard = (c: Client) => (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={rowHref(c)}
          onClick={
            onOpen
              ? (e) => {
                  if (!isPlainClick(e)) return;
                  e.preventDefault();
                  if (!isRepeatClick(e)) onOpen(c);
                }
              : undefined
          }
          className="min-w-0 break-words text-body font-semibold text-fg underline-offset-4 hover:underline"
        >
          {c.fullName}
        </Link>
        <StatusPill kind="health" status={c.vaccineAlert} size="sm" className="shrink-0" />
      </div>
      <p className="mt-0.5 truncate text-meta text-fg-secondary">
        <span className="tabular">{formatPhone(c.phone)}</span>
        {c.petNames.length ? ` · ${c.petNames.join(", ")}` : null}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-meta text-fg">
        <dl className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <div>
            <dt className="sr-only">{mode === "visits" ? t("owners.visits") : t("owners.orders")}</dt>
            <dd className="tabular">{t.plural(mode === "visits" ? "owners.visitsCount" : "owners.ordersCount", mode === "visits" ? c.visitsCount : c.ordersCount)}</dd>
          </div>
          <div className="flex items-center gap-1">
            <Wallet aria-hidden="true" size={13} className="text-fg-secondary" />
            <dt className="sr-only">{t("owners.spent")}</dt>
            <dd className="font-semibold tabular">{formatMoney(c.totalSpentAZN, locale, { decimals: "auto" })}</dd>
          </div>
          <div className="flex items-center gap-1">
            <History aria-hidden="true" size={13} className="text-fg-secondary" />
            <dt className="sr-only">{mode === "visits" ? t("owners.lastVisit") : t("owners.lastOrder")}</dt>
            <dd>{lastText(c)}</dd>
          </div>
        </dl>
        {rideTag(c)}
      </div>
    </div>
  );

  return (
    <ResponsiveTable
      caption={t("owners.caption")}
      columns={columns}
      rows={rows}
      getRowId={(c) => c.id}
      sort={sort}
      onSortChange={onSortChange}
      rowHref={rowHref}
      onRowClick={onOpen}
      selectedId={selectedId}
      loading={loading}
      skeletonRows={skeletonRows}
      mobileCard={mobileCard}
    />
  );
}
