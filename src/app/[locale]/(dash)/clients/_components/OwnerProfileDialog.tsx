"use client";

import { X } from "lucide-react";
import { useId, useRef } from "react";

import { IconButton } from "@/components/ui";
import { Portal, useModalLayer } from "@/components/ui/overlay";
import { useT } from "@/lib/i18n/client";

import { OwnerProfile } from "./OwnerProfile";

/**
 * The full owner profile as a large modal over the clients list. Opened by a click on an owner
 * (the URL gets `?id=<clientId>`, so Back closes it) and by `/clients?id=…` links from
 * notifications and the appointment / order drawers. The /clients/owners/[id] page stays for
 * direct links and "open in a new tab".
 *
 * ≥ 640px: centred, up to 72rem wide, scrolls inside itself. Phones: a bottom sheet that clears the
 * home indicator. Same modal behaviour as Dialog (focus trap, Esc, scroll lock, focus return); the
 * message and booking dialogs opened from the profile stack on top of it.
 *
 * The backdrop ignores the second click of a double click: a double click on an owner row would
 * otherwise open the modal and close it again on the backdrop that just appeared under the mouse.
 */
export function OwnerProfileDialog({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const tc = useT("common");
  useModalLayer(Boolean(clientId), ref, onClose);
  if (!clientId) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-fade-in bg-overlay"
          onClick={(e) => {
            if (e.detail <= 1) onClose();
          }}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="relative flex max-h-[94dvh] w-full max-w-6xl animate-sheet-up flex-col overflow-hidden rounded-t-panel bg-bg shadow-sheet sm:max-h-[calc(100dvh-3rem)] sm:animate-pop sm:rounded-panel"
        >
          {/*
            First in the DOM, so it gets the initial focus. It floats over the band's top-right corner
            (ProfileBand reserveCorner keeps that free) and stays put while the profile scrolls under
            it, so it has an outline and a shadow to read as a control over any content.
          */}
          <IconButton
            label={tc("a11y.closeDialog")}
            icon={<X size={20} />}
            variant="outline"
            onClick={onClose}
            className="absolute right-5 top-5 z-10 bg-surface/90 shadow-card backdrop-blur-sm sm:right-6 sm:top-6"
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(--spacing(3)+env(safe-area-inset-bottom))] sm:p-4">
            <OwnerProfile key={clientId} clientId={clientId} variant="dialog" titleId={titleId} onClose={onClose} />
          </div>
        </div>
      </div>
    </Portal>
  );
}
