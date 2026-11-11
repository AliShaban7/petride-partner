import { Cat, Dog, Rabbit } from "lucide-react";
import Image from "next/image";

import type { AvatarTint, Species } from "@/lib/api/types";
import { cn } from "@/lib/cn";

import { AVATAR_FILL } from "../_lib/look";

const SIZES = { sm: 44, md: 64, lg: 88, xl: 112 } as const;

/**
 * Pet "initial art": the first letter in the chunky display face on the pet's pastel tint, with a
 * small species badge. A photo replaces the letter when the owner added one in the app.
 * Decorative (the pet's name is always written next to it).
 */
export function PetAvatar({
  name,
  species,
  tint,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  species: Species;
  tint: AvatarTint;
  photoUrl?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  const Glyph = species === "dog" ? Dog : species === "cat" ? Cat : Rabbit;
  const badge = Math.round(px * 0.36);
  return (
    <span aria-hidden="true" className={cn("relative inline-flex shrink-0", className)} style={{ width: px, height: px }}>
      <span
        className={cn(
          "relative inline-flex size-full items-center justify-center overflow-hidden rounded-[30%] font-display font-extrabold leading-none text-fg",
          AVATAR_FILL[tint],
        )}
        style={{ fontSize: Math.round(px * 0.5) }}
      >
        {photoUrl ? (
          <Image src={photoUrl} alt="" fill sizes={`${px}px`} className="object-cover" unoptimized />
        ) : (
          <span className="translate-y-[0.06em]">{name.trim().charAt(0).toLocaleUpperCase()}</span>
        )}
      </span>
      <span
        className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-surface text-fg shadow-thumb"
        style={{ width: badge, height: badge }}
      >
        <Glyph size={Math.round(badge * 0.6)} strokeWidth={2} />
      </span>
    </span>
  );
}
