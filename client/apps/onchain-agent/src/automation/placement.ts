/**
 * Building placement — finds open hex slots on a realm's inner grid and
 * computes BFS direction paths from the center tile (10,10) to each slot.
 */
import { getNeighborHexes, Direction } from "@bibliothecadao/types";

/** Center tile of every realm's inner hex grid. */
const CENTER: [number, number] = [10, 10];

/** Max buildable rings per realm level (0-indexed): Settlement=1, City=2, Kingdom=3, Empire=4. */
const LEVEL_TO_MAX_RING: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4 };

/**
 * BFS from `start` to `end` on the inner hex grid, returning the shortest direction path.
 *
 * @param start - Starting hex as [col, row].
 * @param end - Target hex as [col, row].
 * @returns Ordered Direction[] to walk from start to end, or an empty array if unreachable or already there.
 */
export function getDirectionsArray(start: [number, number], end: [number, number]): Direction[] {
  const [startCol, startRow] = start;
  const [endCol, endRow] = end;

  if (startCol === endCol && startRow === endRow) return [];

  const queue: { col: number; row: number; path: Direction[] }[] = [{ col: startCol, row: startRow, path: [] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { col, row, path } = queue.shift()!;

    if (col === endCol && row === endRow) return path;

    const key = `${col},${row}`;
    if (visited.has(key)) continue;
    visited.add(key);

    for (const neighbor of getNeighborHexes(col, row)) {
      if (!visited.has(`${neighbor.col},${neighbor.row}`)) {
        queue.push({
          col: neighbor.col,
          row: neighbor.row,
          path: [...path, neighbor.direction],
        });
      }
    }
  }

  return [];
}

/**
 * Generate all hex positions in concentric rings around the center.
 */
function hexRings(maxRing: number): Array<{ col: number; row: number }> {
  const result: Array<{ col: number; row: number }> = [];
  const visited = new Set<string>();
  visited.add(`${CENTER[0]},${CENTER[1]}`);

  let frontier = [{ col: CENTER[0], row: CENTER[1] }];

  for (let ring = 1; ring <= maxRing; ring++) {
    const nextFrontier: Array<{ col: number; row: number }> = [];
    for (const hex of frontier) {
      for (const neighbor of getNeighborHexes(hex.col, hex.row)) {
        const key = `${neighbor.col},${neighbor.row}`;
        if (!visited.has(key)) {
          visited.add(key);
          result.push({ col: neighbor.col, row: neighbor.row });
          nextFrontier.push({ col: neighbor.col, row: neighbor.row });
        }
      }
    }
    frontier = nextFrontier;
  }

  return result;
}

/** A hex grid position plus the BFS direction path from the realm center to that position. */
export interface SlotResult {
  /** Column coordinate of the target hex. */
  col: number;
  /** Row coordinate of the target hex. */
  row: number;
  /** Ordered directions to walk from the center hex (10,10) to reach this slot. */
  directions: Direction[];
}

/**
 * Find the first open build slot on a realm, scanning outward ring by ring.
 *
 * @param occupied - Set of "col,row" strings marking already-built positions.
 * @param level - Realm level (0-indexed); determines how many hex rings are available.
 * @returns The nearest unoccupied SlotResult with its direction path, or null if all slots are full.
 */
export function findOpenSlot(occupied: Set<string>, level: number): SlotResult | null {
  const maxRing = LEVEL_TO_MAX_RING[level] ?? 1;
  const candidates = hexRings(maxRing);

  for (const { col, row } of candidates) {
    if (!occupied.has(`${col},${row}`)) {
      const directions = getDirectionsArray(CENTER, [col, row]);
      if (directions.length > 0) {
        return { col, row, directions };
      }
    }
  }

  return null;
}

/**
 * Find up to `count` open build slots on a realm, claiming each one before searching for the next.
 *
 * @param occupied - Set of "col,row" strings marking already-built positions.
 * @param level - Realm level (0-indexed); determines how many hex rings are available.
 * @param count - Maximum number of slots to find.
 * @returns The found SlotResults and an updated occupied set that includes the newly claimed slots.
 */
export function findOpenSlots(
  occupied: Set<string>,
  level: number,
  count: number,
): { slots: SlotResult[]; updatedOccupied: Set<string> } {
  const working = new Set(occupied);
  const slots: SlotResult[] = [];

  for (let i = 0; i < count; i++) {
    const slot = findOpenSlot(working, level);
    if (!slot) break;
    slots.push(slot);
    working.add(`${slot.col},${slot.row}`);
  }

  return { slots, updatedOccupied: working };
}
