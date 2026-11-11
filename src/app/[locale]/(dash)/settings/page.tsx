import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton, SkeletonText } from "@/components/ui";
import { getT, localeFromParams } from "@/lib/i18n/server";

import { SettingsView } from "./SettingsView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "settings");
  return { title: t("meta.title"), description: t("meta.description") };
}

/** The view reads `?tab=` (useSearchParams), so it sits in a Suspense boundary. */
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <SkeletonText lines={2} className="max-w-xl" />
          <Skeleton className="h-96 w-full rounded-panel" />
        </div>
      }
    >
      <SettingsView />
    </Suspense>
  );
}
