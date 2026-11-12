"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { partnerFeatures, useShellCounts } from "@/components/shell";
import { AsyncView, Button, ButtonLink, Card, EmptyState, ErrorState, IconButton, PageHeader, ResponsiveTable, type Column } from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, AppointmentQuery, AppointmentStatus } from "@/lib/api/types";
import { useSession } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
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
import { Toolbar, ViewSwitch } from "./_components/Toolbar";
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
const HEADING_ID = "appointments-heading";

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
    <div className="space-y-section">
      <PageHeader title={t("title")} />
      <Card padding="md">
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
    // 12 rows a page, like every other list (clients, orders, products, rides): a page fits a laptop screen.
    pageSize: 12,
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
  // One h2 for the section, in the toolbar row: the range (list), the week or the day, plus the count.
  const todayDate = ready ? new Date(now) : undefined;
  let headingText = t("title");
  let count: number | undefined;
  if (ready) {
    if (state.view === "list") {
      headingText =
        state.range === "custom"
          ? [state.from, state.to].filter(Boolean).sort().map((d) => formatDate(d as string, locale, todayDate)).join(" – ") || t("range.custom")
          : t.dynamic(`range.${state.range}`);
      count = list.data?.total;
    } else if (state.view === "week") {
      headingText = `${formatDayMonth(days[0], locale)} – ${formatDayMonth(days[6], locale)}`;
      count = calendar.data ? calendar.data.total : undefined;
    } else {
      // No count here: the day strip and the summary tiles already show it.
      const label = formatDayLabel(anchor, locale, todayDate);
      headingText = label === formatDate(anchor, locale, todayDate) ? formatWeekdayDate(anchor, locale) : `${label} · ${formatWeekdayDate(anchor, locale)}`;
    }
  }
  const countText =
    count === undefined ? null : (
      <span className={cn("whitespace-nowrap font-sans font-semibold text-fg-secondary", state.view === "list" ? "text-body-sm" : "text-meta")}>
        <span className="sr-only">, </span>
        {t.plural("results", count)}
      </span>
    );
  const heading = (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {/* In the list the period select shows the range from 640px: there only the count stays visible. */}
      <span className={cn(state.view === "list" && count !== undefined && "sm:sr-only")}>{headingText}</span>
      {countText}
    </span>
  );

  const hiddenNote = state.status.length ? undefined : t("calendar.hiddenCancelled");
  const filtered = Boolean(state.status.length || state.service || state.q);

  return (
    <div className="space-y-section">
      {/* No description and no "N requests waiting" banner: the top bar and the Requests chip already show the count. */}
      <PageHeader
        title={t("title")}
        eyebrow={ready ? formatWeekdayDate(now, locale) : undefined}
        actions={
          <>
            <ViewSwitch value={state.view} onChange={(view) => update({ view })} />
            <Button className="max-sm:hidden" leftIcon={<Plus size={18} aria-hidden="true" />} onClick={() => setDialog({ kind: "new" })} disabled={!ready}>
              {t("newAppointment")}
            </Button>
            <IconButton className="sm:hidden" variant="primary" label={t("newAppointment")} icon={<Plus size={20} />} onClick={() => setDialog({ kind: "new" })} disabled={!ready} />
          </>
        }
      />

      <section aria-labelledby={HEADING_ID} aria-busy={list.isRefreshing || calendar.isRefreshing || undefined} className="relative min-w-0 rounded-panel bg-surface shadow-card">
        <Toolbar
          state={state}
          update={update}
          anchor={anchor}
          today={today}
          services={services.data}
          requests={requests}
          categories={categories}
          heading={heading}
          headingId={HEADING_ID}
        />
        <div className="min-w-0 p-3 sm:p-4 lg:px-5 lg:pb-5">
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
                  <WeekCalendar
                    notice={calendar.data && calendar.data.total === 0 ? (filtered ? t("list.noResultsBody") : t("calendar.emptyWeek")) : undefined}
                    days={days}
                    appointments={calendarItems}
                    now={now}
                    hours={hours}
                    loading={!calendar.data}
                    onOpen={open}
                    onCreateAt={(start) => setDialog({ kind: "new", prefill: { start } })}
                    footnote={hiddenNote}
                  />
                </div>
              ) : null}
              <div className={state.view === "week" ? "space-y-3 sm:hidden" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]"}>
                <div className="min-w-0 space-y-3">
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
                    // Desktop day view: the day scrolls inside its own box (the page fits the screen), next to the summary.
                    // The bottom edge fades out over the box's own padding, a hint that more is below.
                    className={
                      state.view === "day"
                        ? "lg:-mx-1 lg:max-h-[max(22rem,calc(100dvh-27rem))] lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:pb-6 lg:pt-1 lg:[mask-image:linear-gradient(to_bottom,var(--color-fg)_calc(100%-1.5rem),transparent)]"
                        : undefined
                    }
                  />
                </div>
                {state.view === "day" && calendar.data ? <DaySummary day={anchor} today={today} appointments={calendarItems} partner={partner.data} onOpen={open} /> : null}
              </div>
            </>
          )}
        </div>
      </section>

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
