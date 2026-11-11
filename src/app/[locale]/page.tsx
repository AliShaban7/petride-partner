import { redirect } from "next/navigation";

import { localizedHref, ROUTES } from "@/lib/i18n/navigation";
import { localeFromParams } from "@/lib/i18n/server";

/** /az → /az/overview (the proxy normally does this before we get here). */
export default async function LocaleIndex({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFromParams(params);
  redirect(localizedHref(locale, ROUTES.overview));
}
