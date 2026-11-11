"use client";

import { Lock } from "lucide-react";
import { useState } from "react";

import { Button, Textarea, useToast } from "@/components/ui";
import { errorCode, useApiMutation } from "@/lib/api/hooks";
import type { PartnerApi } from "@/lib/api";
import { useT } from "@/lib/i18n/client";

const MAX = 1000;

/** Internal (team-only) note with save/undo. Used for pets (updatePetNote) and owners (updateClientNote). */
export function NoteEditor({
  label,
  initial,
  save,
  invalidates,
}: {
  label: string;
  initial: string;
  save: (api: PartnerApi, note: string) => Promise<unknown>;
  invalidates: readonly string[];
}) {
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
    <div className="space-y-3">
      <Textarea
        label={label}
        hint={
          <span className="inline-flex items-center gap-1">
            <Lock aria-hidden="true" size={12} />
            {t("notes.privateHint")} · {t("notes.counter", { count: value.length, max: MAX })}
          </span>
        }
        value={value}
        maxLength={MAX}
        rows={5}
        placeholder={t("notes.placeholder")}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
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
  );
}
