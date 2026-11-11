import Link from "next/link";

import { PawPeek } from "@/components/illustrations";

/** 404 inside a locale (no translations available here — kept bilingual-neutral and short). */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <PawPeek size={96} pet="tabby" />
      <h1 className="font-display text-h1 font-extrabold">404</h1>
      <p className="text-fg-secondary">Səhifə tapılmadı · Страница не найдена · Page not found</p>
      <Link href="/" className="font-semibold text-primary underline underline-offset-4">
        PetRide Partner
      </Link>
    </main>
  );
}
