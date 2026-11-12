"use client";

import { ArrowDown, ArrowUp, EyeOff, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";

import { Checkbox, IconButton, Menu, Pill, Switch, Tag } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDuration, formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { PriceError, ServiceDraft } from "./model";
import { appPriceText } from "./AppPreview";
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

/** Grid template shared by the rows and the column header (each row is its own grid, so tracks are fixed). */
export const SERVICE_ROW_COLS = "@min-[50rem]:grid-cols-[2.75rem_minmax(0,1fr)_5.5rem_8rem_10rem_3.5rem_2.75rem]";

/**
 * One service. From a 50rem-wide list it is one table-like line (handle · name · duration · price ·
 * "show in the app" · active · menu); narrower it is a compact card: handle, name, active switch and
 * menu on one line, the meta line under them, then price and "show in the app". Price, "show in the
 * app" and active edit the page draft.
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
  // What the app shows instead of a plain price ("from 35 ₼", "Priced on site") is worth a few visible
  // words in the meta line; the plain case stays for screen readers (the price field's description).
  const hint = item.showPrice ? (item.priceFrom ? t("row.fromHint") : t("row.exactHint")) : t("row.onSiteHint", { label: tc("money.pricedOnSite") });
  const hintVisible = !item.showPrice || item.priceFrom;
  const inApp = t("row.inApp", { price: appPriceText(item, locale, tc) });

  return (
    <li
      data-sortable-id={item.key}
      data-price-key={item.key}
      className={cn(
        "relative grid grid-cols-[2.75rem_minmax(0,1fr)_auto_2.75rem] items-start gap-x-2 gap-y-2 rounded-card border border-border bg-surface p-3 transition-[box-shadow,background-color] duration-200",
        SERVICE_ROW_COLS,
        "@min-[50rem]:items-center @min-[50rem]:gap-x-3 @min-[50rem]:rounded-tile @min-[50rem]:border-0 @min-[50rem]:border-b @min-[50rem]:px-1 @min-[50rem]:py-1.5",
        dragging && "z-10 border-primary/40 shadow-floating ring-2 ring-primary/30 @min-[50rem]:rounded-tile @min-[50rem]:border",
        !item.active && !dragging && "bg-surface-muted",
      )}
    >
      {changed ? <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-chip bg-accent @min-[50rem]:inset-y-2" /> : null}

      <button
        type="button"
        aria-label={t("row.handle", { name, position: index + 1, total })}
        aria-describedby={instructionsId}
        className={cn(
          "col-start-1 row-start-1 inline-flex size-11 touch-none select-none items-center justify-center rounded-tile text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg lg:size-9",
          dragging ? "cursor-grabbing bg-primary-tint text-primary" : "cursor-grab",
        )}
        {...handleProps}
      >
        <GripVertical aria-hidden="true" size={20} />
      </button>

      {/* Narrow: the name sits beside the handle, switch and menu, and the meta line runs under them at full
          width (display: contents). Wide: name and meta stack in the service column. */}
      <div className="contents @min-[50rem]:col-start-2 @min-[50rem]:row-start-1 @min-[50rem]:block @min-[50rem]:min-w-0">
        <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 self-center">
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
          {/* Wide list: what the app shows as the price sits beside the name (the name line has room; in the
              meta line it would wrap onto a third line). Narrow cards keep it at the end of the meta line. */}
          {hintVisible ? (
            <span aria-hidden="true" className="hidden text-meta font-medium text-fg @min-[50rem]:inline">
              {inApp}
            </span>
          ) : null}
        </div>
        {/* One meta line: the app subtitle, species, bookings, duration (narrow), what the app shows as the price
            (narrow). Items wrap whole; the "·" separator travels with the next item. */}
        <p className="col-span-full row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-meta text-fg-secondary @min-[50rem]:mt-0.5 @min-[50rem]:px-0 [&>*+*]:before:mr-2 [&>*+*]:before:content-['·']">
          {description ? <span>{description}</span> : null}
          <span>{item.species.map((s) => tc(`species.${s}`)).join(", ")}</span>
          {!item.isNew ? <span className="whitespace-nowrap tabular">{t.plural("row.bookings", item.bookings30d)}</span> : null}
          {/* After a visible item, so the hidden (wide) duration never leaves a leading "·". */}
          <span className="whitespace-nowrap tabular @min-[50rem]:hidden">{formatDuration(item.durationMin, locale)}</span>
          {hintVisible ? (
            <span aria-hidden="true" className="font-medium text-fg @min-[50rem]:hidden">
              {inApp}
            </span>
          ) : null}
        </p>
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      </div>

      <p className="hidden text-body-sm text-fg tabular @min-[50rem]:col-start-3 @min-[50rem]:row-start-1 @min-[50rem]:block">{formatDuration(item.durationMin, locale)}</p>

      {/* Narrow: one wrapping line under the name. Wide: the price and checkbox cells of the row. */}
      <div className="col-span-full row-start-3 flex flex-wrap items-center gap-x-4 gap-y-2 @min-[50rem]:contents">
        <div className="w-32 min-w-0 @min-[50rem]:col-start-4 @min-[50rem]:row-start-1 @min-[50rem]:w-auto">
          <label htmlFor={priceId} className="sr-only">
            {t("row.priceFor", { name })}
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
        </div>
        <div className="min-w-0 @min-[50rem]:col-start-5 @min-[50rem]:row-start-1">
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
        {visibleError ? (
          <p id={errorId} className="basis-full text-meta font-medium text-error-text @min-[50rem]:col-span-3 @min-[50rem]:col-start-4 @min-[50rem]:row-start-2">
            {t.dynamic(`errors.price.${visibleError === "empty" ? "emptyOrHide" : visibleError}`, { max: formatMoney(9999, locale, { decimals: 0 }) })}
          </p>
        ) : null}
      </div>

      <div className="col-start-3 row-start-1 self-center @min-[50rem]:col-start-6">
        {/* The column header says "In the app"; the switch's name carries the service. 44px tall hit area. */}
        <Switch
          checked={item.active}
          onCheckedChange={(active) => onChange({ active })}
          hideLabel
          label={`${t("row.active")}: ${name}`}
        />
      </div>

      <div className="col-start-4 row-start-1 flex justify-end self-center @min-[50rem]:col-start-7">
        <Menu
          label={t("row.actions", { name })}
          items={[
            { id: "edit", label: t("row.edit"), icon: <Pencil aria-hidden="true" size={16} />, onSelect: onEdit },
            { id: "up", label: t("row.moveUp"), icon: <ArrowUp aria-hidden="true" size={16} />, onSelect: () => onMove(-1), disabled: index === 0 },
            { id: "down", label: t("row.moveDown"), icon: <ArrowDown aria-hidden="true" size={16} />, onSelect: () => onMove(1), disabled: index === total - 1 },
            { id: "archive", label: t("row.archive"), icon: <Trash2 aria-hidden="true" size={16} />, onSelect: onArchive, tone: "danger", separatorBefore: true },
          ]}
          trigger={(props) => <IconButton {...props} size="sm" label={t("row.actions", { name })} icon={<MoreHorizontal size={20} />} />}
        />
      </div>
    </li>
  );
}
