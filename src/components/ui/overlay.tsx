"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** True after hydration (portals need document.body). */
export function useIsClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Renders children into document.body (client only). */
export function Portal({ children }: { children: ReactNode }) {
  const isClient = useIsClient();
  return isClient ? createPortal(children, document.body) : null;
}

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** Stack of open modal layers: only the top one reacts to Esc / Tab. */
const stack: symbol[] = [];

/**
 * Modal behaviour for Dialog / Drawer: focus moves inside (initialFocus or first focusable),
 * Tab / Shift+Tab are trapped, Esc closes the top-most layer, page scroll is locked, and focus
 * returns to the element that opened it (or to `#main` when the layer was open on page load).
 */
export function useModalLayer(open: boolean, containerRef: RefObject<HTMLElement | null>, onClose: () => void, initialFocusRef?: RefObject<HTMLElement | null>) {
  // Portal renders nothing on the hydration pass, so a layer that is already open on first load
  // (e.g. /appointments?id=…) only gets its container one render later — re-run then.
  const isClient = useIsClient();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !isClient) return;
    const token = Symbol("layer");
    stack.push(token);
    const previous = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const frame = requestAnimationFrame(() => {
      if (!container) return;
      const target = initialFocusRef?.current ?? focusables(container)[0] ?? container;
      target.focus({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token || !container) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    // If the focused element disappears (a button that re-renders away, a row that leaves a
    // filter) focus falls to <body> — pull it back inside the top-most layer.
    const refocus = () => {
      if (stack[stack.length - 1] !== token || !container || !container.isConnected) return;
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      (focusables(container)[0] ?? container).focus({ preventScroll: true });
    };
    let guardFrame = 0;
    const scheduleRefocus = () => {
      cancelAnimationFrame(guardFrame);
      guardFrame = requestAnimationFrame(refocus);
    };
    const observer = container ? new MutationObserver(scheduleRefocus) : null;
    if (container && observer) {
      observer.observe(container, { childList: true, subtree: true });
      container.addEventListener("focusout", scheduleRefocus);
    }

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(guardFrame);
      observer?.disconnect();
      container?.removeEventListener("focusout", scheduleRefocus);
      document.removeEventListener("keydown", onKey);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
      if (stack.length === 0) {
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPadding;
      }
      if (previous && previous !== document.body && document.contains(previous)) previous.focus({ preventScroll: true });
      // Opened straight from a link (/clients?id=…, /appointments?id=…): nothing had focus, so
      // land on the page's <main> (tabIndex -1, the skip link's target) instead of <body>.
      else if (stack.length === 0) document.getElementById("main")?.focus({ preventScroll: true });
    };
  }, [open, isClient, containerRef, initialFocusRef]);
}

/** Closes a non-modal popup on outside pointer down / Esc / focus leaving it. */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onDismiss: (reason: "outside" | "escape") => void) {
  const cb = useRef(onDismiss);
  useEffect(() => {
    cb.current = onDismiss;
  });
  useEffect(() => {
    if (!open) return;
    const inside = (node: EventTarget | null) => refs.some((r) => r.current && node instanceof Node && r.current.contains(node));
    const onPointer = (e: PointerEvent) => {
      if (!inside(e.target)) cb.current("outside");
    };
    // Capture phase on window: runs before a Dialog/Drawer underneath, and stops it there so only
    // the popup closes.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cb.current("escape");
    };
    const onFocus = (e: FocusEvent) => {
      if (!inside(e.target)) cb.current("outside");
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, refs]);
}
