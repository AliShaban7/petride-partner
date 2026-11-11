"use client";

import { Printer } from "lucide-react";

import { PawMark } from "@/components/illustrations";
import { Button, Dialog, Portal } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Order, PartnerProfile } from "@/lib/api/types";
import { formatDateLong, formatMoney, formatNumber, formatPhone, formatTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * Print-friendly receipt. The dialog shows a preview; "Print" prints only the receipt: while the
 * dialog is open a copy sits in a body-level node that is hidden on screen and becomes the only
 * visible thing in print (so the shell, the drawer and the dialog chrome don't print).
 */
export function OrderReceiptDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const t = useT("orders");
  const tc = useT("common");
  const partner = useApiQuery(["partner"], (api) => api.getPartner(), { enabled: open });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={t("receipt.title", { code: order.code })}
      description={t("receipt.description")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("actions.close")}
          </Button>
          <Button leftIcon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
            {t("actions.print")}
          </Button>
        </>
      }
    >
      <div className="rounded-card border border-dashed border-control-border/60 bg-surface p-5">
        <Receipt order={order} partner={partner.data} />
      </div>
      {open ? (
        <Portal>
          <div className="pr-print-root hidden print:block">
            <style>{"@media print { body > :not(.pr-print-root) { display: none !important; } .pr-print-root { padding: 12mm; } }"}</style>
            <Receipt order={order} partner={partner.data} />
          </div>
        </Portal>
      ) : null}
    </Dialog>
  );
}

function Receipt({ order, partner }: { order: Order; partner?: PartnerProfile }) {
  const t = useT("orders");
  const ts = useT("status");
  const locale = useLocale();
  const money = (n: number) => formatMoney(n, locale);
  const courier = order.fulfilment === "petride_courier";
  return (
    <article className="mx-auto max-w-sm text-body-sm text-fg">
      <header className="flex items-start justify-between gap-3 border-b border-dashed border-control-border/60 pb-3">
        <div className="min-w-0">
          <p className="font-display text-title font-extrabold">{partner?.name ?? "PetRide"}</p>
          {partner ? (
            <>
              <p className="text-meta text-fg-secondary">{partner.address}</p>
              <p className="text-meta text-fg-secondary tabular">{formatPhone(partner.phone)}</p>
            </>
          ) : null}
        </div>
        <PawMark size={28} className="shrink-0 text-primary" />
      </header>

      <p className="mt-3 font-display text-h2 font-extrabold">{t("receipt.heading")}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-meta">
        <dt className="text-fg-secondary">{t("receipt.order")}</dt>
        <dd className="text-right font-semibold">{order.code}</dd>
        <dt className="text-fg-secondary">{t("receipt.date")}</dt>
        <dd className="text-right tabular">
          {formatDateLong(order.createdAt, locale)}, {formatTime(order.createdAt)}
        </dd>
        <dt className="text-fg-secondary">{t("receipt.customer")}</dt>
        <dd className="text-right">{order.clientName}</dd>
        <dt className="text-fg-secondary">{t("receipt.delivery")}</dt>
        <dd className="text-right">{ts.dynamic(`fulfilment.${order.fulfilment}`)}</dd>
        <dt className="text-fg-secondary">{t("receipt.payment")}</dt>
        <dd className="text-right">{t(order.paymentMethod === "card" ? "drawer.card" : "drawer.cash")}</dd>
      </dl>

      <table className="mt-4 w-full border-collapse text-meta">
        <caption className="sr-only">{t("drawer.itemsCaption", { code: order.code })}</caption>
        <thead>
          <tr className="border-b border-dashed border-control-border/60 text-fg-secondary">
            <th scope="col" className="py-1.5 text-left font-semibold">
              {t("drawer.product")}
            </th>
            <th scope="col" className="py-1.5 text-right font-semibold">
              {t("drawer.qty")}
            </th>
            <th scope="col" className="py-1.5 text-right font-semibold">
              {t("drawer.lineTotal")}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.productId} className="align-top">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                {item.name}
                <span className="block text-fg-secondary tabular">
                  {formatNumber(item.qty, locale)} × {money(item.unitPriceAZN)}
                </span>
              </th>
              <td className="py-1.5 text-right tabular">{formatNumber(item.qty, locale)}</td>
              <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular">{money(item.totalAZN)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 space-y-1 border-t border-dashed border-control-border/60 pt-3">
        <div className="flex justify-between gap-4">
          <dt>{t("drawer.subtotal")}</dt>
          <dd className="tabular">{money(order.subtotalAZN)}</dd>
        </div>
        {courier ? (
          <div className="flex justify-between gap-4">
            <dt>{t("drawer.deliveryFee")}</dt>
            <dd className="tabular">{order.deliveryFeeAZN > 0 ? money(order.deliveryFeeAZN) : t("drawer.free")}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 pt-1 text-title font-bold">
          <dt>{t("drawer.total")}</dt>
          <dd className="tabular">{money(order.totalAZN)}</dd>
        </div>
      </dl>

      <footer className="mt-4 border-t border-dashed border-control-border/60 pt-3 text-center text-meta">
        <p>{t("receipt.thanks")}</p>
        <p className="mt-1 text-fg-secondary">{t("receipt.demo")}</p>
      </footer>
    </article>
  );
}
