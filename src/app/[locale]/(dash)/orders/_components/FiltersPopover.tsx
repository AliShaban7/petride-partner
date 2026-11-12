"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, CountBadge, Popover } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Phones: an icon "Filters" button next to the search, with the secondary filter(s) in a popover,
 * so search and filters share one row. The badge counts the filters set inside. From 640px the
 * pages show those filters inline instead (pass `className="sm:hidden"`).
 */
export function FiltersPopover({ label, count, children, className }: { label: string; count: number; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("shrink-0", className)}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={label}
        trigger={(p) => (
          <Button {...p} variant="outline" className="px-3" leftIcon={<SlidersHorizontal size={18} aria-hidden="true" />}>
            <span className="sr-only">{label}</span>
            <CountBadge count={count} />
          </Button>
        )}
      >
        <div className="space-y-3 p-4">{children}</div>
      </Popover>
    </div>
  );
}
