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
  const initialDistance = getHexDistance({ col: oldPos.x, row: oldPos.y }, { col: newPos.x, row: newPos.y });
  if (initialDistance > maxDistance) {
    return []; // Return empty path if target is too far
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

  while (openSet.length > 0) {
    // Find node with lowest f score
    const current = openSet.reduce((min, node) => (node.f < min.f ? node : min), openSet[0]);

    // Reached end
    if (current.col === newPos.x && current.row === newPos.y) {
      return reconstructPath(current);
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

      const existingNode = openSet.find((n) => n.col === neighborCol && n.row === neighborRow);

      if (!existingNode) {
        openSet.push(neighborNode);
      } else if (g < existingNode.g) {
        existingNode.g = g;
        existingNode.f = f;
        existingNode.parent = current;
      }
    }
  }

  return []; // No path found
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
