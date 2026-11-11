import type { Metadata } from "next";
import { Suspense } from "react";

import { getT, localeFromParams } from "@/lib/i18n/server";

import { PetProfileView } from "./PetProfileView";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "clients");
  return { title: t("meta.petTitle"), description: t("meta.petDescription") };
}

export default async function PetPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense>
      <PetProfileView key={id} petId={decodeURIComponent(id)} />
    </Suspense>
  );
}
