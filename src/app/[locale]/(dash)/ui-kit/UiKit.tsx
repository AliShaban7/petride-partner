"use client";

// Design-system reference for page builders (/[locale]/ui-kit). Not linked from the nav.
// Strings here are intentionally English-only developer labels; real pages must use t().

import { Banknote, CalendarDays, Car, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import { PAW_PETS, PawArt, PeekingPaws } from "@/components/illustrations";
import {
  AsyncView,
  Avatar,
  Button,
  CHART_COLORS,
  ChartCard,
  ChartTooltipContent,
  Checkbox,
  ConfirmDialog,
  DateInput,
  Drawer,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  KpiCard,
  Menu,
  PageHeader,
  Pagination,
  Panel,
  ResponsiveTable,
  SearchField,
  SegmentedControl,
  Select,
  StatusPill,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
  chartAxisProps,
  chartGridProps,
  useToast,
  type Column,
} from "@/components/ui";
import { useApiQuery } from "@/lib/api/hooks";
import type { Appointment, StatsPeriod } from "@/lib/api/types";
import { formatDayMonth, formatMoney, formatNumber, formatTime, formatWeekdayShort } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

export function UiKit() {
  const locale = useLocale();
  const tc = useT("common");
  const { toast } = useToast();
  const [period, setPeriod] = useState<StatsPeriod>("7d");
  const [tab, setTab] = useState("table");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<Appointment | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(false);

  const kpis = useApiQuery(["stats", "kpis", period], (api) => api.getKpis(period));
  const daily = useApiQuery(["stats", "daily", period], (api) => api.getDailySeries(period));
  const appts = useApiQuery(["appointments", "kit", page, search], (api) => api.listAppointments({ page, pageSize: 8, search, sort: "start_desc" }));

  const columns: Column<Appointment>[] = [
    { id: "pet", header: "Pet", rowHeader: true, sortable: true, sortValue: (a) => a.petName, cell: (a) => (
      <span className="inline-flex items-center gap-2.5"><Avatar name={a.petName} tint={a.petTint} species={a.petSpecies} size="xs" />{a.petName}</span>
    ) },
    { id: "client", header: "Client", sortable: true, sortValue: (a) => a.clientName, cell: (a) => a.clientName, mobile: "subtitle" },
    { id: "service", header: "Service", cell: (a) => a.serviceName },
    { id: "when", header: "When", sortable: true, sortValue: (a) => a.start, cell: (a) => `${formatDayMonth(a.start, locale)}, ${formatTime(a.start)}` },
    { id: "ride", header: "Ride", cell: (a) => (a.ride ? <StatusPill kind="ride" status={a.ride.status} size="sm" /> : "—"), className: "hidden lg:table-cell" },
    { id: "status", header: "Status", cell: (a) => <StatusPill kind="appointment" status={a.status} size="sm" />, mobile: "badge" },
  ];

  const deltaLabel = tc(`delta.vs_${period}`);

  return (
    <div className="space-y-8">
      <PageHeader size="hero" eyebrow="PetRide Partner · design system" title="Good morning, IDEA" description="Every component with live mock data. Resize to 360px to check the mobile variants." />

      <SegmentedControl
        label={tc("periods.label")}
        value={period}
        onChange={setPeriod}
        options={(["today", "7d", "30d", "90d"] as const).map((p) => ({ value: p, label: tc(`periods.${p}`) }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} tone="lilac" pet="cream" label="Appointments" icon={<CalendarDays size={16} />} loading={!kpis.data} value={formatNumber(kpis.data?.appointments.value ?? 0, locale)} delta={kpis.data?.appointments.delta} deltaLabel={deltaLabel} />
        <KpiCard index={1} tone="peach" pet="ginger" label="Revenue" icon={<Banknote size={16} />} loading={!kpis.data} value={formatMoney(kpis.data?.revenue.value ?? 0, locale, { decimals: 0 })} delta={kpis.data?.revenue.delta} deltaLabel={deltaLabel} />
        <KpiCard index={2} tone="mint" pet="golden" label="With a PetRide ride" icon={<Car size={16} />} loading={!kpis.data} value={`${Math.round((kpis.data?.rideShare.value ?? 0) * 100)}%`} delta={kpis.data?.rideShare.delta} deltaLabel={deltaLabel} />
        <KpiCard index={3} tone="sand" pet="tabby" label="Rating" icon={<Star size={16} />} loading={!kpis.data} value={(kpis.data?.rating.value ?? 0).toFixed(1)} unit="/ 5" delta={kpis.data?.rating.delta} deltaLabel={deltaLabel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ChartCard
          title="Visits per day"
          summary={`Visits per day for the selected period: ${daily.data?.map((d) => d.appointments).join(", ") ?? "loading"}.`}
          legend={[{ label: "Visits", color: CHART_COLORS[0] }, { label: "With a ride", color: CHART_COLORS[1] }]}
          loading={!daily.data && !daily.error}
          error={daily.error}
          onRetry={daily.refetch}
          empty={daily.data?.every((d) => d.appointments === 0)}
        >
          <BarChart data={daily.data} margin={{ left: -16, right: 4, top: 8 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="date" {...chartAxisProps} tickFormatter={(d: string) => (period === "7d" ? formatWeekdayShort(d, locale) : formatDayMonth(d, locale))} minTickGap={12} />
            <YAxis {...chartAxisProps} allowDecimals={false} width={40} />
            <ChartTooltip cursor={{ fill: "var(--color-primary-selected)" }} content={<ChartTooltipContent labelFormatter={(d) => formatDayMonth(String(d), locale)} />} />
            <Bar dataKey="appointments" name="Visits" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
            <Bar dataKey="withRide" name="With a ride" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>
        <Panel title="Statuses" description="StatusPill — text + colour + icon" tone="softLilac">
          <div className="flex flex-wrap gap-2">
            {(["requested", "confirmed", "checked_in", "completed", "no_show", "cancelled", "declined"] as const).map((s) => <StatusPill key={s} kind="appointment" status={s} />)}
            {(["new", "preparing", "ready", "delivered"] as const).map((s) => <StatusPill key={s} kind="order" status={s} />)}
            {(["scheduled", "onway", "intrip", "completed"] as const).map((s) => <StatusPill key={s} kind="ride" status={s} />)}
            {(["ok", "due_soon", "overdue"] as const).map((s) => <StatusPill key={s} kind="health" status={s} />)}
          </div>
        </Panel>
      </div>

      <Panel title="Appointments" description="ResponsiveTable (cards under 640px) + Tabs + Pagination + Drawer" actions={<SearchField label="Search" value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} wrapperClassName="w-full sm:w-64" />}>
        <Tabs label="View" value={tab} onChange={setTab} idPrefix="kit" tabs={[{ id: "table", label: "Table", count: appts.data?.total }, { id: "states", label: "States" }]} className="mb-4" />
        {tab === "table" ? (
          <TabPanel idPrefix="kit" value="table">
            <AsyncView query={appts} loading={<ResponsiveTable caption="Appointments" columns={columns} rows={[]} getRowId={(a) => a.id} loading />} empty={<EmptyState title={tc("states.noResultsTitle")} description={tc("states.noResultsBody")} />}>
              {(data) => (
                <div className="space-y-4">
                  <ResponsiveTable caption="Appointments" columns={columns} rows={data.items} getRowId={(a) => a.id} onRowClick={setDrawer} selectedId={drawer?.id} />
                  <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} onPageChange={setPage} />
                </div>
              )}
            </AsyncView>
          </TabPanel>
        ) : (
          <TabPanel idPrefix="kit" value="states" className="grid gap-4 md:grid-cols-2">
            <EmptyState compact />
            <ErrorState compact onRetry={() => toast({ title: "Retrying…", tone: "info" })} />
          </TabPanel>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Buttons & menus">
          <div className="flex flex-wrap items-center gap-2">
            <Button leftIcon={<Plus size={18} />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="danger" leftIcon={<Trash2 size={18} />} onClick={() => setConfirm(true)}>Danger</Button>
            <Button loading>Saving</Button>
            <Tooltip content="Tooltip text"><IconButton label="Add" icon={<Plus size={20} />} variant="secondary" /></Tooltip>
            <Menu label="Actions" items={[{ id: "a", label: "Accept", onSelect: () => toast({ title: "Accepted", description: "Bella · 11:00" }) }, { id: "b", label: "Decline", tone: "danger", onSelect: () => toast({ title: "Declined", tone: "error" }) }]} trigger={(p) => <Button variant="outline" {...p}>Menu</Button>} />
          </div>
        </Panel>
        <Panel title="Form controls">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Price" inputMode="decimal" hint="Leave empty for “Priced on site”" rightSlot={<span className="px-2 text-fg-secondary">₼</span>} />
            <Select label="Service" placeholder="All services" options={[{ value: "a", label: "General check-up" }, { value: "b", label: "Full grooming" }]} />
            <DateInput label="Date" />
            <DateInput label="Time" kind="time" error="Pick a time inside opening hours" />
            <Textarea label="Note for the client" wrapperClassName="sm:col-span-2" />
            <Switch label="Accept PetRide rides" description="Clients can book a ride with the visit" checked={on} onCheckedChange={setOn} />
            <Checkbox label="Auto-confirm requests" checked={checked} onCheckedChange={setChecked} />
          </div>
        </Panel>
      </div>

      <Panel title="Illustrations" tone="softMint">
        <div className="flex flex-wrap items-end gap-6">
          {PAW_PETS.map((p) => <PawArt key={p} pet={p} width={56} />)}
          <Avatar name="Leyla Məmmədova" size="lg" />
          <Avatar name="Bella" species="dog" tint="coral" size="lg" />
        </div>
        <PeekingPaws height={120} className="mt-4" />
      </Panel>

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer ? `${drawer.petName} · ${drawer.serviceName}` : ""} description={drawer?.clientName} footer={<><Button variant="ghost" onClick={() => setDrawer(null)}>{tc("actions.close")}</Button><Button onClick={() => setDrawer(null)}>{tc("actions.accept")}</Button></>}>
        {drawer ? <pre className="overflow-x-auto rounded-tile bg-surface-muted p-3 text-caption">{JSON.stringify(drawer, null, 2)}</pre> : null}
      </Drawer>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); toast({ title: "Deleted", action: { label: "Undo", onClick: () => {} } }); }} title="Delete this service?" description="Clients won't see it in the app any more." confirmLabel={tc("actions.delete")} tone="danger" />
    </div>
  );
}
