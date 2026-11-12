"use client";

import { ArrowRight, CalendarClock, Car, Check, Hourglass, Inbox, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { AsyncView, Avatar, Button, ButtonLink, ConfirmDialog, EmptyState, Panel, SkeletonRows, Textarea } from "@/components/ui";
import type { QueryResult } from "@/lib/api/hooks";
import type { Appointment, AppointmentStatus, OverviewData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate, formatDayLabel, formatDuration, formatMoney, formatRelative, formatTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { useNow } from "./now";

/** Dashboard cap; the "View all (N)" link opens the full list. Phones show fewer cards. */
const VISIBLE = 3;
const PHONE_VISIBLE = 2;

export type RequestsPanelProps = {
  query: QueryResult<OverviewData>;
  /** Optimistic statuses (accepted / declined here, waiting for the refetch). */
  optimistic: Record<string, AppointmentStatus>;
  onAccept: (appointment: Appointment) => void;
  onDecline: (appointment: Appointment, reason: string) => void;
  className?: string;
};

/** Requests from the PetRide app waiting for an answer: one-click accept, decline with a reason. */
export function RequestsPanel({ query, optimistic, onAccept, onDecline, className }: RequestsPanelProps) {
  const t = useT("overview");
  const locale = useLocale();
  const [declining, setDeclining] = useState<Appointment | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const pending = (query.data?.pending ?? []).filter((a) => !optimistic[a.id]);
  const allHref = localizedHref(locale, ROUTES.appointments, { status: "requested" });

  /** The card is about to disappear: move focus to the next card's main action (or the panel body). */
  const moveFocusFrom = (id: string, always = false) => {
    const root = bodyRef.current;
    if (!root || (!always && !root.contains(document.activeElement))) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-request]"));
    const index = cards.findIndex((card) => card.dataset.request === id);
    const next = cards[index + 1] ?? cards[index - 1];
    requestAnimationFrame(() => {
      const target = next?.isConnected ? next.querySelector<HTMLElement>("[data-primary-action]") : null;
      (target ?? root).focus({ preventScroll: true });
    });
  };

  return (
    <Panel
      title={t("requests.title")}
      icon={<Inbox size={20} />}
      className={cn("flex flex-col", className)}
      bodyClassName="flex flex-1 flex-col"
      actions={
        pending.length > 0 ? (
          <ButtonLink href={allHref} variant="ghost" size="sm" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
            {t("requests.viewAll", { count: pending.length })}
          </ButtonLink>
        ) : null
      }
    >
      <div ref={bodyRef} tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <AsyncView
          query={query}
          compact
          isEmpty={(data) => data.pending.every((a) => optimistic[a.id])}
          loading={<SkeletonRows rows={3} />}
          empty={<EmptyState compact className="flex-1 justify-center" pet="golden" title={t("requests.emptyTitle")} description={t("requests.emptyBody")} />}
        >
          {() => (
            <ul className="space-y-2">
              {pending.slice(0, VISIBLE).map((a, i) => (
                <RequestCard
                  key={a.id}
                  appointment={a}
                  index={i}
                  onAccept={() => {
                    moveFocusFrom(a.id);
                    onAccept(a);
                  }}
                  onDecline={() => setDeclining(a)}
                />
              ))}
            </ul>
          )}
        </AsyncView>
      </div>
      {declining ? (
        <DeclineDialog
          key={declining.id}
          appointment={declining}
          onClose={() => setDeclining(null)}
          onConfirm={(reason) => {
            moveFocusFrom(declining.id, true);
            setDeclining(null);
            onDecline(declining, reason);
          }}
        />
      ) : null}
    </Panel>
  );
}

/**
 * Compact request card: pet and breed, service and client, one wrapping line of facts (when, how
 * long, price, PetRide), then Decline / Accept. Container queries keep it readable in a 260px
 * dashboard column: the avatar appears from 20rem, the buttons move next to the text from 28rem.
 */
function RequestCard({ appointment: a, index, onAccept, onDecline }: { appointment: Appointment; index: number; onAccept: () => void; onDecline: () => void }) {
  const t = useT("overview");
  const tc = useT("common");
  const locale = useLocale();
  const now = useNow(30_000);
  const titleId = useId();
  const href = localizedHref(locale, ROUTES.appointments, { id: a.id });
  const price = a.priceAZN === null ? tc("money.pricedOnSite") : formatMoney(a.priceAZN, locale, { decimals: "auto" });
  const day = now === null ? formatDate(a.start, locale) : formatDayLabel(a.start, locale, new Date(now));
  const received = now === null ? null : formatRelative(a.createdAt, locale, new Date(now));

  return (
    <li
      data-request={a.id}
      className={cn(
        "@container animate-fade-up rounded-card border border-border bg-surface p-3 transition-shadow duration-200 hover:shadow-card",
        index >= PHONE_VISIBLE && "max-sm:hidden",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex flex-col gap-2.5 @md:flex-row @md:items-center @md:gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <Avatar name={a.petName} species={a.petSpecies} tint={a.petTint} size="sm" shape="tile" className="hidden @xs:inline-flex" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id={titleId} title={`${a.petName} · ${a.petBreed}`} className="min-w-0 truncate text-body font-semibold text-fg">
                <Link href={href} className="rounded-sm underline-offset-2 hover:underline">
                  {a.petName}
                </Link>
                <span className="font-normal text-fg-secondary"> · {a.petBreed}</span>
              </h3>
              {received ? (
                <span className="shrink-0 whitespace-nowrap text-caption text-fg-secondary">
                  <span className="sr-only">{t("requests.received", { time: received })}</span>
                  <span aria-hidden="true">{received}</span>
                </span>
              ) : null}
            </div>
            <p title={`${a.serviceName} · ${a.clientName}`} className="truncate text-body-sm text-fg-secondary">
              <span className="font-semibold text-fg">{a.serviceName}</span> · {a.clientName}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-fg-secondary">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <CalendarClock size={14} aria-hidden="true" className="shrink-0" />
                {day}, <span className="tabular">{formatTime(a.start)}</span>
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Hourglass size={14} aria-hidden="true" className="shrink-0" />
                {formatDuration(a.durationMin, locale)}
              </span>
              <span className="whitespace-nowrap tabular">{price}</span>
              {a.withRide ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-fg">
                  <Car size={14} aria-hidden="true" className="shrink-0" />
                  {a.returnRide ? t("requests.roundTrip") : t("requests.withRide")}
                </span>
              ) : null}
            </p>
            {a.clientNote ? (
              <p className="mt-1.5 line-clamp-2 rounded-tile bg-surface-muted px-2.5 py-1.5 text-meta text-fg-secondary">
                <span className="sr-only">{t("requests.clientNote")} </span>
                {a.clientNote}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 @xs:flex @xs:justify-end @md:shrink-0">
          <Button size="sm" variant="outline" aria-describedby={titleId} leftIcon={<X size={16} aria-hidden="true" />} onClick={onDecline}>
            {tc("actions.decline")}
          </Button>
          <Button size="sm" data-primary-action="" aria-describedby={titleId} leftIcon={<Check size={16} aria-hidden="true" />} onClick={onAccept}>
            {tc("actions.accept")}
          </Button>
        </div>
      </div>
    </li>
  );
}

const REASONS = ["busy", "unavailable", "other"] as const;
type Reason = (typeof REASONS)[number];

function DeclineDialog({ appointment, onClose, onConfirm }: { appointment: Appointment; onClose: () => void; onConfirm: (reason: string) => void }) {
  const t = useT("overview");
  const [reason, setReason] = useState<Reason>("busy");
  const [text, setText] = useState("");
  const name = useId();
  const confirm = () => {
    if (reason === "other") {
      if (text.trim()) onConfirm(text.trim());
      return;
    }
    onConfirm(t(`requests.decline.${reason}`));
  };
  return (
    <ConfirmDialog
      open
      tone="danger"
      onClose={onClose}
      onConfirm={confirm}
      title={t("requests.decline.title", { pet: appointment.petName })}
      description={t("requests.decline.description", { client: appointment.clientName })}
      confirmLabel={t("requests.decline.confirm")}
      confirmDisabled={reason === "other" && !text.trim()}
    >
      <fieldset>
        <legend className="mb-2 text-body-sm font-semibold text-fg">{t("requests.decline.legend")}</legend>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label
              key={r}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-tile border p-3 transition-colors",
                reason === r ? "border-primary bg-primary-selected" : "border-border hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name={name}
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-body-sm text-fg">{t(`requests.decline.${r}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {reason === "other" ? (
        <Textarea
          wrapperClassName="mt-3"
          label={t("requests.decline.otherLabel")}
          hint={t("requests.decline.otherHint")}
          rows={3}
          required
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      ) : null}
    </ConfirmDialog>
  );
}
