/**
 * Mock session cookie: base64url JSON { partnerId, email, iat }. NOT signed — fine for the demo,
 * replaced by Supabase Auth (@supabase/ssr) later. Edge/Node safe (used by src/proxy.ts too).
 */
import type { PartnerKind, ServiceCategory } from "@/lib/api/types";

import { accountForPartner } from "./accounts";

export const SESSION_COOKIE = "petride_partner_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { partnerId: string; email: string; iat: number };

/** What the app knows about the signed-in partner user. */
export type Session = {
  partnerId: string;
  partnerKind: PartnerKind;
  partnerName: string;
  partnerShortName: string;
  categories: ServiceCategory[];
  email: string;
  userName: string;
};

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSession(payload: SessionPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/** Parses and validates a cookie value; null when missing, malformed, expired or unknown partner. */
export function decodeSession(value: string | undefined | null): Session | null {
  if (!value) return null;
  try {
    const payload = JSON.parse(fromBase64Url(value)) as Partial<SessionPayload>;
    if (typeof payload.partnerId !== "string" || typeof payload.email !== "string" || typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > SESSION_MAX_AGE * 1000) return null;
    const account = accountForPartner(payload.partnerId);
    if (!account) return null;
    return {
      partnerId: account.partnerId,
      partnerKind: account.partnerKind,
      partnerName: account.partnerName,
      partnerShortName: account.partnerShortName,
      categories: [...account.categories],
      email: payload.email,
      userName: account.userName,
    };
  } catch {
    return null;
  }
}
