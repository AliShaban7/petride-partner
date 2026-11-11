import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import { isBigPaw, PAW_ASPECT, PAW_TIP_Y, PAW_VIEW_W, PawArt, type PawPet } from "./PawArt";

/*
 * Web port of the app's PeekingPaws / PawPeek (src/components/illustrations/PeekingPaws.tsx).
 * Motion is pure CSS (`animate-paw-bob`, `animate-paw-wave` from globals.css): every paw bobs
 * gently, the dog waves every ~6 s, hovering a paw makes it wiggle. Under prefers-reduced-motion
 * the global rule stops all of it. Decorative: aria-hidden, never focusable, ignores the pointer
 * except for the playful hover.
 */

type PawSpec = { pet: PawPet; x: number; reach: number; tilt: number; delay: number; waves?: boolean };

const LAYOUT_4: readonly PawSpec[] = [
  { pet: "ginger", x: 0.12, reach: 0.74, tilt: 7, delay: 0 },
  { pet: "tabby", x: 0.36, reach: 0.56, tilt: -5, delay: 650 },
  { pet: "golden", x: 0.615, reach: 0.9, tilt: 3, delay: 1300, waves: true },
  { pet: "cream", x: 0.875, reach: 0.67, tilt: -8, delay: 1950 },
];

const LAYOUT_3: readonly PawSpec[] = [
  { pet: "ginger", x: 0.18, reach: 0.72, tilt: 7, delay: 0 },
  { pet: "golden", x: 0.5, reach: 0.9, tilt: -3, delay: 870, waves: true },
  { pet: "cream", x: 0.82, reach: 0.64, tilt: -8, delay: 1740 },
];

const CAT_WIDTH = 0.48;
const DOG_WIDTH = 0.58;

/** Height the tallest paw reaches in a strip of `height` (reserve this much so content is never covered). */
export function peekingPawsReach(height: number, density: 3 | 4 = 4): number {
  const layout = density === 3 ? LAYOUT_3 : LAYOUT_4;
  return Math.ceil(height * Math.max(...layout.map((p) => p.reach)));
}

export type PeekingPawsProps = {
  /** Strip height in px (default 150). Width fills the parent; art scales by height. */
  height?: number;
  /** 4 paws, or 3 for narrow screens. */
  density?: 3 | 4;
  className?: string;
};

/** Four pets' paws peeking up from the bottom edge: ginger cat, grey tabby, golden dog, cream cat. */
export function PeekingPaws({ height = 150, density = 4, className }: PeekingPawsProps) {
  const layout = density === 3 ? LAYOUT_3 : LAYOUT_4;
  return (
    <div aria-hidden="true" className={cn("relative w-full overflow-hidden", className)} style={{ height }}>
      {layout.map((spec) => (
        <PeekPaw key={spec.pet} spec={spec} stripHeight={height} />
      ))}
    </div>
  );
}

function PeekPaw({ spec, stripHeight }: { spec: PawSpec; stripHeight: number }) {
  const width = stripHeight * (isBigPaw(spec.pet) ? DOG_WIDTH : CAT_WIDTH);
  const artHeight = width * PAW_ASPECT;
  const bottom = stripHeight * spec.reach - artHeight + (PAW_TIP_Y * width) / PAW_VIEW_W;
  // Tilts and waves pivot where the leg crosses the bottom edge.
  const pivot = `50% ${Math.round(artHeight + bottom)}px`;
  const outer: CSSProperties = {
    left: `${spec.x * 100}%`,
    marginLeft: -width / 2,
    bottom,
    width,
    height: artHeight,
    rotate: `${spec.tilt}deg`,
    transformOrigin: pivot,
  };
  return (
    <div className="group absolute" style={outer}>
      <div className="animate-paw-bob h-full w-full" style={{ animationDelay: `${spec.delay}ms` }}>
        <div
          className={cn(
            "h-full w-full transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1.5 group-hover:rotate-6",
            spec.waves && "animate-paw-wave",
          )}
          style={{ transformOrigin: pivot }}
        >
          <PawArt pet={spec.pet} width={width} />
        </div>
      </div>
    </div>
  );
}

export type PawPeekProps = {
  /** Circle diameter (default 72). */
  size?: number;
  pet?: PawPet;
  className?: string;
};

/** One paw peeking up out of a soft round window — for friendly empty states. Decorative. */
export function PawPeek({ size = 72, pet = "ginger", className }: PawPeekProps) {
  const width = size * 0.62;
  const artHeight = width * PAW_ASPECT;
  const bottom = size * 0.84 - artHeight + (PAW_TIP_Y * width) / PAW_VIEW_W;
  return (
    <div
      aria-hidden="true"
      className={cn("relative shrink-0 overflow-hidden rounded-full bg-ill-peek-bg", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute left-1/2"
        style={{ marginLeft: -width / 2, bottom, width, height: artHeight, rotate: "-7deg", transformOrigin: `50% ${Math.round(artHeight + bottom)}px` }}
      >
        <div className="animate-paw-bob h-full w-full">
          <PawArt pet={pet} width={width} />
        </div>
      </div>
    </div>
  );
}

export type CornerPawProps = {
  pet?: PawPet;
  /** Paw width in px (default 64). */
  width?: number;
  /** How far the toes reach into the card, px (default 70). */
  reach?: number;
  /** Tilt in degrees (default −28: leaning in from the bottom-right corner). */
  tilt?: number;
  className?: string;
};

/**
 * A paw reaching into a card from its bottom-right corner (KPI cards). Place it inside a
 * `relative overflow-hidden` container. Decorative; bobs gently, lifts on card hover (`group`).
 */
export function CornerPaw({ pet = "golden", width = 64, reach = 70, tilt = -28, className }: CornerPawProps) {
  const artHeight = width * PAW_ASPECT;
  const bottom = reach - artHeight + (PAW_TIP_Y * width) / PAW_VIEW_W;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute right-3", className)}
      style={{ bottom, width, height: artHeight, rotate: `${tilt}deg`, transformOrigin: `50% ${Math.round(artHeight + bottom)}px` }}
    >
      <div className="animate-paw-bob h-full w-full transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-2">
        <PawArt pet={pet} width={width} />
      </div>
    </div>
  );
}
