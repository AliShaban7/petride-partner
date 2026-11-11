"use client";

import { CalendarClock, Car, History, UserRound, Weight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CornerPaw } from "@/components/illustrations";
import { Skeleton, StatusPill } from "@/components/ui";
import type { Pet } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatAge, formatDate, formatDayLabel, formatTime, formatWeight } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import type { DirectoryMode } from "../_lib/directory";
import { SOFT_BAND, pawFor } from "../_lib/look";
import { PetAvatar } from "./PetAvatar";

/** Paws stay still until the card is hovered or focused (24 bobbing paws at once is too busy). */
const PAUSED_PAWS =
  "[&_.animate-paw-bob]:[animation-play-state:paused] hover:[&_.animate-paw-bob]:[animation-play-state:running] focus-visible:[&_.animate-paw-bob]:[animation-play-state:running]";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 text-fg-secondary">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-fg">{children}</dd>
    </div>
  );
}

/** One pet in the directory grid: pastel band with a peeking paw, initial art, health pill, owner, next visit. */
export function PetCard({ pet, href, mode, cameWithRide, now, index = 0 }: { pet: Pet; href: string; mode: DirectoryMode; cameWithRide: boolean; now: number; index?: number }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const today = new Date(now);
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full animate-fade-up flex-col overflow-hidden rounded-card bg-surface shadow-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover",
        PAUSED_PAWS,
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className={cn("relative h-20 shrink-0 overflow-hidden", SOFT_BAND[pet.tint])}>
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 p-3 text-caption font-semibold text-fg-tertiary">
          <span className="tabular">{pet.code}</span>
          {cameWithRide ? (
            <span className="inline-flex items-center gap-1 rounded-chip bg-surface/80 px-2 py-0.5 text-fg">
              <Car aria-hidden="true" size={12} strokeWidth={2.2} />
              {mode === "visits" ? t("pet.rideTag") : t("pet.courierTag")}
            </span>
          ) : null}
        </div>
        <CornerPaw pet={pawFor(pet)} width={34} reach={42} tilt={-24} />
      </div>
      <div className="relative flex flex-1 flex-col px-4 pb-4">
        <PetAvatar name={pet.name} species={pet.species} tint={pet.tint} photoUrl={pet.photoUrl} size="md" className="-mt-8 rounded-[30%] ring-4 ring-surface" />
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <h3 className="min-w-0 truncate font-display text-title font-extrabold text-fg">{pet.name}</h3>
          <StatusPill kind="health" status={pet.healthStatus} size="sm" />
        </div>
        <p className="mt-0.5 truncate text-meta text-fg-secondary">
          {pet.breed} · {formatAge(pet.birthDate, locale, today)}
        </p>
        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-meta">
          <Row icon={<UserRound size={14} />} label={t("pet.owner")}>
            {pet.ownerName}
          </Row>
          {mode === "visits" ? (
            <>
              <Row icon={<CalendarClock size={14} />} label={t("pet.next")}>
                {pet.nextAppointment ? (
                  <>
                    <span className="font-semibold">
                      {formatDayLabel(pet.nextAppointment.start, locale, today)}, {formatTime(pet.nextAppointment.start)}
                    </span>
                    <span className="text-fg-secondary"> · {pet.nextAppointment.serviceName}</span>
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
    <div aria-hidden="true" className="overflow-hidden rounded-card bg-surface shadow-card">
      <Skeleton className="h-20 rounded-none" />
      <div className="px-4 pb-4">
        <Skeleton className="-mt-8 size-16 rounded-[30%] ring-4 ring-surface" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <Skeleton className="mt-2 h-3 w-2/3" />
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}
