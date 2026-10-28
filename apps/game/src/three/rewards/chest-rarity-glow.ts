import { HUD_SHEET } from "@/tokens";

import type { ChestGlow } from "./chest-transitions";

/** A chest's rarity, common (1) to legendary (5), as the HUD's rarity plates count it. */
export type ChestRarity = 1 | 2 | 3 | 4 | 5;

/**
 * A chest's rarity as its glow when it opens: none for a common one; from uncommon up, light leaks from its lid in the
 * rarity's colour (the HUD's own rarity plate colour), its runes take that colour, and its beams reach higher.
 */
export const chestRarityGlow = (rarity: ChestRarity): ChestGlow | undefined => {
  if (rarity === 1) return undefined;
  const step = (rarity - 1) / 4;
  return {
    seam: 0.3 + step * 0.6,
    tint: HUD_SHEET[`rarity-${rarity}`],
    runes: step,
    beam: { limit: 1, reach: 1 + step * 0.6, boost: 1 + step * 0.8 },
  };
};
