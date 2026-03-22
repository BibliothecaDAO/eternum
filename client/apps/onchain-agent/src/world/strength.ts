/**
 * Combat strength calculation — a universal number for any army or guard slot.
 *
 * Tier values match the on-chain combat simulator:
 *   T1 = 100, T2 = 250 (2.5x), T3 = 700 (7x)
 */

import { BiomeIdToType } from "@bibliothecadao/types";

/** Convert PascalCase biome type to human-readable name. */
export function biomeName(biomeId: number): string {
  const type = BiomeIdToType[biomeId];
  if (!type) return "Unknown";
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// ── Tier multipliers ─────────────────────────────────────────────────

const TIER_VALUE: Record<string, number> = {
  T1: 100,
  T2: 250,
  T3: 700,
};

// ── Biome bonus by troop type ────────────────────────────────────────

const TROOP_TYPE_INDEX: Record<string, number> = {
  Knight: 0,
  Crossbowman: 1,
  Paladin: 2,
};

/**
 * Per-biome combat bonus percentages indexed by biome ID.
 * Each tuple is `[Knight bonus, Crossbowman bonus, Paladin bonus]`.
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

// ── Tile combat modifiers ────────────────────────────────────────────

/** Combat modifiers for a tile — which troop types are strong/weak here. */
export interface TileCombatModifiers {
  Knight: number;
  Crossbowman: number;
  Paladin: number;
}

/**
 * Get the combat modifier percentages for a biome.
 * Returns { Knight: -30, Crossbowman: 30, Paladin: 0 } etc.
 */
export function biomeCombatModifiers(biomeId: number): TileCombatModifiers {
  const bonuses = BIOME_COMBAT_BONUS[biomeId] ?? [0, 0, 0];
  return {
    Knight: bonuses[0],
    Crossbowman: bonuses[1],
    Paladin: bonuses[2],
  };
}

// ── Strength calculation ─────────────────────────────────────────────

/**
 * Result of a combat strength calculation.
 *
 * `base` is the raw strength (troop count x tier). `effective` includes
 * the biome modifier for this unit on its current tile. `modifier` is the
 * percentage applied.
 */
export interface Strength {
  /** Base strength (troop count × tier value / 100). */
  base: number;
  /** Effective strength on current tile (base adjusted by biome modifier). */
  effective: number;
  /** Biome modifier percentage applied (e.g. 30, -30, or 0). */
  modifier: number;
}

/**
 * Calculate combat strength for a single troop group.
 */
export function calculateStrength(troopCount: number, troopTier: string, troopType: string, biome: number): Strength {
  const tierValue = TIER_VALUE[troopTier] ?? TIER_VALUE.T1;
  const base = Math.floor((troopCount * tierValue) / 100);

  const bonuses = BIOME_COMBAT_BONUS[biome] ?? [0, 0, 0];
  const typeIdx = TROOP_TYPE_INDEX[troopType];
  const modifier = typeIdx !== undefined ? bonuses[typeIdx] : 0;
  const effective = Math.floor(base * (1 + modifier / 100));

  return { base, effective, modifier };
}

/**
 * Calculate aggregate combat strength across multiple guard slots.
 *
 * Sums base strength from all slots. The biome modifier is taken from the
 * slot with the highest troop count (the "dominant" group).
 */
export function calculateGuardStrength(
  guards: Array<{ count: number; troopTier: string; troopType: string }>,
  biome: number,
): Strength {
  if (guards.length === 0) {
    return { base: 0, effective: 0, modifier: 0 };
  }

  let totalBase = 0;
  let dominantModifier = 0;
  let dominantCount = 0;

  for (const g of guards) {
    const s = calculateStrength(g.count, g.troopTier, g.troopType, biome);
    totalBase += s.base;
    if (g.count > dominantCount) {
      dominantCount = g.count;
      dominantModifier = s.modifier;
    }
  }

  const effective = Math.floor(totalBase * (1 + dominantModifier / 100));
  return { base: totalBase, effective, modifier: dominantModifier };
}
