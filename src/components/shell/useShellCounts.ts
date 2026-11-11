"use client";

import { useApiQuery } from "@/lib/api/hooks";
import { useSession } from "@/lib/auth/client";

import { partnerFeatures } from "./nav";

/** Live counts for nav badges and the top bar (polls every 30 s). */
export function useShellCounts() {
  const session = useSession();
  const f = partnerFeatures(session);
  const requests = useApiQuery(
    ["appointments", "shell-pending"],
    (api) => api.listAppointments({ status: ["requested"], from: new Date().toISOString(), pageSize: 1 }),
    { enabled: f.appointments, refreshMs: 30_000 },
  );
  const orders = useApiQuery(["orders", "shell-new"], (api) => api.listOrders({ status: ["new"], pageSize: 1 }), {
    enabled: f.orders,
    refreshMs: 30_000,
  });
  const notifications = useApiQuery(["notifications"], (api) => api.listNotifications(), { refreshMs: 30_000 });
  return {
    requests: requests.data?.total ?? 0,
    orders: orders.data?.total ?? 0,
    unread: notifications.data?.filter((n) => !n.read).length ?? 0,
    notifications,
  };
}
