"use client";

import { ArrowLeft } from "lucide-react";

import { ButtonLink, EmptyState, ErrorState, Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n/client";

/** Skeleton of a profile page (avatar + title, stat tiles, tabs + side panels). */
export function ProfileSkeleton() {
  const tc = useT("common");
  return (
    <div aria-busy="true" className="space-y-6">
      <span className="sr-only">{tc("states.loading")}</span>
      <div aria-hidden="true" className="flex items-center gap-4">
        <Skeleton className="size-24 shrink-0 rounded-[30%] sm:size-28" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-9 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-48 max-w-full" />
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-panel sm:h-32" />
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-panel bg-surface p-5 shadow-card">
          <Skeleton className="h-10 w-full max-w-md" />
          <SkeletonRows rows={5} className="mt-4" />
        </div>
        <SkeletonCard />
      </div>
    </div>
  );
}

/** Not found (deleted / wrong link) vs. any other error (retry). */
export function ProfileError({ error, onRetry, backHref, kind }: { error: unknown; onRetry: () => void; backHref: string; kind: "pet" | "owner" }) {
  const t = useT("clients");
  if (errorCode(error) === "not_found") {
    return (
      <EmptyState
        pet={kind === "pet" ? "tabby" : "golden"}
        title={kind === "pet" ? t("profile.petNotFound") : t("profile.ownerNotFound")}
        description={t("profile.notFoundBody")}
        action={
          <ButtonLink href={backHref} variant="secondary" leftIcon={<ArrowLeft aria-hidden="true" size={18} />}>
            {kind === "owner" ? t("profile.backToOwners") : t("profile.backToClients")}
          </ButtonLink>
        }
      />
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}
