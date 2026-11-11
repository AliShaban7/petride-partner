"use client";

import { createContext, use, type ReactNode } from "react";

import type { Session } from "./session";

const SessionContext = createContext<Session | null>(null);

/** Mounted by the (dash) layout with the server-verified session. */
export function SessionProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <SessionContext value={session}>{children}</SessionContext>;
}

/** The signed-in partner user (Client Components inside the dashboard). */
export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error("useSession must be used inside the dashboard (<SessionProvider>)");
  return session;
}
