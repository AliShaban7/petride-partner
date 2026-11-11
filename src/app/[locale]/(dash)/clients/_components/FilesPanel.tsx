"use client";

import { ExternalLink, FileImage, FileText, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

import { Button, ConfirmDialog, EmptyState, IconButton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDecimal } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";

import { addPetFiles, removePetFile, useNow, usePetFiles, type PetFile } from "../_lib/stores";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Lab results, X-rays, vaccination passport scans… The PartnerApi has no file storage yet, so
 * uploads stay in this browser tab (object URLs) and the panel says so.
 */
export function FilesPanel({ petId, petName }: { petId: string; petName: string }) {
  const t = useT("clients");
  const tc = useT("common");
  const locale = useLocale();
  const { toast } = useToast();
  const files = usePetFiles(petId);
  const now = useNow();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [toRemove, setToRemove] = useState<PetFile | null>(null);

  const size = (bytes: number) =>
    bytes >= 1024 * 1024 ? t("files.mb", { value: formatDecimal(bytes / (1024 * 1024), locale) }) : t("files.kb", { value: formatDecimal(Math.max(1, bytes / 1024), locale) });

  const take = (list: FileList | null) => {
    if (!list?.length) return;
    const all = Array.from(list);
    const ok = all.filter((f) => f.size <= MAX_BYTES && (ACCEPT.includes(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)));
    if (ok.length < all.length) toast({ title: t("files.rejected"), description: t("files.rules"), tone: "error" });
    if (ok.length) {
      addPetFiles(petId, ok);
      toast({ title: t.plural("files.added", ok.length) });
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <input ref={inputRef} id={inputId} type="file" multiple accept=".pdf,image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => take(e.target.files)} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors sm:flex-row sm:justify-between sm:text-left",
          dragging ? "border-primary bg-primary-selected" : "border-border bg-surface-muted",
        )}
      >
        <div className="min-w-0">
          <p className="font-semibold text-fg">{t("files.dropTitle", { pet: petName })}</p>
          <p className="text-meta text-fg-secondary">{t("files.rules")}</p>
        </div>
        <Button variant="secondary" leftIcon={<Upload aria-hidden="true" size={18} />} onClick={() => inputRef.current?.click()}>
          {t("files.upload")}
        </Button>
      </div>

      {files.length ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {files.map((f) => {
            const image = f.type.startsWith("image/");
            const Icon = image ? FileImage : FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span aria-hidden="true" className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-tile text-fg", image ? "bg-pastel-sky" : "bg-pastel-peach")}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-fg">{f.name}</span>
                  <span className="block text-meta text-fg-secondary">
                    {size(f.size)} · {formatDateTime(f.addedAt, locale, new Date(now))}
                  </span>
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-surface-muted"
                  aria-label={`${t("files.open", { name: f.name })} (${tc("a11y.newTab")})`}
                  title={t("files.open", { name: f.name })}
                >
                  <ExternalLink aria-hidden="true" size={18} />
                </a>
                <IconButton label={t("files.remove", { name: f.name })} icon={<Trash2 size={18} />} onClick={() => setToRemove(f)} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact pet="cream" title={t("files.emptyTitle")} description={t("files.emptyBody")} />
      )}
      <p className="text-meta text-fg-secondary">{t("files.demoNote")}</p>

      <ConfirmDialog
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={() => {
          if (toRemove) removePetFile(petId, toRemove.id);
          setToRemove(null);
          toast({ title: t("files.removed") });
        }}
        tone="danger"
        title={t("files.removeTitle")}
        description={toRemove ? t("files.removeBody", { name: toRemove.name }) : undefined}
        confirmLabel={tc("actions.delete")}
      />
    </div>
  );
}
