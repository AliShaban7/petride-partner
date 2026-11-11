import type { Metadata } from "next";
import { Suspense } from "react";

import { getT, localeFromParams } from "@/lib/i18n/server";

import { ClientsView } from "./ClientsView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "clients");
  return { title: t("meta.title"), description: t("meta.description") };
}

export default function ClientsPage() {
  // ClientsView reads the query string (filters live in the URL).
  return (
    <Suspense>
      <ClientsView />
    </Suspense>
  );
}
