/**
 * A* pathfinder for Eternum's even-r offset hex grid.
 *
 * Uses shared packages (@bibliothecadao/types) for hex neighbor logic,
 * coordinate conversions, and biome definitions — zero inlined duplicates.
 *
 * Pure function: takes start, end, and tile map — returns the cheapest path
 * with per-step cost breakdown and directions for action execution.
 */

import {
  getNeighborHexes,
  Direction,
  BiomeType,
  BiomeTypeToId,
  BiomeIdToType,
  TroopType,
  type NeighborHex,
} from "@bibliothecadao/types";
import { Coord } from "@bibliothecadao/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TileInfo {
  biome: number;
  occupierType: number;
  occupierId: number;
}

/**
 * Configuration for pathfinding stamina costs.
 * Mirrors values from ConfigManager but as a plain object — no ECS dependency.
 * Caller fetches these once per tick from SQL or uses defaults.
 */
export interface PathCostConfig {
  /** Stamina cost to explore an unknown tile (default 30). */
  exploreCost: number;
  /** Base stamina cost to travel through an explored tile (default 10). */
  baseTravelCost: number;
  /** Biome bonus/penalty value applied per troop type (default 10). */
  biomeBonus: number;
  /** Troop type of the explorer — affects biome-specific cost modifiers. */
  troopType: TroopType;
}

/** Default cost config matching current Eternum game values. */
export const DEFAULT_COST_CONFIG: PathCostConfig = {
  exploreCost: 30,
  baseTravelCost: 10,
  biomeBonus: 10,
  troopType: TroopType.Knight,
};

/** A single step in a computed path. */
export interface PathStep {
  col: number;
  row: number;
  direction: Direction; // Direction enum value to reach this tile from previous
  cost: number; // Movement cost for this step
  explored: boolean; // Whether this tile is already explored
}

/** Result of a pathfinding computation. */
export interface PathResult {
  found: boolean;
  path: PathStep[]; // Ordered steps from start (exclusive) to end (inclusive)
  totalCost: number;
  /** Breakdown of path into executable action batches. */
  actionBatches: ActionBatch[];
}

/** A batch of consecutive steps that can be executed as a single action. */
export interface ActionBatch {
  type: "travel" | "explore";
  directions: Direction[];
  /** Total cost for this batch. */
  cost: number;
}

// ---------------------------------------------------------------------------
// Biome costs
// ---------------------------------------------------------------------------

/** Impassable biome IDs (deep ocean, ocean). */
const IMPASSABLE_BIOMES = new Set([BiomeTypeToId[BiomeType.DeepOcean], BiomeTypeToId[BiomeType.Ocean]]);

/**
 * Get the travel stamina cost for a specific biome and troop type.
 * Mirrors ConfigManager.getTravelStaminaCost logic as a pure function.
 *
 * Paladin gets bonuses in open terrain (grassland, shrubland, desert, tundra, bare)
 * and penalties in forests/rain forests. All troops get reduced cost in ocean/deep ocean
 * (though those are typically impassable) and increased cost in scorched.
 */
export function getBiomeTravelCost(biome: BiomeType, config: PathCostConfig): number {
  const { baseTravelCost, biomeBonus, troopType } = config;
  const isPaladin = troopType === TroopType.Paladin;

  switch (biome) {
    case BiomeType.Ocean:
    case BiomeType.DeepOcean:
      return baseTravelCost - biomeBonus; // -bonus for all troops
    case BiomeType.Beach:
    case BiomeType.Snow:
      return baseTravelCost; // No modifier
    case BiomeType.Grassland:
    case BiomeType.Shrubland:
    case BiomeType.SubtropicalDesert:
    case BiomeType.TemperateDesert:
    case BiomeType.Tundra:
    case BiomeType.Bare:
      return baseTravelCost + (isPaladin ? -biomeBonus : 0);
    case BiomeType.TropicalRainForest:
    case BiomeType.TropicalSeasonalForest:
    case BiomeType.TemperateRainForest:
    case BiomeType.TemperateDeciduousForest:
    case BiomeType.Taiga:
      return baseTravelCost + (isPaladin ? biomeBonus : 0);
    case BiomeType.Scorched:
      return baseTravelCost + biomeBonus; // +bonus for all troops
    default:
      return baseTravelCost;
  }
}

function getTileCost(tile: TileInfo | undefined, config: PathCostConfig): number {
  if (!tile) return config.exploreCost; // Unknown/unexplored tile
  if (IMPASSABLE_BIOMES.has(tile.biome)) return Infinity;
  if (tile.biome === 0) return config.exploreCost; // Unexplored

  const biomeType = BiomeIdToType[tile.biome];
  if (!biomeType) return config.baseTravelCost;
  return getBiomeTravelCost(biomeType, config);
}

function isTileExplored(tile: TileInfo | undefined): boolean {
  return tile !== undefined && tile.biome !== 0;
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function coordKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Hex distance using Coord.distance() from shared types.
 * Admissible heuristic — never overestimates.
 */
function hexDistance(fromCol: number, fromRow: number, toCol: number, toRow: number): number {
  return new Coord(fromCol, fromRow).distance(new Coord(toCol, toRow));
}

// ---------------------------------------------------------------------------
// Binary min-heap priority queue
// ---------------------------------------------------------------------------

class MinHeap {
  private heap: { key: string; priority: number }[] = [];

  get length(): number {
    return this.heap.length;
  }

  push(key: string, priority: number): void {
    this.heap.push({ key, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): string | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top.key;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[i].priority >= this.heap[parent].priority) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < n && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// A* Pathfinding
// ---------------------------------------------------------------------------

/**
 * Find the cheapest path from (startCol, startRow) to (endCol, endRow).
 *
 * @param startCol - Starting column
 * @param startRow - Starting row
 * @param endCol - Target column
 * @param endRow - Target row
 * @param tileMap - Map of "col,row" -> TileInfo from world state
 * @param costConfig - Stamina cost configuration (defaults to DEFAULT_COST_CONFIG)
 * @param maxSteps - Maximum path length before giving up (default 200)
 * @returns PathResult with path, costs, and executable action batches
 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: Map<string, TileInfo>,
  costConfig: PathCostConfig = DEFAULT_COST_CONFIG,
  maxSteps: number = 200,
): PathResult {
  const startKey = coordKey(startCol, startRow);
  const endKey = coordKey(endCol, endRow);

  if (startKey === endKey) {
    return { found: true, path: [], totalCost: 0, actionBatches: [] };
  }

  // Check if target is impassable
  const targetTile = tileMap.get(endKey);
  if (targetTile && IMPASSABLE_BIOMES.has(targetTile.biome)) {
    return { found: false, path: [], totalCost: Infinity, actionBatches: [] };
  }

  const frontier = new MinHeap();
  frontier.push(startKey, 0);

  const cameFrom = new Map<string, string | null>();
  const costSoFar = new Map<string, number>();
  const directionTo = new Map<string, Direction>();

  cameFrom.set(startKey, null);
  costSoFar.set(startKey, 0);

  let found = false;

  while (frontier.length > 0) {
    const currentKey = frontier.pop()!;

    if (currentKey === endKey) {
      found = true;
      break;
    }

    const [cStr, rStr] = currentKey.split(",");
    const currentCol = parseInt(cStr, 10);
    const currentRow = parseInt(rStr, 10);
    const currentCost = costSoFar.get(currentKey)!;

    // Bail if we've explored too many nodes
    if (costSoFar.size > maxSteps * 6) break;

    // Use shared getNeighborHexes from @bibliothecadao/types
    const neighbors: NeighborHex[] = getNeighborHexes(currentCol, currentRow);

    for (const neighbor of neighbors) {
      const neighborKey = coordKey(neighbor.col, neighbor.row);
      const neighborTile = tileMap.get(neighborKey);
      const moveCost = getTileCost(neighborTile, costConfig);

      if (moveCost === Infinity) continue; // Impassable

      const newCost = currentCost + moveCost;
      const existingCost = costSoFar.get(neighborKey);

      if (existingCost === undefined || newCost < existingCost) {
        costSoFar.set(neighborKey, newCost);
        // A* heuristic: cost so far + estimated remaining (hex distance * min cost)
        // Minimum possible cost per hex — use lowest travel cost for admissible heuristic
        const minCost = Math.max(1, costConfig.baseTravelCost - costConfig.biomeBonus);
        const heuristic = hexDistance(neighbor.col, neighbor.row, endCol, endRow) * minCost;
        frontier.push(neighborKey, newCost + heuristic);
        cameFrom.set(neighborKey, currentKey);
        directionTo.set(neighborKey, neighbor.direction);
      }
    }
  }

  if (!found) {
    return { found: false, path: [], totalCost: Infinity, actionBatches: [] };
  }

  // Reconstruct path
  const path: PathStep[] = [];
  let current = endKey;
  while (current !== startKey) {
    const prev = cameFrom.get(current)!;
    const [cStr, rStr] = current.split(",");
    const col = parseInt(cStr, 10);
    const row = parseInt(rStr, 10);
    const tile = tileMap.get(current);
    const direction = directionTo.get(current)!;
    const cost = getTileCost(tile, costConfig);
    const explored = isTileExplored(tile);

    path.unshift({ col, row, direction, cost, explored });
    current = prev;
  }

  const totalCost = costSoFar.get(endKey)!;
  const actionBatches = buildActionBatches(path);

  return { found, path, totalCost, actionBatches };
}

// ---------------------------------------------------------------------------
// Action batch builder
// ---------------------------------------------------------------------------

/**
 * Groups consecutive path steps into executable action batches.
 * - Consecutive explored tiles → single "travel" batch (multi-hop)
 * - Each unexplored tile → individual "explore" batch (one at a time)
 */
function buildActionBatches(path: PathStep[]): ActionBatch[] {
  const batches: ActionBatch[] = [];
  let i = 0;

  while (i < path.length) {
    if (path[i].explored) {
      // Collect consecutive explored tiles into one travel batch
      const travelDirections: Direction[] = [];
      let travelCost = 0;
      while (i < path.length && path[i].explored) {
        travelDirections.push(path[i].direction);
        travelCost += path[i].cost;
        i++;
      }
      batches.push({ type: "travel", directions: travelDirections, cost: travelCost });
    } else {
      // Each unexplored tile is a separate explore action
      batches.push({
        type: "explore",
        directions: [path[i].direction],
        cost: path[i].cost,
      });
      i++;
    }
  }

  return batches;
}
