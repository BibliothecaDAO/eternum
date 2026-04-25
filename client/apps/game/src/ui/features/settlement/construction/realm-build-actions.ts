import { BUILDINGS_CENTER, BuildingType, getNeighborHexes, ResourcesIds } from "@bibliothecadao/types";
import { TileManager } from "@bibliothecadao/eternum";
import { toast } from "sonner";

type RealmPosition = {
  x: bigint | number;
  y: bigint | number;
};

type BuildWorldContext = {
  account: any;
  components: any;
  systemCalls: any;
};

type RealmBuildTarget = {
  type: BuildingType;
  resource?: ResourcesIds;
};

type BuildSelection = {
  outerCol: number;
  outerRow: number;
  innerCol: number;
  innerRow: number;
};

type RealmBuildActionOptions = {
  entityId: number;
  realmPosition?: RealmPosition | null;
  target: RealmBuildTarget;
  useSimpleCost: boolean;
  world: BuildWorldContext;
  occupiedSpots?: ReadonlySet<string>;
  vacatedSpots?: ReadonlySet<string>;
  onReserveSpot?: (spotKey: string) => void;
  onReleaseSpot?: (spotKey: string) => void;
  onBuildSuccess?: (selection: BuildSelection) => void;
};

type RealmAvailableTileOptions = {
  entityId: number;
  realmPosition?: RealmPosition | null;
  world: Omit<BuildWorldContext, "account">;
  occupiedSpots?: ReadonlySet<string>;
  vacatedSpots?: ReadonlySet<string>;
};

const buildablePositionsCache = new Map<number, Array<{ col: number; row: number }>>();
const OCCUPIED_SPACE_REASON = "space is occupied";

const extractErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isOccupiedSpaceError = (error: unknown): boolean =>
  extractErrorMessage(error).toLowerCase().includes(OCCUPIED_SPACE_REASON);

const generateBuildablePositions = (radius: number) => {
  const cached = buildablePositionsCache.get(radius);
  if (cached) return cached;

  const positions: Array<{ col: number; row: number }> = [];
  const seen = new Set<string>();

  const addPosition = (col: number, row: number) => {
    const key = `${col},${row}`;
    if (seen.has(key)) return;
    positions.push({ col, row });
    seen.add(key);
  };

  const start = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };
  addPosition(start.col, start.row);

  let currentLayer = [start];
  for (let i = 0; i < radius; i += 1) {
    const nextLayer: Array<{ col: number; row: number }> = [];
    currentLayer.forEach((position) => {
      getNeighborHexes(position.col, position.row).forEach((neighbor) => {
        const key = `${neighbor.col},${neighbor.row}`;
        if (seen.has(key)) return;

        addPosition(neighbor.col, neighbor.row);
        nextLayer.push(neighbor);
      });
    });
    currentLayer = nextLayer;
  }

  buildablePositionsCache.set(radius, positions);
  return positions;
};

const createTileManager = (
  entityId: number,
  realmPosition: RealmPosition,
  world: Omit<BuildWorldContext, "account">,
) => {
  const outerCol = Number(realmPosition.x);
  const outerRow = Number(realmPosition.y);
  const tileManager = new TileManager(world.components, world.systemCalls, {
    col: outerCol,
    row: outerRow,
  });

  return {
    outerCol,
    outerRow,
    tileManager,
    buildRadiusResolver: () => Math.max(1, Number(tileManager.getRealmLevel(entityId)) + 1),
  };
};

const hasBuildableCandidate = ({
  entityId,
  realmPosition,
  world,
  occupiedSpots = new Set<string>(),
  vacatedSpots = new Set<string>(),
}: RealmAvailableTileOptions) => {
  if (!realmPosition) return true;

  const { tileManager, buildRadiusResolver } = createTileManager(entityId, realmPosition, world);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  const centerKey = `${BUILDINGS_CENTER[0]},${BUILDINGS_CENTER[1]}`;

  return candidates.some((position) => {
    const key = `${position.col},${position.row}`;
    if (key === centerKey) return false;
    if (occupiedSpots.has(key)) return false;
    if (vacatedSpots.has(key) && tileManager.isHexOccupied({ col: position.col, row: position.row })) return false;
    return !tileManager.isHexOccupied({ col: position.col, row: position.row });
  });
};

export const resolveRealmHasAvailableBuildingTile = (options: RealmAvailableTileOptions) =>
  hasBuildableCandidate(options);

export const buildRealmBuilding = async ({
  entityId,
  realmPosition,
  target,
  useSimpleCost,
  world,
  occupiedSpots = new Set<string>(),
  vacatedSpots = new Set<string>(),
  onReserveSpot,
  onReleaseSpot,
  onBuildSuccess,
}: RealmBuildActionOptions) => {
  if (!realmPosition) {
    toast.error("Select a realm before building.");
    return false;
  }

  const { outerCol, outerRow, tileManager, buildRadiusResolver } = createTileManager(entityId, realmPosition, world);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  const centerKey = `${BUILDINGS_CENTER[0]},${BUILDINGS_CENTER[1]}`;

  const availableSpots = candidates.filter((position) => {
    const key = `${position.col},${position.row}`;
    if (key === centerKey) return false;
    if (occupiedSpots.has(key)) return false;
    if (vacatedSpots.has(key) && tileManager.isHexOccupied({ col: position.col, row: position.row })) return false;
    return !tileManager.isHexOccupied({ col: position.col, row: position.row });
  });

  if (availableSpots.length === 0) {
    toast.error("No empty building tiles available.");
    return false;
  }

  let reservedSpotKey: string | null = null;
  let occupiedTileFailures = 0;

  try {
    for (const availableSpot of availableSpots) {
      const spotKey = `${availableSpot.col},${availableSpot.row}`;
      reservedSpotKey = spotKey;
      onReserveSpot?.(spotKey);

      try {
        await tileManager.placeBuilding(
          world.account,
          entityId,
          target.type,
          { col: availableSpot.col, row: availableSpot.row },
          useSimpleCost,
        );

        onBuildSuccess?.({
          outerCol,
          outerRow,
          innerCol: availableSpot.col,
          innerRow: availableSpot.row,
        });
        return true;
      } catch (error) {
        onReleaseSpot?.(spotKey);
        reservedSpotKey = null;

        if (isOccupiedSpaceError(error)) {
          occupiedTileFailures += 1;
          continue;
        }

        throw error;
      }
    }

    if (occupiedTileFailures > 0) {
      toast.error("All auto-selected tiles became occupied. Please try again.");
      return false;
    }

    toast.error("No empty building tiles available.");
    return false;
  } catch (error) {
    console.error("Failed to auto-build", error);
    if (isOccupiedSpaceError(error)) {
      toast.error("This tile is occupied. Please try again.");
    } else {
      toast.error("Building failed. Please try again.");
    }
    return false;
  } finally {
    if (reservedSpotKey) {
      onReleaseSpot?.(reservedSpotKey);
    }
  }
};
