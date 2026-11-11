"use client";

import { CalendarPlus, Car, ClipboardList, MessageCircle, PawPrint, Phone, ReceiptText, ShoppingBag, Star, Stethoscope, Wallet } from "lucide-react";
import { useState } from "react";

import { partnerFeatures } from "@/components/shell";
import { Avatar, Button, DetailList, EmptyState, PageHeader, Panel, StatusPill } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Review, Ride } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { LOCALE_NAMES } from "@/lib/i18n/config";
import { formatDate, formatDateLong, formatDateTime, formatMoney, formatNumber, formatPercent, formatPhone, formatRelative, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { BackLink, CallLink, MiniStat, PetLinkRow, SourcePill } from "../../_components/bits";
import { OrdersTable, VisitsTable } from "../../_components/HistoryTables";
import { SendMessageDialog } from "../../_components/MessageDialogs";
import { NewAppointmentDialog } from "../../_components/NewAppointmentDialog";
import { NoteEditor } from "../../_components/NoteEditor";
import { ProfileError, ProfileSkeleton } from "../../_components/ProfileStates";
import { useNow, useOutbox } from "../../_lib/stores";
import { useMockParam } from "../../_lib/url";

/** Owner profile: contact, pets, visits / orders, spend, PetRide rides, reviews and quick actions. */
export function OwnerProfileView({ clientId }: { clientId: string }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const mode = partnerFeatures(session).appointments ? "visits" : "orders";
  const now = useNow();
  const linkQuery = useMockParam();
  const backHref = localizedHref(locale, ROUTES.clients, { view: "owners", ...linkQuery });
  const query = useApiQuery(["clients", clientId], (api) => api.getClient(clientId));
  const lastMessage = useOutbox(`client:${clientId}`);
  const [messageKey, setMessageKey] = useState(0);
  const [bookingKey, setBookingKey] = useState(0);

  if (!query.data) {
    return (
      <div className="space-y-4">
        <BackLink href={backHref}>{t("profile.backToOwners")}</BackLink>
        {query.error ? <ProfileError error={query.error} onRetry={query.refetch} backHref={backHref} kind="owner" /> : <ProfileSkeleton />}
      </div>
    );
  }

  const { client, pets, appointments, orders, rides, reviews } = query.data;
  const today = new Date(now);
  // Average over paid tickets only: completed visits + delivered / picked-up orders (what totalSpent counts).
  const tickets = client.visitsCount + orders.filter((o) => o.status === "delivered" || o.status === "picked_up").length;
  const average = tickets ? client.totalSpentAZN / tickets : 0;
  const courierRides = rides.filter((r) => r.direction === "delivery" && r.status === "completed").length;
  const upcoming = appointments
    .filter((a) => (a.status === "requested" || a.status === "confirmed") && new Date(a.start).getTime() > now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const petHref = (id: string) => localizedHref(locale, `${ROUTES.clients}/pets/${id}`, linkQuery);

  return (
    <div className="space-y-6">
      <BackLink href={backHref}>{t("profile.backToOwners")}</BackLink>

      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Avatar name={client.fullName} size="xl" className="animate-fade-up" />
        <PageHeader
          className="min-w-0 flex-1 sm:flex-col sm:items-start 2xl:flex-row 2xl:items-end"
          eyebrow={client.firstVisitAt ? t("owner.since", { date: formatDateLong(client.firstVisitAt, locale) }) : t("owner.newClient")}
          title={client.fullName}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <span>{client.area}</span>
              <SourcePill source={client.source} />
              <StatusPill kind="health" status={client.vaccineAlert} size="sm" />
            </span>
          }
          actions={
            <>
              {mode === "visits" && pets.length ? (
                <Button leftIcon={<CalendarPlus aria-hidden="true" size={18} />} onClick={() => setBookingKey((k) => k + 1)}>
                  {t("owner.newAppointment")}
                </Button>
              ) : null}
              <Button variant="secondary" leftIcon={<MessageCircle aria-hidden="true" size={18} />} onClick={() => setMessageKey((k) => k + 1)}>
                {t("owner.sendMessage")}
              </Button>
              <CallLink phone={client.phone} label={tc("actions.call")} />
            </>
          }
        />
      </div>

      {/* ---- Spend & visits ---- */}
      <section aria-label={t("owner.summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MiniStat
          index={0}
          tone="mint"
          pet="golden"
          icon={mode === "visits" ? <Stethoscope size={16} /> : <ShoppingBag size={16} />}
          label={mode === "visits" ? t("owners.visits") : t("owners.orders")}
          value={formatNumber(mode === "visits" ? client.visitsCount : client.ordersCount, locale)}
          footnote={
            client.lastVisitAt
              ? t(mode === "visits" ? "pet.lastVisitValue" : "pet.lastOrderValue", { date: formatDate(client.lastVisitAt, locale, today) })
              : mode === "visits"
                ? t("pet.noVisits")
                : t("owner.noOrders")
          }
        />
        <MiniStat
          index={1}
          tone="peach"
          pet="ginger"
          icon={<Wallet size={16} />}
          label={t("owners.spent")}
          value={formatMoney(client.totalSpentAZN, locale, { decimals: 0 })}
          footnote={mode === "visits" && client.ordersCount ? t.plural("owner.withOrders", client.ordersCount) : undefined}
        />
        <MiniStat index={2} tone="lilac" icon={<ReceiptText size={16} />} label={t("owner.averageTicket")} value={tickets ? formatMoney(average, locale, { decimals: 0 }) : "—"} />
        <MiniStat
          index={3}
          tone="sand"
          pet="tabby"
          icon={<Car size={16} />}
          label={mode === "visits" ? t("owner.petrideRides") : t("owner.courierDeliveries")}
          value={formatNumber(mode === "visits" ? client.rideVisits : courierRides, locale)}
          footnote={
            mode === "visits" && client.visitsCount
              ? t("owner.rideShare", { share: formatPercent(client.rideVisits / client.visitsCount, locale) })
              : undefined
          }
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
        <div className="min-w-0 space-y-4 lg:space-y-6">
          <Panel title={t.plural("owner.petsCount", pets.length)} icon={<PawPrint size={20} />}>
            {pets.length ? (
              <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                {pets.map((pet) => (
                  <li key={pet.id} className="min-w-0">
                    <PetLinkRow pet={pet} href={petHref(pet.id)} now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact pet="cream" title={t("owner.noPets")} description={t("owner.noPetsBody")} />
            )}
          </Panel>

          {mode === "visits" ? (
            <Panel title={t("owner.visitsTitle")} description={t.plural("owner.visitsTotal", appointments.length)} icon={<ClipboardList size={20} />}>
              {appointments.length ? (
                <VisitsTable rows={appointments} caption={t("owner.visitsCaption", { name: client.fullName })} showPet now={now} />
              ) : (
                <EmptyState compact pet="golden" title={t("owner.noVisits")} description={t("owner.noVisitsBody")} />
              )}
            </Panel>
          ) : null}

          {mode === "orders" || orders.length ? (
            <Panel title={t("owner.ordersTitle")} icon={<ShoppingBag size={20} />}>
              {orders.length ? (
                <OrdersTable rows={orders} caption={t("orders.caption", { name: client.fullName })} now={now} />
              ) : (
                <EmptyState compact pet="ginger" title={t("owner.noOrders")} description={t("pet.ordersEmptyBody")} />
              )}
            </Panel>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
          <Panel title={t("owner.contact")} icon={<Phone size={20} />}>
            <DetailList
              items={[
                {
                  label: t("owners.phone"),
                  value: (
                    <a href={phoneHref(client.phone)} className="tabular underline-offset-4 hover:underline">
                      {formatPhone(client.phone)}
                    </a>
                  ),
                },
                { label: t("owner.area"), value: client.area },
                { label: t("owner.language"), value: LOCALE_NAMES[client.locale] },
                { label: t("owner.firstVisit"), value: client.firstVisitAt ? formatDateLong(client.firstVisitAt, locale) : "—" },
                {
                  label: mode === "visits" ? t("owners.lastVisit") : t("owners.lastOrder"),
                  value: client.lastVisitAt ? formatDateLong(client.lastVisitAt, locale) : "—",
                },
                ...(lastMessage ? [{ label: t("owner.lastMessage"), value: formatRelative(lastMessage.at, locale, today) }] : []),
              ]}
            />
          </Panel>

          <Panel title={t("notes.internal")} icon={<ClipboardList size={20} />}>
            <NoteEditor
              label={t("notes.internalOwnerLabel", { name: client.firstName })}
              initial={client.partnerNote ?? ""}
              save={(api, note) => api.updateClientNote(client.id, note)}
              invalidates={["clients"]}
            />
          </Panel>

          <Panel title={mode === "visits" ? t("owner.ridesTitle") : t("owner.courierTitle")} icon={<Car size={20} />}>
            {rides.length ? <RideList rides={rides.slice(0, 5)} now={now} /> : <p className="text-body-sm text-fg-secondary">{t("owner.noRides")}</p>}
          </Panel>

          {reviews.length ? (
            <Panel title={t("owner.reviewsTitle")} icon={<Star size={20} />}>
              <ReviewList reviews={reviews} now={now} />
            </Panel>
          ) : null}
        </div>
      </div>

      {messageKey > 0 ? (
        <SendMessageDialog
          key={messageKey}
          open
          onClose={() => setMessageKey(0)}
          client={client}
          pets={pets}
          partnerName={session.partnerShortName}
          nextAppointment={upcoming}
          visits={mode === "visits"}
        />
      ) : null}
      {bookingKey > 0 ? <NewAppointmentDialog key={bookingKey} open onClose={() => setBookingKey(0)} pets={pets} /> : null}
    </div>
  );
}

function RideList({ rides, now }: { rides: Ride[]; now: number }) {
  const t = useT("clients");
  const ts = useT("status");
  const locale = useLocale();
  const today = new Date(now);
  return (
    <ul className="divide-y divide-border">
      {rides.map((r) => (
        <li key={r.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-body-sm font-semibold text-fg">
              {ts.dynamic(`direction.${r.direction}`)}
              {r.petNames.length ? <span className="font-normal text-fg-secondary"> · {r.petNames.join(", ")}</span> : null}
            </p>
            <StatusPill kind="ride" status={r.status} size="sm" />
          </div>
          <p className="text-meta text-fg-secondary">
            {formatDateTime(r.pickupAt, locale, today)}
            {r.driver ? ` · ${t("owner.driver", { name: r.driver.name, plate: r.driver.car.plate })}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ReviewList({ reviews, now }: { reviews: Review[]; now: number }) {
  const t = useT("clients");
  const locale = useLocale();
  const today = new Date(now);
  return (
    <ul className="space-y-3">
      {reviews.slice(0, 3).map((r) => (
        <li key={r.id} className="rounded-card bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-0.5" role="img" aria-label={t("owner.rating", { rating: r.rating })}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} aria-hidden="true" size={14} className={i < r.rating ? "fill-warning text-warning" : "text-control-border"} />
              ))}
            </span>
            <span className="text-meta text-fg-secondary">{formatDate(r.createdAt, locale, today)}</span>
          </div>
          <p className="mt-1 text-body-sm text-fg">{r.text}</p>
          {r.serviceName || r.petName ? <p className="mt-1 text-meta text-fg-secondary">{[r.petName, r.serviceName].filter(Boolean).join(" · ")}</p> : null}
        </li>
      ))}
    </ul>
  );
}
