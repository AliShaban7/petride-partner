export type PawMarkProps = {
  /** Rendered width and height (the mark is square). Default 40. */
  size?: number;
  /** Fill colour. Defaults to the brand teal. */
  color?: string;
  className?: string;
};

/**
 * PetRide paw mark (viewBox 40×40) — ported from the app (src/components/illustrations/PawMark.tsx):
 * four toes + main pad, mirror-symmetric around x = 20. Decorative (aria-hidden).
 */
export function PawMark({ size = 40, color = "var(--color-primary)", className }: PawMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <g fill={color}>
        <ellipse cx={9.5} cy={17} rx={3.8} ry={4.8} transform="rotate(-15 9.5 17)" />
        <ellipse cx={15.5} cy={10} rx={4} ry={5} transform="rotate(-6 15.5 10)" />
        <ellipse cx={24.5} cy={10} rx={4} ry={5} transform="rotate(6 24.5 10)" />
        <ellipse cx={30.5} cy={17} rx={3.8} ry={4.8} transform="rotate(15 30.5 17)" />
        <path d="M20 19c-6 0-11 6.5-11 11 0 3 2.4 4.5 5.2 4.5 2.4 0 3.8-1.2 5.8-1.2s3.4 1.2 5.8 1.2c2.8 0 5.2-1.5 5.2-4.5 0-4.5-5-11-11-11z" />
      </g>
    </svg>
  );
}
