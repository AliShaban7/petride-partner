import type { PawPet } from "@/components/illustrations";
import type { AvatarTint, Pet } from "@/lib/api/types";

/** Soft pastel band behind a pet (cards, profile hero). Text on it: text-fg / text-fg-tertiary only. */
export const SOFT_BAND: Record<AvatarTint, string> = {
  sage: "bg-soft-mint",
  coral: "bg-soft-peach",
  mint: "bg-soft-mint",
  lilac: "bg-soft-lilac",
  peach: "bg-soft-peach",
  sand: "bg-soft-sand",
  sky: "bg-soft-sky",
};

/** Stronger pastel for the avatar tile itself (text-fg on all of them). */
export const AVATAR_FILL: Record<AvatarTint, string> = {
  sage: "bg-sage",
  coral: "bg-accent-tint-strong",
  mint: "bg-pastel-mint",
  lilac: "bg-pastel-lilac",
  peach: "bg-pastel-peach",
  sand: "bg-pastel-sand",
  sky: "bg-pastel-sky",
};

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/** Which of PetRide's paw illustrations fits this pet: dogs get the golden paw, tabbies the tabby one. */
export function pawFor(pet: Pick<Pet, "species" | "breed" | "name">): PawPet {
  if (pet.species === "dog") return "golden";
  if (pet.species === "other") return "cream";
  if (/tabby|табби|zolaq/i.test(pet.breed)) return "tabby";
  return (["ginger", "cream", "tabby"] as const)[hash(pet.name) % 3];
}
