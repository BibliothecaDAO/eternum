import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import {
  GUTTERS,
  HUD_COLOR_CLASSES,
  HUD_FINISH,
  HUD_LAYERS,
  HUD_LAYOUT,
  HUD_TYPE,
  RADII,
  TYPE,
  WIDTHS,
} from "@/tokens";

/**
 * tailwind-merge only knows Tailwind's default theme, so it must be told the token classes (src/tokens.ts). Unknown, a
 * `text-title` reads to it as a colour and drops the element's `text-kit-*` colour, a `bg-halo` drops a `bg-kit-*`
 * ground, and a `rounded-plate` is never replaced by a caller's `rounded-*`. The HUD's roles and colours likewise: a
 * `text-hud-label` is a size and a `text-hud-muted` a colour, so the two stand together.
 */
const twMerge = extendTailwindMerge<"text-shadow">({
  extend: {
    theme: {
      borderRadius: Object.keys(RADII),
      spacing: [...Object.keys(GUTTERS), ...Object.keys(HUD_LAYOUT).map((name) => `hud-${name}`)],
    },
    classGroups: {
      "font-size": [{ text: [...Object.keys(TYPE), ...Object.keys(HUD_TYPE).map((role) => `hud-${role}`)] }],
      "text-color": [{ text: Object.keys(HUD_COLOR_CLASSES).map((name) => `hud-${name}`) }],
      "bg-color": [{ bg: Object.keys(HUD_COLOR_CLASSES).map((name) => `hud-${name}`) }],
      "border-color": [{ border: Object.keys(HUD_COLOR_CLASSES).map((name) => `hud-${name}`) }],
      z: [{ z: Object.keys(HUD_LAYERS).map((name) => `hud-${name}`) }],
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
