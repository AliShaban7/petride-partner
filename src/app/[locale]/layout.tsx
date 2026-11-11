import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter, Nunito } from "next/font/google";
import type { ReactNode } from "react";

import "../globals.css";

import { ToastProvider } from "@/components/ui";
import { cn } from "@/lib/cn";
import { I18nProvider } from "@/lib/i18n/client";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { getT, localeFromParams } from "@/lib/i18n/server";

// UI text: Inter (latin-ext covers ə ğ ı ö ü ş ç; cyrillic for ru).
const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-inter", display: "swap" });
// Display: Baloo 2 — chunky & rounded, has Azerbaijani ə/Ə — but no Cyrillic…
const baloo = Baloo_2({ subsets: ["latin", "latin-ext"], variable: "--font-baloo", display: "swap" });
// …so Russian headings use Nunito (rounded, Cyrillic). globals.css switches it via :lang(ru).
const nunito = Nunito({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-nunito", display: "swap" });

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = getT(locale, "common");
  return {
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    applicationName: t("appName"),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f3f3c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await localeFromParams(params);
  return (
    <html lang={locale} className={cn(inter.variable, baloo.variable, nunito.variable)}>
      <body>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
