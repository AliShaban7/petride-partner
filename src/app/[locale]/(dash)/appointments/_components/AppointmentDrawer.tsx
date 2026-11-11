"use client";

import { Ellipsis, MessageSquareText, Phone, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  AsyncView,
  Avatar,
  Button,
  DetailList,
  Drawer,
  ErrorState,
  Skeleton,
  SkeletonText,
  StatusPill,
  Tag,
  Textarea,
  buttonClasses,
} from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, Pet } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  formatAge,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatDuration,
  formatPhone,
  formatRelative,
  formatTimeRange,
  formatWeekdayDate,
  formatWeight,
  phoneHref,
} from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { isStay } from "../_lib/time";
import { availableActions, isRideUnderWay, type ActionKind, type AppointmentActions } from "../_lib/useAppointmentActions";
import { ActionMenu } from "./ActionMenu";
import { ACTION_ICONS, CategoryDot, PriceText, useActionItems } from "./bits";
import { RideCard } from "./RideCard";

export type AppointmentDrawerProps = {
  id?: string;
  now: number;
  actions: AppointmentActions;
  onClose: () => void;
  onAction: (kind: ActionKind, a: Appointment) => void;
};

/** Everything about one appointment: pet, owner, service, PetRide rides, notes, history, actions. */
export function AppointmentDrawer({ id, now, actions, onClose, onAction }: AppointmentDrawerProps) {
  const t = useT("appointments");
  const locale = useLocale();
  const query = useApiQuery(["appointments", "detail", id], (api) => api.getAppointment(id ?? ""), { enabled: Boolean(id), refreshMs: 15_000 });
  const a = query.data && query.data.id === id ? actions.merge(query.data) : undefined;

  return (
    <Drawer
      // Opened only after hydration (now > 0): a modal that is already open during hydration
      // never gets its Esc / focus trap wired up (shared useModalLayer reads the ref too early).
      open={Boolean(id) && now > 0}
      onClose={onClose}
      side="auto"
      size="md"
      title={a ? `${a.petName} · ${a.serviceName}` : t("drawer.title")}
      description={a ? `${a.code} · ${whenText(a, locale)}` : undefined}
      footer={a ? <Footer a={a} now={now} pending={actions.isPending(a.id)} onAction={onAction} /> : undefined}
    >
      {!a ? (
        query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} compact />
        ) : (
          <div aria-busy="true" className="space-y-5 pt-2">
            <span className="sr-only">{t("drawer.loading")}</span>
            <Skeleton className="h-7 w-40 rounded-chip" />
            <Skeleton className="h-28 w-full rounded-card" />
            <SkeletonText lines={4} />
          </div>
        )
      ) : (
        <DrawerBody a={a} now={now} actions={actions} />
      )}
    </Drawer>
  );
}

function whenText(a: Appointment, locale: Locale) {
  if (isStay(a) && a.durationMin >= 1440) return `${formatDayMonth(a.start, locale)} – ${formatDayMonth(a.end, locale)}`;
  return `${formatDayMonth(a.start, locale)}, ${formatTimeRange(a.start, a.end)}`;
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-border pt-5", className)}>
      <h3 className="mb-3 font-display text-title font-extrabold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function DrawerBody({ a, now, actions }: { a: Appointment; now: number; actions: AppointmentActions }) {
  const t = useT("appointments");
  const tc = useT("common");
  const ts = useT("status");
  const locale = useLocale();
  const today = now ? new Date(now) : undefined;
  const pet = useApiQuery(["pets", "detail", a.petId], (api) => api.getPet(a.petId));
  const previous = useApiQuery(["appointments", "pet-history", a.petId, a.start], (api) =>
    api.listAppointments({ petId: a.petId, to: a.start, sort: "start_desc", pageSize: 5 }),
  );
  const rides = [a.ride, a.returnRide].filter((r) => r !== undefined);

  return (
    <div className="space-y-5 pb-2">
      {/* Status line */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill kind="appointment" status={a.status} />
        <Tag>{ts.dynamic(`source.${a.source}`)}</Tag>
        {a.status === "requested" && today ? <span className="text-meta text-fg-secondary">{t("drawer.requestedAgo", { ago: formatRelative(a.createdAt, locale, today) })}</span> : null}
      </div>
      {a.status === "confirmed" && isRideUnderWay(a) ? (
        <p className="rounded-card bg-primary-selected px-4 py-3 text-body-sm text-fg">{t("drawer.rideLive")}</p>
      ) : null}
      {a.reason && (a.status === "declined" || a.status === "cancelled") ? (
        <p className="rounded-card bg-surface-muted px-4 py-3 text-body-sm text-fg">
          <span className="font-semibold">{t("drawer.reason")}:</span> {a.reason}
        </p>
      ) : null}

      <DetailList
        columns={2}
        items={[
          { label: t("drawer.date"), value: isStay(a) && a.durationMin >= 1440 ? `${formatDate(a.start, locale)} – ${formatDate(a.end, locale)}` : formatWeekdayDate(a.start, locale) },
          { label: t("drawer.time"), value: <span className="tabular">{formatTimeRange(a.start, a.end)}</span> },
          {
            label: t("drawer.service"),
            value: (
              <span className="inline-flex items-center gap-2">
                <CategoryDot category={a.category} />
                {a.serviceName}
              </span>
            ),
          },
          { label: t("drawer.duration"), value: formatDuration(a.durationMin, locale) },
          { label: a.status === "completed" ? t("drawer.charged") : t("drawer.price"), value: <PriceText appointment={a} /> },
          { label: t("drawer.code"), value: <span className="tabular">{a.code}</span> },
        ]}
      />

      {/* Pet */}
      <Section title={t("drawer.pet")}>
        <AsyncView query={pet} compact loading={<Skeleton className="h-32 w-full rounded-card" />}>
          {(p) => <PetCard pet={p} now={now} />}
        </AsyncView>
      </Section>

      {/* Owner */}
      <Section title={t("drawer.owner")}>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={a.clientName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fg">{a.clientName}</p>
            <a href={phoneHref(a.clientPhone)} className="text-body-sm font-medium text-primary underline-offset-4 tabular hover:underline">
              {formatPhone(a.clientPhone)}
            </a>
          </div>
          <div className="flex gap-2">
            <a href={phoneHref(a.clientPhone)} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-11" })}>
              <Phone aria-hidden="true" size={16} />
              {tc("actions.call")}
            </a>
            <Link href={localizedHref(locale, ROUTES.clients, { id: a.clientId })} className={buttonClasses({ variant: "outline", size: "sm", className: "min-h-11" })}>
              <UserRound aria-hidden="true" size={16} />
              {t("drawer.profile")}
            </Link>
          </div>
        </div>
      </Section>

      {/* PetRide */}
      {a.withRide || rides.length ? (
        <Section title={t("drawer.rides")}>
          {rides.length ? (
            <div className="space-y-3">
              {rides.map((r) => (
                <RideCard key={r.id} ride={r} now={now} />
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-fg-secondary">{t("drawer.rideNotBooked")}</p>
          )}
        </Section>
      ) : null}

      {/* Notes */}
      <Section title={t("drawer.notes")}>
        {a.clientNote ? (
          <blockquote className="mb-4 flex gap-2 rounded-card bg-soft-sand px-4 py-3 text-body-sm text-fg">
            <MessageSquareText aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-fg-tertiary" />
            <span>
              <span className="block text-meta font-semibold text-fg-tertiary">{t("drawer.clientNote")}</span>
              {a.clientNote}
            </span>
          </blockquote>
        ) : null}
        <StaffNote key={`${a.id}:${a.staffNote ?? ""}`} a={a} actions={actions} />
      </Section>

      {/* Previous visits */}
      <Section title={t("drawer.previous")}>
        <AsyncView
          query={previous}
          compact
          loading={<SkeletonText lines={3} />}
          isEmpty={(d) => d.items.filter((x) => x.id !== a.id).length === 0}
          empty={<p className="text-body-sm text-fg-secondary">{t("drawer.firstVisit", { pet: a.petName })}</p>}
        >
          {(d) => (
            <ul className="divide-y divide-border">
              {d.items
                .filter((x) => x.id !== a.id)
                .map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-body-sm font-medium text-fg">{x.serviceName}</span>
                      <span className="block text-meta text-fg-secondary tabular">{formatDateTime(x.start, locale, today)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {x.status === "completed" ? <PriceText appointment={x} className="text-body-sm" /> : null}
                      <StatusPill kind="appointment" status={x.status} size="sm" />
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </AsyncView>
      </Section>

      {/* This appointment's history */}
      <Section title={t("drawer.history")}>
        <ol className="space-y-3">
          {[...a.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
              <span aria-hidden="true" className="mt-1.5 size-2 rounded-full bg-sage" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill kind="appointment" status={h.status} size="sm" />
                  <span className="text-meta text-fg-secondary">{t.dynamic(`history.by.${h.by}`)}</span>
                </span>
                <span className="mt-0.5 block text-meta text-fg-secondary tabular">{formatDateTime(h.at, locale, today)}</span>
                {h.note ? <span className="mt-0.5 block text-body-sm text-fg">{h.note === "rescheduled" ? t("history.rescheduled") : h.note}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function PetCard({ pet, now }: { pet: Pet; now: number }) {
  const t = useT("appointments");
  const tc = useT("common");
  const locale = useLocale();
  const alerts = pet.vaccines.filter((v) => v.status === "overdue" || v.status === "due_soon");
  return (
    <div className="rounded-card bg-surface-muted p-4">
      <div className="flex items-start gap-4">
        <Avatar name={pet.name} species={pet.species} tint={pet.tint} src={pet.photoUrl} shape="tile" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-h2 font-extrabold leading-tight text-fg">{pet.name}</p>
          <p className="text-body-sm text-fg-secondary">
            {tc.dynamic(`species.${pet.species}`)} · {pet.breed}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag tone="white">{tc.dynamic(`sex.${pet.sex}`)}</Tag>
            <Tag tone="white">{formatAge(pet.birthDate, locale, now ? new Date(now) : undefined)}</Tag>
            <Tag tone="white">{formatWeight(pet.weightKg, locale)}</Tag>
            <Tag tone="white">{pet.code}</Tag>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-meta font-semibold text-fg">{t("drawer.vaccines")}</p>
        {alerts.length ? (
          <ul className="space-y-1.5">
            {alerts.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
                <span className="text-fg">
                  {v.name} · <span className="tabular">{formatDate(v.nextDate ?? v.dueDate, locale)}</span>
                </span>
                <StatusPill kind="vaccine" status={v.status} size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-fg-secondary">{pet.vaccines.length ? t("drawer.vaccinesOk") : t("drawer.vaccinesNone")}</p>
        )}
      </div>

      {pet.travelNotes.length ? (
        <div className="mt-4">
          <p className="mb-1.5 text-meta font-semibold text-fg">{t("drawer.travelNotes")}</p>
          <div className="flex flex-wrap gap-1.5">
            {pet.travelNotes.map((n) => (
              <Tag key={n} tone="warning" icon={<TriangleAlert aria-hidden="true" size={12} />}>
                {n}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}
      {pet.partnerNote ? (
        <p className="mt-4 text-body-sm text-fg">
          <span className="font-semibold">{t("drawer.petNote")}:</span> {pet.partnerNote}
        </p>
      ) : null}
    </div>
  );
}

/** Internal staff note (not shown to the client). */
function StaffNote({ a, actions }: { a: Appointment; actions: AppointmentActions }) {
  const t = useT("appointments");
  const tc = useT("common");
  const [draft, setDraft] = useState(a.staffNote ?? "");
  const dirty = draft.trim() !== (a.staffNote ?? "").trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void actions.saveNote(a, draft.trim());
      }}
      className="space-y-2"
    >
      <Textarea label={t("drawer.staffNote")} hint={t("drawer.staffNoteHint")} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} />
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft(a.staffNote ?? "")}>
            {tc("actions.cancel")}
          </Button>
          <Button type="submit" variant="secondary" size="sm" loading={actions.isPending(a.id)}>
            {t("drawer.saveNote")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/** Status-dependent actions: up to three buttons, the rest in a "More" menu. */
function Footer({ a, now, pending, onAction }: { a: Appointment; now: number; pending: boolean; onAction: (kind: ActionKind, a: Appointment) => void }) {
  const t = useT("appointments");
  const tc = useT("common");
  const menuItems = useActionItems();
  const acts = availableActions(a, now);
  const visible = acts.length <= 3 ? acts : acts.slice(0, 2);
  const overflow = acts.length <= 3 ? [] : acts.slice(2);
  // Primary (first) goes last so it sits at the right edge.
  const ordered = [...visible].reverse();
  // After an action the buttons change (the one that had focus is gone, or a dialog closed and its
  // opener vanished). Keep keyboard focus inside the drawer instead of letting it fall to <body>,
  // where the next Tab would leave the modal.
  const box = useRef<HTMLDivElement>(null);
  const signature = acts.join(",");
  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const buttons = box.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    buttons?.[buttons.length - 1]?.focus({ preventScroll: true });
  }, [signature, pending]);
  return (
    <div ref={box} className="flex w-full flex-wrap items-center justify-end gap-2">
      {overflow.length ? (
        <ActionMenu
          label={t("drawer.moreActions")}
          items={menuItems(overflow, (kind) => onAction(kind, a))}
          trigger={(p) => (
            <Button {...p} variant="ghost" leftIcon={<Ellipsis size={18} aria-hidden="true" />} disabled={pending}>
              {tc("actions.more")}
            </Button>
          )}
        />
      ) : null}
      {ordered.map((kind) => {
        const Icon = ACTION_ICONS[kind];
        const primary = kind === acts[0];
        const danger = kind === "decline" || kind === "cancel";
        return (
          <Button
            key={kind}
            variant={primary ? (kind === "bookAgain" ? "secondary" : "primary") : "outline"}
            className={cn(danger && "text-error-text")}
            leftIcon={<Icon size={18} aria-hidden="true" />}
            disabled={pending}
            loading={primary && pending}
            onClick={() => onAction(kind, a)}
          >
            {t.dynamic(`actions.${kind}`)}
          </Button>
        );
      })}
    </div>
  );
}
