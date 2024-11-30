import { HexPosition } from "@/types";
import { Position } from "@/types/Position";
import { getNeighborOffsets } from "@bibliothecadao/eternum";

interface Node {
  col: number;
  row: number;
  f: number;
  g: number;
  parent?: Node;
}

export function findShortestPath(
  startPosition: Position,
  endPosition: Position,
  exploredTiles: Map<number, Set<number>>,
): Position[] {
  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  const start = startPosition.getNormalized();
  const end = endPosition.getNormalized();
  const startNode: Node = {
    col: start.x,
    row: start.y,
    f: 0,
    g: 0,
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    // Find node with lowest f score
    let current = openSet.reduce((min, node) => (node.f < min.f ? node : min), openSet[0]);

    // Reached end
    if (current.col === end.x && current.row === end.y) {
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

      // Skip if not explored or already in closed set
      if (!exploredTiles.get(neighborCol)?.has(neighborRow) || closedSet.has(`${neighborCol},${neighborRow}`)) {
        continue;
      }

      const g = current.g + 1;
      const h = getHexDistance({ col: neighborCol, row: neighborRow }, { col: end.x, row: end.y });
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
