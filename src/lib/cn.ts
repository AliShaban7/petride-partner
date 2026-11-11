import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know our custom @theme scales, otherwise it treats e.g. `text-caption`
 * (a font size) and `text-fg` (a colour) as the same group and drops one of them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "meta", "body-sm", "body", "title", "h2", "h1", "kpi", "hero"],
      radius: ["checkbox", "segment", "tile", "button", "input", "card", "panel", "chip"],
      shadow: ["thumb", "card", "card-hover", "floating", "sheet"],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (last one wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
