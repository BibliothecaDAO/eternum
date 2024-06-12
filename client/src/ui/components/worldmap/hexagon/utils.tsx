import { Color } from "three";
import { Position, getNeighborHexes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { Hexagon } from "../../../../types";

const matrix = new Matrix4();
const positions = new Vector3();
import { InstancedMesh, Matrix4, Vector3 } from "three";
import { FELT_CENTER } from "@/ui/config";

export const isNeighbor = (pos1: Position, pos2: Position) => {
  const neighborOffsets = pos1.y % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;
  for (const { i, j } of neighborOffsets) {
    if (pos1.x + i === pos2.x && pos1.y + j === pos2.y) {
      return true;
    }
  }
  return false;
};

export const getGrayscaleColor = (color: Color) => {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  const darkerLuminance = luminance * 0.5; // Make the grayscale color darker, closer to black
  return darkerLuminance;
};

export const getPositionsAtIndex = (mesh: InstancedMesh<any, any>, index: number) => {
  if (!mesh || !mesh.isInstancedMesh) {
    console.error("The provided mesh is not an InstancedMesh.");
    return null;
  }

  mesh.getMatrixAt(index, matrix);
  positions.setFromMatrixPosition(matrix);

  return positions;
};

export const findAccessiblePositionsAndPaths = (
  startPos: Position,
  exploredHexes: Map<number, Set<number>>,
  maxHex: number,
  canExplore: boolean,
) => {
  const posKey = (pos: Position) => `${pos.x},${pos.y}`;
  const priorityQueue: { position: Position; distance: number; path: Position[] }[] = [
    { position: startPos, distance: 0, path: [startPos] },
  ];
  const travelPaths = new Map<string, { path: Position[]; isExplored: boolean }>();
  const shortestDistances = new Map<string, number>();

  while (priorityQueue.length > 0) {
    priorityQueue.sort((a, b) => a.distance - b.distance); // This makes the queue work as a priority queue
    const { position: current, distance, path } = priorityQueue.shift()!;
    const currentKey = posKey(current);

    if (!shortestDistances.has(currentKey) || distance < shortestDistances.get(currentKey)!) {
      shortestDistances.set(currentKey, distance);
      const isExplored = exploredHexes.get(current.x - FELT_CENTER)?.has(current.y - FELT_CENTER) || false;
      travelPaths.set(currentKey, { path: path, isExplored });
      if (!isExplored) continue;

      const neighbors = getNeighborHexes(current.x, current.y); // This function needs to be defined
      for (const { col: x, row: y } of neighbors) {
        const neighborKey = posKey({ x, y });
        const nextDistance = distance + 1;
        const nextPath = [...path, { x, y }];

        const isExplored = exploredHexes.get(x - FELT_CENTER)?.has(y - FELT_CENTER) || false;
        if ((isExplored && nextDistance <= maxHex) || (!isExplored && canExplore && nextDistance === 1)) {
          if (!shortestDistances.has(neighborKey) || nextDistance < shortestDistances.get(neighborKey)!) {
            priorityQueue.push({ position: { x, y }, distance: nextDistance, path: nextPath });
          }
        }
      }
    }
  }

  return travelPaths;
};
