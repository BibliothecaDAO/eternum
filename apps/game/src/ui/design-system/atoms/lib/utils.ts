import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { GUTTERS, HUD_FINISH, RADII, TYPE, WIDTHS } from "@/tokens";

/**
 * tailwind-merge only knows Tailwind's default theme, so it must be told the token classes (src/tokens.ts). Unknown, a
 * `text-title` reads to it as a colour and drops the element's `text-kit-*` colour, a `bg-halo` drops a `bg-kit-*`
 * ground, and a `rounded-plate` is never replaced by a caller's `rounded-*`.
 */
const twMerge = extendTailwindMerge<"text-shadow">({
  extend: {
    theme: { borderRadius: Object.keys(RADII), spacing: Object.keys(GUTTERS) },
    classGroups: {
      "font-size": [{ text: Object.keys(TYPE) }],
      "max-w": [{ "max-w": Object.keys(WIDTHS) }],
      w: [{ w: Object.keys(WIDTHS) }],
      "text-shadow": [{ "text-shadow": Object.keys(HUD_FINISH.textShadow) }],
      shadow: [{ shadow: Object.keys(HUD_FINISH.shadow) }],
      "bg-image": [{ bg: Object.keys(HUD_FINISH.gradient) }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
