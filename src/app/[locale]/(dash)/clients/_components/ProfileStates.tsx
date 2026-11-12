"use client";

import { ArrowLeft } from "lucide-react";

import { Button, ButtonLink, EmptyState, ErrorState, Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui";
import { errorCode } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n/client";

/**
 * Skeleton of a profile page (band with avatar, title and facts; then tabs + side panels). `title`
 * is the page's h1 while the name loads (visually hidden); in a dialog it is the h2 that names the
 * dialog (`heading="h2"`, `titleId`).
 */
export function ProfileSkeleton({ title, heading: Heading = "h1", titleId }: { title: string; heading?: "h1" | "h2"; titleId?: string }) {
  const tc = useT("common");
  return (
    <div aria-busy="true" className="space-y-section">
      <Heading id={titleId} className="sr-only">
        {title}
      </Heading>
      <span className="sr-only">{tc("states.loading")}</span>
      <div aria-hidden="true" className="overflow-hidden rounded-panel bg-surface shadow-card">
        <div className="flex items-center gap-4 p-4 lg:px-5">
          <Skeleton className="size-16 shrink-0 rounded-[30%]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2 bg-surface px-4 py-3 lg:px-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="@container">
        <div className="grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-panel bg-surface p-4 shadow-card lg:p-5">
            <Skeleton className="h-9 w-full max-w-md" />
            <SkeletonRows rows={5} className="mt-3" />
          </div>
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

/**
 * Not found (deleted / wrong link) vs. any other error (retry). On a page the not-found state links
 * back to the list (`backHref`); in a modal over the list, `onBack` closes it instead (the list,
 * with its search, sort and page, is right underneath).
 */
export function ProfileError({
  error,
  onRetry,
  backHref,
  onBack,
  kind,
}: {
  error: unknown;
  onRetry: () => void;
  backHref: string;
  onBack?: () => void;
  kind: "pet" | "owner";
}) {
  const t = useT("clients");
  const tc = useT("common");
  if (errorCode(error) === "not_found") {
    return (
      <EmptyState
        pet={kind === "pet" ? "tabby" : "golden"}
        title={kind === "pet" ? t("profile.petNotFound") : t("profile.ownerNotFound")}
        description={t("profile.notFoundBody")}
        action={
          onBack ? (
            <Button variant="secondary" onClick={onBack}>
              {tc("actions.close")}
            </Button>
          ) : (
            <ButtonLink href={backHref} variant="secondary" leftIcon={<ArrowLeft aria-hidden="true" size={18} />}>
              {kind === "owner" ? t("profile.backToOwners") : t("profile.backToClients")}
            </ButtonLink>
          )
        }
      />
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}
