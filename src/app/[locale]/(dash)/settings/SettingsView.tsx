"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useUnsavedGuard } from "@/components/services-settings";
import { PageHeader } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

import { HoursSection } from "./_components/HoursSection";
import { IntegrationSection } from "./_components/IntegrationSection";
import { LanguageSection } from "./_components/LanguageSection";
import { NotificationsSection } from "./_components/NotificationsSection";
import { ProfileSection } from "./_components/ProfileSection";
import { isSectionId, SECTION_IDS, type SectionId } from "./_components/sections";
import { SecuritySection } from "./_components/SecuritySection";
import { SettingsNav } from "./_components/SettingsNav";
import { TeamSection } from "./_components/TeamSection";

/**
 * Settings: profile, working hours, PetRide integration, notifications, team, language and
 * security. The section comes from `?tab=`. Every section stays mounted (only the active one is
 * visible), so switching sections never loses unsaved edits; the nav marks sections with edits
 * and leaving the page with edits asks first.
 */
export function SettingsView() {
  const t = useT("settings");
  const params = useSearchParams();
  const tab = params.get("tab");
  const active: SectionId = isSectionId(tab) ? tab : "profile";
  const [dirty, setDirty] = useState<Partial<Record<SectionId, boolean>>>({});
  const anyDirty = Object.values(dirty).some(Boolean);
  useUnsavedGuard(anyDirty, t("leaveConfirm"));

  const reporters = useMemo(
    () =>
      Object.fromEntries(
        SECTION_IDS.map((id) => [id, (value: boolean) => setDirty((d) => (Boolean(d[id]) === value ? d : { ...d, [id]: value }))]),
      ) as Record<SectionId, (dirty: boolean) => void>,
    [],
  );
  const confirmLeave = useCallback(() => !anyDirty || window.confirm(t("leaveConfirm")), [anyDirty, t]);

  return (
    <div className="space-y-section">
      <PageHeader title={t("title")} />
      {/* From 1280px the sections are a left sub-nav beside the content; narrower, one row of pills above it. */}
      <div className="grid gap-4 xl:grid-cols-[13rem_minmax(0,1fr)] xl:items-start">
        <SettingsNav active={active} dirty={dirty} />
        <div className="min-w-0">
          <div hidden={active !== "profile"}>
            <ProfileSection onDirtyChange={reporters.profile} />
          </div>
          <div hidden={active !== "hours"}>
            <HoursSection onDirtyChange={reporters.hours} />
          </div>
          <div hidden={active !== "petride"}>
            <IntegrationSection onDirtyChange={reporters.petride} />
          </div>
          <div hidden={active !== "notifications"}>
            <NotificationsSection onDirtyChange={reporters.notifications} />
          </div>
          <div hidden={active !== "team"}>
            <TeamSection />
          </div>
          <div hidden={active !== "language"}>
            <LanguageSection confirmLeave={confirmLeave} />
          </div>
          <div hidden={active !== "security"}>
            <SecuritySection />
          </div>
        </div>
      </div>
    </div>
  );
}
