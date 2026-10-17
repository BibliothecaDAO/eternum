import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { GUTTERS, RADII, TEXT_SHADOWS, TYPE, WIDTHS } from "@/tokens";

/**
 * tailwind-merge only knows Tailwind's default theme, so it must be told the token classes (src/tokens.ts). Unknown, a
 * `text-title` reads to it as a colour and drops the element's `text-kit-*` colour, and a `rounded-plate` is never
 * replaced by a caller's `rounded-*`.
 */
const twMerge = extendTailwindMerge<"text-shadow">({
  extend: {
    theme: { borderRadius: Object.keys(RADII), spacing: Object.keys(GUTTERS) },
    classGroups: {
      "font-size": [{ text: Object.keys(TYPE) }],
      "max-w": [{ "max-w": Object.keys(WIDTHS) }],
      w: [{ w: Object.keys(WIDTHS) }],
      "text-shadow": [{ "text-shadow": Object.keys(TEXT_SHADOWS) }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
