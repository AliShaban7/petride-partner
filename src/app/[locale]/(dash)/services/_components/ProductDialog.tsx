"use client";

import { useId, useRef, useState } from "react";

import { parsePrice, parseWhole } from "@/components/services-settings";
import { Button, Dialog, Field, Input, Switch, TabPanel, Tabs } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";

import { PriceInput } from "./PriceInput";
import { STOCK_MAX, type ProductDraft } from "./productModel";

type Errors = Partial<Record<"nameAz" | "price" | "stock" | "lowStockAt", string>>;

/** Edit one product: names (az / ru / en), price, stock, low-stock threshold and visibility. */
export function ProductDialog({
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  initial: ProductDraft;
  saving: boolean;
  onClose: () => void;
  onSubmit: (item: ProductDraft) => void;
}) {
  const t = useT("services");
  const tc = useT("common");
  const uiLocale = useLocale();
  const [form, setForm] = useState(initial);
  const [lowStock, setLowStock] = useState(String(initial.lowStockAt));
  const [lang, setLang] = useState<Locale>("az");
  const [errors, setErrors] = useState<Errors>({});
  const nameAzRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const tabsPrefix = `prd${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const set = (patch: Partial<ProductDraft>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => ({
      ...e,
      ...(patch.nameI18n && { nameAz: undefined }),
      ...(patch.price !== undefined && { price: undefined }),
      ...(patch.stock !== undefined && { stock: undefined }),
    }));
  };

  const submit = () => {
    const e: Errors = {};
    if (!form.nameI18n.az.trim()) e.nameAz = t("dialog.errors.nameRequired");
    const price = parsePrice(form.price);
    if (!price.ok) e.price = t.dynamic(`errors.price.${price.reason}`, { max: formatMoney(9999, uiLocale, { decimals: 0 }) });
    if (parseWhole(form.stock, 0, STOCK_MAX) === null) e.stock = t("products.errors.stock");
    const threshold = parseWhole(lowStock, 0, 999);
    if (threshold === null) e.lowStockAt = t("products.errors.lowStock");
    setErrors(e);
    if (e.nameAz) {
      setLang("az");
      requestAnimationFrame(() => nameAzRef.current?.focus());
      return;
    }
    const first = (["price", "stock", "lowStockAt"] as const).find((k) => e[k]);
    if (first) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${formId}-${first}"]`)?.focus());
      return;
    }
    onSubmit({ ...form, lowStockAt: threshold ?? form.lowStockAt });
  };

  return (
    <Dialog
      open
      onClose={saving ? () => {} : onClose}
      hideClose={saving}
      size="lg"
      title={t("products.dialogTitle")}
      description={t("products.dialogDescription", { sku: form.sku })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tc("actions.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {tc("actions.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-6 pb-2"
      >
        <fieldset className="space-y-3">
          <legend className="text-body-sm font-semibold text-fg">{t("dialog.namesLegend")}</legend>
          <Tabs
            variant="pills"
            idPrefix={tabsPrefix}
            label={t("dialog.languageTabs")}
            value={lang}
            onChange={(id) => setLang(id as Locale)}
            tabs={LOCALES.map((l) => ({ id: l, label: `${LOCALE_SHORT[l]}${l === "az" ? " *" : ""}` }))}
          />
          {LOCALES.map((l) =>
            l === lang ? (
              <TabPanel key={l} idPrefix={tabsPrefix} value={l} className="pt-1">
                <Input
                  ref={l === "az" ? nameAzRef : undefined}
                  lang={l}
                  label={t("dialog.name", { language: LOCALE_NAMES[l] })}
                  required={l === "az"}
                  maxLength={80}
                  value={form.nameI18n[l]}
                  placeholder={l === "az" ? undefined : form.nameI18n.az}
                  error={l === "az" ? errors.nameAz : undefined}
                  hint={l === "az" ? t("dialog.nameAzHint") : t("dialog.nameFallbackHint")}
                  onChange={(e) => set({ nameI18n: { ...form.nameI18n, [l]: e.target.value } })}
                />
              </TabPanel>
            ) : null,
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("row.price")} error={errors.price} required>
            {({ id, describedBy, invalid }) => (
              <PriceInput
                id={id}
                data-field={`${formId}-price`}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.price}
                locale={uiLocale}
                onValueChange={(price) => set({ price })}
              />
            )}
          </Field>
          <Input
            data-field={`${formId}-stock`}
            label={t("products.stock")}
            inputMode="numeric"
            value={form.stock}
            error={errors.stock}
            onChange={(e) => set({ stock: e.target.value.replace(/[^\d]/g, "") })}
            className="tabular"
            required
          />
          <Input
            data-field={`${formId}-lowStockAt`}
            label={t("products.lowStockAt")}
            inputMode="numeric"
            value={lowStock}
            error={errors.lowStockAt}
            hint={t("products.lowStockHint")}
            onChange={(e) => {
              setLowStock(e.target.value.replace(/[^\d]/g, ""));
              setErrors((x) => ({ ...x, lowStockAt: undefined }));
            }}
            className="tabular"
          />
        </div>

        <Switch checked={form.active} onCheckedChange={(active) => set({ active })} label={t("products.active")} description={t("products.activeHint")} />
      </form>
    </Dialog>
  );
}
