/**
 * Combat strength calculation — a universal number for any army or guard slot.
 *
 * Includes full biome breakdown showing effective strength for each troop
 * type on the current tile, plus the unit's actual effective strength.
 *
 * Tier values match the on-chain combat simulator:
 *   T1 = 100, T2 = 250 (2.5x), T3 = 700 (7x)
 */

import { BiomeIdToType } from "@bibliothecadao/types";

/** Convert PascalCase biome type to human-readable name. */
function biomeName(biomeId: number): string {
  const type = BiomeIdToType[biomeId];
  if (!type) return "Unknown";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

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

/** Per-troop-type biome modifier with calculated effective strength. */
export interface BiomeMatchup {
  modifier: number;
  effective: number;
}

/**
 * Result of a combat strength calculation.
 *
 * Includes the base strength, a full biome breakdown showing what each
 * troop type's effective strength would be on this tile, and the current
 * tile summary.
 */
export interface Strength {
  /** Base strength (troop count × tier value / 100). */
  base: number;
  /** Per-troop-type biome matchup on this tile. */
  biomeBreakdown: {
    Knight: BiomeMatchup;
    Crossbowman: BiomeMatchup;
    Paladin: BiomeMatchup;
  };
  /** This unit's effective strength on the current tile. */
  currentTile: {
    biome: string;
    biomeId: number;
    modifier: number;
    effective: number;
  };
  /** Formatted display string. */
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

  const bonuses = BIOME_COMBAT_BONUS[biome] ?? [0, 0, 0];

  const calcEffective = (modifier: number) => Math.floor(base * (1 + modifier / 100));

  const biomeBreakdown = {
    Knight: { modifier: bonuses[0], effective: calcEffective(bonuses[0]) },
    Crossbowman: { modifier: bonuses[1], effective: calcEffective(bonuses[1]) },
    Paladin: { modifier: bonuses[2], effective: calcEffective(bonuses[2]) },
  };

  const typeIdx = TROOP_TYPE_INDEX[troopType];
  const myModifier = typeIdx !== undefined ? bonuses[typeIdx] : 0;
  const effective = calcEffective(myModifier);

  const biomeLabel = biomeName(biome);

  let display = `${base.toLocaleString()} base`;
  if (myModifier !== 0) {
    display += ` → ${effective.toLocaleString()} on ${biomeLabel} (${myModifier > 0 ? "+" : ""}${myModifier}%)`;
  } else {
    display += ` → ${effective.toLocaleString()} on ${biomeLabel} (0%)`;
  }

  return {
    base,
    biomeBreakdown,
    currentTile: { biome: biomeLabel, biomeId: biome, modifier: myModifier, effective },
    display,
  };
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
  const emptyBreakdown = {
    Knight: { modifier: 0, effective: 0 },
    Crossbowman: { modifier: 0, effective: 0 },
    Paladin: { modifier: 0, effective: 0 },
  };

  if (guards.length === 0) {
    return {
      base: 0,
      biomeBreakdown: emptyBreakdown,
      currentTile: { biome: biomeName(biome), biomeId: biome, modifier: 0, effective: 0 },
      display: "0",
    };
  }

  let totalBase = 0;
  let dominantStrength: Strength | null = null;
  let dominantCount = 0;

  for (const g of guards) {
    const s = calculateStrength(g.count, g.troopTier, g.troopType, biome);
    totalBase += s.base;
    if (g.count > dominantCount) {
      dominantCount = g.count;
      dominantStrength = s;
    }
  }

  const dominant = dominantStrength!;
  const totalEffective = Math.floor(totalBase * (1 + dominant.currentTile.modifier / 100));
  const biomeLabel = biomeName(biome);

  let display = `${totalBase.toLocaleString()} base`;
  if (dominant.currentTile.modifier !== 0) {
    display += ` → ${totalEffective.toLocaleString()} on ${biomeLabel} (${dominant.currentTile.modifier > 0 ? "+" : ""}${dominant.currentTile.modifier}%)`;
  } else {
    display += ` → ${totalEffective.toLocaleString()} on ${biomeLabel} (0%)`;
  }

  return {
    base: totalBase,
    biomeBreakdown: dominant.biomeBreakdown,
    currentTile: { biome: biomeLabel, biomeId: biome, modifier: dominant.currentTile.modifier, effective: totalEffective },
    display,
  };
}
