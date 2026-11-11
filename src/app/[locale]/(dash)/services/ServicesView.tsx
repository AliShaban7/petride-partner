"use client";

import { partnerFeatures } from "@/components/shell";
import { EmptyState, PageHeader } from "@/components/ui";
import { useSession } from "@/lib/auth/client";
import { useT } from "@/lib/i18n/client";

import { ProductsEditor } from "./_components/ProductsEditor";
import { ServicesEditor } from "./_components/ServicesEditor";

/**
 * Services & prices. Clinics / salons / hotels edit their services (vet, grooming, hotel);
 * pet shops edit their product prices and stock. A partner with both gets both editors.
 */
export function ServicesView() {
  const t = useT("services");
  const features = partnerFeatures(useSession());

  if (!features.appointments && !features.orders) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <EmptyState title={t("unavailable.title")} description={t("unavailable.body")} pet="cream" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {features.appointments ? <ServicesEditor /> : null}
      {features.orders ? <ProductsEditor headless={features.appointments} /> : null}
    </div>
  );
}
