"use client";

import { Car } from "lucide-react";

import { Avatar, ResponsiveTable, StatusPill, Tag, type Column, type SortState } from "@/components/ui";
import type { Client } from "@/lib/api/types";
import { formatDate, formatMoney, formatNumber, formatPhone } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { DirectoryMode } from "../_lib/directory";

export function OwnersTable({
  rows,
  mode,
  sort,
  onSortChange,
  rowHref,
  rideClientIds,
  now,
  loading,
}: {
  rows: Client[];
  mode: DirectoryMode;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  rowHref: (client: Client) => string;
  rideClientIds: Set<string>;
  now: number;
  loading?: boolean;
}) {
  const t = useT("clients");
  const locale = useLocale();
  const today = new Date(now);
  const rideLabel = (c: Client) =>
    mode === "visits" && c.rideVisits > 0 ? t.plural("owners.rideVisits", c.rideVisits) : mode === "visits" ? t("pet.rideTag") : t("pet.courierTag");
  const columns: Column<Client>[] = [
    {
      id: "name",
      header: t("owners.name"),
      sortable: true,
      rowHeader: true,
      mobile: "title",
      className: "min-w-52",
      cell: (c) => (
        <span className="inline-flex min-w-0 items-center gap-3">
          <Avatar name={c.fullName} size="sm" className="hidden sm:inline-flex" />
          <span className="min-w-0">
            <span className="block break-words">{c.fullName}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta font-normal text-fg-secondary">
              <span className="whitespace-nowrap tabular">{formatPhone(c.phone)}</span>
              {rideClientIds.has(c.id) ? (
                <Tag icon={<Car aria-hidden="true" size={12} />} className="py-0.5">
                  {rideLabel(c)}
                </Tag>
              ) : null}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "pets",
      header: t("owners.pets"),
      sortable: true,
      mobile: "subtitle",
      className: "hidden lg:table-cell",
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
      className: "hidden lg:table-cell",
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
      cell: (c) => <span className="whitespace-nowrap">{c.lastVisitAt ? formatDate(c.lastVisitAt, locale, today) : mode === "visits" ? t("pet.noVisits") : t("owner.noOrders")}</span>,
    },
    {
      id: "health",
      header: t("owners.health"),
      mobile: "badge",
      cell: (c) => (
        <>
          {/* Short label under the "Vaccines" column header; the full one in phone cards (no header there). */}
          <StatusPill kind="health" status={c.vaccineAlert} size="sm" label={t.dynamic(`healthShort.${c.vaccineAlert}`)} className="hidden sm:inline-flex" />
          <StatusPill kind="health" status={c.vaccineAlert} size="sm" className="sm:hidden" />
        </>
      ),
    },
  ];
  return (
    <ResponsiveTable
      caption={t("owners.caption")}
      columns={columns}
      rows={rows}
      getRowId={(c) => c.id}
      sort={sort}
      onSortChange={onSortChange}
      rowHref={rowHref}
      loading={loading}
      skeletonRows={8}
    />
  );
}
