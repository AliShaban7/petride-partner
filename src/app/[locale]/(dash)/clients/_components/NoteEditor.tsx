"use client";

import { Lock } from "lucide-react";
import { useId, useState } from "react";

import { Button, Textarea, useToast } from "@/components/ui";
import { errorCode, useApiMutation } from "@/lib/api/hooks";
import type { PartnerApi } from "@/lib/api";
import { useT } from "@/lib/i18n/client";

const MAX = 1000;
/** The counter only shows near the limit (the textarea stops at MAX anyway), so the hint and Save share a line. */
const COUNTER_FROM = 800;

/**
 * Internal (team-only) note with save/undo, compact: 3 rows, the privacy hint and the buttons share
 * one line (the character counter appears only near the limit). Used for pets (updatePetNote) and
 * owners (updateClientNote). The label is visually hidden by default because the surrounding section
 * already has the "Internal note" heading.
 */
export function NoteEditor({
  label,
  initial,
  save,
  invalidates,
  showLabel,
}: {
  label: string;
  initial: string;
  save: (api: PartnerApi, note: string) => Promise<unknown>;
  invalidates: readonly string[];
  showLabel?: boolean;
}) {
  const hintId = useId();
  const t = useT("clients");
  const tc = useT("common");
  const { toast } = useToast();
  const [value, setValue] = useState(initial);
  const [base, setBase] = useState(initial);
  if (initial !== base) {
    // Fresh data from the server: take it unless the user is in the middle of editing.
    setBase(initial);
    if (value === base) setValue(initial);
  }
  const mutation = useApiMutation((api, note: string) => save(api, note), { invalidates });
  const dirty = value.trim() !== initial.trim();
  const onSave = async () => {
    try {
      await mutation.mutateAsync(value.trim());
      toast({ title: t("notes.saved") });
    } catch (error) {
      toast({ title: tc("states.errorTitle"), description: tc.dynamic(`errors.${errorCode(error)}`), tone: "error" });
    }
  };
  return (
    <div className="space-y-2">
      <Textarea
        label={label}
        hideLabel={!showLabel}
        aria-describedby={hintId}
        value={value}
        maxLength={MAX}
        rows={3}
        placeholder={t("notes.placeholder")}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={hintId} className="inline-flex min-w-0 items-center gap-1 text-meta text-fg-secondary">
          <Lock aria-hidden="true" size={12} className="shrink-0" />
          {t("notes.privateHint")}
          {value.length >= COUNTER_FROM ? (
            <>
              {" · "}
              <span className="tabular">{t("notes.counter", { count: value.length, max: MAX })}</span>
            </>
          ) : null}
        </p>
        <div className="ml-auto flex gap-2">
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={() => setValue(initial)} disabled={mutation.isPending}>
              {t("notes.undo")}
            </Button>
          ) : null}
          <Button size="sm" onClick={onSave} disabled={!dirty} loading={mutation.isPending}>
            {tc("actions.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
