"use client";

import {
  BellRing,
  Cake,
  CalendarClock,
  CalendarPlus,
  Car,
  ClipboardList,
  FileText,
  HeartPulse,
  Mars,
  Microchip,
  NotebookPen,
  ShoppingBag,
  Stethoscope,
  Syringe,
  UserRound,
  Venus,
  Wallet,
  Weight,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { partnerFeatures } from "@/components/shell";
import {
  AsyncView,
  Avatar,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Panel,
  SkeletonRows,
  TabPanel,
  Tabs,
  Tag,
} from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, ClientDetail, Pet } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { formatAge, formatDate, formatDateLong, formatDayLabel, formatMoney, formatNumber, formatPhone, formatRelative, formatTime, formatWeight, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { BackLink, CallLink, PetLinkRow, ProfileBand, type BandFact } from "../../_components/bits";
import { FilesPanel } from "../../_components/FilesPanel";
import { OrdersTable, VisitsTable } from "../../_components/HistoryTables";
import { ReminderDialog } from "../../_components/MessageDialogs";
import { NewAppointmentDialog } from "../../_components/NewAppointmentDialog";
import { NoteEditor } from "../../_components/NoteEditor";
import { PetAvatar } from "../../_components/PetAvatar";
import { ProfileError, ProfileSkeleton } from "../../_components/ProfileStates";
import { VaccinesTable, sortVaccines } from "../../_components/VaccinesTable";
import { pawFor } from "../../_lib/look";
import { useNow, useOutbox } from "../../_lib/stores";
import { useMockParam, useQueryUpdater } from "../../_lib/url";

type TabId = "visits" | "orders" | "health" | "notes" | "files";

/**
 * Pet profile: one band with the header (breed, sex, age, weight, microchip on one wrapping line),
 * actions and key facts; then the tabs (Visits or Orders for shops / Health / Notes / Files) on the
 * left and the owner on the right on desktop.
 */
export function PetProfileView({ petId }: { petId: string }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const mode = partnerFeatures(session).appointments ? "visits" : "orders";
  const now = useNow();
  const params = useSearchParams();
  const update = useQueryUpdater();
  const linkQuery = useMockParam();
  const backHref = localizedHref(locale, ROUTES.clients, linkQuery);

  const petQ = useApiQuery(["pets", petId], (api) => api.getPet(petId));
  const pet = petQ.data;
  const ownerId = pet?.ownerId ?? null;
  const ownerQ = useApiQuery(["clients", ownerId], (api) => api.getClient(ownerId ?? ""), { enabled: Boolean(ownerId) });
  const visitsQ = useApiQuery(["appointments", "pet", petId], (api) => api.listAppointments({ petId, sort: "start_desc", pageSize: 200 }), {
    enabled: mode === "visits",
  });
  const partnerQ = useApiQuery(["partner"], (api) => api.getPartner());

  const tabIds: TabId[] = [mode === "visits" ? "visits" : "orders", "health", "notes", "files"];
  const tabParam = params.get("tab");
  const tab: TabId = (tabIds as string[]).includes(tabParam ?? "") ? (tabParam as TabId) : tabIds[0];

  const [reminderKey, setReminderKey] = useState(0);
  const [bookingKey, setBookingKey] = useState(0);
  const lastReminder = useOutbox(`pet:${petId}`);

  if (!pet) {
    return (
      <div className="space-y-2">
        <BackLink href={backHref}>{t("profile.backToClients")}</BackLink>
        {petQ.error ? (
          <div className="space-y-section">
            <PageHeader title={t("meta.petTitle")} />
            <ProfileError error={petQ.error} onRetry={petQ.refetch} backHref={backHref} kind="pet" />
          </div>
        ) : (
          <ProfileSkeleton title={t("meta.petTitle")} />
        )}
      </div>
    );
  }

  const today = new Date(now);
  const visits = visitsQ.data?.items ?? [];
  const completed = visits.filter((a) => a.status === "completed");
  const spent = completed.reduce((sum, a) => sum + (a.amountAZN ?? 0), 0);
  const rides = completed.filter((a) => a.withRide).length;
  const dueVaccines = sortVaccines(pet.vaccines.filter((v) => v.status === "overdue" || v.status === "due_soon"));
  // Most urgent vaccine: the first overdue / due-soon one, otherwise the next dose coming up.
  const nextVaccine = dueVaccines[0] ?? [...pet.vaccines].sort((a, b) => (a.nextDate ?? a.dueDate).localeCompare(b.nextDate ?? b.dueDate))[0];
  const owner = ownerQ.data?.client;
  const offerRide = mode === "visits" && Boolean(partnerQ.data?.acceptsRides);
  const ownerHref = localizedHref(locale, `${ROUTES.clients}/owners/${pet.ownerId}`, linkQuery);
  const healthTone = pet.healthStatus === "overdue" ? "peach" : pet.healthStatus === "due_soon" ? "sand" : "mint";

  const tabs = tabIds.map((id) => ({
    id,
    label: t.dynamic(`petTabs.${id}`),
    count: id === "health" ? dueVaccines.length : undefined,
    icon:
      id === "visits" ? (
        <Stethoscope aria-hidden="true" size={16} className="hidden sm:block" />
      ) : id === "orders" ? (
        <ShoppingBag aria-hidden="true" size={16} className="hidden sm:block" />
      ) : id === "health" ? (
        <Syringe aria-hidden="true" size={16} className="hidden sm:block" />
      ) : id === "notes" ? (
        <NotebookPen aria-hidden="true" size={16} className="hidden sm:block" />
      ) : (
        <FileText aria-hidden="true" size={16} className="hidden sm:block" />
      ),
  }));

  const openReminder = () => setReminderKey((k) => k + 1);
  const openBooking = () => setBookingKey((k) => k + 1);

  const facts: BandFact[] = [
    {
      id: "vaccines",
      tone: healthTone,
      pet: pawFor(pet),
      icon: <HeartPulse size={14} />,
      label: t("pet.vaccines"),
      value: t.dynamic(`healthShort.${pet.healthStatus}`),
      footnote: nextVaccine ? `${nextVaccine.name} · ${formatDate(nextVaccine.nextDate ?? nextVaccine.dueDate, locale, today)}` : t("health.allGood"),
    },
    ...(mode === "visits"
      ? ([
          {
            id: "next",
            tone: "lilac",
            icon: <CalendarClock size={14} />,
            label: t("pet.next"),
            value: pet.nextAppointment ? formatDayLabel(pet.nextAppointment.start, locale, today) : "—",
            footnote: pet.nextAppointment ? `${formatTime(pet.nextAppointment.start)} · ${pet.nextAppointment.serviceName}` : t("pet.noNext"),
          },
          {
            id: "visits",
            tone: "sky",
            icon: <ClipboardList size={14} />,
            label: t("pet.visitsLabel"),
            value: formatNumber(pet.visitsCount, locale),
            footnote: pet.lastVisitAt ? t("pet.lastVisitValue", { date: formatDate(pet.lastVisitAt, locale, today) }) : t("pet.noVisits"),
          },
          {
            id: "spent",
            tone: "sand",
            icon: <Wallet size={14} />,
            label: t("pet.spent"),
            value: visitsQ.data ? formatMoney(spent, locale, { decimals: 0 }) : "…",
            footnote: visitsQ.data ? (rides ? t.plural("pet.ridesFootnote", rides) : t("pet.noRides")) : undefined,
          },
        ] satisfies BandFact[])
      : ([
          { id: "age", tone: "lilac", icon: <Cake size={14} />, label: t("pet.age"), value: formatAge(pet.birthDate, locale, today), footnote: formatDateLong(pet.birthDate, locale) },
          { id: "weight", tone: "sky", icon: <Weight size={14} />, label: t("pet.weight"), value: formatWeight(pet.weightKg, locale), footnote: tc.dynamic(`size.${pet.size}`) },
          {
            id: "orders",
            tone: "sand",
            icon: <ShoppingBag size={14} />,
            label: t("owners.orders"),
            value: owner ? formatNumber(owner.ordersCount, locale) : "…",
            footnote: owner ? t("pet.ordersByOwner", { name: owner.fullName }) : undefined,
          },
        ] satisfies BandFact[])),
  ];
  // Phones: the first action keeps its text, the others become icon buttons (names stay for screen readers).
  const remindFirst = dueVaccines.length > 0;

  return (
    <div className="space-y-section">
      <div className="space-y-1">
        <BackLink href={backHref}>{t("profile.backToClients")}</BackLink>

        <ProfileBand
          avatar={<PetAvatar name={pet.name} species={pet.species} tint={pet.tint} photoUrl={pet.photoUrl} size="md" className="animate-fade-up" />}
          header={
            <PageHeader
              eyebrow={`${pet.code} · ${tc.dynamic(`species.${pet.species}`)}`}
              title={pet.name}
            />
          }
          details={
            // Everything about the pet the band's cells don't show (shops have age and weight there).
            <>
              <span>{pet.breed}</span>
              <span className="inline-flex items-center gap-1">
                {pet.sex === "f" ? <Venus aria-hidden="true" size={14} className="shrink-0" /> : <Mars aria-hidden="true" size={14} className="shrink-0" />}
                <span className="sr-only">{t("pet.sexLabel")}: </span>
                {tc.dynamic(`sex.${pet.sex}`)}, {pet.neutered ? t("pet.neutered") : t("pet.notNeutered")}
              </span>
              {mode === "visits" ? (
                <>
                  <span className="inline-flex items-center gap-1">
                    <Cake aria-hidden="true" size={14} className="shrink-0" />
                    <span className="sr-only">{t("pet.age")}: </span>
                    {formatAge(pet.birthDate, locale, today)} ({formatDateLong(pet.birthDate, locale)})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Weight aria-hidden="true" size={14} className="shrink-0" />
                    <span className="sr-only">{t("pet.weightSize")}: </span>
                    {formatWeight(pet.weightKg, locale)} · {tc.dynamic(`size.${pet.size}`)}
                  </span>
                </>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Microchip aria-hidden="true" size={14} className="shrink-0" />
                {t("pet.microchip")}: <span className="tabular">{pet.microchip ?? t("pet.noMicrochip")}</span>
              </span>
            </>
          }
          actions={
            <>
              {remindFirst ? (
                <Button variant="accent" leftIcon={<BellRing aria-hidden="true" size={18} />} onClick={openReminder} className="max-sm:flex-1">
                  {t("pet.remind")}
                </Button>
              ) : null}
              {mode === "visits" ? (
                <Button
                  variant={remindFirst ? "secondary" : "primary"}
                  leftIcon={<CalendarPlus aria-hidden="true" size={18} />}
                  onClick={openBooking}
                  disabled={!ownerQ.data}
                  className={remindFirst ? undefined : "max-sm:flex-1"}
                >
                  <span className={remindFirst ? "max-sm:sr-only" : undefined}>{t("owner.newAppointment")}</span>
                </Button>
              ) : null}
              {owner ? <CallLink phone={owner.phone} label={t("pet.callOwner")} compactOnPhone={remindFirst || mode === "visits"} /> : null}
            </>
          }
          factsLabel={t("pet.keyFacts")}
          facts={facts}
        />
      </div>

      {/* Two columns once the page area is ≥ 56rem (container query: at 1024px with the sidebar open they'd squeeze the tables). */}
      <div className="@container">
        <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* ---- Tabs ---- */}
          <Card padding="none" className="min-w-0 overflow-hidden">
            <Tabs tabs={tabs} value={tab} onChange={(id) => update({ tab: id === tabIds[0] ? null : id })} label={t("petTabs.label", { pet: pet.shortName })} idPrefix="pet" className="px-2 pt-1 sm:px-4" />
            <TabPanel idPrefix="pet" value={tab} className="p-4 lg:p-5">
              {tab === "visits" ? (
                <AsyncView
                  query={visitsQ}
                  loading={<SkeletonRows rows={5} />}
                  compact
                  empty={
                    <EmptyState
                      compact
                      pet={pawFor(pet)}
                      title={t("visits.emptyTitle")}
                      description={t("visits.emptyBody", { pet: pet.shortName })}
                      action={
                        <Button variant="secondary" size="sm" onClick={openBooking} disabled={!ownerQ.data}>
                          {t("owner.newAppointment")}
                        </Button>
                      }
                    />
                  }
                >
                  {(data) => <VisitsTable rows={data.items} caption={t("visits.caption", { pet: pet.shortName })} now={now} />}
                </AsyncView>
              ) : null}

              {tab === "orders" ? (
                <AsyncView
                  query={ownerQ}
                  loading={<SkeletonRows rows={5} />}
                  compact
                  isEmpty={(d) => d.orders.length === 0}
                  empty={<EmptyState compact pet={pawFor(pet)} title={t("owner.noOrders")} description={t("pet.ordersEmptyBody")} />}
                >
                  {/* The band's Orders cell already says they're under the owner's name. */}
                  {(d) => <OrdersTable rows={d.orders} caption={t("orders.caption", { name: d.client.fullName })} now={now} />}
                </AsyncView>
              ) : null}

              {tab === "health" ? (
                // The band already shows the status, the tab badge the number due and the band's
                // "Remind" button the action; the table's statuses say which ones.
                <div className="space-y-3">
                  {lastReminder ? (
                    <p className="inline-flex items-center gap-1.5 text-meta text-fg-secondary">
                      <BellRing aria-hidden="true" size={14} className="shrink-0" />
                      {t("health.lastReminder", { when: formatRelative(lastReminder.at, locale, today), name: lastReminder.to })}
                    </p>
                  ) : null}
                  {pet.vaccines.length ? (
                    <VaccinesTable vaccines={pet.vaccines} now={now} caption={t("health.caption", { pet: pet.shortName })} />
                  ) : (
                    <EmptyState compact pet={pawFor(pet)} title={t("health.emptyTitle")} description={t("health.emptyBody")} />
                  )}
                  <p className="text-meta text-fg-secondary">{t("health.source")}</p>
                </div>
              ) : null}

              {tab === "notes" ? <NotesTab pet={pet} visits={visits} detail={ownerQ.data} loading={!ownerQ.data && !ownerQ.error} now={now} /> : null}

              {tab === "files" ? <FilesPanel petId={pet.id} petName={pet.shortName} /> : null}
            </TabPanel>
          </Card>

          {/* ---- Side: the owner (the pet's own details are in the band) ---- */}
          <OwnerPanel detail={ownerQ.data} ownerError={ownerQ.error} onRetry={ownerQ.refetch} pet={pet} ownerHref={ownerHref} now={now} linkQuery={linkQuery} />
        </div>
      </div>

      {reminderKey > 0 ? (
        <ReminderDialog
          key={reminderKey}
          open
          onClose={() => setReminderKey(0)}
          pet={pet}
          owner={owner}
          partnerName={session.partnerShortName}
          offerRide={offerRide}
        />
      ) : null}
      {bookingKey > 0 && ownerQ.data ? (
        <NewAppointmentDialog key={bookingKey} open onClose={() => setBookingKey(0)} pets={ownerQ.data.pets} defaultPetId={pet.id} />
      ) : null}
    </div>
  );
}

function OwnerPanel({
  detail,
  ownerError,
  onRetry,
  pet,
  ownerHref,
  now,
  linkQuery,
}: {
  detail: ClientDetail | undefined;
  ownerError: Error | undefined;
  onRetry: () => void;
  pet: Pet;
  ownerHref: string;
  now: number;
  linkQuery: Record<string, string>;
}) {
  const t = useT("clients");
  const locale = useLocale();
  const others = detail?.pets.filter((p) => p.id !== pet.id) ?? [];
  return (
    <Panel
      title={t("pet.owner")}
      icon={<UserRound size={18} />}
      actions={
        <Link href={ownerHref} className="inline-flex min-h-11 items-center text-body-sm font-semibold text-primary underline-offset-4 hover:underline lg:min-h-9">
          {t("pet.ownerProfile")}
        </Link>
      }
    >
      {detail ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={detail.client.fullName} size="md" />
            <div className="min-w-0">
              <Link href={ownerHref} className="block truncate font-semibold text-fg underline-offset-4 hover:underline">
                {detail.client.fullName}
              </Link>
              <p className="text-body-sm text-fg-secondary">
                <a href={phoneHref(detail.client.phone)} className="tabular underline-offset-4 hover:underline">
                  {formatPhone(detail.client.phone)}
                </a>
                {" · "}
                {detail.client.area}
              </p>
            </div>
          </div>
          {others.length ? (
            <div className="space-y-2">
              <p className="text-meta font-semibold text-fg-secondary">{t("pet.otherPets")}</p>
              <ul className="space-y-2">
                {others.map((p) => (
                  <li key={p.id}>
                    <PetLinkRow pet={p} href={localizedHref(locale, `${ROUTES.clients}/pets/${p.id}`, linkQuery)} now={now} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : ownerError ? (
        <div className="space-y-2">
          <p className="text-body-sm text-fg-secondary">{pet.ownerName}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t("profile.retryOwner")}
          </Button>
        </div>
      ) : (
        <SkeletonRows rows={2} />
      )}
    </Panel>
  );
}

function NotesTab({ pet, visits, detail, loading, now }: { pet: Pet; visits: Appointment[]; detail: ClientDetail | undefined; loading: boolean; now: number }) {
  const t = useT("clients");
  const locale = useLocale();
  const today = new Date(now);
  const bookingNotes = visits.filter((a) => a.clientNote).map((a) => ({ id: a.id, at: a.start, title: a.serviceName, text: a.clientNote ?? "" }));
  const rideNotes = (detail?.rides ?? [])
    .filter((r) => r.petIds.includes(pet.id) && r.driverNote)
    .map((r) => ({ id: r.id, at: r.pickupAt, title: t("notes.rideNote"), text: r.driverNote ?? "" }));
  const appNotes = [...bookingNotes, ...rideNotes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const staffNotes = visits.filter((a) => a.staffNote).slice(0, 12);
  return (
    <div className="space-y-4">
      <section aria-labelledby="notes-app" className="space-y-2">
        <h2 id="notes-app" className="font-display text-title font-extrabold">
          {t("notes.fromApp")}
        </h2>
        <div>
          <p className="mb-1.5 text-meta font-semibold text-fg-secondary">{t("notes.travel")}</p>
          {pet.travelNotes.length ? (
            <ul className="flex flex-wrap gap-2">
              {pet.travelNotes.map((n) => (
                <li key={n}>
                  <Tag tone="warning" icon={<Car aria-hidden="true" size={12} />}>
                    {n}
                  </Tag>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-fg-secondary">{t("notes.noTravel")}</p>
          )}
        </div>
        {loading ? (
          <SkeletonRows rows={2} />
        ) : appNotes.length ? (
          <ul className="space-y-2">
            {appNotes.map((n) => (
              <li key={n.id} className="rounded-card bg-surface-muted px-3.5 py-2.5">
                <p className="text-meta text-fg-secondary">
                  {n.title} · {formatDate(n.at, locale, today)}
                </p>
                <blockquote className="mt-1 border-l-2 border-primary/40 pl-3 text-body-sm text-fg">{n.text}</blockquote>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-fg-secondary">{t("notes.noAppNotes")}</p>
        )}
      </section>

      <section aria-labelledby="notes-internal" className="space-y-2 border-t border-border pt-4">
        <h2 id="notes-internal" className="font-display text-title font-extrabold">
          {t("notes.internal")}
        </h2>
        <NoteEditor
          label={t("notes.internalLabel", { pet: pet.shortName })}
          initial={pet.partnerNote ?? ""}
          save={(api, note) => api.updatePetNote(pet.id, note)}
          invalidates={["pets"]}
        />
      </section>

      {staffNotes.length ? (
        <section aria-labelledby="notes-visits" className="space-y-2 border-t border-border pt-4">
          <h2 id="notes-visits" className="font-display text-title font-extrabold">
            {t("notes.visitNotes")}
          </h2>
          <ul className="space-y-2">
            {staffNotes.map((a) => (
              <li key={a.id} className="rounded-card border border-border px-3.5 py-2.5">
                <p className="text-meta text-fg-secondary">
                  {a.serviceName} · {formatDate(a.start, locale, today)}
                </p>
                <p className="mt-0.5 text-body-sm text-fg">{a.staffNote}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
