"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Portal, useDismiss } from "./overlay";

export type MenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Action item… */
  onSelect?: () => void;
  /** …or link item. */
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Divider above this item. */
  separatorBefore?: boolean;
};

export type MenuTriggerProps = {
  id: string;
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  "aria-haspopup": "menu";
  onClick: (e?: { currentTarget: HTMLElement }) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
};

export type MenuProps = {
  /** Render the trigger; spread `props` on a <button>. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: MenuItem[];
  /** Accessible name of the menu. */
  label: string;
  align?: "start" | "end";
  /** Optional block above the items (e.g. signed-in user). */
  header?: ReactNode;
  className?: string;
};

type Position = { left?: number; right?: number; top?: number; bottom?: number; maxHeight?: number };

const GAP = 6;

function findTrigger(menuId: string, triggerId: string): HTMLElement | null {
  return document.getElementById(triggerId) ?? document.querySelector<HTMLElement>(`[data-menu-root="${CSS.escape(menuId)}"] [aria-haspopup=menu]`);
}
const EDGE = 8;

/**
 * Dropdown menu (row actions "…", profile menu, export). WAI-ARIA menu button: ↓/↑/Home/End move,
 * Enter/Space select, Esc closes and returns focus, Tab closes.
 *
 * Renders in a portal with fixed positioning, so a table's scroll box or a drawer footer never
 * clips it; it opens upwards when there is no room below. Esc is caught on window in the capture
 * phase, so a Drawer or Dialog underneath stays open. Scrolling the page or resizing closes it.
 */
export function Menu({ trigger, items, label, align = "end", header, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({});
  const id = useId();
  const triggerId = `${id}-trigger`;
  const wrap = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const itemId = (index: number) => `${id}-item-${index}`;
  // Items and trigger are found in the DOM (not via refs) so the trigger callbacks stay render-safe.
  // The trigger is looked up inside the wrapper, so it works even if a custom button drops `id`.
  const anchor = () => findTrigger(id, triggerId);
  const focusItem = (index: number | undefined) =>
    requestAnimationFrame(() => {
      if (index !== undefined) document.getElementById(itemId(index))?.focus();
    });
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) anchor()?.focus();
  };

  const openMenu = (focusIndex: number | undefined) => {
    const el = anchor();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    setPos(align === "end" ? { right: Math.max(EDGE, vw - r.right), top: r.bottom + GAP } : { left: Math.max(EDGE, r.left), top: r.bottom + GAP });
    setOpen(true);
    focusItem(focusIndex);
  };

  // Flip upwards (or cap the height) once the real size is known.
  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const el = findTrigger(id, triggerId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const h = menu.current.offsetHeight;
    const vh = window.innerHeight;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    if (h <= below) return;
    setPos((p) =>
      above > below
        ? { left: p.left, right: p.right, bottom: vh - r.top + GAP, maxHeight: h > above ? above : undefined }
        : { ...p, maxHeight: below },
    );
  }, [open, id, triggerId]);

  useDismiss(open, [wrap, menu], (reason) => {
    if (reason === "outside") setOpen(false);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      close(true);
    };
    const onMove = (e: Event) => {
      if (menu.current && e.target instanceof Node && menu.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only reads the stable trigger id
  }, [open]);

  const onTriggerKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowDown" ? enabled[0] : enabled[enabled.length - 1]);
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const current = items.findIndex((_, i) => document.getElementById(itemId(i)) === document.activeElement);
    const at = enabled.indexOf(current);
    let next: number | null | undefined = null;
    if (e.key === "ArrowDown") next = enabled[(at + 1) % enabled.length];
    else if (e.key === "ArrowUp") next = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    else if (e.key === "Tab") {
      e.preventDefault();
      close(true);
      return;
    }
    if (next !== null && next !== undefined) {
      e.preventDefault();
      document.getElementById(itemId(next))?.focus();
    }
  };

  const itemClass = (item: MenuItem) =>
    cn(
      "flex min-h-11 w-full items-center gap-3 rounded-tile px-3 text-left text-body-sm font-medium outline-none transition-colors hover:bg-surface-muted focus-visible:bg-primary-selected focus:bg-primary-selected aria-disabled:opacity-50 [&_svg]:shrink-0",
      item.tone === "danger" ? "text-error-text" : "text-fg",
    );

  return (
    <span ref={wrap} data-menu-root={id} className="inline-flex">
      {trigger({
        id: triggerId,
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        "aria-haspopup": "menu",
        onClick: () => (open ? close(false) : openMenu(enabled[0])),
        onKeyDown: onTriggerKey,
      })}
      {open ? (
        <Portal>
          <div
            ref={menu}
            className={cn(
              "fixed z-[55] min-w-56 max-w-[calc(100vw-1rem)] animate-pop overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-floating",
              align === "end" ? "origin-top-right" : "origin-top-left",
              className,
            )}
            style={pos}
          >
            {header ? <div className="border-b border-border px-3 pb-2.5 pt-1.5">{header}</div> : null}
            <ul id={id} role="menu" aria-label={label} onKeyDown={onMenuKey} className={cn(header && "pt-1.5")}>
              {items.map((item, i) => (
                <li key={item.id} role="none" className={cn(item.separatorBefore && "mt-1.5 border-t border-border pt-1.5")}>
                  {item.href && !item.disabled ? (
                    <Link id={itemId(i)} role="menuitem" tabIndex={-1} href={item.href} onClick={() => close(false)} className={itemClass(item)}>
                      {item.icon}
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      id={itemId(i)}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      aria-disabled={item.disabled || undefined}
                      onClick={() => {
                        if (item.disabled) return;
                        close(true);
                        item.onSelect?.();
                      }}
                      className={itemClass(item)}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Portal>
      ) : null}
    </span>
  );
}
