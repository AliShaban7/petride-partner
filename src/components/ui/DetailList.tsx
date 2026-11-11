import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type DetailItem = { label: ReactNode; value: ReactNode; icon?: ReactNode };

/** Label → value pairs (<dl>) for drawers and detail cards. */
export function DetailList({ items, columns = 1, className }: { items: DetailItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-meta text-fg-secondary">
            {item.icon}
            {item.label}
          </dt>
          <dd className="mt-0.5 break-words text-body font-medium text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
