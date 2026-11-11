"use client";

import { Suspense } from "react";

import { SkeletonCard } from "@/components/ui";
import { partnerFeatures } from "@/components/shell";
import { useSession } from "@/lib/auth/client";

import { RidesView } from "./RidesView";
import { ShopOrdersView } from "./ShopOrdersView";

/**
 * One nav item, useful for every partner type: pet shops get their shop orders (table / Kanban,
 * products & stock); clinics, salons and hotels get the PetRide rides to and from them.
 */
export function OrdersView() {
  const session = useSession();
  const { orders } = partnerFeatures(session);
  return (
    // useSearchParams below reads the URL; the boundary keeps prerendering rules happy.
    <Suspense fallback={<SkeletonCard className="h-72" />}>{orders ? <ShopOrdersView /> : <RidesView />}</Suspense>
  );
}
