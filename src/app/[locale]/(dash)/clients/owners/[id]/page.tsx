import type { Metadata } from "next";
import { Suspense } from "react";

import { getT, localeFromParams } from "@/lib/i18n/server";

import { OwnerProfileView } from "./OwnerProfileView";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "clients");
  return { title: t("meta.ownerTitle"), description: t("meta.ownerDescription") };
}

export default async function OwnerPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense>
      <OwnerProfileView key={id} clientId={decodeURIComponent(id)} />
    </Suspense>
  );
}
