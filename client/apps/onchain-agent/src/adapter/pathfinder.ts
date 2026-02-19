/**
 * A* pathfinder for Eternum's even-r offset hex grid.
 *
 * Pure function: takes start, end, and tile map — returns the cheapest path
 * with per-step cost breakdown and directions for action execution.
 *
 * Does NOT make decisions about whether to go somewhere. That's the agent's job.
 * This just answers: "what's the path and what does it cost?"
 */

// ---------------------------------------------------------------------------
// Inline hex neighbor logic (even-r offset grid)
// Avoids adding @bibliothecadao/types as a dependency.
// Source: packages/types/src/constants/hex.ts
// ---------------------------------------------------------------------------

interface NeighborHex {
  col: number;
  row: number;
  direction: number;
}

const NEIGHBOR_OFFSETS_EVEN = [
  { i: 1, j: 0, direction: 0 }, // EAST
  { i: 1, j: 1, direction: 1 }, // NORTH_EAST
  { i: 0, j: 1, direction: 2 }, // NORTH_WEST
  { i: -1, j: 0, direction: 3 }, // WEST
  { i: 0, j: -1, direction: 4 }, // SOUTH_WEST
  { i: 1, j: -1, direction: 5 }, // SOUTH_EAST
];

const NEIGHBOR_OFFSETS_ODD = [
  { i: 1, j: 0, direction: 0 }, // EAST
  { i: 0, j: 1, direction: 1 }, // NORTH_EAST
  { i: -1, j: 1, direction: 2 }, // NORTH_WEST
  { i: -1, j: 0, direction: 3 }, // WEST
  { i: -1, j: -1, direction: 4 }, // SOUTH_WEST
  { i: 0, j: -1, direction: 5 }, // SOUTH_EAST
];

function getNeighborHexes(col: number, row: number): NeighborHex[] {
  const offsets = row % 2 === 0 ? NEIGHBOR_OFFSETS_EVEN : NEIGHBOR_OFFSETS_ODD;
  return offsets.map((o) => ({ col: col + o.i, row: row + o.j, direction: o.direction }));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TileInfo {
  biome: number;
  occupierType: number;
  occupierId: number;
}

/** A single step in a computed path. */
export interface PathStep {
  col: number;
  row: number;
  direction: number; // Direction enum value to reach this tile from previous
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
  directions: number[];
  /** Total cost for this batch. */
  cost: number;
}

// ---------------------------------------------------------------------------
// Biome costs
// ---------------------------------------------------------------------------

/** Impassable biome IDs (deep ocean, ocean). */
const IMPASSABLE_BIOMES = new Set([1, 2]);

/**
 * Movement cost by biome ID.
 * Biome 0 = unexplored/unknown — passable but higher cost (explore action).
 * These are base costs; the agent can query stamina tables for exact values.
 */
const BIOME_COST: Record<number, number> = {
  0: 30, // Unexplored — explore action cost
  1: Infinity, // Deep Ocean — impassable
  2: Infinity, // Ocean — impassable
  3: 10, // Beach
  4: 10, // Scorched
  5: 10, // Bare
  6: 10, // Tundra
  7: 10, // Snow
  8: 10, // Temperate Desert
  9: 10, // Shrubland
  10: 10, // Taiga
  11: 10, // Grassland
  12: 10, // Temperate Deciduous Forest
  13: 10, // Temperate Rain Forest
  14: 10, // Subtropical Desert
  15: 10, // Tropical Seasonal Forest
  16: 10, // Tropical Rain Forest
};

function getTileCost(tile: TileInfo | undefined): number {
  if (!tile) return 30; // Unknown/unexplored tile — explore cost
  if (IMPASSABLE_BIOMES.has(tile.biome)) return Infinity;
  return BIOME_COST[tile.biome] ?? 10;
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

/** Cube distance for hex heuristic (admissible, never overestimates). */
function hexDistance(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): number {
  // Convert even-r offset to cube coords
  const fq = fromCol - Math.floor((fromRow - (fromRow & 1)) / 2);
  const fr = fromRow;
  const fs = -fq - fr;

  const tq = toCol - Math.floor((toRow - (toRow & 1)) / 2);
  const tr = toRow;
  const ts = -tq - tr;

  return Math.max(Math.abs(fq - tq), Math.abs(fr - tr), Math.abs(fs - ts));
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
 * @param maxSteps - Maximum path length before giving up (default 200)
 * @returns PathResult with path, costs, and executable action batches
 */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: Map<string, TileInfo>,
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
  const directionTo = new Map<string, number>(); // direction used to reach each tile

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

    const neighbors: NeighborHex[] = getNeighborHexes(currentCol, currentRow);

    for (const neighbor of neighbors) {
      const neighborKey = coordKey(neighbor.col, neighbor.row);
      const neighborTile = tileMap.get(neighborKey);
      const moveCost = getTileCost(neighborTile);

      if (moveCost === Infinity) continue; // Impassable

      const newCost = currentCost + moveCost;
      const existingCost = costSoFar.get(neighborKey);

      if (existingCost === undefined || newCost < existingCost) {
        costSoFar.set(neighborKey, newCost);
        // A* heuristic: cost so far + estimated remaining (hex distance * min cost)
        const heuristic = hexDistance(neighbor.col, neighbor.row, endCol, endRow) * 10;
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
    const cost = getTileCost(tile);
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
      const travelDirections: number[] = [];
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
