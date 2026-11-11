import type { Metadata } from "next";

import { getT, localeFromParams } from "@/lib/i18n/server";

import { LoginView } from "./LoginView";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT(await localeFromParams(params), "auth");
  return { title: t("meta.title") };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const locale = await localeFromParams(params);
  const { next } = await searchParams;
  return <LoginView locale={locale} next={typeof next === "string" ? next : undefined} />;
}
