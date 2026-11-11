"use client";

import { ArrowLeft, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CornerPaw, type PawPet } from "@/components/illustrations";
import { Pill, StatusPill, buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui";
import type { ClientSource, Pet } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatAge, formatPhone, phoneHref } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { PetAvatar } from "./PetAvatar";

const STAT_TONES = { mint: "bg-pastel-mint", peach: "bg-pastel-peach", lilac: "bg-pastel-lilac", sand: "bg-pastel-sand", sky: "bg-pastel-sky" } as const;

/** Compact pastel number tile (profile pages). Text on pastel: text-fg / text-fg-tertiary only. */
export function MiniStat({
  label,
  value,
  icon,
  footnote,
  tone = "mint",
  pet,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  footnote?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  pet?: PawPet;
  index?: number;
}) {
  return (
    <div
      className={cn("group relative isolate min-h-28 animate-fade-up overflow-hidden rounded-panel p-4 sm:p-5", STAT_TONES[tone])}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className="relative z-10 flex items-center gap-2 text-meta font-semibold text-fg-tertiary sm:text-body-sm">
        {icon ? (
          <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface/75 text-fg">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0">{label}</span>
      </p>
      <p className="relative z-10 mt-2 font-display text-h1 font-extrabold tracking-tight text-fg tabular">{value}</p>
      {footnote ? <p className={cn("relative z-10 mt-1 text-meta text-fg-tertiary", pet && "pr-12")}>{footnote}</p> : null}
      {pet ? <CornerPaw pet={pet} width={38} reach={42} /> : null}
    </div>
  );
}

/** "← Clients" link above a profile. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-chip pr-3 text-body-sm font-semibold text-fg-secondary transition-colors hover:text-fg"
    >
      <ArrowLeft aria-hidden="true" size={18} />
      {children}
    </Link>
  );
}

/** tel: link styled as a button. */
export function CallLink({
  phone,
  label,
  variant = "outline",
  size = "md",
  className,
}: {
  phone: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <a href={phoneHref(phone)} className={buttonClasses({ variant, size, className })} aria-label={`${label}: ${formatPhone(phone)}`}>
      <Phone aria-hidden="true" size={18} />
      {label}
    </a>
  );
}

/** Where the client first came from (PetRide app, phone, walk-in). */
export function SourcePill({ source }: { source: ClientSource }) {
  const ts = useT("status");
  return (
    <Pill tone={source === "petride" ? "info" : "neutral"} size="sm">
      {ts.dynamic(`source.${source}`)}
    </Pill>
  );
}

/** A pet as a row link (owner pages, quick view). */
export function PetLinkRow({ pet, href, now }: { pet: Pet; href: string; now: number }) {
  const locale = useLocale();
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface p-3 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <PetAvatar name={pet.name} species={pet.species} tint={pet.tint} photoUrl={pet.photoUrl} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-fg">{pet.name}</span>
        <span className="block truncate text-meta text-fg-secondary">
          {pet.breed} · {formatAge(pet.birthDate, locale, new Date(now))}
        </span>
        <StatusPill kind="health" status={pet.healthStatus} size="sm" className="mt-1" />
      </span>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-fg-secondary transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
