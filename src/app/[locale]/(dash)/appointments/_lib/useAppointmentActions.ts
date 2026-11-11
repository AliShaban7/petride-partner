"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/components/ui";
import { errorCode, useApiMutation } from "@/lib/api/hooks";
import type { PartnerApi } from "@/lib/api/partner-api";
import type { Appointment, NewAppointmentInput } from "@/lib/api/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { MINUTE, startOfDay } from "./time";

export type ActionKind = "accept" | "decline" | "reschedule" | "checkIn" | "complete" | "noShow" | "cancel" | "bookAgain";

/**
 * Actions that are valid for an appointment right now (the API rejects anything else with
 * `invalid_transition`). Order = importance; the first one is the primary button.
 */
export function availableActions(a: Appointment, now: number): ActionKind[] {
  const start = new Date(a.start).getTime();
  const startedOrToday = now > 0 && startOfDay(start) <= startOfDay(now);
  // A driver is already on the way / the pet is in the car: moving or cancelling the visit (or
  // calling it a no-show) would strand the ride, so only arrival actions stay.
  const rideMoving = isRideUnderWay(a);
  switch (a.status) {
    case "requested":
      return rideMoving ? ["accept", "decline"] : ["accept", "reschedule", "decline"];
    case "confirmed":
      if (rideMoving) return ["checkIn", "complete"];
      return startedOrToday
        ? ["checkIn", "complete", "reschedule", ...(start <= now ? (["noShow"] as const) : []), "cancel"]
        : ["reschedule", "cancel"];
    case "checked_in":
      return ["complete"];
    default:
      return ["bookAgain"];
  }
}

/** The inbound PetRide ride has a driver on the way, waiting at pick-up, or the pet on board. */
export function isRideUnderWay(a: Appointment): boolean {
  const status = a.ride?.status;
  return status === "onway" || status === "arrived" || status === "intrip";
}

/** One-tap buttons on cards: answer a request, check a pet in, finish a visit in progress. */
export function quickActions(actions: ActionKind[], a: Appointment): ActionKind[] {
  if (a.status === "requested") return actions.filter((k) => k === "accept" || k === "decline");
  if (a.status === "confirmed") return actions.filter((k) => k === "checkIn");
  if (a.status === "checked_in") return actions.filter((k) => k === "complete");
  return [];
}

type Override = { patch: Partial<Appointment>; at: number };

/**
 * Appointment mutations with optimistic UI and toasts.
 *
 * `merge(a)` lays the optimistic patch over any copy of the appointment (list row, calendar block,
 * drawer) until a refetched copy is newer than the change (`updatedAt` ≥ the moment of the click),
 * so the UI never flickers back. A failed call drops the patch and shows an error toast.
 */
export function useAppointmentActions(options: { onOpen?: (id: string) => void } = {}) {
  const t = useT("appointments");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [pending, setPending] = useState<Record<string, true>>({});

  // One mutation that runs any API call: every success refetches all queries (cheap in the mock),
  // so lists, the drawer, the top-bar badge and the overview stay in step.
  const mutation = useApiMutation((api: PartnerApi, call: (api: PartnerApi) => Promise<unknown>) => call(api));

  const merge = useCallback(
    (a: Appointment): Appointment => {
      const o = overrides[a.id];
      if (!o || new Date(a.updatedAt).getTime() >= o.at) return a;
      return { ...a, ...o.patch };
    },
    [overrides],
  );

  const drop = (id: string) => {
    setOverrides((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
  };
  const setBusy = (id: string, busy: boolean) =>
    setPending((all) => {
      const next = { ...all };
      if (busy) next[id] = true;
      else delete next[id];
      return next;
    });

  async function run(
    a: Appointment,
    patch: Partial<Appointment>,
    call: (api: PartnerApi) => Promise<Appointment>,
    success: { title: string; description?: string },
  ): Promise<Appointment | undefined> {
    const at = Date.now();
    setOverrides((all) => ({ ...all, [a.id]: { patch, at } }));
    setBusy(a.id, true);
    try {
      const result = (await mutation.mutateAsync(call)) as Appointment;
      toast({ title: success.title, description: success.description, tone: "success" });
      return result;
    } catch (error) {
      drop(a.id);
      toast({ title: t("toast.failed"), description: tc.dynamic(`errors.${errorCode(error)}`), tone: "error" });
      return undefined;
    } finally {
      setBusy(a.id, false);
    }
  }

  const first = (name: string) => name.split(" ")[0] ?? name;

  return {
    merge,
    isPending: (id: string) => Boolean(pending[id]),

    accept: (a: Appointment) =>
      run(a, { status: "confirmed" }, (api) => api.confirmAppointment(a.id), {
        title: t("toast.accepted", { pet: a.petName }),
        description: t("toast.acceptedBody", { client: first(a.clientName) }),
      }),

    decline: (a: Appointment, reason: string) =>
      run(a, { status: "declined", reason }, (api) => api.declineAppointment(a.id, reason), {
        title: t("toast.declined"),
        description: t("toast.declinedBody", { client: first(a.clientName) }),
      }),

    reschedule: (a: Appointment, start: number) =>
      run(
        a,
        {
          status: a.status === "requested" ? "confirmed" : a.status,
          start: new Date(start).toISOString(),
          end: new Date(start + a.durationMin * MINUTE).toISOString(),
        },
        (api) => api.rescheduleAppointment(a.id, new Date(start).toISOString()),
        {
          title: t("toast.rescheduled", { when: formatDateTime(start, locale) }),
          description: a.withRide ? t("toast.rescheduledRide") : a.source === "app" ? t("toast.rescheduledBody", { client: first(a.clientName) }) : t("toast.callOwner"),
        },
      ),

    checkIn: (a: Appointment) =>
      run(a, { status: "checked_in" }, (api) => api.checkInAppointment(a.id), { title: t("toast.checkedIn", { pet: a.petName }) }),

    complete: (a: Appointment, amountAZN: number, staffNote?: string) =>
      run(
        a,
        { status: "completed", amountAZN, ...(staffNote !== undefined && { staffNote }) },
        (api) => api.completeAppointment(a.id, { amountAZN, staffNote }),
        { title: t("toast.completed", { pet: a.petName }), description: t("toast.completedBody", { amount: formatMoney(amountAZN, locale, { decimals: "auto" }) }) },
      ),

    noShow: (a: Appointment) =>
      run(a, { status: "no_show" }, (api) => api.markNoShow(a.id), { title: t("toast.noShow", { pet: a.petName }) }),

    cancel: (a: Appointment, reason: string) =>
      run(a, { status: "cancelled", reason }, (api) => api.cancelAppointment(a.id, reason), {
        title: t("toast.cancelled"),
        description: a.withRide ? t("toast.cancelledRide") : a.source === "app" ? t("toast.cancelledBody", { client: first(a.clientName) }) : t("toast.callOwner"),
      }),

    saveNote: (a: Appointment, staffNote: string) =>
      run(a, { staffNote }, (api) => api.updateAppointmentNote(a.id, staffNote), { title: t("toast.noteSaved") }),

    /** Walk-in / phone booking. Resolves with the new appointment (or undefined on error). */
    create: async (input: NewAppointmentInput, petName: string): Promise<Appointment | undefined> => {
      try {
        const created = (await mutation.mutateAsync((api) => api.createAppointment(input))) as Appointment;
        toast({
          title: t("toast.created", { pet: petName }),
          description: formatDateTime(created.start, locale),
          tone: "success",
          action: options.onOpen ? { label: t("toast.open"), onClick: () => options.onOpen?.(created.id) } : undefined,
        });
        return created;
      } catch (error) {
        toast({ title: t("toast.failed"), description: tc.dynamic(`errors.${errorCode(error)}`), tone: "error" });
        return undefined;
      }
    },
  };
}

export type AppointmentActions = ReturnType<typeof useAppointmentActions>;
