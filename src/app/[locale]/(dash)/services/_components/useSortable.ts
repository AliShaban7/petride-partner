"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Drag-to-reorder for a short vertical list, with no library:
 * - pointer (mouse, touch, pen) on the row's handle: the row follows the pointer slot by slot;
 * - keyboard on the handle: ↑ / ↓ move one place, Home / End to the ends;
 * - rows glide to their new place (FLIP), unless the user prefers reduced motion;
 * - every move is announced through `onAnnounce`.
 * Rows need `data-sortable-id={id}` and live inside the element given `listRef`.
 */
export function useSortable({
  ids,
  onReorder,
  onAnnounce,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  /** Called with (id, newIndex, total) after a keyboard move or a drop. */
  onAnnounce?: (id: string, index: number, total: number) => void;
}) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const idsRef = useRef(ids);
  const onReorderRef = useRef(onReorder);
  const onAnnounceRef = useRef(onAnnounce);
  const drag = useRef<{ id: string; pointerId: number } | null>(null);
  const positions = useRef(new Map<string, number>());
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    idsRef.current = ids;
    onReorderRef.current = onReorder;
    onAnnounceRef.current = onAnnounce;
  });

  // FLIP: animate rows from their previous position to the new one.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-sortable-id]"));
    for (const row of rows) {
      const id = row.dataset.sortableId ?? "";
      const top = row.getBoundingClientRect().top;
      const before = positions.current.get(id);
      if (!reduce && before !== undefined && Math.abs(before - top) > 1 && typeof row.animate === "function") {
        row.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], { duration: 180, easing: "cubic-bezier(0, 0, 0.58, 1)" });
      }
      positions.current.set(id, top);
    }
    if (refocus.current) {
      const handle = list.querySelector<HTMLElement>(`[data-sortable-handle="${CSS.escape(refocus.current)}"]`);
      if (handle && document.activeElement !== handle) handle.focus({ preventScroll: true });
      refocus.current = null;
    }
  }, [ids]);

  const move = useCallback((id: string, to: number) => {
    const current = idsRef.current;
    const from = current.indexOf(id);
    const target = Math.max(0, Math.min(current.length - 1, to));
    if (from < 0 || from === target) return false;
    // Fresh positions before the move so the FLIP starts from where rows are now.
    const list = listRef.current;
    if (list) {
      for (const row of Array.from(list.querySelectorAll<HTMLElement>("[data-sortable-id]"))) {
        positions.current.set(row.dataset.sortableId ?? "", row.getBoundingClientRect().top);
      }
    }
    const next = current.filter((x) => x !== id);
    next.splice(target, 0, id);
    idsRef.current = next;
    onReorderRef.current(next);
    return true;
  }, []);

  // Pointer drags listen on the window, not on the handle: React moves the dragged row's DOM node
  // while it is reordered, and moving a node can drop its pointer capture (the row would then stop
  // following and the drag would never end). Window listeners keep working either way.
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const startDrag = useCallback(
    (id: string, pointerId: number) => {
      stopDrag.current?.();
      drag.current = { id, pointerId };
      setDraggingId(id);
      const onMove = (e: globalThis.PointerEvent) => {
        const d = drag.current;
        const list = listRef.current;
        if (!d || d.pointerId !== e.pointerId || !list) return;
        e.preventDefault();
        const others = Array.from(list.querySelectorAll<HTMLElement>("[data-sortable-id]")).filter((el) => el.dataset.sortableId !== d.id);
        let index = 0;
        for (const el of others) {
          const r = el.getBoundingClientRect();
          if (e.clientY > r.top + r.height / 2) index += 1;
        }
        move(d.id, index);
      };
      const finish = (e: globalThis.PointerEvent, announce: boolean) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId) return;
        cleanup();
        if (announce) onAnnounceRef.current?.(d.id, idsRef.current.indexOf(d.id), idsRef.current.length);
      };
      const onUp = (e: globalThis.PointerEvent) => finish(e, true);
      const onCancel = (e: globalThis.PointerEvent) => finish(e, false);
      const cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        drag.current = null;
        stopDrag.current = null;
        setDraggingId(null);
      };
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      stopDrag.current = cleanup;
    },
    [move],
  );

  const handleProps = useCallback(
    (id: string) => ({
      "data-sortable-handle": id,
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(id, e.pointerId);
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        const index = idsRef.current.indexOf(id);
        const last = idsRef.current.length - 1;
        const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : e.key === "Home" ? 0 : e.key === "End" ? last : null;
        if (to === null) return;
        e.preventDefault();
        refocus.current = id;
        if (move(id, to)) onAnnounceRef.current?.(id, Math.max(0, Math.min(last, to)), idsRef.current.length);
      },
    }),
    [move, startDrag],
  );

  /** Move by one (row menu "Move up / down"). */
  const moveBy = useCallback(
    (id: string, delta: number) => {
      const index = idsRef.current.indexOf(id);
      if (move(id, index + delta)) onAnnounceRef.current?.(id, idsRef.current.indexOf(id), idsRef.current.length);
    },
    [move],
  );

  return { listRef, draggingId, handleProps, moveBy };
}
