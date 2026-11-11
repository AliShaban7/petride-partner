"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { SearchField } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/client";
import { localizedHref, ROUTES } from "@/lib/i18n/navigation";

/**
 * Top-bar search. Codes jump to their list ("A-1042" → appointments, "S-2031" → orders);
 * anything else searches clients & pets: /clients?q=… (the Clients page reads `q`).
 */
export function GlobalSearch({ className, onDone, autoFocus }: { className?: string; onDone?: () => void; autoFocus?: boolean }) {
  const t = useT("shell");
  const locale = useLocale();
  const router = useRouter();
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    const route = /^a-\d+$/i.test(q) ? ROUTES.appointments : /^s-\d+$/i.test(q) ? ROUTES.orders : ROUTES.clients;
    router.push(localizedHref(locale, route, { q }));
    onDone?.();
  };
  return (
    <form onSubmit={submit} className={className}>
      <SearchField
        label={t("topbar.searchLabel")}
        placeholder={t("topbar.searchPlaceholder")}
        value={value}
        onValueChange={setValue}
        autoFocus={autoFocus}
        enterKeyHint="search"
      />
    </form>
  );
}
