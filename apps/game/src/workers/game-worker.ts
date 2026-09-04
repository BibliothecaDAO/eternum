import { getNeighborOffsets } from "@bibliothecadao/types";
import type { BiomeType, HexEntityInfo } from "@bibliothecadao/types";
import type { GameWorkerRequestMessage, GameWorkerWorldState } from "./game-worker-messages";

// Simplified Position interface
interface WorkerPosition {
  x: number;
  y: number;
}

interface Node {
  col: number;
  row: number;
  f: number;
  g: number;
  parent?: Node;
}

// State maps
const exploredTiles = new Map<number, Map<number, BiomeType>>();
const structureHexes = new Map<number, Map<number, HexEntityInfo>>();
const armyHexes = new Map<number, Map<number, HexEntityInfo>>();

function updateSpatialMap<T>(map: Map<number, Map<number, T>>, col: number, row: number, value: T | null): void {
  if (value !== null) {
    const column = map.get(col) ?? new Map<number, T>();
    column.set(row, value);
    map.set(col, column);
    return;
  }

  const column = map.get(col);
  column?.delete(row);
  if (column?.size === 0) {
    map.delete(col);
  }
}

function resetWorldState(): void {
  exploredTiles.clear();
  structureHexes.clear();
  armyHexes.clear();
}

function hydrateWorldState(worldState: GameWorkerWorldState): void {
  resetWorldState();
  worldState.exploredTiles.forEach(({ biome, col, row }) => updateSpatialMap(exploredTiles, col, row, biome));
  worldState.structures.forEach(({ col, info, row }) => updateSpatialMap(structureHexes, col, row, info));
  worldState.armies.forEach(({ col, info, row }) => updateSpatialMap(armyHexes, col, row, info));
}

self.onmessage = (event: MessageEvent<GameWorkerRequestMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "UPDATE_EXPLORED": {
      updateSpatialMap(exploredTiles, msg.col, msg.row, msg.biome);
      break;
    }
    case "UPDATE_STRUCTURE": {
      updateSpatialMap(structureHexes, msg.col, msg.row, msg.info);
      break;
    }
    case "UPDATE_ARMY": {
      updateSpatialMap(armyHexes, msg.col, msg.row, msg.info);
      break;
    }
    case "HYDRATE_WORLD_STATE": {
      hydrateWorldState(msg);
      break;
    }
    case "RESET_WORLD_STATE": {
      resetWorldState();
      break;
    }
    case "FIND_PATH": {
      const path = findShortestPath(msg.start, msg.end, msg.maxDistance);
      self.postMessage({ type: "PATH_RESULT", requestId: msg.requestId, path });
      break;
    }
  }
};

// Adapted A* Pathfinding
function findShortestPath(startPos: WorkerPosition, endPos: WorkerPosition, maxDistance: number): WorkerPosition[] {
  if (startPos.x === endPos.x && startPos.y === endPos.y) return [];

  // Distance check
  const initialDist = getHexDistance(startPos, endPos);
  if (initialDist > maxDistance) return [];

  const openSet: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    col: startPos.x,
    row: startPos.y,
    f: 0,
    g: 0,
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    // Find lowest f
    let lowestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIndex].f) {
        lowestIndex = i;
      }
    }
    const current = openSet[lowestIndex];

    // Reached end
    if (current.col === endPos.x && current.row === endPos.y) {
      return reconstructPath(current);
    }

    // Move to closed
    openSet.splice(lowestIndex, 1);
    closedSet.add(`${current.col},${current.row}`);

    // Neighbors
    const neighbors = getNeighborOffsets(current.row);
    for (const { i, j } of neighbors) {
      const neighborCol = current.col + i;
      const neighborRow = current.row + j;

      // Max distance check from start
      if (current.g + 1 > maxDistance) continue;

      // Check if explored
      const colMap = exploredTiles.get(neighborCol);
      if (!colMap || !colMap.has(neighborRow)) continue;

      // Check closed set
      if (closedSet.has(`${neighborCol},${neighborRow}`)) continue;

      // Check structures (block)
      const structMap = structureHexes.get(neighborCol);
      if (structMap && structMap.has(neighborRow)) continue;

      // Check armies (block, unless it's the target)
      const armyMap = armyHexes.get(neighborCol);
      const isTarget = neighborCol === endPos.x && neighborRow === endPos.y;
      if (armyMap && armyMap.has(neighborRow) && !isTarget) continue;

      const g = current.g + 1;
      const h = getHexDistance({ x: neighborCol, y: neighborRow }, endPos);
      const f = g + h;

      const existingNode = openSet.find((n) => n.col === neighborCol && n.row === neighborRow);
      if (!existingNode) {
        openSet.push({
          col: neighborCol,
          row: neighborRow,
          f,
          g,
          parent: current,
        });
      } else if (g < existingNode.g) {
        existingNode.g = g;
        existingNode.f = f;
        existingNode.parent = current;
      }
    }
  }

  return [];
}

function reconstructPath(endNode: Node): WorkerPosition[] {
  const path: WorkerPosition[] = [];
  let current: Node | undefined = endNode;
  while (current) {
    path.unshift({ x: current.col, y: current.row });
    current = current.parent;
  }
  return path;
}

function getHexDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  // In axial coordinates (which col/row essentially are with offset), distance is:
  // (abs(dx) + abs(dy) + abs(dz)) / 2
  // But here we likely use offset coordinates logic or axial.
  // The original code used:
  // const dx = Math.abs(a.col - b.col);
  // const dy = Math.abs(a.row - b.row);
  // return Math.max(dx, dy);
  // Let's stick to what was in the original file if possible,
  // but typically hex distance is more complex in offset coords.
  // Assuming `getHexDistance` in original code was correct for the coordinate system used.
  // The original code:
  // function getHexDistance(a: HexPosition, b: HexPosition): number {
  //   const dx = Math.abs(a.col - b.col);
  //   const dy = Math.abs(a.row - b.row);
  //   return Math.max(dx, dy);
  // }

  // Actually, looking at original file:
  // function getHexDistance(a: HexPosition, b: HexPosition): number {
  //   const dx = Math.abs(a.col - b.col);
  //   const dy = Math.abs(a.row - b.row);
  //   return Math.max(dx, dy);
  // }
  // This looks like Chebyshev distance, which is correct for axial coordinates if col/row are axial.
  // If they are offset (odd-r/even-r), this is an approximation or incorrect.
  // Given the codebase uses `col` and `row`, and `getNeighborOffsets` depends on even/odd row,
  // it implies OFFSET coordinates.
  // For offset coordinates, max(dx, dy) is NOT the correct distance metric.
  // However, I should mirror exactly what was there to preserve behavior,
  // OR fix it if I know better.
  // The `getNeighborOffsets` strongly suggests "Odd-q" or "Even-q" or "Odd-r" vertical layout.
  // `apps/game/src/three/utils/pathfinding.ts` had `getHexDistance` implementation.
  // I will use the implementation from the original file.

  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy);
}
