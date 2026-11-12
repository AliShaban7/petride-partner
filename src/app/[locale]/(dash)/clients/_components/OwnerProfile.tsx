"use client";

import { CalendarPlus, Car, Languages, MapPin, MessageCircle, NotebookPen, PawPrint, Phone, ReceiptText, ShoppingBag, Star, Stethoscope, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { partnerFeatures } from "@/components/shell";
import { Avatar, Button, Card, EmptyState, PageHeader, Panel, StatusPill, TabPanel, Tabs } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import type { Review, Ride } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { LOCALE_NAMES } from "@/lib/i18n/config";
import { formatDate, formatDateLong, formatDateTime, formatMoney, formatNumber, formatPercent, formatPhone, formatRelative, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { BackLink, CallLink, PetLinkRow, ProfileBand, SourcePill, TOUCH_HIT_AREA, type BandFact } from "./bits";
import { OrdersTable, VisitsTable } from "./HistoryTables";
import { SendMessageDialog } from "./MessageDialogs";
import { NewAppointmentDialog } from "./NewAppointmentDialog";
import { NoteEditor } from "./NoteEditor";
import { ProfileError, ProfileSkeleton } from "./ProfileStates";
import { useNow, useOutbox } from "../_lib/stores";
import { useMockParam, useQueryUpdater } from "../_lib/url";

type TabId = "visits" | "orders" | "rides" | "reviews";

const RIDES_STEP = 5;
const REVIEWS_STEP = 3;

/**
 * Owner profile. One band on top (name, contact, source, vaccine status, actions and the key
 * numbers), then two columns on wide screens: history tabs (visits / orders / rides / reviews) on
 * the left, pets and the internal note on the right. Phones: band, pets, history, note.
 *
 * - `variant="page"` (/clients/owners/[id]): back link, the name is the page's h1, the tab lives in
 *   the URL (`?tab=`).
 * - `variant="dialog"` (OwnerProfileDialog over the clients list): the name is an h2 with `titleId`
 *   (the dialog's accessible name), panel headings are h3, the tab is local state, and the
 *   not-found state offers `onClose` instead of a link away from the list.
 */
export function OwnerProfile({ clientId, variant, titleId, onClose }: { clientId: string; variant: "page" | "dialog"; titleId?: string; onClose?: () => void }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const mode = partnerFeatures(session).appointments ? "visits" : "orders";
  const now = useNow();
  const params = useSearchParams();
  const update = useQueryUpdater();
  const linkQuery = useMockParam();
  const backHref = localizedHref(locale, ROUTES.clients, { view: "owners", ...linkQuery });
  const query = useApiQuery(["clients", clientId], (api) => api.getClient(clientId));
  const lastMessage = useOutbox(`client:${clientId}`);
  const [messageKey, setMessageKey] = useState(0);
  const [bookingKey, setBookingKey] = useState(0);
  const [dialogTab, setDialogTab] = useState<string | null>(null);
  const inDialog = variant === "dialog";
  const panelHeading = inDialog ? 3 : 2;

  if (!query.data) {
    if (inDialog) {
      return query.error ? (
        <div className="space-y-section pt-2">
          <h2 id={titleId} className="sr-only">
            {t("meta.ownerTitle")}
          </h2>
          <ProfileError error={query.error} onRetry={query.refetch} backHref={backHref} onBack={onClose} kind="owner" />
        </div>
      ) : (
        <ProfileSkeleton title={t("meta.ownerTitle")} heading="h2" titleId={titleId} />
      );
    }
    return (
      <div className="space-y-2">
        <BackLink href={backHref}>{t("profile.backToOwners")}</BackLink>
        {query.error ? (
          <div className="space-y-section">
            <PageHeader title={t("meta.ownerTitle")} />
            <ProfileError error={query.error} onRetry={query.refetch} backHref={backHref} kind="owner" />
          </div>
        ) : (
          <ProfileSkeleton title={t("meta.ownerTitle")} />
        )}
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
  const canBook = mode === "visits" && pets.length > 0;

  // ---- History tabs ----
  const tabIds: TabId[] = [
    ...(mode === "visits" ? (["visits"] as const) : []),
    ...(mode === "orders" || orders.length ? (["orders"] as const) : []),
    "rides",
    ...(reviews.length ? (["reviews"] as const) : []),
  ];
  const tabParam = inDialog ? dialogTab : params.get("tab");
  const tab: TabId = (tabIds as string[]).includes(tabParam ?? "") ? (tabParam as TabId) : tabIds[0];
  const setTab = (id: string) => (inDialog ? setDialogTab(id) : update({ tab: id === tabIds[0] ? null : id }));
  const ridesTitle = mode === "visits" ? t("owner.ridesTitle") : t("owner.courierTitle");
  const TAB_META: Record<TabId, { label: string; count: number; icon: ReactNode }> = {
    visits: { label: t("owner.visitsTitle"), count: appointments.length, icon: <Stethoscope aria-hidden="true" size={16} className="max-sm:hidden" /> },
    orders: { label: t("owner.ordersTitle"), count: orders.length, icon: <ShoppingBag aria-hidden="true" size={16} className="max-sm:hidden" /> },
    rides: { label: ridesTitle, count: rides.length, icon: <Car aria-hidden="true" size={16} className="max-sm:hidden" /> },
    reviews: { label: t("owner.reviewsTitle"), count: reviews.length, icon: <Star aria-hidden="true" size={16} className="max-sm:hidden" /> },
  };
  const tabs = tabIds.map((id) => ({ id, label: TAB_META[id].label, count: TAB_META[id].count, countTone: "neutral" as const, icon: TAB_META[id].icon }));

  // ---- Key facts ----
  const facts: BandFact[] = [
    {
      id: "visits",
      tone: "mint",
      pet: "golden",
      icon: mode === "visits" ? <Stethoscope size={14} /> : <ShoppingBag size={14} />,
      label: mode === "visits" ? t("owners.visits") : t("owners.orders"),
      value: formatNumber(mode === "visits" ? client.visitsCount : client.ordersCount, locale),
      footnote: client.lastVisitAt
        ? t(mode === "visits" ? "pet.lastVisitValue" : "pet.lastOrderValue", { date: formatDate(client.lastVisitAt, locale, today) })
        : mode === "visits"
          ? t("pet.noVisits")
          : t("owner.noOrders"),
    },
    {
      id: "spent",
      tone: "peach",
      icon: <Wallet size={14} />,
      label: t("owners.spent"),
      value: formatMoney(client.totalSpentAZN, locale, { decimals: 0 }),
      footnote: mode === "visits" && client.ordersCount ? t.plural("owner.withOrders", client.ordersCount) : undefined,
    },
    { id: "average", tone: "lilac", icon: <ReceiptText size={14} />, label: t("owner.averageTicket"), value: tickets ? formatMoney(average, locale, { decimals: 0 }) : "—" },
    {
      id: "rides",
      tone: "sand",
      icon: <Car size={14} />,
      label: mode === "visits" ? t("owner.petrideRides") : t("owner.courierDeliveries"),
      value: formatNumber(mode === "visits" ? client.rideVisits : courierRides, locale),
      footnote: mode === "visits" && client.visitsCount ? t("owner.rideShare", { share: formatPercent(client.rideVisits / client.visitsCount, locale) }) : undefined,
    },
  ];

  // Source and vaccine status ride on the eyebrow's line (no row of their own).
  const eyebrow = (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{client.firstVisitAt ? t("owner.since", { date: formatDateLong(client.firstVisitAt, locale) }) : t("owner.newClient")}</span>
      <SourcePill source={client.source} />
      <StatusPill kind="health" status={client.vaccineAlert} size="sm" />
    </span>
  );

  return (
    <div className="space-y-section">
      <div className="space-y-1">
        {inDialog ? null : <BackLink href={backHref}>{t("profile.backToOwners")}</BackLink>}

        <ProfileBand
          // Dialog: room for the close button that floats over the band's top-right corner.
          reserveCorner={inDialog}
          avatar={<Avatar name={client.fullName} size="lg" className="animate-fade-up" />}
          header={
            inDialog ? (
              <div className="min-w-0">
                <div className="mb-0.5 text-meta font-semibold text-fg-secondary">{eyebrow}</div>
                <h2 id={titleId} className="font-display text-h1 font-extrabold tracking-tight text-fg">
                  {client.fullName}
                </h2>
              </div>
            ) : (
              <PageHeader eyebrow={eyebrow} title={client.fullName} />
            )
          }
          details={
            <>
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" size={14} className="shrink-0" />
                <span className="sr-only">{t("owner.area")}: </span>
                {client.area}
              </span>
              <a href={phoneHref(client.phone)} className={cn("inline-flex items-center gap-1 tabular underline-offset-4 hover:text-fg hover:underline", TOUCH_HIT_AREA)}>
                <Phone aria-hidden="true" size={14} className="shrink-0" />
                <span className="sr-only">{t("owners.phone")}: </span>
                {formatPhone(client.phone)}
              </a>
              <span className="inline-flex items-center gap-1">
                <Languages aria-hidden="true" size={14} className="shrink-0" />
                {t("owner.languageValue", { language: LOCALE_NAMES[client.locale] })}
              </span>
              {lastMessage ? (
                <span className="inline-flex items-center gap-1">
                  <MessageCircle aria-hidden="true" size={14} className="shrink-0" />
                  {t("owner.lastMessage")}: {formatRelative(lastMessage.at, locale, today)}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              {canBook ? (
                <Button leftIcon={<CalendarPlus aria-hidden="true" size={18} />} onClick={() => setBookingKey((k) => k + 1)} className="max-sm:flex-1">
                  {t("owner.newAppointment")}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                leftIcon={<MessageCircle aria-hidden="true" size={18} />}
                onClick={() => setMessageKey((k) => k + 1)}
                className={canBook ? undefined : "max-sm:flex-1"}
              >
                {/* Phones: icon only next to the main action (the name stays for screen readers). */}
                <span className={canBook ? "max-sm:sr-only" : undefined}>{t("owner.sendMessage")}</span>
              </Button>
              <CallLink phone={client.phone} label={tc("actions.call")} compactOnPhone />
            </>
          }
          factsLabel={t("owner.summary")}
          facts={facts}
        />
      </div>

      {/*
        Laid out by the space the page gets (container queries), not the window: at 1024px with the
        sidebar open two columns would squeeze the history table.
         - narrow (phones): pets, history, note stacked.
         - ≥ 36rem: pets | note side by side, the history under them at full width.
         - ≥ 56rem (1280px with the sidebar): history on the left across both rows; pets (row 1) and
           the note (row 2) in a fixed 22rem column on the right, wide enough for the note's hint and
           Save on one line.
      */}
      <div className="@container">
        <div className="grid items-start gap-4 @xl:grid-cols-2 @4xl:grid-cols-[minmax(0,1fr)_22rem] @4xl:grid-rows-[auto_1fr]">
          <Panel title={t.plural("owner.petsCount", pets.length)} headingLevel={panelHeading} icon={<PawPrint size={18} />} className="@xl:col-start-1 @xl:row-start-1 @4xl:col-start-2">
            {pets.length ? (
              <ul className="grid gap-2">
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

          <Card padding="none" className="min-w-0 overflow-hidden @xl:col-span-2 @xl:row-start-2 @4xl:col-span-1 @4xl:col-start-1 @4xl:row-span-2 @4xl:row-start-1">
            <Tabs
              tabs={tabs}
              value={tab}
              onChange={setTab}
              label={t("owner.historyLabel", { name: client.fullName })}
              idPrefix="owner"
              className="px-2 pt-1 sm:px-4"
            />
            <TabPanel idPrefix="owner" value={tab} className="p-4 lg:p-5">
              {tab === "visits" ? (
                appointments.length ? (
                  <VisitsTable rows={appointments} caption={t("owner.visitsCaption", { name: client.fullName })} showPet now={now} />
                ) : (
                  <EmptyState
                    compact
                    pet="golden"
                    title={t("owner.noVisits")}
                    description={t("owner.noVisitsBody")}
                    action={
                      canBook ? (
                        <Button variant="secondary" size="sm" onClick={() => setBookingKey((k) => k + 1)}>
                          {t("owner.newAppointment")}
                        </Button>
                      ) : undefined
                    }
                  />
                )
              ) : null}
              {tab === "orders" ? (
                orders.length ? (
                  <OrdersTable rows={orders} caption={t("orders.caption", { name: client.fullName })} now={now} />
                ) : (
                  <EmptyState compact pet="ginger" title={t("owner.noOrders")} description={t("pet.ordersEmptyBody")} />
                )
              ) : null}
              {tab === "rides" ? (
                rides.length ? <RideList rides={rides} now={now} /> : <p className="text-body-sm text-fg-secondary">{t("owner.noRides")}</p>
              ) : null}
              {tab === "reviews" ? <ReviewList reviews={reviews} now={now} /> : null}
            </TabPanel>
          </Card>

          <Panel title={t("notes.internal")} headingLevel={panelHeading} icon={<NotebookPen size={18} />} className="@xl:col-start-2 @xl:row-start-1 @4xl:row-start-2">
            <NoteEditor
              label={t("notes.internalOwnerLabel", { name: client.firstName })}
              initial={client.partnerNote ?? ""}
              draftKey={`client:${client.id}`}
              save={(api, note) => api.updateClientNote(client.id, note)}
              invalidates={["clients"]}
            />
          </Panel>
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

/** "Show more" for capped history lists (focus stays on the button, the new rows appear above it). */
function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  const tc = useT("common");
  if (shown >= total) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onMore} className="mt-2">
      {tc("actions.showMore")}
    </Button>
  );
}

function RideList({ rides, now }: { rides: Ride[]; now: number }) {
  const t = useT("clients");
  const ts = useT("status");
  const locale = useLocale();
  const today = new Date(now);
  const [limit, setLimit] = useState(RIDES_STEP);
  return (
    <div>
      <ul className="divide-y divide-border">
        {rides.slice(0, limit).map((r) => (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0">
            <div className="min-w-0">
              <p className="text-body-sm font-semibold text-fg">
                {ts.dynamic(`direction.${r.direction}`)}
                {r.petNames.length ? <span className="font-normal text-fg-secondary"> · {r.petNames.join(", ")}</span> : null}
              </p>
              <p className="text-meta text-fg-secondary">
                {formatDateTime(r.pickupAt, locale, today)}
                {r.driver ? ` · ${t("owner.driver", { name: r.driver.name, plate: r.driver.car.plate })}` : ""}
              </p>
            </div>
            <StatusPill kind="ride" status={r.status} size="sm" />
          </li>
        ))}
      </ul>
      <ShowMore shown={Math.min(limit, rides.length)} total={rides.length} onMore={() => setLimit((l) => l + RIDES_STEP)} />
    </div>
  );
}

function ReviewList({ reviews, now }: { reviews: Review[]; now: number }) {
  const t = useT("clients");
  const locale = useLocale();
  const today = new Date(now);
  const [limit, setLimit] = useState(REVIEWS_STEP);
  return (
    <div>
      <ul className="space-y-2">
        {reviews.slice(0, limit).map((r) => (
          <li key={r.id} className="rounded-card bg-surface-muted px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-0.5" role="img" aria-label={t("owner.rating", { rating: r.rating })}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} aria-hidden="true" size={14} className={i < r.rating ? "fill-warning text-warning" : "text-control-border"} />
                ))}
              </span>
              <span className="text-meta text-fg-secondary">
                {[r.petName, r.serviceName].filter(Boolean).join(" · ")}
                {r.petName || r.serviceName ? " · " : ""}
                {formatDate(r.createdAt, locale, today)}
              </span>
            </div>
            <p className="mt-1 text-body-sm text-fg">{r.text}</p>
          </li>
        ))}
      </ul>
      <ShowMore shown={Math.min(limit, reviews.length)} total={reviews.length} onMore={() => setLimit((l) => l + REVIEWS_STEP)} />
    </div>
  );
}
