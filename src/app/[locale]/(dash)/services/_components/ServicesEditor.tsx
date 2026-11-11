"use client";

import { BedDouble, CalendarCheck, Eye, HandCoins, Plus, Scissors, Stethoscope, Tag as TagIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { EXTRAS_TAG, Notice, SaveBar, useDraft, useExtras, useUnsavedGuard } from "@/components/services-settings";
import { Button, ConfirmDialog, EmptyState, ErrorState, KpiCard, PageHeader, Panel, SkeletonRows, useToast } from "@/components/ui";
import { errorCode, useApiMutation, useApiQuery } from "@/lib/api/hooks";
import { useSession } from "@/lib/auth/client";
import { formatNumber } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { AppPreview } from "./AppPreview";
import { HoursCard } from "./HoursCard";
import {
  blankService,
  buildSavePlan,
  changedKeys,
  commitRows,
  draftEquals,
  executePlan,
  orderChanged,
  priceError,
  remapKeys,
  SERVICE_CATS,
  serviceName,
  toServicesDraft,
  withItem,
  withoutItem,
  type SavePlan,
  type SaveResult,
  type ServiceCat,
  type ServiceDraft,
  type ServicesDraft,
} from "./model";
import { ServiceDialog } from "./ServiceDialog";
import { ServiceRow } from "./ServiceRow";
import { useSortable } from "./useSortable";

const CAT_ICONS = { vet: Stethoscope, groom: Scissors, hotel: BedDouble } as const;

type DialogState = { mode: "create" | "edit"; initial: ServiceDraft };

/**
 * Services & prices for clinics, salons and hotels: KPIs, services grouped by category with inline
 * price / "show price in the app" / active editing and drag-to-reorder, the add/edit dialog, a
 * live app preview, the hours summary and a sticky save bar for the inline edits.
 */
export function ServicesEditor() {
  const t = useT("services");
  const tc = useT("common");
  const locale = useLocale();
  const session = useSession();
  const { toast } = useToast();
  const instructionsId = useId();

  const servicesQ = useApiQuery(["services"], (api) => api.listServices());
  const partnerQ = useApiQuery(["partner"], (api) => api.getPartner());
  const extrasQ = useExtras();

  const serverBase = useMemo(
    () => (servicesQ.data && extrasQ.data ? toServicesDraft(servicesQ.data, extrasQ.data.services, locale) : undefined),
    [servicesQ.data, extrasQ.data, locale],
  );
  const { draft, base, setDraft, reset, commit, dirty } = useDraft<ServicesDraft>(serverBase, draftEquals);
  useUnsavedGuard(dirty, t("saveBar.leaveConfirm"));

  const [showErrors, setShowErrors] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // The target stays set while the dialog closes, so its title doesn't flip mid-animation.
  const [archiveTarget, setArchiveTarget] = useState<ServiceDraft | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const save = useApiMutation((api, plan: SavePlan) => executePlan(api, plan), { invalidates: ["services", EXTRAS_TAG, "overview", "stats"] });
  const archive = useApiMutation((api, id: string) => api.archiveService(id), { invalidates: ["services", "overview", "stats"] });

  const categories: ServiceCat[] = SERVICE_CATS.filter((c) => session.categories.includes(c) || (draft?.order[c].length ?? 0) > 0);
  const dialogCategories: ServiceCat[] = SERVICE_CATS.filter((c) => session.categories.includes(c));
  const firstCategory = dialogCategories[0] ?? "vet";

  // ---- Derived -----------------------------------------------------------------------------------
  const changed = useMemo(() => (draft && base ? changedKeys(draft, base) : new Set<string>()), [draft, base]);
  const reordered = Boolean(draft && base && orderChanged(draft, base));
  const ordered = useMemo(() => (draft ? SERVICE_CATS.flatMap((c) => draft.order[c]).map((k) => draft.items[k]).filter(Boolean) : []), [draft]);
  const invalid = ordered.filter((i) => priceError(i));

  const kpis = useMemo(() => {
    const items = base ? Object.values(base.items) : [];
    const total = items.length;
    const active = items.filter((i) => i.active).length;
    const withPrice = items.filter((i) => i.showPrice).length;
    const onSite = items.filter((i) => i.active && !i.showPrice).length;
    const bookings = items.reduce((s, i) => s + i.bookings30d, 0);
    const top = [...items].sort((a, b) => b.bookings30d - a.bookings30d)[0];
    return { total, active, withPrice, onSite, bookings, top };
  }, [base]);

  // ---- Editing -----------------------------------------------------------------------------------
  const updateItem = (key: string, patch: Partial<ServiceDraft>) =>
    setDraft((d) => (d.items[key] ? { ...d, items: { ...d.items, [key]: { ...d.items[key], ...patch } } } : d));

  const reorder = (category: ServiceCat, ids: string[]) => setDraft((d) => ({ ...d, order: { ...d.order, [category]: ids } }));

  const announceMove = (id: string, index: number, total: number) => {
    const item = draft?.items[id];
    if (item) setAnnouncement(t("reorder.moved", { name: serviceName(item, locale), position: index + 1, total }));
  };

  const focusPrice = (key: string) =>
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-price-key="${CSS.escape(key)}"] input[inputmode="decimal"]`);
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus({ preventScroll: true });
    });

  // ---- Saving ------------------------------------------------------------------------------------
  const saveAll = async () => {
    if (!draft || !base) return;
    if (invalid.length) {
      setShowErrors(true);
      focusPrice(invalid[0].key);
      return;
    }
    const sent = draft;
    const plan = buildSavePlan(sent, base);
    // mutateAsync, not mutate: `save.error` in this closure is the previous render's value.
    let result: SaveResult;
    try {
      result = await save.mutateAsync(plan);
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
      return;
    }
    if (!result.failed.length && !result.metaFailed) {
      commit(({ draft: current }) => ({ base: remapKeys(sent, result.created), draft: remapKeys(current, result.created) }));
      setShowErrors(false);
      toast({ title: t("toast.saved"), description: t("toast.savedBody") });
      return;
    }
    const ok = [...plan.updates, ...plan.creates].map((x) => x.key).filter((k) => !result.failed.includes(k));
    commit((current) => commitRows(current, sent, ok, result.created));
    toast({ tone: "error", title: t("toast.partial"), description: tc.dynamic(`errors.${errorCode(result.firstError)}`) });
  };

  const submitDialog = async (item: ServiceDraft) => {
    if (!draft || !base || !dialog) return;
    const next = withItem(draft, item);
    setDraft((d) => withItem(d, item));
    const plan = buildSavePlan(next, base, [item.key]);
    const name = serviceName(item, locale);
    let result: SaveResult;
    try {
      result = await save.mutateAsync(plan);
    } catch (err) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(err)}`) });
      return;
    }
    if (result.failed.includes(item.key)) {
      toast({ tone: "error", title: t("toast.saveFailed"), description: tc.dynamic(`errors.${errorCode(result.firstError)}`) });
      return;
    }
    commit((current) => commitRows(current, next, [item.key], result.created));
    setDialog(null);
    toast({ title: dialog.mode === "create" ? t("toast.created", { name }) : t("toast.updated", { name }) });
  };

  const confirmArchive = async () => {
    const target = archiveTarget;
    if (!target) return;
    const name = serviceName(target, locale);
    if (target.isNew) {
      setDraft((d) => withoutItem(d, target.key));
      setArchiveOpen(false);
      return;
    }
    try {
      await archive.mutateAsync(target.key);
      commit((current) => ({ base: withoutItem(current.base, target.key), draft: withoutItem(current.draft, target.key) }));
      setArchiveOpen(false);
      toast({ title: t("toast.archived", { name }) });
    } catch (e) {
      toast({ tone: "error", title: t("toast.archiveFailed"), description: tc.dynamic(`errors.${errorCode(e)}`) });
    }
  };

  const openCreate = (category: ServiceCat = firstCategory) => setDialog({ mode: "create", initial: blankService(category) });

  // ---- Save bar text ---------------------------------------------------------------------------------
  const changeCount = changed.size + (reordered ? 1 : 0);
  const saveMessage =
    showErrors && invalid.length
      ? t.plural("saveBar.fix", invalid.length)
      : reordered && changed.size === 0
        ? t("saveBar.orderChanged")
        : t.plural("saveBar.changes", Math.max(1, changeCount));

  const error = servicesQ.error ?? extrasQ.error;
  const loading = !serverBase && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button leftIcon={<Plus aria-hidden="true" size={18} />} onClick={() => openCreate()} disabled={!draft}>
            {t("add")}
          </Button>
        }
      />

      {/* KPIs: what the app shows right now (saved state). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          tone="mint"
          pet="golden"
          icon={<Eye size={16} />}
          label={t("kpi.active")}
          loading={!base && !error}
          value={base ? formatNumber(kpis.active, locale) : "—"}
          unit={base ? t("kpi.ofTotal", { total: formatNumber(kpis.total, locale) }) : undefined}
          footnote={!base ? undefined : kpis.total - kpis.active > 0 ? t.plural("kpi.hidden", kpis.total - kpis.active) : t("kpi.allVisible")}
        />
        <KpiCard
          index={1}
          tone="lilac"
          pet="tabby"
          icon={<TagIcon size={16} />}
          label={t("kpi.withPrice")}
          loading={!base && !error}
          value={base ? formatNumber(kpis.withPrice, locale) : "—"}
          unit={base ? t("kpi.ofTotal", { total: formatNumber(kpis.total, locale) }) : undefined}
          footnote={base ? t("kpi.withPriceNote") : undefined}
        />
        <KpiCard
          index={2}
          tone="peach"
          pet="ginger"
          icon={<HandCoins size={16} />}
          label={tc("money.pricedOnSite")}
          loading={!base && !error}
          value={base ? formatNumber(kpis.onSite, locale) : "—"}
          footnote={!base ? undefined : kpis.onSite > 0 ? t("kpi.onSiteNote") : t("kpi.onSiteNone")}
        />
        <KpiCard
          index={3}
          tone="sand"
          pet="cream"
          icon={<CalendarCheck size={16} />}
          label={t("kpi.bookings")}
          loading={!base && !error}
          value={base ? formatNumber(kpis.bookings, locale) : "—"}
          footnote={kpis.top && kpis.top.bookings30d > 0 ? t("kpi.top", { name: serviceName(kpis.top, locale) }) : undefined}
        />
      </div>

      {base && kpis.onSite > 0 ? (
        <Notice
          tone="app"
          title={t.plural("notice.onSite", kpis.onSite, { label: tc("money.pricedOnSite") })}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const first = ordered.find((i) => i.active && !i.showPrice);
                if (first) focusPrice(first.key);
              }}
            >
              {t("notice.setPrice")}
            </Button>
          }
        >
          {t("notice.onSiteBody")}
        </Notice>
      ) : null}

      <p id={instructionsId} className="sr-only">
        {t("reorder.instructions")}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start">
        <div className="min-w-0 space-y-6">
          {error && !serverBase ? (
            <Panel title={t("listTitle")}>
              <ErrorState
                error={error}
                onRetry={() => {
                  servicesQ.refetch();
                  extrasQ.refetch();
                }}
              />
            </Panel>
          ) : loading || !draft ? (
            <Panel title={t("listTitle")}>
              <div aria-busy="true">
                <span className="sr-only">{tc("states.loading")}</span>
                <SkeletonRows rows={5} />
              </div>
            </Panel>
          ) : Object.keys(draft.items).length === 0 ? (
            <Panel title={t("listTitle")}>
              <EmptyState
                title={t("empty.title")}
                description={t("empty.body")}
                pet="golden"
                action={
                  <Button leftIcon={<Plus aria-hidden="true" size={18} />} onClick={() => openCreate()}>
                    {t("empty.action")}
                  </Button>
                }
              />
            </Panel>
          ) : (
            categories.map((category, i) => (
              <CategoryPanel
                key={category}
                index={i}
                category={category}
                draft={draft}
                changed={changed}
                showErrors={showErrors}
                instructionsId={instructionsId}
                onReorder={(ids) => reorder(category, ids)}
                onAnnounce={announceMove}
                onChange={updateItem}
                onAdd={() => openCreate(category)}
                onEdit={(item) => setDialog({ mode: "edit", initial: item })}
                onArchive={(item) => {
                  setArchiveTarget(item);
                  setArchiveOpen(true);
                }}
              />
            ))
          )}
        </div>

        <aside aria-label={t("asideLabel")} className="grid min-w-0 gap-6 md:grid-cols-2 2xl:sticky 2xl:top-[calc(var(--topbar-h)+1.5rem)] 2xl:grid-cols-1">
          {draft ? <AppPreview draft={draft} partner={partnerQ.data} logo={extrasQ.data?.profile.logoDataUrl ?? null} /> : null}
          <HoursCard partner={partnerQ.data} extras={extrasQ.data} error={partnerQ.error} onRetry={partnerQ.refetch} />
        </aside>
      </div>

      <SaveBar
        visible={dirty}
        saving={save.isPending && !dialog}
        label={t("saveBar.label")}
        message={saveMessage}
        hint={t("saveBar.hint")}
        saveLabel={t("saveBar.save")}
        discardLabel={t("saveBar.discard")}
        onSave={saveAll}
        onDiscard={() => {
          reset();
          setShowErrors(false);
        }}
      />

      {dialog ? (
        <ServiceDialog
          key={dialog.initial.key}
          open
          mode={dialog.mode}
          initial={dialog.initial}
          categories={dialog.mode === "edit" ? [dialog.initial.category] : dialogCategories}
          saving={save.isPending}
          onClose={() => setDialog(null)}
          onSubmit={submitDialog}
        />
      ) : null}

      <ConfirmDialog
        open={archiveOpen && archiveTarget !== null}
        onClose={() => setArchiveOpen(false)}
        onConfirm={confirmArchive}
        tone="danger"
        loading={archive.isPending}
        title={t("archive.title", { name: archiveTarget ? serviceName(archiveTarget, locale) : "" })}
        description={archiveTarget?.isNew ? t("archive.bodyNew") : t("archive.body")}
        confirmLabel={t("archive.confirm")}
      />
    </div>
  );
}

function CategoryPanel({
  index,
  category,
  draft,
  changed,
  showErrors,
  instructionsId,
  onReorder,
  onAnnounce,
  onChange,
  onAdd,
  onEdit,
  onArchive,
}: {
  index: number;
  category: ServiceCat;
  draft: ServicesDraft;
  changed: Set<string>;
  showErrors: boolean;
  instructionsId: string;
  onReorder: (ids: string[]) => void;
  onAnnounce: (id: string, index: number, total: number) => void;
  onChange: (key: string, patch: Partial<ServiceDraft>) => void;
  onAdd: () => void;
  onEdit: (item: ServiceDraft) => void;
  onArchive: (item: ServiceDraft) => void;
}) {
  const t = useT("services");
  const locale = useLocale();
  const ids = draft.order[category];
  const items = ids.map((k) => draft.items[k]).filter(Boolean);
  const { listRef, draggingId, handleProps, moveBy } = useSortable({ ids, onReorder, onAnnounce });
  const Icon = CAT_ICONS[category];
  const active = items.filter((i) => i.active).length;

  return (
    <Panel
      className="animate-fade-up"
      bodyClassName="@container"
      style={{ animationDelay: `${index * 70}ms` }}
      icon={<Icon size={20} />}
      title={t(`categories.${category}.title`)}
      description={items.length ? t("categoryMeta", { count: t.plural("serviceCount", items.length), active: formatNumber(active, locale) }) : t(`categories.${category}.hint`)}
      actions={
        <Button variant="secondary" size="sm" leftIcon={<Plus aria-hidden="true" size={16} />} onClick={onAdd}>
          {t("addShort")}
          <span className="sr-only">: {t(`categories.${category}.title`)}</span>
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="rounded-card bg-surface-muted px-4 py-6 text-center text-body-sm text-fg-secondary">{t("categoryEmpty")}</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[2.75rem_minmax(0,1fr)_6.5rem_12.5rem_9rem_2.75rem] gap-x-3 border-b border-border px-1 pb-2 text-meta font-semibold text-fg-secondary @min-[50rem]:grid"
          >
            <span />
            <span>{t("columns.service")}</span>
            <span>{t("columns.duration")}</span>
            <span>{t("columns.price")}</span>
            <span>{t("columns.active")}</span>
            <span />
          </div>
          <ul ref={listRef} aria-label={t("listLabel", { category: t(`categories.${category}.title`) })} className="space-y-3 @min-[50rem]:space-y-0">
            {items.map((item, i) => (
              <ServiceRow
                key={item.key}
                item={item}
                name={serviceName(item, locale) || t("dialog.namePlaceholder")}
                changed={changed.has(item.key)}
                error={priceError(item)}
                showErrors={showErrors}
                index={i}
                total={items.length}
                dragging={draggingId === item.key}
                handleProps={handleProps(item.key)}
                instructionsId={instructionsId}
                onChange={(patch) => onChange(item.key, patch)}
                onEdit={() => onEdit(item)}
                onArchive={() => onArchive(item)}
                onMove={(delta) => moveBy(item.key, delta)}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
