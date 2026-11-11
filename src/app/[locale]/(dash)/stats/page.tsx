import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui";
import { getT, localeFromParams } from "@/lib/i18n/server";

import { StatsView } from "./StatsView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "stats");
  return { title: t("meta.title"), description: t("meta.description") };
}

export default function StatsPage() {
  // StatsView reads the period from the URL (useSearchParams).
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-panel" />}>
      <StatsView />
    </Suspense>
  );
}
