import type { Metadata } from "next";

import { partnerFeatures } from "@/components/shell/nav";
import { getSession } from "@/lib/auth/server";
import { getT, localeFromParams } from "@/lib/i18n/server";

import { ServicesView } from "./ServicesView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "services");
  const session = await getSession();
  const shopOnly = session ? !partnerFeatures(session).appointments && partnerFeatures(session).orders : false;
  return shopOnly ? { title: t("titleShop"), description: t("descriptionShop") } : { title: t("meta.title"), description: t("meta.description") };
}

export default function ServicesPage() {
  return <ServicesView />;
}
