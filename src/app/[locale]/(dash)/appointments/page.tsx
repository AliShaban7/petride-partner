import type { Metadata } from "next";
import { Suspense } from "react";

import { SkeletonCard } from "@/components/ui";
import { getT, localeFromParams } from "@/lib/i18n/server";

import { AppointmentsView } from "./AppointmentsView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "appointments");
  return { title: t("meta.title"), description: t("meta.description") };
}

export default function AppointmentsPage() {
  // The view reads filters from the URL (useSearchParams), so it sits in its own Suspense boundary.
  return (
    <Suspense fallback={<SkeletonCard className="h-96" />}>
      <AppointmentsView />
    </Suspense>
  );
}
