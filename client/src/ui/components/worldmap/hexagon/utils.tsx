import {
  EternumGlobalConfig,
  Position,
  Resource,
  ResourcesIds,
  TROOPS_STAMINAS,
  getNeighborHexes,
} from "@bibliothecadao/eternum";

const matrix = new Matrix4();
const positions = new Vector3();
import { InstancedMesh, Matrix4, Vector3 } from "three";
import { FELT_CENTER } from "@/ui/config";

export const getPositionsAtIndex = (mesh: InstancedMesh<any, any>, index: number) => {
  if (!mesh || !mesh.isInstancedMesh) {
    console.error("The provided mesh is not an InstancedMesh.");
    return null;
  }

  mesh.getMatrixAt(index, matrix);
  positions.setFromMatrixPosition(matrix);

  return positions;
};

export const canExplore = (stamina: number | undefined, food: Resource[]) => {
  if (stamina && stamina < EternumGlobalConfig.stamina.exploreCost) {
    return false;
  }
  const fish = food.find((resource) => resource.resourceId === ResourcesIds.Fish);
  if ((fish?.amount || 0) < EternumGlobalConfig.exploration.fishBurn) {
    return false;
  }
  const wheat = food.find((resource) => resource.resourceId === ResourcesIds.Wheat);
  if ((wheat?.amount || 0) < EternumGlobalConfig.exploration.wheatBurn) {
    return false;
  }

  return true;
};

const getMaxSteps = () => {
  const staminaCosts = Object.values(EternumGlobalConfig.stamina);
  const minCost = Math.min(...staminaCosts);

  const staminaValues = Object.values(TROOPS_STAMINAS);
  const maxStamina = Math.max(...staminaValues);

  return Math.floor(maxStamina / minCost);
};

export const findShortestPathBFS = (startPos: Position, endPos: Position, exploredHexes: Map<number, Set<number>>) => {
  const maxHex = getMaxSteps();

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
      const neighbors = getNeighborHexes(current.x, current.y); // Assuming getNeighbors is defined elsewhere
      for (const { col: x, row: y } of neighbors) {
        const neighborKey = posKey({ x, y });
        const isExplored = exploredHexes.get(x - FELT_CENTER)?.has(y - FELT_CENTER);
        if (!visited.has(neighborKey) && !queue.some((e) => posKey(e.position) === neighborKey) && isExplored) {
          path.set(neighborKey, current); // Map each neighbor back to the current position
          queue.push({ position: { x, y }, distance: distance + 1 });
        }
      }
    }
  }

  return []; // Return empty array if no path is found within maxHex distance
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
