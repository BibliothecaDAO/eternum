import { BUILDINGS_CENTER, BuildingType, getNeighborHexes, ResourcesIds } from "@bibliothecadao/types";
import { TileManager } from "@bibliothecadao/eternum";
import { toast } from "@/ui/features/event-feed/notify";
import { getScopedGameId } from "@/sync/game-scope";
import { resolveConstructionBuildability, type ConstructionBuildabilityInput } from "./construction-buildability";

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

type BuildSpot = {
  col: number;
  row: number;
};

type RealmBuildActionOptions = {
  entityId: number;
  realmPosition?: RealmPosition | null;
  realm?: ConstructionBuildabilityInput["realm"];
  mode?: ConstructionBuildabilityInput["mode"];
  target: RealmBuildTarget;
  useSimpleCost: boolean;
  world: BuildWorldContext;
  onBuildSuccess?: (selection: BuildSelection) => void;
};

type RealmAvailableTileOptions = {
  entityId: number;
  realmPosition?: RealmPosition | null;
  world: Omit<BuildWorldContext, "account">;
};

const buildablePositionsCache = new Map<number, BuildSpot[]>();
const realmBuildLocks = new Map<string, Promise<void>>();
const OCCUPIED_SPACE_REASON = "space is occupied";

const runWithRealmBuildLock = async <Result>(entityId: number, task: () => Promise<Result>): Promise<Result> => {
  const lockKey = `${getScopedGameId()}:${entityId}`;
  const previous = realmBuildLocks.get(lockKey) ?? Promise.resolve();
  let release!: () => void;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => turn);
  realmBuildLocks.set(lockKey, tail);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (realmBuildLocks.get(lockKey) === tail) realmBuildLocks.delete(lockKey);
  }
};

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

const isCenterBuildSpot = (spot: BuildSpot) => spot.col === BUILDINGS_CENTER[0] && spot.row === BUILDINGS_CENTER[1];

const toBuildSpotKey = ({ col, row }: BuildSpot) => `${col},${row}`;

const isAvailableBuildSpot = (tileManager: TileManager, spot: BuildSpot) => {
  if (isCenterBuildSpot(spot)) return false;
  return !tileManager.isHexOccupied(spot);
};

const resolveAvailableBuildSpots = (tileManager: TileManager, candidates: BuildSpot[]) =>
  candidates.filter((candidate) => isAvailableBuildSpot(tileManager, candidate));

const generateBuildablePositions = (radius: number) => {
  const cached = buildablePositionsCache.get(radius);
  if (cached) return cached;

  const positions: BuildSpot[] = [];
  const seen = new Set<string>();

  const addPosition = (col: number, row: number) => {
    const key = toBuildSpotKey({ col, row });
    if (seen.has(key)) return;
    positions.push({ col, row });
    seen.add(key);
  };

  const start = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };
  addPosition(start.col, start.row);

  let currentLayer = [start];
  for (let i = 0; i < radius; i += 1) {
    const nextLayer: BuildSpot[] = [];
    currentLayer.forEach((position) => {
      getNeighborHexes(position.col, position.row).forEach((neighbor) => {
        const key = toBuildSpotKey(neighbor);
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

const hasBuildableCandidate = ({ entityId, realmPosition, world }: RealmAvailableTileOptions) => {
  if (!realmPosition) return true;

  const { tileManager, buildRadiusResolver } = createTileManager(entityId, realmPosition, world);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  return candidates.some((candidate) => isAvailableBuildSpot(tileManager, candidate));
};

export const resolveRealmHasAvailableBuildingTile = (options: RealmAvailableTileOptions) =>
  hasBuildableCandidate(options);

const submitRealmBuilding = async ({
  entityId,
  realmPosition,
  realm,
  mode,
  target,
  useSimpleCost,
  world,
  onBuildSuccess,
}: RealmBuildActionOptions & { realmPosition: RealmPosition }) => {
  const baseBuildability = resolveConstructionBuildability({
    entityId,
    buildingType: target.type,
    useSimpleCost,
    components: world.components,
    realm,
    mode,
  });

  if (!baseBuildability.canSubmit) {
    toast.error(baseBuildability.reason ?? "Building cannot be submitted.");
    return false;
  }

  const { outerCol, outerRow, tileManager, buildRadiusResolver } = createTileManager(entityId, realmPosition, world);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  const availableSpots = resolveAvailableBuildSpots(tileManager, candidates);

  if (availableSpots.length === 0) {
    toast.error("No empty building tiles available.");
    return false;
  }

  let occupiedTileFailures = 0;

  try {
    for (const availableSpot of availableSpots) {
      const spotBuildability = resolveConstructionBuildability({
        entityId,
        buildingType: target.type,
        useSimpleCost,
        components: world.components,
        realm,
        mode,
        targetSpot: availableSpot,
        tileManager,
      });

      if (!spotBuildability.canSubmit) {
        continue;
      }

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
  }
};

export const buildRealmBuilding = async (options: RealmBuildActionOptions) => {
  const realmPosition = options.realmPosition;
  if (!realmPosition) {
    toast.error("Select a realm before building.");
    return false;
  }

  return runWithRealmBuildLock(options.entityId, () => submitRealmBuilding({ ...options, realmPosition }));
};
