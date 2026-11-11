"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

import { Portal } from "./overlay";

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** e.g. { label: "Undo", onClick } */
  action?: { label: string; onClick: () => void };
  /** ms; default 4000 (app motion.toast). Errors stay 7000. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number };

type ToastApi = { toast: (options: ToastOptions) => number; dismiss: (id: number) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Mounted once in app/[locale]/layout.tsx. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT("common");
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((options: ToastOptions) => {
    seq.current += 1;
    const id = seq.current;
    setItems((list) => [...list.slice(-2), { ...options, id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext value={api}>
      {children}
      <Portal>
        <div
          role="region"
          aria-label={t("a11y.toasts")}
          aria-live="polite"
          className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--tabbar-h)+0.75rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end"
        >
          {items.map((item) => (
            <ToastView key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>
      </Portal>
    </ToastContext>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const t = useT("common");
  const tone = item.tone ?? "success";
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, item.duration ?? (tone === "error" ? 7000 : 4000));
    return () => window.clearTimeout(timer);
  }, [paused, item.duration, tone, onDismiss]);
  const Icon = tone === "success" ? CircleCheck : tone === "error" ? CircleAlert : Info;
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-card bg-live-surface p-3.5 pr-2 text-on-primary shadow-sheet"
      data-surface="dark"
    >
      <Icon
        aria-hidden="true"
        size={20}
        className={cn("mt-0.5 shrink-0", tone === "success" && "text-live-accent", tone === "error" && "text-accent", tone === "info" && "text-on-primary-muted")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-meta text-on-dark-muted">{item.description}</p> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss();
          }}
          className="min-h-9 shrink-0 rounded-tile px-2.5 text-body-sm font-bold text-live-accent hover:bg-white/10"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("a11y.dismiss")}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-on-dark-muted hover:bg-white/10 hover:text-on-primary"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

/** toast({ title, description?, tone: "success" | "error" | "info", action? }). */
export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
