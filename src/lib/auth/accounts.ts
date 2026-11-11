/**
 * Demo partner accounts (mock auth). Supabase Auth replaces this — see README "Supabase".
 * Shared by the login server action, the proxy and the shell (no secrets beyond the demo password).
 */
import type { PartnerKind, ServiceCategory } from "@/lib/api/types";

export type DemoAccount = {
  email: string;
  password: string;
  partnerId: string;
  partnerKind: PartnerKind;
  partnerName: string;
  partnerShortName: string;
  categories: ServiceCategory[];
  /** Person shown in the profile menu. */
  userName: string;
};

export const DEMO_PASSWORD = "petride123";

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: "idea@petride.az",
    password: DEMO_PASSWORD,
    partnerId: "idea",
    partnerKind: "clinic",
    partnerName: "IDEA Animal Care Center",
    partnerShortName: "IDEA",
    categories: ["vet", "groom", "hotel"],
    userName: "IDEA Admin",
  },
  {
    email: "shop@petride.az",
    password: DEMO_PASSWORD,
    partnerId: "pawpaw",
    partnerKind: "petshop",
    partnerName: "PawPaw Pet Shop",
    partnerShortName: "PawPaw",
    categories: ["shop"],
    userName: "PawPaw Admin",
  },
];

export function findAccount(email: string): DemoAccount | undefined {
  const needle = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === needle);
}

export function accountForPartner(partnerId: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.partnerId === partnerId);
}
