import { Position } from "@bibliothecadao/eternum";

import { BiomeType, getNeighborOffsets, HexEntityInfo, HexPosition } from "@bibliothecadao/types";

interface Node {
  col: number;
  row: number;
  f: number;
  g: number;
  parent?: Node;
}

export function findShortestPath(
  oldPosition: Position,
  newPosition: Position,
  exploredTiles: Map<number, Map<number, BiomeType>>,
  structureHexes: Map<number, Map<number, HexEntityInfo>>,
  armyHexes: Map<number, Map<number, HexEntityInfo>>,
  maxDistance: number,
): Position[] {
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
    return [];
  }

  // Check if target is within maximum distance before starting pathfinding
  const oldPos = oldPosition.getNormalized();
  const newPos = newPosition.getNormalized();
  const profiler = createPathfindingProfiler(oldPos, newPos, maxDistance);
  const initialDistance = getHexDistance({ col: oldPos.x, row: oldPos.y }, { col: newPos.x, row: newPos.y });
  if (initialDistance > maxDistance) {
    return profiler ? profiler.finish([], "initial-distance") : []; // Return empty path if target is too far
  }

  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  const startNode: Node = {
    col: oldPos.x,
    row: oldPos.y,
    f: 0,
    g: 0,
  };

  openSet.push(startNode);
  profiler?.trackOpenSetSize(openSet.length);
  profiler?.nodeCreated();

  while (openSet.length > 0) {
    // Find node with lowest f score
    const current = openSet.reduce((min, node) => (node.f < min.f ? node : min), openSet[0]);
    profiler?.nodeExpanded();

    // Reached end
    if (current.col === newPos.x && current.row === newPos.y) {
      const path = reconstructPath(current);
      return profiler ? profiler.finish(path, "success") : path;
    }

    // Move current node from open to closed set
    openSet.splice(openSet.indexOf(current), 1);
    closedSet.add(`${current.col},${current.row}`);

    // Check neighbors
    const neighbors = getNeighborOffsets(current.row);
    for (const { i, j } of neighbors) {
      const neighborCol = current.col + i;
      const neighborRow = current.row + j;

      // Skip if path is getting too long
      if (current.g + 1 > maxDistance) {
        continue;
      }

      // Skip if not explored or already in closed set
      if (!exploredTiles.get(neighborCol)?.has(neighborRow) || closedSet.has(`${neighborCol},${neighborRow}`)) {
        continue;
      }

      // skip if the neighbor is a structure hex
      if (structureHexes.get(neighborCol)?.has(neighborRow)) {
        continue;
      }

      // skip if the neighbor is an army hex and not the end hex (where the unit is going)
      if (armyHexes.get(neighborCol)?.has(neighborRow) && !(neighborCol === newPos.x && neighborRow === newPos.y)) {
        continue;
      }

      const g = current.g + 1;
      const h = getHexDistance({ col: neighborCol, row: neighborRow }, { col: newPos.x, row: newPos.y });
      const f = g + h;

      const neighborNode: Node = {
        col: neighborCol,
        row: neighborRow,
        f,
        g,
        parent: current,
      };
      profiler?.nodeCreated();

      const existingNode = openSet.find((n) => n.col === neighborCol && n.row === neighborRow);

      if (!existingNode) {
        openSet.push(neighborNode);
        profiler?.trackOpenSetSize(openSet.length);
      } else if (g < existingNode.g) {
        existingNode.g = g;
        existingNode.f = f;
        existingNode.parent = current;
      }
    }
  }

  return profiler ? profiler.finish([], "no-path") : []; // No path found
}

function reconstructPath(endNode: Node): Position[] {
  const path: Position[] = [];
  let current: Node | undefined = endNode;

  while (current) {
    path.unshift(new Position({ x: current.col, y: current.row }));
    current = current.parent;
  }

  return path;
}

function getHexDistance(a: HexPosition, b: HexPosition): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return Math.max(dx, dy);
}

type PathfindingOutcome = "success" | "initial-distance" | "no-path";

interface PathfindingProfiler {
  nodeCreated(): void;
  nodeExpanded(): void;
  trackOpenSetSize(size: number): void;
  finish(result: Position[], outcome: PathfindingOutcome): Position[];
}

function createPathfindingProfiler(
  start: { x: number; y: number },
  end: { x: number; y: number },
  maxDistance: number,
): PathfindingProfiler | null {
  if (typeof performance === "undefined") {
    return null;
  }

  const perfAny = performance as any;
  const hasMemory = typeof perfAny.memory !== "undefined";
  const startTime = performance.now();
  const startHeap = hasMemory ? perfAny.memory.usedJSHeapSize : null;
  let nodesCreated = 0;
  let nodesExpanded = 0;
  let peakOpenSet = 0;

  const finish = (result: Position[], outcome: PathfindingOutcome): Position[] => {
    const durationMs = performance.now() - startTime;
    const endHeap = hasMemory ? perfAny.memory.usedJSHeapSize : null;
    const heapDeltaMB = startHeap !== null && endHeap !== null ? (endHeap - startHeap) / (1024 * 1024) : null;

    const shouldLog =
      (heapDeltaMB !== null && heapDeltaMB > 10) || nodesCreated > 5000 || nodesExpanded > 5000 || durationMs > 20;

    if (shouldLog) {
      console.warn("[PATHFIND] heavy search", {
        outcome,
        durationMs: Number(durationMs.toFixed(2)),
        nodesCreated,
        nodesExpanded,
        peakOpenSet,
        maxDistance,
        start,
        end,
        pathLength: result.length,
        heapDeltaMB: heapDeltaMB !== null ? Number(heapDeltaMB.toFixed(2)) : "n/a",
      });
    }

    return result;
  };

  return {
    nodeCreated() {
      nodesCreated++;
    },
    nodeExpanded() {
      nodesExpanded++;
    },
    trackOpenSetSize(size: number) {
      if (size > peakOpenSet) {
        peakOpenSet = size;
      }
    },
    finish,
  };
}
