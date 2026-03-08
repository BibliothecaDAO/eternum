/**
 * A* pathfinding over explored hex tiles.
 *
 * Converts a start/end hex coordinate pair into a direction array
 * suitable for `explorer_travel` or `explorer_explore`.
 *
 * Uses hex utilities from @bibliothecadao/types for direction/offset
 * logic. Coordinate system: offset coordinates where neighbor offsets
 * depend on whether the row (y) is even or odd.
 */

import type { TileState, Position } from "@bibliothecadao/client";
import {
  Direction,
  getNeighborOffsets,
  getDirectionBetweenAdjacentHexes,
  Coord,
} from "@bibliothecadao/types";

// ── Types ────────────────────────────────────────────────────────────

/** Cost function: given a destination tile key "x,y", return stamina cost to enter it. */
export type TileCostFn = (tileKey: string) => number;

export interface PathResult {
  /** Ordered hex positions from start to end (inclusive). */
  path: Position[];
  /** Direction values for each step. Length = path.length - 1. */
  directions: number[];
  /** Number of steps (= directions.length). */
  distance: number;
  /** Total stamina cost for the path. */
  staminaCost: number;
  /** True if a path exists but exceeds maxStamina. */
  reachedLimit: boolean;
}

// ── Hex distance heuristic ───────────────────────────────────────────

function hexDistance(a: Position, b: Position): number {
  return new Coord(a.x, a.y).distance(new Coord(b.x, b.y));
}

// ── Direction between adjacent hexes ─────────────────────────────────

export function directionBetween(from: Position, to: Position): Direction | null {
  return getDirectionBetweenAdjacentHexes(
    { col: from.x, row: from.y },
    { col: to.x, row: to.y },
  );
}

// ── A* pathfinder ────────────────────────────────────────────────────

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
}

/**
 * Find cheapest stamina path between two hex positions over explored tiles.
 *
 * Uses A* with stamina cost as edge weight (via tileCost function).
 * Finds the cheapest path, then marks `reachedLimit` if it exceeds maxStamina.
 *
 * @param start       Starting hex position
 * @param end         Target hex position
 * @param explored    Set of explored tile keys ("x,y")
 * @param blocked     Set of blocked tile keys (structures, other armies).
 *                    The end position is never considered blocked (allows targeting).
 * @param maxStamina  Maximum stamina budget
 * @param tileCost    Cost function: tile key → stamina to enter that tile
 * @returns PathResult or null if truly unreachable
 */
export function findPath(
  start: Position,
  end: Position,
  explored: Set<string>,
  blocked: Set<string>,
  maxStamina: number,
  tileCost: TileCostFn,
): PathResult | null {
  if (start.x === end.x && start.y === end.y) {
    return { path: [start], directions: [], distance: 0, staminaCost: 0, reachedLimit: false };
  }

  const endKey = `${end.x},${end.y}`;
  // Use minimum possible cost for A* heuristic (admissible)
  const minCost = 1;

  const openSet: Node[] = [{ x: start.x, y: start.y, g: 0, f: hexDistance(start, end) * minCost, parent: null }];
  const closed = new Set<string>();

  while (openSet.length > 0) {
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet[bestIdx];
    openSet.splice(bestIdx, 1);

    const key = `${current.x},${current.y}`;
    if (closed.has(key)) continue;
    closed.add(key);

    // Reached target
    if (current.x === end.x && current.y === end.y) {
      const result = reconstructPath(current);
      result.reachedLimit = result.staminaCost > maxStamina;
      return result;
    }

    // Expand neighbors
    const offsets = getNeighborOffsets(current.y);
    for (const { i, j } of offsets) {
      const nx = current.x + i;
      const ny = current.y + j;
      const nKey = `${nx},${ny}`;

      if (closed.has(nKey)) continue;

      // Must be explored (unless it's the target — explorer_explore can reach unexplored targets)
      if (!explored.has(nKey) && nKey !== endKey) continue;

      // Must not be blocked (target is never blocked)
      if (blocked.has(nKey) && nKey !== endKey) continue;

      const stepCost = tileCost(nKey);
      const g = current.g + stepCost;
      const f = g + hexDistance({ x: nx, y: ny }, end) * minCost;

      // Check if already in open set with better g
      const existing = openSet.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
      } else {
        openSet.push({ x: nx, y: ny, g, f, parent: current });
      }
    }
  }

  return null; // Truly unreachable
}

function reconstructPath(endNode: Node): PathResult {
  const path: Position[] = [];
  let node: Node | null = endNode;
  const totalCost = endNode.g;
  while (node) {
    path.push({ x: node.x, y: node.y });
    node = node.parent;
  }
  path.reverse();

  const directions: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const dir = directionBetween(path[i], path[i + 1]);
    if (dir === null) {
      throw new Error(`Non-adjacent hex pair in path: (${path[i].x},${path[i].y}) → (${path[i + 1].x},${path[i + 1].y})`);
    }
    directions.push(dir);
  }

  return { path, directions, distance: directions.length, staminaCost: totalCost, reachedLimit: false };
}

// ── Build tile index from MapSnapshot tiles ──────────────────────────

export interface TileIndex {
  explored: Set<string>;
  blocked: Set<string>;
}

/**
 * Build pathfinding tile index from raw tile data.
 * Any occupied tile blocks movement (structures, explorers, chests, quests, spires).
 * The end position is never considered blocked by findPath (allows targeting).
 */
export function buildTileIndex(tiles: TileState[]): TileIndex {
  const explored = new Set<string>();
  const blocked = new Set<string>();

  for (const t of tiles) {
    const key = `${t.position.x},${t.position.y}`;
    explored.add(key);

    if (t.occupierType !== 0) {
      blocked.add(key);
    }
  }

  return { explored, blocked };
}
