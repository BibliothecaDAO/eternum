/**
 * eternum-pathfinding-v2.ts — H3 pathfinding matching Eternum Cairo contracts exactly
 *
 * Uses @bibliothecadao/types for game types. Returns direction arrays ready
 * for explorer_travel / explorer_explore contract calls.
 *
 * Contract source: contracts/game/src/systems/combat/contracts/troop_movement.cairo
 *
 * ON-CHAIN MOVEMENT RULES (from explorer_move):
 * ═══════════════════════════════════════════════
 * 1. ALL tiles in path (including destination) must be NOT occupied
 *    → assert!(tile.not_occupied()) — no exception for target
 * 2. TRAVEL mode: all tiles must be discovered (biome != 0)
 *    → assert!(tile.discovered())
 * 3. EXPLORE mode: exactly 1 tile, must NOT be discovered
 *    → assert!(directions.len().is_zero()) + assert!(!tile.discovered())
 * 4. Stamina cost per tile:
 *    - Explore: flat stamina_explore_stamina_cost (config, default 30)
 *    - Travel: stamina_travel_stamina_cost +/- stamina_travel_bonus(biome, troop)
 * 5. stamina_bonus_value is configurable (not hardcoded 10)
 * 6. Stamina is refilled before spending (tick-based regen)
 * 7. Food (wheat + fish) is burned per move, scaled by troop count
 * 8. Explorer is removed from origin tile before movement begins
 */

import {
  latLngToCell,
  gridPathCells,
  gridDisk,
  gridDistance,
  localIjToCell,
  cellToLocalIj,
} from "h3-js";

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

// ============================================================================
// STAMINA CONFIG (mirrors TroopStaminaConfig from Cairo config.cairo)
//
// These are the DEFAULT values from the game config. All are configurable
// on-chain via TroopStaminaConfig. Callers can override via StaminaConfig.
// ============================================================================

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

export function maxStamina(
  troop: TroopType,
  tier: TroopTier,
  config: StaminaConfig = DEFAULT_STAMINA_CONFIG,
): number {
  const base =
    troop === TroopType.Knight ? config.maxKnight :
    troop === TroopType.Paladin ? config.maxPaladin :
    config.maxCrossbowman;
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
  BiomeType.Bare, BiomeType.Tundra, BiomeType.Shrubland,
  BiomeType.Grassland, BiomeType.TemperateDesert, BiomeType.SubtropicalDesert,
]);
// Biomes where Paladin gets +bonusValue (forest disadvantage)
const PALADIN_EXPENSIVE = new Set([
  BiomeType.Taiga, BiomeType.TemperateDeciduousForest, BiomeType.TemperateRainForest,
  BiomeType.TropicalSeasonalForest, BiomeType.TropicalRainForest,
]);

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

export function travelStaminaCost(
  biome: BiomeType,
  troop: TroopType,
  config: StaminaConfig = DEFAULT_STAMINA_CONFIG,
): number {
  return config.travelCost + staminaTravelBonus(biome, troop, config.bonusValue);
}

/** Get stamina cost from a numeric biome ID */
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
// H3 MAPPING
// ============================================================================

export const H3_RES = 7;
export const ANCHOR = latLngToCell(37.7749, -122.4194, H3_RES);

export function coordToH3(x: number, y: number): string {
  const q = x - Math.trunc((y + (y & 1)) / 2);
  return localIjToCell(ANCHOR, { i: q, j: -y });
}

export function h3ToPosition(h3Cell: string): Position {
  const ij = cellToLocalIj(ANCHOR, h3Cell);
  const q = ij.i || 0;
  const r = (-ij.j) || 0;
  return { x: q + Math.trunc((r + (r & 1)) / 2), y: r };
}

// ============================================================================
// TILE INDEX
// ============================================================================

export interface H3TileIndex {
  h3ToBiome: Map<string, number>;
  h3ToOccupier: Map<string, number>;
  h3ToPosition: Map<string, Position>;
  keyToH3: Map<string, string>;
  count: number;
}

/**
 * Build H3 tile index from game client TileState[].
 * Call once, reuse for multiple findPath calls.
 */
export function buildH3TileIndex(tiles: TileState[]): H3TileIndex {
  const h3ToBiome = new Map<string, number>();
  const h3ToOccupier = new Map<string, number>();
  const h3ToPos = new Map<string, Position>();
  const keyToH3 = new Map<string, string>();

  for (const t of tiles) {
    const { x, y } = t.position;
    let h3: string;
    try {
      h3 = coordToH3(x, y);
    } catch {
      continue;
    }

    h3ToBiome.set(h3, t.biome);
    h3ToOccupier.set(h3, t.occupierType);
    h3ToPos.set(h3, t.position);
    keyToH3.set(`${x},${y}`, h3);
  }

  return { h3ToBiome, h3ToOccupier, h3ToPosition: h3ToPos, keyToH3, count: h3ToBiome.size };
}

// ============================================================================
// PATH RESULT
// ============================================================================

export interface PathResult {
  /** Ordered positions from start to end (inclusive). */
  path: Position[];
  /** Direction enum values for each step. Ready for contract calls. */
  directions: Direction[];
  /** Number of hex steps. */
  distance: number;
  /** Total stamina cost for the path. */
  staminaCost: number;
  /** True if a path was found but exceeds maxStamina budget. */
  reachedLimit: boolean;
}

// ============================================================================
// PATHFINDING
// ============================================================================

export interface FindPathOptions {
  /** Troop type for biome cost calculation. */
  troop?: TroopType;
  /** Maximum stamina budget. */
  maxStamina?: number;
  /** Stamina config override (default: DEFAULT_STAMINA_CONFIG). */
  staminaConfig?: StaminaConfig;
}

/**
 * Find optimal travel path between two explored tiles.
 *
 * Matches on-chain explorer_move() rules:
 *   - ALL tiles (including destination) must be not-occupied
 *   - ALL tiles must be discovered (biome != 0)
 *   - Cost per tile = travelCost +/- stamina_travel_bonus(biome, troop)
 *
 * Returns null if unreachable. Returns PathResult with reachedLimit=true
 * if path exists but exceeds maxStamina.
 */
export function findPath(
  start: Position,
  end: Position,
  index: H3TileIndex,
  options: FindPathOptions = {},
): PathResult | null {
  const config = options.staminaConfig ?? DEFAULT_STAMINA_CONFIG;
  const { troop, maxStamina: budget } = options;

  if (start.x === end.x && start.y === end.y) {
    return { path: [start], directions: [], distance: 0, staminaCost: 0, reachedLimit: false };
  }

  const startH3 = index.keyToH3.get(`${start.x},${start.y}`);
  const endH3 = index.keyToH3.get(`${end.x},${end.y}`);
  if (!startH3 || !endH3) return null;

  // ── Tile cost: biome-weighted travel cost ──
  function cellCost(h3: string): number {
    const biomeId = index.h3ToBiome.get(h3) ?? 0;
    if (troop && biomeId > 0) return travelStaminaCostById(biomeId, troop, config);
    return config.travelCost;
  }

  // ── Tile passability: matches on-chain assert!(tile.not_occupied()) ──
  // On-chain: ALL tiles in path must be not_occupied (no target exception)
  // On-chain: ALL tiles must be discovered (biome != 0) for travel
  function canEnter(h3: string): boolean {
    // Must be a known tile in our index
    if (!index.h3ToBiome.has(h3)) return false;
    // Must be discovered (biome != 0)
    if ((index.h3ToBiome.get(h3) ?? 0) === 0) return false;
    // Must not be occupied (occupierType == 0)
    // On-chain: assert!(tile.not_occupied()) — NO exception for destination
    if ((index.h3ToOccupier.get(h3) ?? 0) !== 0) return false;
    return true;
  }

  // Destination must be passable
  if (!canEnter(endH3)) return null;

  // ── Fast path: H3 straight line ──
  try {
    const direct = gridPathCells(startH3, endH3);
    if (direct.length > 0) {
      const pathCells = direct.filter(c => c !== startH3);
      if (pathCells.every(c => canEnter(c))) {
        let cost = 0;
        for (const c of pathCells) cost += cellCost(c);
        return buildResult(startH3, pathCells, cost, budget, index);
      }
    }
  } catch { /* fall through */ }

  // ── A* with H3 primitives ──
  // Heuristic: gridDistance * minimum possible tile cost (admissible)
  const minCost = config.travelCost - config.bonusValue; // e.g. 20 - 10 = 10

  const frontier: { cell: string; f: number }[] = [{ cell: startH3, f: 0 }];
  const cameFrom = new Map<string, string | null>();
  const gScore = new Map<string, number>();
  cameFrom.set(startH3, null);
  gScore.set(startH3, 0);

  while (frontier.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i]!.f < frontier[bestIdx]!.f) bestIdx = i;
    }
    const current = frontier.splice(bestIdx, 1)[0]!.cell;

    if (current === endH3) break;

    const currentG = gScore.get(current)!;
    const neighbors = gridDisk(current, 1).filter(c => c !== current && canEnter(c));

    for (const nb of neighbors) {
      const stepCost = cellCost(nb);
      const tentativeG = currentG + stepCost;

      if (!gScore.has(nb) || tentativeG < gScore.get(nb)!) {
        gScore.set(nb, tentativeG);
        cameFrom.set(nb, current);
        let h = 0;
        try { h = gridDistance(nb, endH3) * minCost; } catch { h = 9999; }
        frontier.push({ cell: nb, f: tentativeG + h });
      }
    }
  }

  if (!cameFrom.has(endH3)) return null;

  // Reconstruct
  const h3Path: string[] = [];
  let cur: string | null = endH3;
  while (cur && cur !== startH3) {
    h3Path.push(cur);
    cur = cameFrom.get(cur) ?? null;
  }
  h3Path.reverse();

  let totalCost = 0;
  for (const c of h3Path) totalCost += cellCost(c);

  return buildResult(startH3, h3Path, totalCost, budget, index);
}

/**
 * Convert H3 cell path → positions + direction array.
 * Throws if any consecutive pair is non-adjacent (internal bug).
 */
function buildResult(
  startH3: string,
  h3Path: string[],
  staminaCost: number,
  budget: number | undefined,
  index: H3TileIndex,
): PathResult {
  const startPos = index.h3ToPosition.get(startH3)!;
  const path: Position[] = [startPos];
  for (const h3 of h3Path) {
    path.push(index.h3ToPosition.get(h3)!);
  }

  const directions: Direction[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]!;
    const to = path[i + 1]!;
    const dir = getDirectionBetweenAdjacentHexes(
      { col: from.x, row: from.y },
      { col: to.x, row: to.y },
    );
    if (dir === null) {
      throw new Error(
        `Non-adjacent hex pair in path: (${from.x},${from.y}) → (${to.x},${to.y})`,
      );
    }
    directions.push(dir);
  }

  return {
    path,
    directions,
    distance: directions.length,
    staminaCost,
    reachedLimit: budget !== undefined && staminaCost > budget,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

export function regenTicksNeeded(
  currentStamina: number,
  requiredStamina: number,
  config: StaminaConfig = DEFAULT_STAMINA_CONFIG,
): number {
  if (currentStamina >= requiredStamina) return 0;
  return Math.ceil((requiredStamina - currentStamina) / config.gainPerTick);
}

/**
 * Tile cost function compatible with compare-me's TileCostFn signature.
 */
export function makeTileCostFn(
  index: H3TileIndex,
  troop: TroopType,
  config: StaminaConfig = DEFAULT_STAMINA_CONFIG,
): (tileKey: string) => number {
  return (tileKey: string) => {
    const h3 = index.keyToH3.get(tileKey);
    if (!h3) return config.travelCost;
    const biomeId = index.h3ToBiome.get(h3) ?? 0;
    if (biomeId > 0) return travelStaminaCostById(biomeId, troop, config);
    return config.travelCost;
  };
}
