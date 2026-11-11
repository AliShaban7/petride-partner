import { useId, type ReactElement } from "react";

/*
 * Original PetRide artwork, ported from the app (src/components/illustrations/PawArt.tsx,
 * react-native-svg) to plain SVG: a raised foreleg + paw seen from the front (toe beans facing the
 * viewer), flat shapes, no outlines. Drawn in a 100 × 240 box: the paw sits at the top, the leg runs
 * off the bottom so it can peek up from any edge. Depth comes from a shade-coloured rim on the right
 * (the fur silhouette shifted left and clipped to itself), so every pet is lit from the upper left.
 */

export type PawPet = "ginger" | "tabby" | "golden" | "cream";
export const PAW_PETS: readonly PawPet[] = ["ginger", "tabby", "golden", "cream"];

/** Art box (viewBox units). */
export const PAW_VIEW_W = 100;
export const PAW_VIEW_H = 240;
/** Height / width of the rendered paw. */
export const PAW_ASPECT = PAW_VIEW_H / PAW_VIEW_W;
/** y of the highest toe in the art box: the "tip" that peeks over an edge. */
export const PAW_TIP_Y = 16.5;

/** Illustration palette (tokens.ts `illustration`) — decorative only. */
const ILL = {
  gingerFur: "#F6AE6B",
  gingerShade: "#E9944F",
  gingerPatch: "#E3863F",
  tabbyFur: "#BEC7C9",
  tabbyShade: "#A3AEB1",
  tabbyStripe: "#8C989B",
  goldenFur: "#EDC385",
  goldenShade: "#DCAA62",
  goldenLight: "#F3D29C",
  creamFur: "#FFFAF2",
  creamShade: "#E4DAF2",
  bean: "#F49C98",
  beanDeep: "#E9867E",
  beanShine: "rgba(255, 255, 255, 0.55)",
} as const;

type Bean = { cx: number; cy: number; rx: number; ry: number; rotate: number };

type PawShape = {
  leg: string;
  palm: { cx: number; cy: number; rx: number; ry: number };
  toes: { cx: number; cy: number; r: number }[];
  tufts: string[];
  pad: string;
  beans: Bean[];
  padShine: Bean;
  rim: number;
};

/** Applies `fx` to every x coordinate of a path made of absolute M / L / C / Q / S / T commands. */
function mapPathX(d: string, fx: (x: number) => number): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let index = 0;
  return tokens
    .map((token) => {
      if (/[A-Za-z]/.test(token)) {
        index = 0;
        return token;
      }
      const value = Number(token);
      const out = index % 2 === 0 ? fx(value) : value;
      index += 1;
      return String(Math.round(out * 100) / 100);
    })
    .join(" ");
}

const mirror = (d: string) => mapPathX(d, (x) => PAW_VIEW_W - x);

const CAT_TUFT = "M18 96 C13 97 9 100 8 105 C11 103 13 103 15 104 C13 107 13 110 14 113 C16 109 18 106 20 104 Z";
const DOG_TUFT = "M14 98 C8 99 4 103 3 109 C7 106 10 106 12 107 C9 111 9 115 10 118 C13 114 15 110 17 107 Z";

const CAT: PawShape = {
  leg: "M18 240 C18 190 17 140 17 106 C17 94 13 86 13 70 C13 52 30 40 50 40 C70 40 87 52 87 70 C87 86 83 94 83 106 C83 140 82 190 82 240 Z",
  palm: { cx: 50, cy: 70, rx: 30, ry: 26 },
  toes: [
    { cx: 24, cy: 45, r: 12 },
    { cx: 39, cy: 30, r: 13 },
    { cx: 61, cy: 30, r: 13 },
    { cx: 76, cy: 45, r: 12 },
  ],
  tufts: [CAT_TUFT, mirror(CAT_TUFT)],
  pad: "M50 58 C58 58 68 67.5 68 75.5 C68 82 63.5 85 58.5 85 C55.5 85 53.2 83.2 50 83.2 C46.8 83.2 44.5 85 41.5 85 C36.5 85 32 82 32 75.5 C32 67.5 42 58 50 58 Z",
  beans: [
    { cx: 25.5, cy: 47, rx: 5.6, ry: 7, rotate: -28 },
    { cx: 39.5, cy: 32.5, rx: 6.2, ry: 7.6, rotate: -10 },
    { cx: 60.5, cy: 32.5, rx: 6.2, ry: 7.6, rotate: 10 },
    { cx: 74.5, cy: 47, rx: 5.6, ry: 7, rotate: 28 },
  ],
  padShine: { cx: 43, cy: 66, rx: 4.5, ry: 2.4, rotate: -30 },
  rim: 7,
};

const DOG: PawShape = {
  leg: "M14 240 C14 190 13 140 13 108 C13 96 8 88 8 72 C8 52 27 40 50 40 C73 40 92 52 92 72 C92 88 87 96 87 108 C87 140 86 190 86 240 Z",
  palm: { cx: 50, cy: 72, rx: 34, ry: 28 },
  toes: [
    { cx: 22, cy: 47, r: 13.5 },
    { cx: 38.5, cy: 30.5, r: 14.5 },
    { cx: 61.5, cy: 30.5, r: 14.5 },
    { cx: 78, cy: 47, r: 13.5 },
  ],
  tufts: [DOG_TUFT, mirror(DOG_TUFT)],
  pad: "M50 57 C60 57 71 67 71 76 C71 83.5 65.5 87 59.5 87 C55.5 87 53 85 50 85 C47 85 44.5 87 40.5 87 C34.5 87 29 83.5 29 76 C29 67 40 57 50 57 Z",
  beans: [
    { cx: 23.5, cy: 49, rx: 7, ry: 7.6, rotate: -25 },
    { cx: 39, cy: 33, rx: 7.4, ry: 8, rotate: -8 },
    { cx: 61, cy: 33, rx: 7.4, ry: 8, rotate: 8 },
    { cx: 76.5, cy: 49, rx: 7, ry: 7.6, rotate: 25 },
  ],
  padShine: { cx: 42, cy: 66, rx: 5, ry: 2.6, rotate: -30 },
  rim: 8,
};

const GINGER_PATCH = ["M8 106 C24 96 44 106 47 130 C50 156 38 178 8 186 Z"];

const tabbyStripe = (y: number) =>
  `M8 ${y} C20 ${y - 3} 29 ${y - 1.5} 34 ${y + 2.5} C37.5 ${y + 5.5} 35.5 ${y + 9} 31 ${y + 9} C23 ${y + 9} 16 ${y + 9.5} 8 ${y + 11.5} Z`;
const TABBY_STRIPES = [
  ...[98, 121, 144, 167, 190, 213].map(tabbyStripe),
  ...[109, 132, 155, 178, 201, 224].map((y) => mirror(tabbyStripe(y))),
];

const GOLDEN_LIGHT = ["M50 46 C70 46 82 59 82 75 C82 91 68 99 50 99 C32 99 18 91 18 75 C18 59 30 46 50 46 Z"];

type Look = { shape: PawShape; fur: string; shade: string; bean: string; marks: { color: string; paths: string[] } | null };

const LOOKS: Record<PawPet, Look> = {
  ginger: { shape: CAT, fur: ILL.gingerFur, shade: ILL.gingerShade, bean: ILL.bean, marks: { color: ILL.gingerPatch, paths: GINGER_PATCH } },
  tabby: { shape: CAT, fur: ILL.tabbyFur, shade: ILL.tabbyShade, bean: ILL.bean, marks: { color: ILL.tabbyStripe, paths: TABBY_STRIPES } },
  golden: { shape: DOG, fur: ILL.goldenFur, shade: ILL.goldenShade, bean: ILL.beanDeep, marks: { color: ILL.goldenLight, paths: GOLDEN_LIGHT } },
  cream: { shape: CAT, fur: ILL.creamFur, shade: ILL.creamShade, bean: ILL.bean, marks: null },
};

/** Dogs get the bigger, rounder paw. */
export function isBigPaw(pet: PawPet): boolean {
  return LOOKS[pet].shape === DOG;
}

function silhouette(shape: PawShape, dx: number, keyPrefix: string): ReactElement[] {
  return [
    <path key={`${keyPrefix}leg`} d={dx ? mapPathX(shape.leg, (x) => x + dx) : shape.leg} />,
    <ellipse key={`${keyPrefix}palm`} cx={shape.palm.cx + dx} cy={shape.palm.cy} rx={shape.palm.rx} ry={shape.palm.ry} />,
    ...shape.toes.map((t, i) => <circle key={`${keyPrefix}toe${i}`} cx={t.cx + dx} cy={t.cy} r={t.r} />),
    ...shape.tufts.map((d, i) => <path key={`${keyPrefix}tuft${i}`} d={dx ? mapPathX(d, (x) => x + dx) : d} />),
  ];
}

function beanEllipse(b: Bean, key: string) {
  return <ellipse key={key} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} transform={`rotate(${b.rotate} ${b.cx} ${b.cy})`} />;
}

export type PawArtProps = {
  pet: PawPet;
  /** Rendered width; the height follows the 100 × 240 art box. */
  width: number;
  className?: string;
};

/** One pet's paw and foreleg. Purely decorative (aria-hidden). */
export function PawArt({ pet, width, className }: PawArtProps) {
  const look = LOOKS[pet];
  const { shape } = look;
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const furClip = `pawfur${id}`;
  const litClip = `pawlit${id}`;

  return (
    <svg
      width={width}
      height={width * PAW_ASPECT}
      viewBox={`0 0 ${PAW_VIEW_W} ${PAW_VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <clipPath id={furClip}>{silhouette(shape, 0, "c")}</clipPath>
        <clipPath id={litClip}>{silhouette(shape, -shape.rim, "l")}</clipPath>
      </defs>
      <g fill={look.shade}>{silhouette(shape, 0, "s")}</g>
      <g clipPath={`url(#${furClip})`}>
        <g fill={look.fur}>{silhouette(shape, -shape.rim, "f")}</g>
        {look.marks ? (
          <g clipPath={`url(#${litClip})`} fill={look.marks.color}>
            {look.marks.paths.map((d, i) => (
              <path key={`m${i}`} d={d} />
            ))}
          </g>
        ) : null}
      </g>
      <g fill={look.bean}>
        <path d={shape.pad} />
        {shape.beans.map((b, i) => beanEllipse(b, `b${i}`))}
      </g>
      <g fill={ILL.beanShine}>
        {beanEllipse(shape.padShine, "ps")}
        {shape.beans.map((b, i) =>
          beanEllipse({ cx: b.cx - b.rx * 0.28, cy: b.cy - b.ry * 0.38, rx: b.rx * 0.32, ry: b.ry * 0.3, rotate: b.rotate }, `bs${i}`),
        )}
      </g>
    </svg>
  );
}
