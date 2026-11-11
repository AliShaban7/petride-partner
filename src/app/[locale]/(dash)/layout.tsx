import type { ReactNode } from "react";

import { AppShell } from "@/components/shell";
import { PartnerApiProvider } from "@/lib/api/provider";
import { SessionProvider } from "@/lib/auth/client";
import { requireSession } from "@/lib/auth/server";
import { localeFromParams } from "@/lib/i18n/server";

/** Every dashboard page: verified session → API bound to that partner → app shell. */
export default async function DashboardLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await localeFromParams(params);
  const session = await requireSession(locale);
  return (
    <SessionProvider session={session}>
      <PartnerApiProvider partnerId={session.partnerId}>
        <AppShell>{children}</AppShell>
      </PartnerApiProvider>
    </SessionProvider>
  );
}
