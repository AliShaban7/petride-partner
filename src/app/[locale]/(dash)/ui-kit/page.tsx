import type { Metadata } from "next";

import { UiKit } from "./UiKit";

export const metadata: Metadata = { title: "UI kit", robots: { index: false } };

/** Living reference of the design system with real mock data (not in the nav): /az/ui-kit */
export default function UiKitPage() {
  return <UiKit />;
}
