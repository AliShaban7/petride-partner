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

const FACT_TONES = { mint: "bg-soft-mint", peach: "bg-soft-peach", lilac: "bg-soft-lilac", sand: "bg-soft-sand", sky: "bg-soft-sky" } as const;

export type BandFact = {
  id: string;
  label: string;
  icon: ReactNode;
  value: ReactNode;
  footnote?: ReactNode;
  tone: keyof typeof FACT_TONES;
  /** A paw peeking into the cell (decorative). */
  pet?: PawPet;
};

/**
 * Profile header in one band: avatar, title block (the page's PageHeader with the h1), a line of
 * details and the actions on top, the key facts under them as one row of soft pastel cells (2 × 2 on
 * phones). From 640px the details sit under the title, next to the avatar; on phones they take the
 * band's full width under the avatar row (fewer wrapped lines). Text on the pastel cells:
 * text-fg / text-fg-tertiary only.
 *
 * `reserveCorner` keeps the top-right corner free for a dialog's close button that floats over it
 * (OwnerProfileDialog): from 640px the whole top row (title and actions) ends left of it; on phones,
 * where the actions wrap under the name, only the title block does.
 */
export function ProfileBand({
  avatar,
  header,
  details,
  actions,
  facts,
  factsLabel,
  reserveCorner,
}: {
  avatar: ReactNode;
  header: ReactNode;
  /** Small grey line(s) under the title: contact, breed, … (icons + text, wraps per item). */
  details?: ReactNode;
  actions?: ReactNode;
  facts: BandFact[];
  factsLabel: string;
  /** Keep the top-right corner free for a floating close button (see above). */
  reserveCorner?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-panel bg-surface shadow-card">
      {/* The lg: longhand is needed too: lg:px-5 would otherwise win over a plain sm:pr-16 from 1024px. */}
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 p-4 lg:px-5", reserveCorner && "sm:pr-16 lg:pr-16")}>
        <div className="grid min-w-0 flex-1 basis-72 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:gap-x-4 sm:gap-y-0.5">
          <div className={cn(details && "sm:row-span-2")}>{avatar}</div>
          <div className={cn("min-w-0", details && "sm:self-end", reserveCorner && "max-sm:pr-12")}>{header}</div>
          {details ? (
            <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-secondary sm:col-span-1 sm:col-start-2 sm:self-start">
              {details}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
      </div>
      <section aria-label={factsLabel}>
        <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
          {facts.map((fact, i) => (
            <div
              key={fact.id}
              className={cn("relative isolate min-w-0 animate-fade-up overflow-hidden px-4 py-3 lg:px-5", FACT_TONES[fact.tone])}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <dt className="relative z-10 flex items-center gap-1.5 text-meta font-semibold text-fg-tertiary">
                <span aria-hidden="true" className="inline-flex shrink-0">
                  {fact.icon}
                </span>
                <span className="min-w-0">{fact.label}</span>
              </dt>
              <dd className="relative z-10 mt-0.5 font-display text-h2 font-extrabold tracking-tight text-fg tabular">{fact.value}</dd>
              {fact.footnote ? <dd className={cn("relative z-10 text-meta text-fg-tertiary", fact.pet && "sm:pr-9")}>{fact.footnote}</dd> : null}
              {/* Phones: no paw, so the footnote keeps the cell's full width. */}
              {fact.pet ? <CornerPaw pet={fact.pet} width={30} reach={34} className="max-sm:hidden" /> : null}
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/**
 * An invisible ::after that grows a small inline link (≈ 20px tall: a phone number, a date in a
 * history card) to a 44px touch target below 1024px, without making its line any taller.
 */
export const TOUCH_HIT_AREA = "relative max-lg:after:absolute max-lg:after:inset-x-0 max-lg:after:-inset-y-3 max-lg:after:content-['']";

/** "← Clients" link above a profile (44px on touch widths, 36px from 1024px). */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-chip pr-3 text-body-sm font-semibold text-fg-secondary transition-colors hover:text-fg lg:min-h-9"
    >
      <ArrowLeft aria-hidden="true" size={18} />
      {children}
    </Link>
  );
}

/**
 * tel: link styled as a button. `compactOnPhone` keeps only the icon below 640px (the label stays
 * for screen readers through aria-label).
 */
export function CallLink({
  phone,
  label,
  variant = "outline",
  size = "md",
  compactOnPhone,
  className,
}: {
  phone: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  compactOnPhone?: boolean;
  className?: string;
}) {
  return (
    <a href={phoneHref(phone)} className={buttonClasses({ variant, size, className })} aria-label={`${label}: ${formatPhone(phone)}`}>
      <Phone aria-hidden="true" size={18} />
      <span className={cn(compactOnPhone && "max-sm:sr-only")}>{label}</span>
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

/** A pet as a compact row link (owner pages, quick view): name + health on one line, breed · age under it. */
export function PetLinkRow({ pet, href, now }: { pet: Pet; href: string; now: number }) {
  const locale = useLocale();
  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center gap-3 rounded-card border border-border bg-surface p-2.5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <PetAvatar name={pet.name} species={pet.species} tint={pet.tint} photoUrl={pet.photoUrl} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 truncate font-semibold text-fg">{pet.name}</span>
          <StatusPill kind="health" status={pet.healthStatus} size="sm" />
        </span>
        <span className="block truncate text-meta text-fg-secondary">
          {pet.breed} · {formatAge(pet.birthDate, locale, new Date(now))}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-fg-secondary transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
