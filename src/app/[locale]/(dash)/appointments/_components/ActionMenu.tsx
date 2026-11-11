"use client";

import { Menu, type MenuItem, type MenuProps } from "@/components/ui";

/** Row-actions item. Kept as a name for the appointments code; same shape as the shared MenuItem. */
export type ActionMenuItem = MenuItem & { onSelect: () => void };

/**
 * Row-actions menu ("…"). The shared `Menu` now renders in a portal with fixed positioning,
 * flips upwards and keeps Esc from closing a Drawer underneath, so this is a plain alias.
 */
export function ActionMenu({ label, items, trigger }: Pick<MenuProps, "label" | "trigger"> & { items: ActionMenuItem[] }) {
  return <Menu label={label} items={items} trigger={trigger} />;
}
