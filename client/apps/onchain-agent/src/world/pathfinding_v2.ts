/**
 * Pathfinding, stamina, and hex utilities for the Eternum agent.
 *
 * Uses native even-r offset hex A* (no H3 dependency). Returns direction
 * arrays ready for explorer_travel / explorer_explore contract calls.
 *
 * Contract source: contracts/game/src/systems/combat/contracts/troop_movement.cairo
 *
 * ON-CHAIN MOVEMENT RULES (from explorer_move):
 * ═══════════════════════════════════════════════
 * 1. ALL tiles in path (including destination) must be NOT occupied
 * 2. TRAVEL mode: all tiles must be discovered (biome != 0)
 * 3. EXPLORE mode: exactly 1 tile, must NOT be discovered
 * 4. Stamina cost: explore = flat cost, travel = base +/- biome bonus
 * 5. Stamina is refilled before spending (tick-based regen)
 * 6. Food (wheat + fish) is burned per move, scaled by troop count
 */

import {
  Coord,
  Cube,
  Direction,
  BiomeType,
  BiomeIdToType,
  BiomeTypeToId,
  TroopType,
  TroopTier,
  TileOccupier,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
} from "@bibliothecadao/types";

import type { TileState, Position } from "@bibliothecadao/client";

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
  Coord,
  Cube,
  Direction,
  BiomeType,
  BiomeIdToType,
  BiomeTypeToId,
  TroopType,
  TroopTier,
  TileOccupier,
  getDirectionBetweenAdjacentHexes,
};

export type { TileState, Position };

/**
 * Return the hex Direction from one adjacent tile to another.
 *
 * @param from - Source hex position.
 * @param to - Destination hex position; must be directly adjacent to `from`.
 * @returns The Direction enum value, or null if not adjacent.
 */
export function directionBetween(from: Position, to: Position): Direction | null {
  return getDirectionBetweenAdjacentHexes({ col: from.x, row: from.y }, { col: to.x, row: to.y });
}

// ============================================================================
// STAMINA CONFIG (mirrors TroopStaminaConfig from Cairo config.cairo)
//
// These are the DEFAULT values from the game config. All are configurable
// on-chain via TroopStaminaConfig. Callers can override via StaminaConfig.
// ============================================================================

/**
 * Stamina configuration mirroring the on-chain TroopStaminaConfig.
 *
 * All fields have sensible defaults matching the current game config.
 * Pass a custom instance to any stamina-related function to override.
 */
export interface StaminaConfig {
  /** Stamina gained per tick (default: 20) */
  gainPerTick: number;
  /** Base travel cost per hex (default: 20) */
  travelCost: number;
  /** Exploration cost per hex — flat, no biome modifier (default: 30) */
  exploreCost: number;
  /** Biome bonus/penalty magnitude (default: 10) */
  bonusValue: number;
  /** Base max stamina per troop type */
  maxKnight: number;
  maxPaladin: number;
  maxCrossbowman: number;
}

/** Default stamina values matching the current on-chain game config. */
export const DEFAULT_STAMINA_CONFIG: StaminaConfig = {
  gainPerTick: 20,
  travelCost: 20,
  exploreCost: 30,
  bonusValue: 10,
  maxKnight: 120,
  maxPaladin: 140,
  maxCrossbowman: 120,
};

/** Tier bonus: hardcoded in Cairo stamina.cairo max() */
const TIER_BONUS: Record<string, number> = {
  [TroopTier.T1]: 0,
  [TroopTier.T2]: 20,
  [TroopTier.T3]: 40,
};

/**
 * Calculate the maximum stamina for a given troop type and tier.
 *
 * Matches the Cairo `stamina.cairo max()` logic: base from troop type + tier bonus.
 *
 * @param troop - The troop type (Knight, Paladin, or Crossbowman).
 * @param tier - The troop tier (T1, T2, or T3).
 * @param config - Optional stamina config override.
 * @returns The maximum stamina value.
 *
 * @example
 * ```ts
 * maxStamina(TroopType.Paladin, TroopTier.T2); // 140 + 20 = 160
 * ```
 */
export function maxStamina(troop: TroopType, tier: TroopTier, config: StaminaConfig = DEFAULT_STAMINA_CONFIG): number {
  const base =
    troop === TroopType.Knight
      ? config.maxKnight
      : troop === TroopType.Paladin
        ? config.maxPaladin
        : config.maxCrossbowman;
  return base + (TIER_BONUS[tier] ?? 0);
}

// ============================================================================
// BIOME STAMINA TRAVEL BONUS
// Matches Cairo troop.cairo stamina_travel_bonus() exactly.
//
// Returns the MODIFIER to add to travelCost.
// Negative = cheaper, Positive = more expensive.
//
// The bonus VALUE comes from config (stamina_bonus_value), NOT hardcoded.
// ============================================================================

// Biomes where ALL troops get -bonusValue (cheaper)
const OCEAN_BIOMES = new Set([BiomeType.DeepOcean, BiomeType.Ocean]);
// Biomes where ALL troops get +bonusValue (more expensive)
const SCORCHED_BIOMES = new Set([BiomeType.Scorched]);
// Biomes where Paladin gets -bonusValue (open terrain advantage)
const PALADIN_CHEAP = new Set([
  BiomeType.Bare,
  BiomeType.Tundra,
  BiomeType.Shrubland,
  BiomeType.Grassland,
  BiomeType.TemperateDesert,
  BiomeType.SubtropicalDesert,
]);
// Biomes where Paladin gets +bonusValue (forest disadvantage)
const PALADIN_EXPENSIVE = new Set([
  BiomeType.Taiga,
  BiomeType.TemperateDeciduousForest,
  BiomeType.TemperateRainForest,
  BiomeType.TropicalSeasonalForest,
  BiomeType.TropicalRainForest,
]);

/**
 * Compute the stamina travel bonus/penalty for a biome and troop type.
 *
 * Matches Cairo `troop.cairo stamina_travel_bonus()` exactly. The returned value
 * is a modifier added to the base travel cost: negative means cheaper movement,
 * positive means more expensive.
 *
 * @param biome - The biome type of the tile.
 * @param troop - The troop type moving through the tile.
 * @param bonusValue - The magnitude of the bonus/penalty (from config).
 * @returns Stamina modifier: negative = discount, positive = surcharge, 0 = neutral.
 *
 * @example
 * ```ts
 * staminaTravelBonus(BiomeType.Ocean, TroopType.Knight);    // -10 (cheaper)
 * staminaTravelBonus(BiomeType.Scorched, TroopType.Knight); // +10 (expensive)
 * staminaTravelBonus(BiomeType.Bare, TroopType.Paladin);    // -10 (open terrain)
 * ```
 */
export function staminaTravelBonus(
  biome: BiomeType,
  troop: TroopType,
  bonusValue: number = DEFAULT_STAMINA_CONFIG.bonusValue,
): number {
  if (OCEAN_BIOMES.has(biome)) return -bonusValue;
  if (SCORCHED_BIOMES.has(biome)) return bonusValue;
  if (troop === TroopType.Paladin) {
    if (PALADIN_CHEAP.has(biome)) return -bonusValue;
    if (PALADIN_EXPENSIVE.has(biome)) return bonusValue;
  }
  return 0;
}

/**
 * Calculate the total stamina cost to traverse a single tile.
 *
 * Equivalent to `travelCost + staminaTravelBonus(biome, troop)`.
 *
 * @param biome - The biome type of the tile.
 * @param troop - The troop type moving through the tile.
 * @param config - Optional stamina config override.
 * @returns Total stamina cost for this tile.
 */
export function travelStaminaCost(
  biome: BiomeType,
  troop: TroopType,
  config: StaminaConfig = DEFAULT_STAMINA_CONFIG,
): number {
  return config.travelCost + staminaTravelBonus(biome, troop, config.bonusValue);
}

/**
 * Calculate the travel stamina cost from a numeric biome ID.
 *
 * Converts the biome ID to a BiomeType, then delegates to {@link travelStaminaCost}.
 * Falls back to the base travel cost if the biome is unknown or `BiomeType.None`.
 *
 * @param biomeId - Numeric biome identifier from the tile data.
 * @param troop - The troop type moving through the tile.
 * @param config - Optional stamina config override.
 * @returns Total stamina cost for this tile.
 */
export function travelStaminaCostById(
  biomeId: number,
  troop: TroopType,
  config: StaminaConfig = DEFAULT_STAMINA_CONFIG,
): number {
  const biomeType = BiomeIdToType[biomeId];
  if (!biomeType || biomeType === BiomeType.None) return config.travelCost;
  return travelStaminaCost(biomeType, troop, config);
}

// ============================================================================
// PATH RESULT
// ============================================================================

/**
 * Result of a pathfinding query.
 *
 * Contains the full path as positions, the direction array ready for contract
 * calls, and stamina cost information.
 */
export interface PathResult {
  /** Ordered positions from start to end (inclusive). */
  path: Position[];
  /** Direction enum values for each step. Ready for `explorer_travel` contract calls. */
  directions: Direction[];
  /** Number of hex steps. */
  distance: number;
  /** Total stamina cost for the path. */
  staminaCost: number;
  /** True if a path was found but exceeds the maxStamina budget. */
  reachedLimit: boolean;
}

// ============================================================================
// NATIVE OFFSET HEX A*
// ============================================================================

/** Options for {@link findPathNative}. */
export interface FindPathOptions {
  /** Troop type for biome-weighted cost calculation. Omit for uniform cost. */
  troop?: TroopType;
  /** Maximum stamina budget. If set and path exceeds it, `reachedLimit` will be true. */
  maxStamina?: number;
  /** Stamina config override (default: {@link DEFAULT_STAMINA_CONFIG}). */
  staminaConfig?: StaminaConfig;
}

/**
 * Minimal grid interface for native A* pathfinding.
 *
 * Abstracts tile data access so {@link findPathNative} works with any
 * backing store (Map, database, etc.) without coupling to H3.
 */
export interface GridIndex {
  /** Biome ID at position. 0 = unexplored. */
  getBiome(x: number, y: number): number;
  /** Occupier type at position. 0 = empty. */
  getOccupier(x: number, y: number): number;
  /** Whether this position exists in the index at all. */
  has(x: number, y: number): boolean;
  /** Whether this tile is synthetic (injected unexplored). Explore cost applies. */
  isSynthetic?(x: number, y: number): boolean;
}

/**
 * Adapt a MapSnapshot's gridIndex Map into the {@link GridIndex} interface.
 *
 * @param gridIndex - A Map keyed by "x,y" with biome and occupierType values.
 * @returns A {@link GridIndex} implementation backed by the Map.
 *
 * @example
 * ```ts
 * const grid = gridIndexFromSnapshot(mapSnapshot.gridIndex);
 * const result = findPathNative(start, end, grid, { troop: TroopType.Knight });
 * ```
 */
export function gridIndexFromSnapshot(gridIndex: Map<string, { biome: number; occupierType: number }>): GridIndex {
  return {
    getBiome: (x, y) => gridIndex.get(`${x},${y}`)?.biome ?? 0,
    getOccupier: (x, y) => gridIndex.get(`${x},${y}`)?.occupierType ?? 0,
    has: (x, y) => gridIndex.has(`${x},${y}`),
  };
}

/**
 * Find the optimal path using native even-r offset hex A*.
 *
 * Uses native offset hex neighbors (no H3 dependency). It uses
 * `getNeighborHexes` from `@bibliothecadao/types` for neighbor lookup,
 * guaranteeing correct adjacency on the even-r offset grid.
 *
 * Matches on-chain movement rules:
 *   - ALL tiles must be discovered (biome != 0)
 *   - ALL tiles must be not-occupied (occupier == 0)
 *   - Synthetic (unexplored) tiles use exploreCost instead of travel cost
 *
 * @param start - Starting position in game coordinates.
 * @param end - Destination position in game coordinates.
 * @param grid - A {@link GridIndex} providing tile data lookups.
 * @param options - Troop type, stamina budget, and config overrides.
 * @returns The optimal path, or `null` if the destination is unreachable.
 *
 * @example
 * ```ts
 * const grid = gridIndexFromSnapshot(mapSnapshot.gridIndex);
 * const result = findPathNative(
 *   { x: 100, y: 200 },
 *   { x: 105, y: 203 },
 *   grid,
 *   { troop: TroopType.Paladin, maxStamina: 160 },
 * );
 * ```
 */
export function findPathNative(
  start: Position,
  end: Position,
  grid: GridIndex,
  options: FindPathOptions = {},
): PathResult | null {
  const config = options.staminaConfig ?? DEFAULT_STAMINA_CONFIG;
  const { troop, maxStamina: budget } = options;

  if (start.x === end.x && start.y === end.y) {
    return { path: [start], directions: [], distance: 0, staminaCost: 0, reachedLimit: false };
  }

  // Passability check
  function canEnter(x: number, y: number): boolean {
    if (!grid.has(x, y)) return false;
    if (grid.getBiome(x, y) === 0) return false;
    if (grid.getOccupier(x, y) !== 0) return false;
    return true;
  }

  if (!canEnter(end.x, end.y)) return null;

  // Tile cost — synthetic (unexplored) tiles use exploreCost,
  // explored tiles use biome-weighted travel cost
  function tileCost(x: number, y: number): number {
    if (grid.isSynthetic?.(x, y)) return config.exploreCost;
    const biomeId = grid.getBiome(x, y);
    if (troop && biomeId > 0) return travelStaminaCostById(biomeId, troop, config);
    return config.travelCost;
  }

  // Hex distance heuristic (admissible for even-r offset)
  function hexDist(ax: number, ay: number, bx: number, by: number): number {
    // Convert offset to cube coords for accurate distance
    const axC = ax - (ay - (ay & 1)) / 2;
    const azC = ay;
    const ayC = -axC - azC;
    const bxC = bx - (by - (by & 1)) / 2;
    const bzC = by;
    const byC = -bxC - bzC;
    return Math.max(Math.abs(axC - bxC), Math.abs(ayC - byC), Math.abs(azC - bzC));
  }

  const minCost = Math.max(1, config.travelCost - config.bonusValue);
  const startKey = `${start.x},${start.y}`;
  const endKey = `${end.x},${end.y}`;

  // A* with simple array priority queue
  const frontier: { x: number; y: number; f: number }[] = [{ x: start.x, y: start.y, f: 0 }];
  const cameFrom = new Map<string, string | null>();
  const gScore = new Map<string, number>();
  cameFrom.set(startKey, null);
  gScore.set(startKey, 0);

  while (frontier.length > 0) {
    // Pop lowest f-score
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i]!.f < frontier[bestIdx]!.f) bestIdx = i;
    }
    const current = frontier.splice(bestIdx, 1)[0]!;
    const currentKey = `${current.x},${current.y}`;

    if (currentKey === endKey) break;

    const currentG = gScore.get(currentKey)!;
    const neighbors = getNeighborHexes(current.x, current.y);

    for (const nb of neighbors) {
      if (!canEnter(nb.col, nb.row)) continue;

      const nbKey = `${nb.col},${nb.row}`;
      const stepCost = tileCost(nb.col, nb.row);
      const tentativeG = currentG + stepCost;

      if (!gScore.has(nbKey) || tentativeG < gScore.get(nbKey)!) {
        gScore.set(nbKey, tentativeG);
        cameFrom.set(nbKey, currentKey);
        const h = hexDist(nb.col, nb.row, end.x, end.y) * minCost;
        frontier.push({ x: nb.col, y: nb.row, f: tentativeG + h });
      }
    }
  }

  if (!cameFrom.has(endKey)) return null;

  // Reconstruct path
  const path: Position[] = [];
  let cur: string | null = endKey;
  while (cur && cur !== startKey) {
    const [x, y] = cur.split(",").map(Number);
    path.push({ x, y });
    cur = cameFrom.get(cur) ?? null;
  }
  path.push(start);
  path.reverse();

  // Build directions
  const directions: Direction[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]!;
    const to = path[i + 1]!;
    const dir = getDirectionBetweenAdjacentHexes({ col: from.x, row: from.y }, { col: to.x, row: to.y });
    if (dir === null) {
      // Should never happen with native neighbors — but safety check
      throw new Error(`Non-adjacent hex pair: (${from.x},${from.y}) → (${to.x},${to.y})`);
    }
    directions.push(dir);
  }

  let staminaCost = 0;
  for (let i = 1; i < path.length; i++) {
    staminaCost += tileCost(path[i]!.x, path[i]!.y);
  }

  return {
    path,
    directions,
    distance: directions.length,
    staminaCost,
    reachedLimit: budget !== undefined && staminaCost > budget,
  };
}
