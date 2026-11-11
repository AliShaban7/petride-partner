import type { Metadata } from "next";

import { getSession } from "@/lib/auth/server";
import { getT, localeFromParams } from "@/lib/i18n/server";

import { OrdersView } from "./_components/OrdersView";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "orders");
  // Clinics, salons and hotels see their PetRide rides here instead of shop orders.
  const session = await getSession();
  const shop = session?.categories.includes("shop") ?? true;
  return shop
    ? { title: t("meta.title"), description: t("meta.description") }
    : { title: t("meta.ridesTitle"), description: t("meta.ridesDescription") };
}

export default function OrdersPage() {
  return <OrdersView />;
}
