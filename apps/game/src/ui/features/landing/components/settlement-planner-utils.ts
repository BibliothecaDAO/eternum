import type {
  ExploredTileBounds,
  SettlementPlannerSnapshot as ApiSettlementPlannerSnapshot,
  SettlementPlannerTile as ApiSettlementPlannerTile,
  SettlementPlannerVillage as ApiSettlementPlannerVillage,
} from "@bibliothecadao/torii";
import { Coord, Direction } from "@bibliothecadao/types";

const CONTRACT_MAP_CENTER = 2147483646;
const PLANNER_HEX_RADIUS = 8;
const PLANNER_HEX_SQRT3 = Math.sqrt(3);
const VILLAGE_REALM_DISTANCE = 2;
const PLANNER_BOUNDS_OVERSCAN = 18;
const VILLAGE_SLOT_HIT_RADIUS = 12;
const REALM_MARKER_HIT_RADIUS = 14;
const REALM_SLOT_HIT_RADIUS = 12;
const TERRAIN_HIT_RADIUS = 11;

const START_DIRECTIONS: ReadonlyArray<readonly [Direction, Direction]> = [
  [Direction.EAST, Direction.SOUTH_WEST],
  [Direction.SOUTH_EAST, Direction.WEST],
  [Direction.SOUTH_WEST, Direction.NORTH_WEST],
  [Direction.WEST, Direction.NORTH_EAST],
  [Direction.NORTH_WEST, Direction.EAST],
  [Direction.NORTH_EAST, Direction.SOUTH_EAST],
];

const ALL_VILLAGE_DIRECTIONS: readonly Direction[] = [
  Direction.EAST,
  Direction.NORTH_EAST,
  Direction.NORTH_WEST,
  Direction.WEST,
  Direction.SOUTH_WEST,
  Direction.SOUTH_EAST,
];

type DirectionString = "East" | "NorthEast" | "NorthWest" | "West" | "SouthWest" | "SouthEast";

type PixelPoint = {
  pixelX: number;
  pixelY: number;
};

export type SettlementPlannerSnapshot = ApiSettlementPlannerSnapshot;
type SettlementPlannerVillage = ApiSettlementPlannerVillage;
type SettlementPlannerTile = ApiSettlementPlannerTile;

export interface SettlementPlannerOptimisticRealm {
  id: string;
  coordX: number;
  coordY: number;
}

export interface SettlementPlannerRealmSlot extends PixelPoint {
  id: string;
  side: number;
  layer: number;
  point: number;
  coordX: number;
  coordY: number;
  occupied: boolean;
}

export interface SettlementPlannerRealmMarker extends PixelPoint {
  id: string;
  entityId: number | null;
  realmId: number | null;
  ownerAddress: string;
  ownerName: string | null;
  coordX: number;
  coordY: number;
  villagesCount: number;
  freeDirectionCount: number;
  optimistic: boolean;
}

export interface SettlementPlannerVillageSlot extends PixelPoint {
  id: string;
  realmEntityId: number | null;
  realmId: number | null;
  ownerAddress: string;
  ownerName: string | null;
  coordX: number;
  coordY: number;
  direction: Direction;
  villageEntityId: number | null;
  occupied: boolean;
  pending: boolean;
}

export interface SettlementPlannerTerrainTile extends PixelPoint {
  id: string;
  coordX: number;
  coordY: number;
  biome: number;
}

export type SettlementPlannerTarget =
  | {
      type: "realm_slot";
      slot: SettlementPlannerRealmSlot;
    }
  | {
      type: "village_slot";
      slot: SettlementPlannerVillageSlot;
    }
  | {
      type: "realm";
      realm: SettlementPlannerRealmMarker;
    }
  | {
      type: "occupied_target";
      occupiedType: "realm_slot" | "village_slot";
      slot: SettlementPlannerRealmSlot | SettlementPlannerVillageSlot;
    }
  | {
      type: "terrain";
      tile: SettlementPlannerTerrainTile;
    };

export interface SettlementPlannerData {
  realmSlots: SettlementPlannerRealmSlot[];
  realms: SettlementPlannerRealmMarker[];
  villageSlots: SettlementPlannerVillageSlot[];
  terrainTiles: SettlementPlannerTerrainTile[];
}

type BuildSettlementPlannerDataInput = {
  snapshot: SettlementPlannerSnapshot;
  terrainTiles: SettlementPlannerTile[];
  layerMax: number | null;
  layersSkipped: number | null;
  baseDistance: number | null;
  mapCenterOffset: number;
  optimisticRealms?: SettlementPlannerOptimisticRealm[];
};

type BuildSettlementPlannerFetchBoundsInput = Omit<BuildSettlementPlannerDataInput, "terrainTiles">;

const toPixelPoint = (coordX: number, coordY: number, mapCenterOffset: number): PixelPoint => {
  const center = CONTRACT_MAP_CENTER - mapCenterOffset;
  const col = coordX - center;
  const row = coordY - center;
  const hexHeight = PLANNER_HEX_RADIUS * 2;
  const hexWidth = PLANNER_HEX_SQRT3 * PLANNER_HEX_RADIUS;
  const verticalDistance = hexHeight * 0.75;
  const horizontalDistance = hexWidth;
  const rowOffset = ((row % 2) * Math.sign(row) * horizontalDistance) / 2;

  return {
    pixelX: col * horizontalDistance - rowOffset,
    pixelY: row * verticalDistance,
  };
};

const toRealmSlotId = (side: number, layer: number, point: number) => `${side}:${layer}:${point}`;

const toVillageSlotId = (realmId: number | null, coordX: number, coordY: number, direction: Direction) =>
  `${realmId ?? "pending"}:${coordX}:${coordY}:${direction}`;

const parseDirectionKey = (key: string): Direction | null => {
  const normalized = key.replace(/[\s_-]/g, "").toLowerCase();
  const directionMap: Record<string, Direction> = {
    east: Direction.EAST,
    northeast: Direction.NORTH_EAST,
    northwest: Direction.NORTH_WEST,
    west: Direction.WEST,
    southwest: Direction.SOUTH_WEST,
    southeast: Direction.SOUTH_EAST,
  };
  return directionMap[normalized] ?? null;
};

const toDirectionSet = (directionsLeft: Array<Partial<Record<DirectionString, []>>>): Set<Direction> => {
  const directions = new Set<Direction>();

  for (const entry of directionsLeft) {
    for (const key of Object.keys(entry)) {
      const direction = parseDirectionKey(key);
      if (direction != null) {
        directions.add(direction);
      }
    }
  }

  return directions;
};

const buildVillageTargetCoord = (coordX: number, coordY: number, direction: Direction): Coord =>
  new Coord(coordX, coordY).travel(direction, VILLAGE_REALM_DISTANCE);

const buildVillageCoordLookup = (villages: SettlementPlannerVillage[]) => {
  const byCoord = new Map<string, SettlementPlannerVillage>();

  for (const village of villages) {
    byCoord.set(`${village.coordX}:${village.coordY}`, village);
  }

  return byCoord;
};

const buildSettlementPlannerRealms = ({
  snapshot,
  mapCenterOffset,
  optimisticRealms = [],
}: {
  snapshot: SettlementPlannerSnapshot;
  mapCenterOffset: number;
  optimisticRealms?: SettlementPlannerOptimisticRealm[];
}): SettlementPlannerRealmMarker[] => {
  const occupiedCoordKeys = new Set(snapshot.realms.map((realm) => `${realm.coordX}:${realm.coordY}`));
  const realms: SettlementPlannerRealmMarker[] = snapshot.realms.map((realm) => {
    const pixel = toPixelPoint(realm.coordX, realm.coordY, mapCenterOffset);
    const freeDirections = toDirectionSet(realm.directionsLeft);

    return {
      id: `realm:${realm.entityId}`,
      entityId: realm.entityId,
      realmId: realm.realmId,
      ownerAddress: realm.ownerAddress,
      ownerName: realm.ownerName,
      coordX: realm.coordX,
      coordY: realm.coordY,
      villagesCount: realm.villagesCount,
      freeDirectionCount: freeDirections.size,
      optimistic: false,
      ...pixel,
    };
  });

  for (const optimisticRealm of optimisticRealms) {
    const coordKey = `${optimisticRealm.coordX}:${optimisticRealm.coordY}`;
    if (occupiedCoordKeys.has(coordKey)) continue;

    realms.push({
      id: `realm:optimistic:${optimisticRealm.id}`,
      entityId: null,
      realmId: null,
      ownerAddress: "",
      ownerName: "Syncing settlement",
      coordX: optimisticRealm.coordX,
      coordY: optimisticRealm.coordY,
      villagesCount: 0,
      freeDirectionCount: ALL_VILLAGE_DIRECTIONS.length,
      optimistic: true,
      ...toPixelPoint(optimisticRealm.coordX, optimisticRealm.coordY, mapCenterOffset),
    });
  }

  return realms;
};

const buildSettlementPlannerRealmSlots = ({
  layerMax,
  layersSkipped,
  baseDistance,
  mapCenterOffset,
  occupiedCoordLookup,
}: {
  layerMax: number | null;
  layersSkipped: number | null;
  baseDistance: number | null;
  mapCenterOffset: number;
  occupiedCoordLookup: Set<string>;
}): SettlementPlannerRealmSlot[] => {
  if (layerMax == null || layerMax <= 0 || baseDistance == null || baseDistance <= 0) {
    return [];
  }

  const slots: SettlementPlannerRealmSlot[] = [];
  const minLayer = Math.max(1, (layersSkipped ?? 0) + 1);
  const center = CONTRACT_MAP_CENTER - mapCenterOffset;
  const mapCenter = new Coord(center, center);

  for (let layer = minLayer; layer <= layerMax; layer += 1) {
    for (let side = 0; side < 6; side += 1) {
      for (let point = 0; point < layer; point += 1) {
        const [startDirection, triangleDirection] = START_DIRECTIONS[side] ?? START_DIRECTIONS[0];
        const sideStart = mapCenter.travel(startDirection, baseDistance);
        const layerStart = sideStart.travel(startDirection, baseDistance * (layer - 1));
        const destination = layerStart.travel(triangleDirection, baseDistance * point);
        const coordKey = `${destination.x}:${destination.y}`;

        slots.push({
          id: toRealmSlotId(side, layer, point),
          side,
          layer,
          point,
          coordX: destination.x,
          coordY: destination.y,
          occupied: occupiedCoordLookup.has(coordKey),
          ...toPixelPoint(destination.x, destination.y, mapCenterOffset),
        });
      }
    }
  }

  return slots;
};

export const buildSettlementPlannerVillageSlots = ({
  realms,
  snapshot,
  mapCenterOffset,
}: {
  realms: SettlementPlannerRealmMarker[];
  snapshot: SettlementPlannerSnapshot;
  mapCenterOffset: number;
}): SettlementPlannerVillageSlot[] => {
  const villagesByCoord = buildVillageCoordLookup(snapshot.villages);
  const sourceRealmsByCoord = new Map(snapshot.realms.map((realm) => [`${realm.coordX}:${realm.coordY}`, realm]));

  return realms.flatMap((realm) => {
    const sourceRealm = sourceRealmsByCoord.get(`${realm.coordX}:${realm.coordY}`) ?? null;
    const freeDirections = sourceRealm ? toDirectionSet(sourceRealm.directionsLeft) : new Set<Direction>();

    return ALL_VILLAGE_DIRECTIONS.map((direction) => {
      const villageCoord = buildVillageTargetCoord(realm.coordX, realm.coordY, direction);
      const village = villagesByCoord.get(`${villageCoord.x}:${villageCoord.y}`) ?? null;
      const coordDerivedOccupied = village != null;
      const pending = realm.optimistic;
      const fallbackFree = sourceRealm ? sourceRealm.villagesCount < ALL_VILLAGE_DIRECTIONS.length : true;
      const directionIsFree =
        pending || coordDerivedOccupied
          ? false
          : freeDirections.size > 0
            ? freeDirections.has(direction)
            : fallbackFree;

      return {
        id: toVillageSlotId(realm.entityId, villageCoord.x, villageCoord.y, direction),
        realmEntityId: realm.entityId,
        realmId: realm.realmId,
        ownerAddress: realm.ownerAddress,
        ownerName: realm.ownerName,
        coordX: villageCoord.x,
        coordY: villageCoord.y,
        direction,
        villageEntityId: village?.entityId ?? null,
        occupied: coordDerivedOccupied || !directionIsFree,
        pending,
        ...toPixelPoint(villageCoord.x, villageCoord.y, mapCenterOffset),
      };
    });
  });
};

const buildSettlementPlannerTerrainTiles = ({
  terrainTiles,
  mapCenterOffset,
}: {
  terrainTiles: SettlementPlannerTile[];
  mapCenterOffset: number;
}): SettlementPlannerTerrainTile[] =>
  terrainTiles.map((tile) => ({
    id: `terrain:${tile.coordX}:${tile.coordY}`,
    coordX: tile.coordX,
    coordY: tile.coordY,
    biome: tile.biome,
    ...toPixelPoint(tile.coordX, tile.coordY, mapCenterOffset),
  }));

export const buildSettlementPlannerData = ({
  snapshot,
  terrainTiles,
  layerMax,
  layersSkipped,
  baseDistance,
  mapCenterOffset,
  optimisticRealms = [],
}: BuildSettlementPlannerDataInput): SettlementPlannerData => {
  const occupiedCoordLookup = new Set(snapshot.realms.map((realm) => `${realm.coordX}:${realm.coordY}`));

  for (const optimisticRealm of optimisticRealms) {
    occupiedCoordLookup.add(`${optimisticRealm.coordX}:${optimisticRealm.coordY}`);
  }

  const realms = buildSettlementPlannerRealms({
    snapshot,
    mapCenterOffset,
    optimisticRealms,
  });

  return {
    realmSlots: buildSettlementPlannerRealmSlots({
      layerMax,
      layersSkipped,
      baseDistance,
      mapCenterOffset,
      occupiedCoordLookup,
    }),
    realms,
    villageSlots: buildSettlementPlannerVillageSlots({
      realms,
      snapshot,
      mapCenterOffset,
    }),
    terrainTiles: buildSettlementPlannerTerrainTiles({
      terrainTiles,
      mapCenterOffset,
    }),
  };
};

export const buildSettlementPlannerFetchBounds = ({
  snapshot,
  layerMax,
  layersSkipped,
  baseDistance,
  mapCenterOffset,
  optimisticRealms = [],
}: BuildSettlementPlannerFetchBoundsInput): ExploredTileBounds | null => {
  const occupiedCoordLookup = new Set(snapshot.realms.map((realm) => `${realm.coordX}:${realm.coordY}`));

  for (const optimisticRealm of optimisticRealms) {
    occupiedCoordLookup.add(`${optimisticRealm.coordX}:${optimisticRealm.coordY}`);
  }

  const realmSlots = buildSettlementPlannerRealmSlots({
    layerMax,
    layersSkipped,
    baseDistance,
    mapCenterOffset,
    occupiedCoordLookup,
  });

  const villages = snapshot.villages.map((village) => ({ coordX: village.coordX, coordY: village.coordY }));
  const realmCoords = snapshot.realms.map((realm) => ({ coordX: realm.coordX, coordY: realm.coordY }));
  const optimisticCoords = optimisticRealms.map((realm) => ({ coordX: realm.coordX, coordY: realm.coordY }));
  const slotCoords = realmSlots.map((slot) => ({ coordX: slot.coordX, coordY: slot.coordY }));
  const allCoords = [...realmCoords, ...villages, ...optimisticCoords, ...slotCoords];

  if (allCoords.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const coord of allCoords) {
    minX = Math.min(minX, coord.coordX);
    maxX = Math.max(maxX, coord.coordX);
    minY = Math.min(minY, coord.coordY);
    maxY = Math.max(maxY, coord.coordY);
  }

  return {
    minX: Math.floor(minX - PLANNER_BOUNDS_OVERSCAN),
    maxX: Math.ceil(maxX + PLANNER_BOUNDS_OVERSCAN),
    minY: Math.floor(minY - PLANNER_BOUNDS_OVERSCAN),
    maxY: Math.ceil(maxY + PLANNER_BOUNDS_OVERSCAN),
  };
};

const getDistanceSq = (left: PixelPoint, x: number, y: number) => {
  const dx = left.pixelX - x;
  const dy = left.pixelY - y;
  return dx * dx + dy * dy;
};

const findNearestWithinRadius = <T extends PixelPoint>(
  entries: T[],
  x: number,
  y: number,
  radius: number,
  predicate?: (entry: T) => boolean,
): T | null => {
  const maxDistanceSq = radius * radius;
  let nearest: T | null = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    if (predicate && !predicate(entry)) continue;
    const distanceSq = getDistanceSq(entry, x, y);
    if (distanceSq <= maxDistanceSq && distanceSq < nearestDistanceSq) {
      nearest = entry;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
};

export const resolveSettlementPlannerTarget = ({
  x,
  y,
  realmSlots,
  realms,
  villageSlots,
  terrainTiles,
}: SettlementPlannerData & {
  x: number;
  y: number;
}): SettlementPlannerTarget | null => {
  const villageSlot = findNearestWithinRadius(villageSlots, x, y, VILLAGE_SLOT_HIT_RADIUS);
  if (villageSlot) {
    if (!villageSlot.occupied && !villageSlot.pending) {
      return { type: "village_slot", slot: villageSlot };
    }
    return { type: "occupied_target", occupiedType: "village_slot", slot: villageSlot };
  }

  const realm = findNearestWithinRadius(realms, x, y, REALM_MARKER_HIT_RADIUS);
  if (realm) {
    return { type: "realm", realm };
  }

  const realmSlot = findNearestWithinRadius(realmSlots, x, y, REALM_SLOT_HIT_RADIUS);
  if (realmSlot) {
    if (!realmSlot.occupied) {
      return { type: "realm_slot", slot: realmSlot };
    }
    return { type: "occupied_target", occupiedType: "realm_slot", slot: realmSlot };
  }

  const terrainTile = findNearestWithinRadius(terrainTiles, x, y, TERRAIN_HIT_RADIUS);
  if (terrainTile) {
    return { type: "terrain", tile: terrainTile };
  }

  return null;
};

export const getSettlementPlannerTargetKey = (target: SettlementPlannerTarget | null): string | null => {
  if (!target) return null;

  switch (target.type) {
    case "realm_slot":
      return `realm-slot:${target.slot.id}`;
    case "village_slot":
      return `village-slot:${target.slot.id}`;
    case "realm":
      return `realm:${target.realm.id}`;
    case "occupied_target":
      return `occupied:${target.occupiedType}:${target.slot.id}`;
    case "terrain":
      return `terrain:${target.tile.id}`;
  }
};

export const isSettlementPlannerTargetStillValid = (
  target: SettlementPlannerTarget,
  plannerData: SettlementPlannerData,
): boolean => {
  switch (target.type) {
    case "realm_slot":
      return plannerData.realmSlots.some((slot) => slot.id === target.slot.id && !slot.occupied);
    case "village_slot":
      return plannerData.villageSlots.some(
        (slot) => slot.id === target.slot.id && !slot.occupied && !slot.pending && slot.realmEntityId != null,
      );
    case "realm":
      return plannerData.realms.some((realm) => realm.id === target.realm.id);
    case "occupied_target":
      return target.occupiedType === "realm_slot"
        ? plannerData.realmSlots.some((slot) => slot.id === target.slot.id && slot.occupied)
        : plannerData.villageSlots.some((slot) => slot.id === target.slot.id && (slot.occupied || slot.pending));
    case "terrain":
      return plannerData.terrainTiles.some((tile) => tile.id === target.tile.id);
  }
};

export const getSettlementPlannerBiomeFill = (biome: number) => {
  const palette = [
    "rgba(52, 79, 92, 0.45)",
    "rgba(82, 101, 67, 0.45)",
    "rgba(120, 91, 61, 0.45)",
    "rgba(132, 117, 73, 0.45)",
    "rgba(72, 94, 80, 0.45)",
    "rgba(103, 83, 59, 0.45)",
  ];

  return palette[Math.abs(biome) % palette.length];
};

export const getPlannerHexPoints = (centerX: number, centerY: number): string => {
  const points: string[] = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    const x = centerX + PLANNER_HEX_RADIUS * Math.cos(angle);
    const y = centerY + PLANNER_HEX_RADIUS * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return points.join(" ");
};

export const settlementPlannerHexRadius = PLANNER_HEX_RADIUS;
