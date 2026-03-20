/**
 * Combat strength calculation — a universal number for any army or guard slot.
 *
 * Formula: `troop count × tier multiplier`. Biome modifier is resolved but
 * returned separately as display context, not baked into the base value.
 *
 * Tier values match the on-chain combat simulator:
 *   T1 = 100, T2 = 250 (2.5x), T3 = 700 (7x)
 */

// ── Tier multipliers ─────────────────────────────────────────────────

/**
 * Combat strength multiplier per troop tier.
 * T1 = 100, T2 = 250 (2.5×), T3 = 700 (7×). These values match the
 * on-chain combat simulator.
 */
const TIER_VALUE: Record<string, number> = {
  T1: 100,
  T2: 250,
  T3: 700,
};

// ── Biome bonus by troop type ────────────────────────────────────────
// Index: 0=Knight, 1=Crossbowman, 2=Paladin
// Value: percentage bonus (positive = buff, negative = nerf)

/**
 * Maps troop type name to its index position within biome bonus tuples.
 * Index 0 = Knight, 1 = Crossbowman, 2 = Paladin.
 */
const TROOP_TYPE_INDEX: Record<string, number> = {
  Knight: 0,
  Crossbowman: 1,
  Paladin: 2,
};

/**
 * Per-biome combat bonus percentages indexed by biome ID.
 * Each tuple is `[Knight bonus, Crossbowman bonus, Paladin bonus]`.
 * Positive values are buffs; negative values are nerfs (e.g. -30 = −30% strength).
 */
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

/**
 * Result of a combat strength calculation.
 *
 * Encapsulates the raw numeric strength, biome context, and a
 * human-readable display string the agent can show directly.
 */
export interface Strength {
  /** Base strength (troop count × tier value / 100). */
  base: number;
  /** Biome modifier percentage (e.g. 30, -30, or 0). */
  biomeModifier: number;
  /** Formatted string, e.g. "4,200 (+30% on this tile)", "3,000 (-30% on this tile)", or just "5,000" when modifier is 0. */
  display: string;
}

/**
 * Calculate combat strength for a single troop group.
 *
 * Strength = `floor(troopCount × tierValue / 100)`.
 * The biome modifier is resolved but **not** applied to the base — it is
 * returned separately so the caller can display context like "+30% on this tile".
 *
 * @param troopCount - Number of troops in the group.
 * @param troopTier - Troop tier: `"T1"`, `"T2"`, or `"T3"`.
 * @param troopType - Troop type: `"Knight"`, `"Crossbowman"`, or `"Paladin"`.
 * @param biome - Biome ID of the tile; determines the combat bonus modifier.
 * @returns A {@link Strength} with base value, biome modifier, and display string.
 *
 * @example
 * ```ts
 * const s = calculateStrength(500, "T2", "Knight", 10);
 * // s.base === 1250, s.biomeModifier === 30, s.display === "1,250 (+30% on this tile)"
 * ```
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
 * Calculate aggregate combat strength across multiple guard slots.
 *
 * Sums base strength from all slots. The biome modifier is taken from the
 * slot with the highest troop count (the "dominant" group), since that
 * group contributes the most to the overall combat result.
 *
 * Returns `{ base: 0, biomeModifier: 0, display: "0" }` for an empty array.
 *
 * @param guards - Guard slot descriptors, each with troop count, tier, and type.
 * @param biome - Biome ID of the tile the guards occupy.
 * @returns A {@link Strength} with combined base, dominant biome modifier, and display string.
 *
 * @example
 * ```ts
 * const s = calculateGuardStrength(
 *   [
 *     { count: 300, troopTier: "T1", troopType: "Knight" },
 *     { count: 100, troopTier: "T2", troopType: "Paladin" },
 *   ],
 *   10, // biome where Knights get +30%
 * );
 * // s.base === 550, s.biomeModifier === 30 (Knight is dominant)
 * ```
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
