import Image from "next/image";
import { Cat, Dog, Rabbit } from "lucide-react";

import type { AvatarTint, Species } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/** Diameters from the app tokens (avatarSize). */
const SIZES = { xs: 28, sm: 40, md: 48, lg: 64, xl: 96 } as const;
export type AvatarSize = keyof typeof SIZES;

/** Decorative tints; text on all of them is text-fg (≥ 9:1). */
const TINTS: Record<AvatarTint, string> = {
  sage: "bg-sage",
  coral: "bg-accent-tint-strong",
  mint: "bg-pastel-mint",
  lilac: "bg-pastel-lilac",
  peach: "bg-pastel-peach",
  sand: "bg-pastel-sand",
  sky: "bg-pastel-sky",
};

const ORDER: AvatarTint[] = ["sage", "coral", "mint", "lilac", "peach", "sand", "sky"];

/** Stable tint from a name (people / pets without a stored tint). */
export function tintFor(name: string): AvatarTint {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return ORDER[h % ORDER.length];
}

export type AvatarProps = {
  /** Person or pet name (initials + accessible name). */
  name: string;
  src?: string;
  size?: AvatarSize;
  tint?: AvatarTint;
  /** Show a species glyph instead of initials (pets). */
  species?: Species;
  /** Square-ish tile instead of a circle (pets in tables). */
  shape?: "circle" | "tile";
  /** When the name is already next to the avatar, hide it from screen readers. Default true. */
  decorative?: boolean;
  className?: string;
};

/** Initials / pet glyph / photo in a tinted circle. */
export function Avatar({ name, src, size = "sm", tint, species, shape = "circle", decorative = true, className }: AvatarProps) {
  const px = SIZES[size];
  const Glyph = species === "dog" ? Dog : species === "cat" ? Cat : species === "other" ? Rabbit : null;
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": name };
  return (
    <span
      {...a11y}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold text-fg",
        shape === "circle" ? "rounded-full" : "rounded-tile",
        TINTS[tint ?? tintFor(name)],
        className,
      )}
      style={{ width: px, height: px, fontSize: Math.max(11, Math.round(px * 0.38)) }}
    >
      {src ? (
        <Image src={src} alt={decorative ? "" : name} fill sizes={`${px}px`} className="object-cover" unoptimized />
      ) : Glyph && size !== "xs" ? (
        <Glyph aria-hidden="true" size={Math.round(px * 0.5)} strokeWidth={1.8} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
