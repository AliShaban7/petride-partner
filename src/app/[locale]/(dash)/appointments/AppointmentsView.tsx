"use client";

import { CalendarDays, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { CornerPaw } from "@/components/illustrations";
import { partnerFeatures, useShellCounts } from "@/components/shell";
import { AsyncView, Button, ButtonLink, Card, EmptyState, ErrorState, PageHeader, Panel, ResponsiveTable, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, AppointmentQuery, AppointmentStatus } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { formatDate, formatDayLabel, formatDayMonth, formatWeekdayDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { ROUTES, localizedHref } from "@/lib/i18n/navigation";

import { AppointmentDrawer } from "./_components/AppointmentDrawer";
import { AppointmentsList } from "./_components/AppointmentsList";
import { DayChips } from "./_components/DayChips";
import { DaySummary } from "./_components/DaySummary";
import { DayTimeline } from "./_components/DayTimeline";
import { CompleteDialog, NoShowDialog, ReasonDialog, RescheduleDialog } from "./_components/dialogs";
import { NewAppointmentDialog, type NewAppointmentPrefill } from "./_components/NewAppointmentDialog";
import { Toolbar } from "./_components/Toolbar";
import { WeekCalendar } from "./_components/WeekCalendar";
import { HOUR, ceilToQuarter, parseIsoDay, rangeFor, startOfDay, startOfWeek, toIsoDay, weekDays } from "./_lib/time";
import { useAppointmentActions, type ActionKind } from "./_lib/useAppointmentActions";
import { useNow } from "./_lib/useNow";
import { chipStatuses, serviceFilter, useUrlState } from "./_lib/url-state";

type DialogState =
  | { kind: "decline" | "cancel" | "reschedule" | "complete" | "noShow"; appointment: Appointment }
  | { kind: "new"; prefill?: NewAppointmentPrefill }
  | null;

/** Calendar views hide cancelled / declined unless the status filter asks for them. */
const CALENDAR_DEFAULT: AppointmentStatus[] = ["requested", "confirmed", "checked_in", "completed", "no_show"];
const iso = (ms: number | undefined) => (ms === undefined ? undefined : new Date(ms).toISOString());

/** Appointments: requests, list / week / day views, details drawer and every action on a visit. */
export function AppointmentsView() {
  const session = useSession();
  const features = partnerFeatures(session);
  if (!features.appointments) return <NoAppointments />;
  return <Appointments />;
}

function NoAppointments() {
  const t = useT("appointments");
  const locale = useLocale();
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      <Card padding="lg">
        <EmptyState
          pet="tabby"
          title={t("gated.title")}
          description={t("gated.body")}
          action={
            <ButtonLink href={localizedHref(locale, ROUTES.orders)} leftIcon={<ShoppingBag size={18} aria-hidden="true" />}>
              {t("gated.action")}
            </ButtonLink>
          }
        />
      </Card>
    </div>
  );
}

function Appointments() {
  const session = useSession();
  const t = useT("appointments");
  const locale = useLocale();
  const [state, update] = useUrlState();
  const now = useNow();
  const ready = now > 0;
  const today = ready ? startOfDay(now) : 0;
  const anchor = parseIsoDay(state.date) ?? today;
  const weekStart = anchor ? startOfWeek(anchor) : 0;
  const days = weekStart ? weekDays(weekStart) : [];
  const [dialog, setDialog] = useState<DialogState>(null);
  const { requests } = useShellCounts();
  const open = (id: string) => update({ id });
  const actions = useAppointmentActions({ onOpen: open });

  const partner = useApiQuery(["partner"], (api) => api.getPartner());
  const services = useApiQuery(["services"], (api) => api.listServices());
  const hours = partner.data?.hours;
  const categories = session.categories.filter((c): c is Appointment["category"] => c !== "shop");

  // ---- Queries -----------------------------------------------------------------------------------------
  const filters: AppointmentQuery = {
    ...serviceFilter(state.service),
    search: state.q || undefined,
  };
  const range = ready ? rangeFor(state.range, today, { from: state.from, to: state.to }) : {};
  const listQuery: AppointmentQuery = {
    ...filters,
    status: chipStatuses(state.status),
    from: iso(range.from),
    to: iso(range.to),
    sort: state.sort,
    page: state.page,
    pageSize: 20,
  };
  const list = useApiQuery(["appointments", "list", listQuery], (api) => api.listAppointments(listQuery), {
    enabled: ready && state.view === "list",
    refreshMs: 30_000,
  });

  const calendarQuery: AppointmentQuery = {
    ...filters,
    status: state.status.length ? chipStatuses(state.status) : CALENDAR_DEFAULT,
    from: iso(weekStart),
    to: iso(weekStart ? startOfDay(weekStart, 7) : undefined),
    sort: "start_asc",
    pageSize: 200,
  };
  const calendar = useApiQuery(["appointments", "week", calendarQuery], (api) => api.listAppointments(calendarQuery), {
    enabled: ready && state.view !== "list",
    refreshMs: 30_000,
  });
  // React Compiler memoises these derivations (no manual useMemo needed).
  const calendarItems = (calendar.data?.items ?? []).map(actions.merge);
  const dayCounts = new Map(days.map((d) => [d, calendarItems.filter((a) => new Date(a.start).getTime() < startOfDay(d, 1) && new Date(a.end).getTime() > d).length]));

  // A page that no longer exists (a stale ?page= link, or the last row of the last page was just
  // answered and left the filter): move to the last real page instead of an empty "nothing found".
  const listPageCount = list.data && list.data.total > 0 ? list.data.pageCount : undefined;
  const urlPage = state.page;
  useEffect(() => {
    if (listPageCount !== undefined && urlPage > listPageCount) update({ page: listPageCount });
  }, [listPageCount, urlPage, update]);

  // ---- Actions -----------------------------------------------------------------------------------------
  const handleAction = (kind: ActionKind, a: Appointment) => {
    if (kind === "accept") void actions.accept(a);
    else if (kind === "checkIn") void actions.checkIn(a);
    else if (kind === "bookAgain") setDialog({ kind: "new", prefill: { petId: a.petId, serviceId: a.serviceId } });
    else setDialog({ kind, appointment: a });
  };
  const closeDialog = () => setDialog(null);
  const goDay = (day: number) => update({ date: day === today ? undefined : toIsoDay(day) });

  // ---- Headings ----------------------------------------------------------------------------------------
  const todayDate = ready ? new Date(now) : undefined;
  let heading = t("title");
  let subheading: string | undefined;
  if (ready) {
    if (state.view === "list") {
      heading =
        state.range === "custom"
          ? [state.from, state.to].filter(Boolean).sort().map((d) => formatDate(d as string, locale, todayDate)).join(" – ") || t("range.custom")
          : t.dynamic(`range.${state.range}`);
      subheading = list.data ? t.plural("results", list.data.total) : undefined;
    } else if (state.view === "week") {
      heading = `${formatDayMonth(days[0], locale)} – ${formatDayMonth(days[6], locale)}`;
      subheading = calendar.data ? t.plural("results", calendar.data.total) : undefined;
    } else {
      const label = formatDayLabel(anchor, locale, todayDate);
      heading = label === formatDate(anchor, locale, todayDate) ? formatWeekdayDate(anchor, locale) : `${label} · ${formatWeekdayDate(anchor, locale)}`;
      subheading = calendar.data ? t.plural("results", dayCounts.get(anchor) ?? 0) : undefined;
    }
  }

  const hiddenNote = state.status.length ? undefined : t("calendar.hiddenCancelled");
  const filtered = Boolean(state.status.length || state.service || state.q);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        eyebrow={ready ? formatWeekdayDate(now, locale) : undefined}
        description={t("description")}
        actions={
          <Button leftIcon={<Plus size={18} aria-hidden="true" />} onClick={() => setDialog({ kind: "new" })} disabled={!ready}>
            {t("newAppointment")}
          </Button>
        }
      />

      {requests > 0 && !(state.status.length === 1 && state.status[0] === "requested") ? (
        <Card tone="softPeach" padding="sm" className="group flex animate-fade-up flex-wrap items-center justify-between gap-3 overflow-hidden pr-24">
          <p className="font-semibold text-fg">{t.plural("pendingBanner.text", requests)}</p>
          <Button variant="accent" size="sm" className="relative z-10" onClick={() => update({ status: ["requested"], view: "list", range: undefined, page: 1 })}>
            {t("pendingBanner.action")}
          </Button>
          <CornerPaw pet="ginger" width={44} reach={48} />
        </Card>
      ) : null}

      <Toolbar state={state} update={update} anchor={anchor} today={today} services={services.data} requests={requests} categories={categories} />

      <Panel
        title={heading}
        description={subheading}
        icon={<CalendarDays size={20} />}
        className="max-sm:px-3 max-sm:py-4"
        aria-busy={list.isRefreshing || calendar.isRefreshing || undefined}
      >
        {state.view === "list" ? (
          !ready ? (
            <ListSkeleton />
          ) : (
            <AsyncView
              query={list}
              loading={<ListSkeleton />}
              empty={
                <EmptyState
                  pet="golden"
                  title={filtered ? t("list.noResultsTitle") : t("list.emptyTitle")}
                  description={filtered ? t("list.noResultsBody") : t("list.emptyBody")}
                  action={
                    filtered ? (
                      <Button variant="secondary" onClick={() => update({ status: [], service: "", q: "" })}>
                        {t("list.clearFilters")}
                      </Button>
                    ) : (
                      <Button variant="secondary" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setDialog({ kind: "new" })}>
                        {t("newAppointment")}
                      </Button>
                    )
                  }
                />
              }
            >
              {(data) => (
                <AppointmentsList
                  data={data}
                  merge={actions.merge}
                  isPending={actions.isPending}
                  now={now}
                  selectedId={state.id}
                  sort={state.sort}
                  onSortChange={(sort) => update({ sort })}
                  onPageChange={(page) => update({ page })}
                  onOpen={open}
                  onAction={handleAction}
                />
              )}
            </AsyncView>
          )
        ) : calendar.error && !calendar.data ? (
          <ErrorState error={calendar.error} onRetry={calendar.refetch} />
        ) : (
          <>
            {state.view === "week" ? (
              <div className="hidden sm:block">
                {calendar.data && calendar.data.total === 0 ? (
                  <p className="mb-3 rounded-card bg-surface-muted px-4 py-3 text-body-sm text-fg">{filtered ? t("list.noResultsBody") : t("calendar.emptyWeek")}</p>
                ) : null}
                <WeekCalendar
                  days={days}
                  appointments={calendarItems}
                  now={now}
                  hours={hours}
                  loading={!calendar.data}
                  onOpen={open}
                  onCreateAt={(start) => setDialog({ kind: "new", prefill: { start } })}
                />
                {hiddenNote ? <p className="mt-2 text-meta text-fg-secondary">{hiddenNote}</p> : null}
              </div>
            ) : null}
            <div className={state.view === "week" ? "space-y-4 sm:hidden" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]"}>
              <div className="min-w-0 space-y-4">
                {days.length ? (
                  <DayChips
                    days={days}
                    selected={anchor}
                    today={today}
                    counts={calendar.data ? dayCounts : undefined}
                    onSelect={goDay}
                    onWeek={(dir) => goDay(startOfWeek(anchor, dir))}
                  />
                ) : null}
                <DayTimeline
                  day={anchor}
                  appointments={calendarItems}
                  now={now}
                  hours={hours}
                  loading={!calendar.data}
                  isPending={actions.isPending}
                  onOpen={open}
                  onAction={handleAction}
                  onCreate={() => setDialog({ kind: "new", prefill: { start: anchor < today ? anchor + 10 * HOUR : Math.max(anchor + 10 * HOUR, ceilToQuarter(now)) } })}
                  onSwipe={(dir) => goDay(startOfDay(anchor, dir))}
                  footnote={hiddenNote}
                />
              </div>
              {state.view === "day" && calendar.data ? <DaySummary day={anchor} appointments={calendarItems} partner={partner.data} onOpen={open} /> : null}
            </div>
          </>
        )}
      </Panel>

      <AppointmentDrawer id={state.id} now={now} actions={actions} onClose={() => update({ id: undefined })} onAction={handleAction} />

      {dialog?.kind === "decline" || dialog?.kind === "cancel" ? (
        <ReasonDialog
          kind={dialog.kind}
          appointment={dialog.appointment}
          onClose={closeDialog}
          onConfirm={(reason) => {
            closeDialog();
            void (dialog.kind === "decline" ? actions.decline(dialog.appointment, reason) : actions.cancel(dialog.appointment, reason));
          }}
        />
      ) : null}
      {dialog?.kind === "noShow" ? (
        <NoShowDialog
          appointment={dialog.appointment}
          onClose={closeDialog}
          onConfirm={() => {
            closeDialog();
            void actions.noShow(dialog.appointment);
          }}
        />
      ) : null}
      {dialog?.kind === "complete" ? (
        <CompleteDialog
          appointment={dialog.appointment}
          onClose={closeDialog}
          onConfirm={(amount, note) => {
            closeDialog();
            void actions.complete(dialog.appointment, amount, note);
          }}
        />
      ) : null}
      {dialog?.kind === "reschedule" ? (
        <RescheduleDialog
          appointment={dialog.appointment}
          hours={hours}
          now={now}
          onClose={closeDialog}
          onConfirm={(start) => {
            closeDialog();
            void actions.reschedule(dialog.appointment, start);
          }}
        />
      ) : null}
      {dialog?.kind === "new" && ready ? (
        <NewAppointmentDialog prefill={dialog.prefill} hours={hours} now={now} onClose={closeDialog} onCreate={actions.create} />
      ) : null}
    </div>
  );
}

/** Table-shaped placeholder (same columns as the list) while the first page loads. */
function ListSkeleton() {
  const t = useT("appointments");
  const columns: Column<Appointment>[] = ["when", "pet", "service", "status", "actions"].map((id) => ({ id, header: t.dynamic(`table.${id}`), cell: () => null }));
  return <ResponsiveTable caption={t("table.caption")} columns={columns} rows={[]} getRowId={(a) => a.id} loading skeletonRows={8} />;
}
