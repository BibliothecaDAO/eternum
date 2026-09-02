import { getNeighborHexes } from "@bibliothecadao/types";

import { terrainHexToWorld } from "./terrain-coordinates";
import { hexCellFromKey, hexCellKey } from "./hex-cell-key";
import type { TerrainCellInput, TerrainRoadAnchor, TerrainRoadSegment } from "./terrain-types";
import { isTerrainWaterBiome } from "./terrain-water";

interface TerrainRoadNetworkInput {
  anchors: readonly TerrainRoadAnchor[];
  cells: readonly TerrainCellInput[];
}

interface RoadConnectionCandidate {
  distance: number;
  from: TerrainRoadAnchor;
  to: TerrainRoadAnchor;
}

interface RoadSearchNode {
  col: number;
  cost: number;
  estimate: number;
  row: number;
}

const MAX_ROAD_CONNECTION_HEXES = 12;
const MAX_ROAD_ROUTE_STEPS = 18;
const MAX_ROAD_DEGREE = 3;
const TERRAIN_HEX_STEP_WORLD_DISTANCE = Math.sqrt(3);

export function buildTerrainRoadSegments(input: TerrainRoadNetworkInput): TerrainRoadSegment[] {
  const cellsByKey = new Map(input.cells.map((cell) => [hexCellKey(cell.col, cell.row), cell]));
  const anchors = canonicalRoadAnchors(input.anchors).filter((anchor) => isEligibleRoadAnchor(anchor, cellsByKey));
  const anchorsByOwner = groupRoadAnchorsByOwner(anchors);
  const segments: TerrainRoadSegment[] = [];

  for (const ownerAnchors of anchorsByOwner.values()) {
    segments.push(...buildOwnerRoadSegments(ownerAnchors, cellsByKey));
  }

  return segments.toSorted(compareRoadSegments);
}

function groupRoadAnchorsByOwner(anchors: readonly TerrainRoadAnchor[]): ReadonlyMap<string, TerrainRoadAnchor[]> {
  const anchorsByOwner = new Map<string, TerrainRoadAnchor[]>();
  for (const anchor of anchors) {
    const ownerAnchors = anchorsByOwner.get(anchor.owner) ?? [];
    ownerAnchors.push(anchor);
    anchorsByOwner.set(anchor.owner, ownerAnchors);
  }
  return anchorsByOwner;
}

function buildOwnerRoadSegments(
  anchors: readonly TerrainRoadAnchor[],
  cellsByKey: ReadonlyMap<number, TerrainCellInput>,
): TerrainRoadSegment[] {
  const parentById = new Map(anchors.map(({ structureId }) => [structureId, structureId]));
  const degreeById = new Map(anchors.map(({ structureId }) => [structureId, 0]));
  const anchorKeys = new Set(anchors.map(({ col, row }) => hexCellKey(col, row)));
  const segments: TerrainRoadSegment[] = [];

  for (const connection of buildConnectionCandidates(anchors)) {
    if (findRoot(parentById, connection.from.structureId) === findRoot(parentById, connection.to.structureId)) continue;
    if ((degreeById.get(connection.from.structureId) ?? 0) >= MAX_ROAD_DEGREE) continue;
    if ((degreeById.get(connection.to.structureId) ?? 0) >= MAX_ROAD_DEGREE) continue;
    const path = findRoadPath(connection.from, connection.to, cellsByKey, anchorKeys);
    if (!path) continue;

    unionRoots(parentById, connection.from.structureId, connection.to.structureId);
    degreeById.set(connection.from.structureId, (degreeById.get(connection.from.structureId) ?? 0) + 1);
    degreeById.set(connection.to.structureId, (degreeById.get(connection.to.structureId) ?? 0) + 1);
    segments.push(...pathToRoadSegments(path, roadRouteId(connection.from, connection.to)));
  }

  return segments;
}

function buildConnectionCandidates(anchors: readonly TerrainRoadAnchor[]): RoadConnectionCandidate[] {
  const candidates: RoadConnectionCandidate[] = [];
  for (let fromIndex = 0; fromIndex < anchors.length; fromIndex += 1) {
    for (let toIndex = fromIndex + 1; toIndex < anchors.length; toIndex += 1) {
      const from = anchors[fromIndex];
      const to = anchors[toIndex];
      const distance = worldDistance(from, to);
      if (distance <= MAX_ROAD_CONNECTION_HEXES * TERRAIN_HEX_STEP_WORLD_DISTANCE) {
        candidates.push({ distance, from, to });
      }
    }
  }
  return candidates.toSorted(
    (left, right) =>
      left.distance - right.distance ||
      left.from.structureId.localeCompare(right.from.structureId) ||
      left.to.structureId.localeCompare(right.to.structureId),
  );
}

function findRoadPath(
  from: TerrainRoadAnchor,
  to: TerrainRoadAnchor,
  cellsByKey: ReadonlyMap<number, TerrainCellInput>,
  anchorKeys: ReadonlySet<number>,
): Array<{ col: number; row: number }> | null {
  const startKey = hexCellKey(from.col, from.row);
  const targetKey = hexCellKey(to.col, to.row);
  const open: RoadSearchNode[] = [{ col: from.col, cost: 0, estimate: worldDistance(from, to), row: from.row }];
  const costByKey = new Map([[startKey, 0]]);
  const previousByKey = new Map<number, number>();

  while (open.length > 0) {
    const currentIndex = findBestSearchNodeIndex(open);
    const [current] = open.splice(currentIndex, 1);
    const currentKey = hexCellKey(current.col, current.row);
    if (current.cost !== costByKey.get(currentKey)) continue;
    if (currentKey === targetKey) return reconstructRoadPath(targetKey, previousByKey);
    if (current.cost >= MAX_ROAD_ROUTE_STEPS) continue;

    const neighbors = getNeighborHexes(current.col, current.row).toSorted(
      (left, right) => left.row - right.row || left.col - right.col,
    );
    for (const neighbor of neighbors) {
      const neighborKey = hexCellKey(neighbor.col, neighbor.row);
      const cell = cellsByKey.get(neighborKey);
      if (!isRoadCellPassable(cell, neighborKey, anchorKeys)) continue;
      const nextCost = current.cost + 1;
      if (nextCost >= (costByKey.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
      costByKey.set(neighborKey, nextCost);
      previousByKey.set(neighborKey, currentKey);
      open.push({
        col: neighbor.col,
        cost: nextCost,
        estimate: nextCost + worldDistance(neighbor, to) / TERRAIN_HEX_STEP_WORLD_DISTANCE,
        row: neighbor.row,
      });
    }
  }

  return null;
}

function findBestSearchNodeIndex(open: readonly RoadSearchNode[]): number {
  let bestIndex = 0;
  for (let index = 1; index < open.length; index += 1) {
    if (compareSearchNodes(open[index], open[bestIndex]) < 0) bestIndex = index;
  }
  return bestIndex;
}

function reconstructRoadPath(targetKey: number, previousByKey: ReadonlyMap<number, number>) {
  const path = [hexCellFromKey(targetKey)];
  let key = targetKey;
  while (previousByKey.has(key)) {
    key = previousByKey.get(key)!;
    path.push(hexCellFromKey(key));
  }
  return path.reverse();
}

function pathToRoadSegments(path: readonly { col: number; row: number }[], routeId: string): TerrainRoadSegment[] {
  return path.slice(1).map((point, index) => {
    const start = terrainHexToWorld(path[index].col, path[index].row);
    const end = terrainHexToWorld(point.col, point.row);
    return { end: [end.x, end.z], routeId, start: [start.x, start.z] };
  });
}

function isEligibleRoadAnchor(anchor: TerrainRoadAnchor, cellsByKey: ReadonlyMap<number, TerrainCellInput>): boolean {
  if (anchor.owner === "" || anchor.owner === "0" || anchor.owner === "0x0") return false;
  const cell = cellsByKey.get(hexCellKey(anchor.col, anchor.row));
  return Boolean(cell?.explored && cell.biome && !isTerrainWaterBiome(cell.biome));
}

function isRoadCellPassable(cell: TerrainCellInput | undefined, key: number, anchorKeys: ReadonlySet<number>): boolean {
  return Boolean(
    cell?.explored && cell.biome && !isTerrainWaterBiome(cell.biome) && (!cell.occupied || anchorKeys.has(key)),
  );
}

function canonicalRoadAnchors(anchors: readonly TerrainRoadAnchor[]): TerrainRoadAnchor[] {
  return anchors.toSorted(
    (left, right) =>
      left.owner.localeCompare(right.owner) ||
      left.structureId.localeCompare(right.structureId) ||
      left.row - right.row ||
      left.col - right.col,
  );
}

function roadRouteId(from: TerrainRoadAnchor, to: TerrainRoadAnchor): string {
  return [from.structureId, to.structureId].toSorted().join(":");
}

function worldDistance(from: { col: number; row: number }, to: { col: number; row: number }): number {
  const start = terrainHexToWorld(from.col, from.row);
  const end = terrainHexToWorld(to.col, to.row);
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function compareSearchNodes(left: RoadSearchNode, right: RoadSearchNode): number {
  return left.estimate - right.estimate || left.cost - right.cost || left.row - right.row || left.col - right.col;
}

function compareRoadSegments(left: TerrainRoadSegment, right: TerrainRoadSegment): number {
  return (
    left.routeId.localeCompare(right.routeId) ||
    left.start[1] - right.start[1] ||
    left.start[0] - right.start[0] ||
    left.end[1] - right.end[1] ||
    left.end[0] - right.end[0]
  );
}

function findRoot(parentById: Map<string, string>, id: string): string {
  const parent = parentById.get(id) ?? id;
  if (parent === id) return id;
  const root = findRoot(parentById, parent);
  parentById.set(id, root);
  return root;
}

function unionRoots(parentById: Map<string, string>, left: string, right: string): void {
  const leftRoot = findRoot(parentById, left);
  const rightRoot = findRoot(parentById, right);
  const [parent, child] = [leftRoot, rightRoot].toSorted();
  parentById.set(child, parent);
}
