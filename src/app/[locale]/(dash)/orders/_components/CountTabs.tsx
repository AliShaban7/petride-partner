"use client";

import { Tabs } from "@/components/ui";

export type CountTab = {
  id: string;
  label: string;
  /** undefined while counts load. */
  count?: number;
  /** "attention" (coral, work waiting for you) or "neutral" (history). */
  tone?: "attention" | "neutral";
};

/**
 * Underline tabs where every tab carries a count and only the actionable ones are coral
 * (a coral "812" on "Handed over" would cry wolf). Thin wrapper over the shared `Tabs`
 * (`countTone`); pair with <TabPanel idPrefix>.
 */
export function CountTabs({ tabs, value, onChange, label, idPrefix, className }: { tabs: CountTab[]; value: string; onChange: (id: string) => void; label: string; idPrefix: string; className?: string }) {
  return (
    <Tabs
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        count: tab.count,
        countTone: tab.tone === "attention" && (tab.count ?? 0) > 0 ? "attention" : "neutral",
      }))}
      value={value}
      onChange={onChange}
      label={label}
      idPrefix={idPrefix}
      className={className}
    />
  );
}
