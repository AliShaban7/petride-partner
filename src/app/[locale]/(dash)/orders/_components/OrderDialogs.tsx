"use client";

import { ArrowRight, Ban } from "lucide-react";
import { useState } from "react";

import { Button, ConfirmDialog, Dialog, Select, StatusPill, Textarea } from "@/components/ui";
import type { Order } from "@/lib/api/types";
import { useT } from "@/lib/i18n/client";

import { BOARD_STAGES, canCancel, isCourier, statusForStage, type AdvanceStatus, type Stage } from "./model";

const REASONS = ["out_of_stock", "client_asked", "no_delivery", "other"] as const;
type Reason = (typeof REASONS)[number];

/**
 * Cancel with a reason the customer sees in the app. Danger confirm, Cancel button focused first.
 * Mount it with `key={order.id}` so the form resets for each order.
 */
export function CancelOrderDialog({
  order,
  onClose,
  onConfirm,
  loading,
}: {
  order: Order | null;
  onClose: () => void;
  onConfirm: (order: Order, reason: string) => void;
  loading?: boolean;
}) {
  const t = useT("orders");
  const [reason, setReason] = useState<Reason>("out_of_stock");
  const [other, setOther] = useState("");
  const [touched, setTouched] = useState(false);
  const otherMissing = reason === "other" && !other.trim();
  const courier = order ? isCourier(order) && Boolean(order.courierRide) : false;

  const submit = () => {
    if (!order) return;
    if (otherMissing) {
      setTouched(true);
      return;
    }
    onConfirm(order, reason === "other" ? other.trim() : t.dynamic(`cancel.reasons.${reason}`));
  };

  return (
    <ConfirmDialog
      open={order !== null}
      onClose={onClose}
      onConfirm={submit}
      tone="danger"
      loading={loading}
      title={order ? t("cancel.title", { code: order.code }) : ""}
      description={t("cancel.description")}
      confirmLabel={t("cancel.confirm")}
      cancelLabel={t("cancel.keep")}
    >
      <div className="space-y-4">
        <Select
          label={t("cancel.reasonLabel")}
          value={reason}
          onChange={(e) => setReason(e.target.value as Reason)}
          options={REASONS.map((r) => ({ value: r, label: t.dynamic(`cancel.reasons.${r}`) }))}
        />
        {reason === "other" ? (
          <Textarea
            label={t("cancel.otherLabel")}
            placeholder={t("cancel.otherPlaceholder")}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            required
            error={touched && otherMissing ? t("cancel.otherRequired") : undefined}
          />
        ) : null}
        {courier ? <p className="rounded-tile bg-warning-bg px-3 py-2 text-body-sm text-warning-text">{t("cancel.courierNote")}</p> : null}
      </div>
    </ConfirmDialog>
  );
}

/**
 * Keyboard / touch alternative to drag and drop: lists the columns this order may move to.
 * "On the way" is never offered (the courier moves orders there).
 */
export function MoveOrderDialog({
  order,
  onClose,
  onMove,
  onCancel,
}: {
  order: Order | null;
  onClose: () => void;
  onMove: (order: Order, status: AdvanceStatus) => void;
  onCancel: (order: Order) => void;
}) {
  const t = useT("orders");
  const ts = useT("status");
  if (!order) return null;
  const targets = BOARD_STAGES.flatMap((stage: Stage) => {
    const status = statusForStage(order, stage);
    return status && status !== "cancel" ? [{ stage, status }] : [];
  });
  const cancellable = canCancel(order);
  const waitingForCourier = order.status === "ready" && isCourier(order) && targets.length === 0;
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t("move.title", { code: order.code })}
      description={t("move.description", { status: ts.dynamic(`order.${order.status}`) })}
    >
      {targets.length ? (
        <ul className="space-y-2" aria-label={t("move.title", { code: order.code })}>
          {targets.map(({ stage, status }) => (
            <li key={stage}>
              <button
                type="button"
                onClick={() => onMove(order, status)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 text-left transition-colors hover:bg-primary-selected"
              >
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-fg">{t.dynamic(`board.columns.${stage}`)}</span>
                  <span className="block text-meta text-fg-secondary">{t.dynamic(`board.hints.${stage}`)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusPill kind="order" status={status} size="sm" />
                  <ArrowRight aria-hidden="true" size={18} className="text-fg-secondary" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-fg-secondary">{waitingForCourier ? t("move.courierOnly") : t("move.none")}</p>
      )}
      {cancellable ? (
        <div className="mt-4 border-t border-border pt-4">
          <Button variant="ghost" className="text-error-text" leftIcon={<Ban size={18} aria-hidden="true" />} onClick={() => onCancel(order)}>
            {t("actions.cancel")}
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
}
