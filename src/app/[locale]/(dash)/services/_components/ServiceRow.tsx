"use client";

import { ArrowDown, ArrowUp, EyeOff, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";

import { Checkbox, IconButton, Menu, Pill, Switch, Tag } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDuration, formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { PriceError, ServiceDraft } from "./model";
import { PriceInput } from "./PriceInput";

export type ServiceRowProps = {
  item: ServiceDraft;
  name: string;
  changed: boolean;
  error: PriceError | null;
  /** Show errors without waiting for blur (after a save attempt). */
  showErrors: boolean;
  index: number;
  total: number;
  dragging: boolean;
  handleProps: Omit<ComponentProps<"button">, "type">;
  instructionsId: string;
  onChange: (patch: Partial<ServiceDraft>) => void;
  onEdit: () => void;
  onArchive: () => void;
  onMove: (delta: number) => void;
};

/**
 * One service: a table-like row from 1280px (handle · name · duration · price · active · menu),
 * a card below. Price, "show in the app" and active are edited inline into the page draft.
 */
export function ServiceRow({ item, name, changed, error, showErrors, index, total, dragging, handleProps, instructionsId, onChange, onEdit, onArchive, onMove }: ServiceRowProps) {
  const t = useT("services");
  const tc = useT("common");
  const locale = useLocale();
  const [touched, setTouched] = useState(false);
  const priceId = useId();
  const errorId = `${priceId}-error`;
  const hintId = `${priceId}-hint`;
  const visibleError = error && (showErrors || touched) ? error : null;
  const description = item.descriptionI18n[locale] || item.descriptionI18n.az;

  return (
    <li
      data-sortable-id={item.key}
      data-price-key={item.key}
      className={cn(
        "relative grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-x-2 gap-y-3 rounded-card border border-border bg-surface p-3 transition-[box-shadow,background-color] duration-200",
        "@min-[50rem]:grid-cols-[2.75rem_minmax(0,1fr)_6.5rem_12.5rem_9rem_2.75rem] @min-[50rem]:items-center @min-[50rem]:gap-x-3 @min-[50rem]:rounded-tile @min-[50rem]:border-0 @min-[50rem]:border-b @min-[50rem]:px-1 @min-[50rem]:py-2.5",
        dragging && "z-10 border-primary/40 shadow-floating ring-2 ring-primary/30 @min-[50rem]:rounded-tile @min-[50rem]:border",
        !item.active && !dragging && "bg-surface-muted",
      )}
    >
      {changed ? <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-chip bg-accent" /> : null}

      <button
        type="button"
        aria-label={t("row.handle", { name, position: index + 1, total })}
        aria-describedby={instructionsId}
        className={cn(
          "col-start-1 row-start-1 inline-flex size-11 touch-none select-none items-center justify-center rounded-tile text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg",
          dragging ? "cursor-grabbing bg-primary-tint text-primary" : "cursor-grab",
        )}
        {...handleProps}
      >
        <GripVertical aria-hidden="true" size={20} />
      </button>

      <div className="col-start-2 row-start-1 min-w-0 pt-1.5 @min-[50rem]:pt-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-body font-semibold text-fg">{name}</p>
          {item.isNew ? (
            <Pill tone="lilac" size="sm">
              {t("row.new")}
            </Pill>
          ) : null}
          {changed ? (
            <Tag tone="warning" className="py-0.5">
              {t("row.unsaved")}
            </Tag>
          ) : null}
          {!item.active ? (
            <Tag icon={<EyeOff aria-hidden="true" size={12} />} className="py-0.5">
              {t("row.hidden")}
            </Tag>
          ) : null}
        </div>
        {description ? <p className="mt-0.5 text-meta text-fg-secondary">{description}</p> : null}
        {/* Meta items wrap whole; the "·" separator travels with the next item, never dangles at a line end. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-fg-secondary">
          <span className="whitespace-nowrap tabular @min-[50rem]:hidden">{formatDuration(item.durationMin, locale)}</span>
          <span className="before:mr-2 before:content-['·'] @min-[50rem]:before:hidden">{item.species.map((s) => tc(`species.${s}`)).join(", ")}</span>
          {!item.isNew ? <span className="whitespace-nowrap tabular before:mr-2 before:content-['·']">{t.plural("row.bookings", item.bookings30d)}</span> : null}
        </p>
      </div>

      <p className="hidden text-body-sm text-fg tabular @min-[50rem]:col-start-3 @min-[50rem]:row-start-1 @min-[50rem]:block">{formatDuration(item.durationMin, locale)}</p>

      <div className="col-span-2 col-start-2 row-start-2 flex flex-wrap items-start gap-x-6 gap-y-3 @min-[50rem]:contents">
        <div className="min-w-0 basis-52 @min-[50rem]:col-start-4 @min-[50rem]:row-start-1 @min-[50rem]:basis-auto">
          <label htmlFor={priceId} className="mb-1.5 block text-body-sm font-semibold text-fg @min-[50rem]:sr-only">
            <span aria-hidden="true" className="@min-[50rem]:hidden">
              {t("row.price")}
            </span>
            <span className="sr-only">{t("row.priceFor", { name })}</span>
          </label>
          <PriceInput
            id={priceId}
            value={item.price}
            locale={locale}
            invalid={Boolean(visibleError)}
            aria-describedby={visibleError ? `${errorId} ${hintId}` : hintId}
            onBlur={() => setTouched(true)}
            onValueChange={(price) => onChange(!item.showPrice && !item.price.trim() && price.trim() ? { price, showPrice: true } : { price })}
            className={cn(!item.showPrice && "text-fg-secondary")}
          />
          {visibleError ? (
            <p id={errorId} className="mt-1 text-meta font-medium text-error-text">
              {t.dynamic(`errors.price.${visibleError === "empty" ? "emptyOrHide" : visibleError}`, { max: formatMoney(9999, locale, { decimals: 0 }) })}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Checkbox
              checked={item.showPrice}
              onCheckedChange={(showPrice) => onChange({ showPrice })}
              label={
                <span className="text-body-sm">
                  {t("row.showPrice")}
                  <span className="sr-only">: {name}</span>
                </span>
              }
            />
          </div>
          <p id={hintId} className="mt-1 text-meta text-fg-secondary">
            {item.showPrice ? (item.priceFrom ? t("row.fromHint") : t("row.exactHint")) : t("row.onSiteHint", { label: tc("money.pricedOnSite") })}
          </p>
        </div>

        <div className="min-w-[9rem] pt-0 sm:pt-7 @min-[50rem]:col-start-5 @min-[50rem]:row-start-1 @min-[50rem]:pt-0">
          <Switch
            checked={item.active}
            onCheckedChange={(active) => onChange({ active })}
            label={
              <span className="text-body-sm">
                {t("row.active")}
                <span className="sr-only">: {name}</span>
              </span>
            }
            className="items-center justify-start gap-3 @min-[50rem]:justify-between"
          />
        </div>
      </div>

      <div className="col-start-3 row-start-1 flex justify-end @min-[50rem]:col-start-6">
        <Menu
          label={t("row.actions", { name })}
          items={[
            { id: "edit", label: t("row.edit"), icon: <Pencil aria-hidden="true" size={16} />, onSelect: onEdit },
            { id: "up", label: t("row.moveUp"), icon: <ArrowUp aria-hidden="true" size={16} />, onSelect: () => onMove(-1), disabled: index === 0 },
            { id: "down", label: t("row.moveDown"), icon: <ArrowDown aria-hidden="true" size={16} />, onSelect: () => onMove(1), disabled: index === total - 1 },
            { id: "archive", label: t("row.archive"), icon: <Trash2 aria-hidden="true" size={16} />, onSelect: onArchive, tone: "danger", separatorBefore: true },
          ]}
          trigger={(props) => <IconButton {...props} label={t("row.actions", { name })} icon={<MoreHorizontal size={20} />} />}
        />
      </div>
    </li>
  );
}
