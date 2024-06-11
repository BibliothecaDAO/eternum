import { Color } from "three";
import { Position, getNeighborHexes, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import { Hexagon } from "../../../../types";

const matrix = new Matrix4();
const positions = new Vector3();
import { InstancedMesh, Matrix4, Vector3 } from "three";

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

export const findShortestPathBFS = (
  startPos: Position,
  endPos: Position,
  exploredHexes: Map<number, Set<number>>,
  maxHex: number,
) => {
  const queue: { position: Position; distance: number }[] = [{ position: startPos, distance: 0 }];
  const visited = new Set<string>();
  const path = new Map<string, Position>();

  const posKey = (pos: Position) => `${pos.x},${pos.y}`;

  while (queue.length > 0) {
    const { position: current, distance } = queue.shift()!;
    if (current.x === endPos.x && current.y === endPos.y) {
      // Reconstruct the path upon reaching the end position
      let temp = current;
      const result = [];
      while (temp) {
        result.unshift(temp); // Add to the beginning of the result array
        //@ts-ignore:
        temp = path.get(posKey(temp)); // Move backwards through the path
      }
      return result;
    }

    if (distance > maxHex) {
      break; // Stop processing if the current distance exceeds maxHex
    }

    const currentKey = posKey(current);
    if (!visited.has(currentKey)) {
      visited.add(currentKey);
      const neighbors = getNeighborHexes(current.x, current.y);
      for (const neighbor of neighbors) {
        const { col: x, row: y } = neighbor;
        const neighborKey = posKey({ x, y });
        const isExplored = exploredHexes.get(x - 2147483647)?.has(y - 2147483647);
        if (
          !visited.has(neighborKey) &&
          !queue.some((e) => posKey(e.position) === neighborKey) &&
          isExplored &&
          distance + 1 <= maxHex
        ) {
          path.set(neighborKey, current); // Map each neighbor back to the current position
          queue.push({ position: { x, y }, distance: distance + 1 });
        }
      }
    }
  }

  return []; // Return empty array if no path is found within maxHex distance
};

export const findAccessiblePositions = (
  startPos: Position,
  exploredHexes: Map<number, Set<number>>,
  maxHex: number,
  canExplore: boolean,
) => {
  const startTime = performance.now(); // Start timing

  const queue: { position: Position; distance: number }[] = [{ position: startPos, distance: 0 }];
  const visited = new Set<string>();
  const posKey = (pos: Position) => `${pos.x},${pos.y}`;
  const highlightPositions = new Set<string>();

  while (queue.length > 0) {
    const { position: current, distance } = queue.shift()!;

    if (distance > maxHex) break; // Stop processing if the current distance exceeds maxHex

    const currentKey = posKey(current);
    if (visited.has(currentKey)) continue;

    visited.add(currentKey);
    // takes compute
    const neighbors = getNeighborHexes(current.x, current.y);

    for (const neighbor of neighbors) {
      const { col: x, row: y } = neighbor;
      const neighborKey = posKey({ x, y });
      if (visited.has(neighborKey)) continue;

      const isExplored = exploredHexes.get(x - 2147483647)?.has(y - 2147483647);
      const nextDistance = distance + 1;

      if (isExplored && nextDistance <= maxHex) {
        queue.push({ position: { x, y }, distance: nextDistance });
        highlightPositions.add(neighborKey);
      } else if (!isExplored && canExplore && nextDistance === 1) {
        highlightPositions.add(neighborKey);
      }
    }
  }

  const endTime = performance.now(); // End timing
  const executionTime = endTime - startTime;
  console.log(`Execution Time: ${executionTime.toFixed(2)} ms`);

  return Array.from(highlightPositions).map((key) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  });
};

export const findAccessiblePositionsAndPaths = (
  startPos: Position,
  exploredHexes: Map<number, Set<number>>,
  maxHex: number,
  canExplore: boolean,
) => {
  const startTime = performance.now(); // Start timing

  const queue: { position: Position; distance: number; path: Position[] }[] = [
    { position: startPos, distance: 0, path: [startPos] }, // Include the start position in the initial path
  ];
  const visited = new Set<string>();
  const posKey = (pos: Position) => `${pos.x},${pos.y}`;
  const travelPaths = new Map<string, { path: Position[]; isExplored: boolean }>(); // Store paths for highlighted positions

  while (queue.length > 0) {
    const { position: current, distance, path } = queue.shift()!;

    if (distance > maxHex) break; // Stop processing if the current distance exceeds maxHex

    const currentKey = posKey(current);
    if (visited.has(currentKey)) continue;

    visited.add(currentKey);
    const neighbors = getNeighborHexes(current.x, current.y);

    for (const neighbor of neighbors) {
      const { col: x, row: y } = neighbor;
      const neighborKey = posKey({ x, y });
      if (visited.has(neighborKey)) continue;

      const isExplored = exploredHexes.get(x - 2147483647)?.has(y - 2147483647);
      const nextDistance = distance + 1;
      const nextPath = [...path, { x, y }]; // Extend the current path

      if ((isExplored && nextDistance <= maxHex) || (!isExplored && canExplore && nextDistance === 1)) {
        queue.push({ position: { x, y }, distance: nextDistance, path: nextPath });
        travelPaths.set(neighborKey, { path: nextPath, isExplored: isExplored || false }); // Store path along with position
      }
    }
  }

  const endTime = performance.now(); // End timing
  const executionTime = endTime - startTime;
  console.log(`Execution Time: ${executionTime.toFixed(2)} ms`);

  return travelPaths;
};
