"use client";

import { CalendarClock, Car, History, UserRound, Weight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Skeleton, StatusPill } from "@/components/ui";
import type { Pet } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatAge, formatDate, formatDayLabel, formatTime, formatWeight } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { DirectoryMode } from "../_lib/directory";
import { SOFT_BAND } from "../_lib/look";
import { PetAvatar } from "./PetAvatar";

/** One fact line; `full` is the whole text as a tooltip when the line is cut on narrow cards. */
function Row({ icon, label, full, children }: { icon: ReactNode; label: string; full?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 text-fg-secondary">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-fg" title={full}>
        {children}
      </dd>
    </div>
  );
}

/**
 * One pet in the directory grid, compact: the pet's pastel strip on the left (initial art, PetRide
 * code, PetRide tag), then name + health, breed · age, owner, next and last visit (weight for shops).
 */
export function PetCard({ pet, href, mode, cameWithRide, now, index = 0 }: { pet: Pet; href: string; mode: DirectoryMode; cameWithRide: boolean; now: number; index?: number }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const today = new Date(now);
  const rideLabel = mode === "visits" ? t("pet.rideTag") : t("pet.courierTag");
  const next = pet.nextAppointment;
  const nextText = next ? `${formatDayLabel(next.start, locale, today)}, ${formatTime(next.start)}` : null;
  return (
    <Link
      href={href}
      className="group flex h-full animate-fade-up overflow-hidden rounded-card bg-surface shadow-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {/* Text on the soft band: text-fg / text-fg-tertiary only. */}
      <div className={cn("flex w-18 shrink-0 flex-col items-center gap-1.5 px-1 py-3", SOFT_BAND[pet.tint])}>
        <PetAvatar name={pet.name} species={pet.species} tint={pet.tint} photoUrl={pet.photoUrl} size="sm" />
        <span className="mt-0.5 text-caption font-semibold text-fg-tertiary tabular">{pet.code}</span>
        {cameWithRide ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface/85 text-fg" title={rideLabel}>
            <Car aria-hidden="true" size={13} strokeWidth={2.2} />
            <span className="sr-only">{rideLabel}</span>
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate font-display text-title font-extrabold text-fg">{pet.name}</h3>
          <StatusPill kind="health" status={pet.healthStatus} size="sm" />
        </div>
        {/* A long breed is cut, the age never is (the full breed is in the tooltip and on the profile). */}
        <p className="flex min-w-0 text-meta text-fg-secondary">
          <span className="min-w-0 truncate" title={pet.breed}>
            {pet.breed}
          </span>
          <span className="shrink-0 whitespace-pre"> · {formatAge(pet.birthDate, locale, today)}</span>
        </p>
        <dl className="mt-2 space-y-1 text-meta">
          <Row icon={<UserRound size={14} />} label={t("pet.owner")} full={pet.ownerName}>
            {pet.ownerName}
          </Row>
          {mode === "visits" ? (
            <>
              <Row icon={<CalendarClock size={14} />} label={t("pet.next")} full={next ? `${nextText} · ${next.serviceName}` : undefined}>
                {next ? (
                  <>
                    <span className="font-semibold">{nextText}</span>
                    <span className="text-fg-secondary"> · {next.serviceName}</span>
                  </>
                ) : (
                  <span className="text-fg-secondary">{t("pet.noNext")}</span>
                )}
              </Row>
              <Row icon={<History size={14} />} label={t("pet.lastVisit")}>
                <span className="text-fg-secondary">
                  {pet.lastVisitAt ? t("pet.lastVisitValue", { date: formatDate(pet.lastVisitAt, locale, today) }) : t("pet.noVisits")}
                </span>
              </Row>
            </>
          ) : (
            <Row icon={<Weight size={14} />} label={t("pet.weight")}>
              <span className="text-fg-secondary">
                {formatWeight(pet.weightKg, locale)} · {tc.dynamic(`species.${pet.species}`)}
              </span>
            </Row>
          )}
        </dl>
      </div>
    </Link>
  );
}

export function PetCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex overflow-hidden rounded-card bg-surface shadow-card">
      <div className="flex w-18 shrink-0 flex-col items-center gap-2 bg-surface-muted py-3">
        <Skeleton className="size-11 rounded-[30%]" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="flex-1 space-y-2 p-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-3 h-3 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
