"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/components/ui";
import { errorCode, useApiMutation } from "@/lib/api/hooks";
import type { Order } from "@/lib/api/types";
import { useT } from "@/lib/i18n/client";

import { isCourier, type AdvanceStatus } from "./model";

/**
 * Status changes with feedback: a toast that names the order and its new status, the courier note
 * when "ready" books a PetRide courier, and a calm error toast when the step isn't allowed.
 * Success refetches every query (shell badges, overview and stats included).
 */
export function useOrderActions() {
  const t = useT("orders");
  const ts = useT("status");
  const tc = useT("common");
  const { toast } = useToast();
  /** Id of the order whose status change is running (spinner on that card / row only). */
  const [busyId, setBusyId] = useState<string | null>(null);

  const advanceMutation = useApiMutation((api, id: string, status: AdvanceStatus) => api.updateOrderStatus(id, status));
  const cancelMutation = useApiMutation((api, id: string, reason: string) => api.cancelOrder(id, reason));
  const { mutateAsync: advanceAsync } = advanceMutation;
  const { mutateAsync: cancelAsync } = cancelMutation;

  const fail = useCallback(
    (error: unknown) => toast({ tone: "error", title: t("toast.failed"), description: tc.dynamic(`errors.${errorCode(error)}`) }),
    [toast, t, tc],
  );

  /** Moves the order on; resolves true on success. */
  const advance = useCallback(
    async (order: Order, status: AdvanceStatus): Promise<boolean> => {
      setBusyId(order.id);
      try {
        await advanceAsync(order.id, status);
        toast({
          tone: "success",
          title: t("toast.moved", { code: order.code, status: ts.dynamic(`order.${status}`) }),
          description: status === "ready" && isCourier(order) && !order.courierRide ? t("toast.courierBooked") : undefined,
        });
        return true;
      } catch (error) {
        fail(error);
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [advanceAsync, toast, t, ts, fail],
  );

  const cancel = useCallback(
    async (order: Order, reason: string): Promise<boolean> => {
      try {
        await cancelAsync(order.id, reason);
        toast({ tone: "success", title: t("toast.cancelled", { code: order.code }), description: t("toast.cancelledBody") });
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    [cancelAsync, toast, t, fail],
  );

  return { advance, cancel, busyId, cancelling: cancelMutation.isPending };
}
