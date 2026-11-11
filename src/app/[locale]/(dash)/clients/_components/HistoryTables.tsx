"use client";

import { Car } from "lucide-react";
import { useState } from "react";

import { Pagination, ResponsiveTable, StatusPill, Tag, type Column } from "@/components/ui";
import type { Appointment, Order } from "@/lib/api/types";
import { formatDate, formatMoney, formatNumber, formatTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { paginate } from "../_lib/directory";
import { useMockParam } from "../_lib/url";

/** Visit history (appointments), newest first. Rows open the appointment on the Appointments page. */
export function VisitsTable({ rows, caption, showPet, now, pageSize = 8 }: { rows: Appointment[]; caption: string; showPet?: boolean; now: number; pageSize?: number }) {
  const t = useT("clients");
  const tc = useT("common");
  const ts = useT("status");
  const locale = useLocale();
  const linkQuery = useMockParam();
  const [page, setPage] = useState(1);
  const today = new Date(now);
  const paged = paginate(rows, page, pageSize);
  const amount = (a: Appointment) => {
    if (a.status === "completed" && a.amountAZN !== undefined) return formatMoney(a.amountAZN, locale, { decimals: "auto" });
    if (a.status === "cancelled" || a.status === "declined" || a.status === "no_show") return "—";
    return a.priceAZN === null ? tc("money.pricedOnSite") : formatMoney(a.priceAZN, locale, { decimals: "auto" });
  };
  const columns: Column<Appointment>[] = [
    {
      id: "when",
      header: t("visits.when"),
      rowHeader: true,
      mobile: "title",
      cell: (a) => (
        <span className="whitespace-nowrap">
          {formatDate(a.start, locale, today)}
          <span className="sm:hidden">, </span>
          <span className="tabular sm:block sm:text-meta sm:font-normal sm:text-fg-secondary">{formatTime(a.start)}</span>
        </span>
      ),
    },
    {
      id: "service",
      header: t("visits.service"),
      mobile: "subtitle",
      cell: (a) => (
        <span className="block min-w-36">
          {showPet ? <span className="font-semibold">{a.petName} · </span> : null}
          {a.serviceName}
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-meta text-fg-secondary">
            {a.withRide ? <Tag icon={<Car aria-hidden="true" size={12} />}>{t("pet.rideTag")}</Tag> : <span>{ts.dynamic(`source.${a.source}`)}</span>}
            <span className="tabular">{a.code}</span>
          </span>
        </span>
      ),
    },
    { id: "status", header: t("visits.status"), mobile: "badge", cell: (a) => <StatusPill kind="appointment" status={a.status} size="sm" /> },
    { id: "amount", header: t("visits.amount"), align: "end", cell: (a) => <span className="whitespace-nowrap tabular">{amount(a)}</span> },
  ];
  return (
    <div className="space-y-3">
      <ResponsiveTable
        caption={caption}
        columns={columns}
        rows={paged.items}
        getRowId={(a) => a.id}
        rowHref={(a) => localizedHref(locale, ROUTES.appointments, { id: a.id, ...linkQuery })}
      />
      {paged.pageCount > 1 ? <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={pageSize} onPageChange={setPage} /> : null}
    </div>
  );
}

/** Shop orders of a client, newest first. Rows open the order on the Orders page. */
export function OrdersTable({ rows, caption, now, pageSize = 8 }: { rows: Order[]; caption: string; now: number; pageSize?: number }) {
  const t = useT("clients");
  const ts = useT("status");
  const locale = useLocale();
  const linkQuery = useMockParam();
  const [page, setPage] = useState(1);
  const today = new Date(now);
  const paged = paginate(rows, page, pageSize);
  const columns: Column<Order>[] = [
    { id: "code", header: t("orders.code"), rowHeader: true, mobile: "title", cell: (o) => <span className="whitespace-nowrap tabular">{o.code}</span> },
    { id: "date", header: t("orders.date"), mobile: "subtitle", cell: (o) => <span className="whitespace-nowrap">{formatDate(o.createdAt, locale, today)}, {formatTime(o.createdAt)}</span> },
    { id: "items", header: t("orders.items"), align: "end", className: "hidden 2xl:table-cell", cell: (o) => <span className="tabular">{formatNumber(o.itemsCount, locale)}</span> },
    { id: "fulfilment", header: t("orders.fulfilment"), className: "hidden 2xl:table-cell", cell: (o) => ts.dynamic(`fulfilment.${o.fulfilment}`) },
    { id: "status", header: t("orders.status"), mobile: "badge", cell: (o) => <StatusPill kind="order" status={o.status} size="sm" /> },
    { id: "total", header: t("orders.total"), align: "end", cell: (o) => <span className="whitespace-nowrap font-semibold tabular">{formatMoney(o.totalAZN, locale)}</span> },
  ];
  return (
    <div className="space-y-3">
      <ResponsiveTable
        caption={caption}
        columns={columns}
        rows={paged.items}
        getRowId={(o) => o.id}
        rowHref={(o) => localizedHref(locale, ROUTES.orders, { id: o.id, ...linkQuery })}
      />
      {paged.pageCount > 1 ? <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={pageSize} onPageChange={setPage} /> : null}
    </div>
  );
}
