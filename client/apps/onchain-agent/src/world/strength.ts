/**
 * Combat strength calculation.
 *
 * Universal strength number for any army or guard slot.
 * Factors: troop count × tier multiplier.
 * Biome modifier shown separately as context.
 *
 * Tier values match the combat simulator:
 *   T1 = 100, T2 = 250 (2.5×), T3 = 700 (7×)
 */

// ── Tier multipliers ─────────────────────────────────────────────────

const TIER_VALUE: Record<string, number> = {
  T1: 100,
  T2: 250,
  T3: 700,
};

// ── Biome bonus by troop type ────────────────────────────────────────
// Index: 0=Knight, 1=Crossbowman, 2=Paladin
// Value: percentage bonus (positive = buff, negative = nerf)

const TROOP_TYPE_INDEX: Record<string, number> = {
  Knight: 0,
  Crossbowman: 1,
  Paladin: 2,
};

const BIOME_COMBAT_BONUS: Record<number, [number, number, number]> = {
  1: [0, 30, -30],
  2: [0, 30, -30],
  4: [0, 30, -30],
  3: [-30, 30, 0],
  7: [-30, 30, 0],
  5: [0, -30, 30],
  6: [0, -30, 30],
  8: [0, -30, 30],
  9: [0, -30, 30],
  11: [0, -30, 30],
  14: [0, -30, 30],
  10: [30, 0, -30],
  12: [30, 0, -30],
  13: [30, 0, -30],
  15: [30, 0, -30],
  16: [30, 0, -30],
};

// ── Strength calculation ─────────────────────────────────────────────

interface Strength {
  /** Base strength (troop count × tier value / 100). */
  base: number;
  /** Biome modifier percentage (e.g. 30, -30, or 0). */
  biomeModifier: number;
  /** Formatted string: "4,200 (+30% on this tile)" */
  display: string;
}

/**
 * Calculate combat strength for a troop group.
 *
 * @param troopCount  Number of troops
 * @param troopTier   "T1", "T2", or "T3"
 * @param troopType   "Knight", "Crossbowman", or "Paladin"
 * @param biome       Biome ID of the tile (for modifier display)
 */
export function calculateStrength(troopCount: number, troopTier: string, troopType: string, biome: number): Strength {
  const tierValue = TIER_VALUE[troopTier] ?? TIER_VALUE.T1;
  const base = Math.floor((troopCount * tierValue) / 100);

  const typeIdx = TROOP_TYPE_INDEX[troopType];
  const bonuses = BIOME_COMBAT_BONUS[biome];
  const biomeModifier = typeIdx !== undefined && bonuses ? bonuses[typeIdx] : 0;

  let display = base.toLocaleString();
  if (biomeModifier > 0) {
    display += ` (+${biomeModifier}% on this tile)`;
  } else if (biomeModifier < 0) {
    display += ` (${biomeModifier}% on this tile)`;
  }

  return { base, biomeModifier, display };
}

/**
 * Calculate total strength for multiple guard slots.
 * Returns aggregate strength (sum of all guard base strengths)
 * with the highest biome modifier shown.
 */
export function calculateGuardStrength(
  guards: Array<{ count: number; troopTier: string; troopType: string }>,
  biome: number,
): Strength {
  if (guards.length === 0) {
    return { base: 0, biomeModifier: 0, display: "0" };
  }

  let totalBase = 0;
  let dominantModifier = 0;
  let dominantCount = 0;

  for (const g of guards) {
    const s = calculateStrength(g.count, g.troopTier, g.troopType, biome);
    totalBase += s.base;
    if (g.count > dominantCount) {
      dominantCount = g.count;
      dominantModifier = s.biomeModifier;
    }
  }

  let display = totalBase.toLocaleString();
  if (dominantModifier > 0) {
    display += ` (+${dominantModifier}% on this tile)`;
  } else if (dominantModifier < 0) {
    display += ` (${dominantModifier}% on this tile)`;
  }

  return { base: totalBase, biomeModifier: dominantModifier, display };
}
