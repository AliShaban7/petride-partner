import { Bell, Building2, Clock, Languages, ShieldCheck, Smartphone, UsersRound, type LucideIcon } from "lucide-react";

export const SECTION_IDS = ["profile", "hours", "petride", "notifications", "team", "language", "security"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  profile: Building2,
  hours: Clock,
  petride: Smartphone,
  notifications: Bell,
  team: UsersRound,
  language: Languages,
  security: ShieldCheck,
};

export const isSectionId = (value: unknown): value is SectionId => typeof value === "string" && (SECTION_IDS as readonly string[]).includes(value);

/** Props every settings section gets from the view. */
export type SectionProps = {
  /** Report unsaved edits (nav dot + leave guard). */
  onDirtyChange: (dirty: boolean) => void;
};
