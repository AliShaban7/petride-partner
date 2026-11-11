import type { Metadata } from "next";

import { getT, localeFromParams } from "@/lib/i18n/server";

import { OverviewView } from "./OverviewView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "overview");
  return { title: t("meta.title"), description: t("meta.description") };
}

export default function OverviewPage() {
  return <OverviewView />;
}
