import { getNeighborHexes, Direction } from "@bibliothecadao/types";

const CENTER: [number, number] = [10, 10];

// Max rings per realm level (0-indexed): Settlement=1, City=2, Kingdom=3, Empire=4
const LEVEL_TO_MAX_RING: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4 };

/**
 * BFS from start to end on the inner hex grid, returning Direction[] path.
 */
export function getDirectionsArray(start: [number, number], end: [number, number]): Direction[] {
  const [startCol, startRow] = start;
  const [endCol, endRow] = end;

  if (startCol === endCol && startRow === endRow) return [];

  const queue: { col: number; row: number; path: Direction[] }[] = [
    { col: startCol, row: startRow, path: [] },
  ];
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
 * Generate all hex positions in concentric rings around center.
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

export interface SlotResult {
  col: number;
  row: number;
  directions: Direction[];
}

/**
 * Find the first open build slot on a realm.
 * @param occupied Set of "col,row" strings for already-built positions
 * @param level Realm level (1-4), determines how many rings are available
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
 * Find up to `count` open build slots on a realm.
 * Returns a mutable Set of occupied positions that includes the newly claimed slots.
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
