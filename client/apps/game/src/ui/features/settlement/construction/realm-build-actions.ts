import { BUILDINGS_CENTER, BuildingType, getNeighborHexes, ResourcesIds } from "@bibliothecadao/types";
import {
  TileManager,
  divideByPrecision,
  getBalance,
  getBuildingCosts,
  getBlockTimestamp,
} from "@bibliothecadao/eternum";
import { toast } from "sonner";
import {
  getBuildReservationState,
  releaseOccupiedBuildSpot,
  reserveOccupiedBuildSpot,
} from "./build-reservation-store";

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

const buildablePositionsCache = new Map<number, BuildSpot[]>();
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

const resolveReservedSpots = (
  entityId: number,
  occupiedSpots?: ReadonlySet<string>,
  vacatedSpots?: ReadonlySet<string>,
) => {
  const reservationState = getBuildReservationState(entityId);

  return {
    occupiedSpots: occupiedSpots ?? reservationState.occupied,
    vacatedSpots: vacatedSpots ?? reservationState.vacated,
  };
};

const reserveAutoBuildSpot = (entityId: number, spotKey: string, onReserveSpot?: (spotKey: string) => void) => {
  if (onReserveSpot) {
    onReserveSpot(spotKey);
    return;
  }

  reserveOccupiedBuildSpot(entityId, spotKey);
};

const releaseAutoBuildSpot = (entityId: number, spotKey: string, onReleaseSpot?: (spotKey: string) => void) => {
  if (onReleaseSpot) {
    onReleaseSpot(spotKey);
    return;
  }

  releaseOccupiedBuildSpot(entityId, spotKey);
};

const isCenterBuildSpot = (spot: BuildSpot) => spot.col === BUILDINGS_CENTER[0] && spot.row === BUILDINGS_CENTER[1];

const toBuildSpotKey = ({ col, row }: BuildSpot) => `${col},${row}`;

const isReservedVacatedSpotStillOccupied = (
  tileManager: TileManager,
  reservedSpots: ReturnType<typeof resolveReservedSpots>,
  spot: BuildSpot,
) => reservedSpots.vacatedSpots.has(toBuildSpotKey(spot)) && tileManager.isHexOccupied(spot);

const isAvailableBuildSpot = (
  tileManager: TileManager,
  reservedSpots: ReturnType<typeof resolveReservedSpots>,
  spot: BuildSpot,
) => {
  if (isCenterBuildSpot(spot)) return false;
  if (reservedSpots.occupiedSpots.has(toBuildSpotKey(spot))) return false;
  if (isReservedVacatedSpotStillOccupied(tileManager, reservedSpots, spot)) return false;
  return !tileManager.isHexOccupied(spot);
};

const resolveAvailableBuildSpots = (
  tileManager: TileManager,
  reservedSpots: ReturnType<typeof resolveReservedSpots>,
  candidates: BuildSpot[],
) => candidates.filter((candidate) => isAvailableBuildSpot(tileManager, reservedSpots, candidate));

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

const hasBuildableCandidate = ({
  entityId,
  realmPosition,
  world,
  occupiedSpots,
  vacatedSpots,
}: RealmAvailableTileOptions) => {
  if (!realmPosition) return true;

  const { tileManager, buildRadiusResolver } = createTileManager(entityId, realmPosition, world);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  const reservedSpots = resolveReservedSpots(entityId, occupiedSpots, vacatedSpots);

  return candidates.some((candidate) => isAvailableBuildSpot(tileManager, reservedSpots, candidate));
};

export const resolveRealmHasAvailableBuildingTile = (options: RealmAvailableTileOptions) =>
  hasBuildableCandidate(options);

const canAffordRealmBuilding = ({
  entityId,
  target,
  useSimpleCost,
  world,
}: Pick<RealmBuildActionOptions, "entityId" | "target" | "useSimpleCost" | "world">): boolean => {
  const { currentDefaultTick } = getBlockTimestamp();
  const buildingCosts = getBuildingCosts(entityId, world.components, target.type, useSimpleCost);
  if (!buildingCosts?.length) {
    return false;
  }

  return buildingCosts.every((resourceCost) => {
    const balance = getBalance(entityId, resourceCost.resource, currentDefaultTick, world.components);
    return divideByPrecision(balance.balance) >= resourceCost.amount;
  });
};

export const buildRealmBuilding = async ({
  entityId,
  realmPosition,
  target,
  useSimpleCost,
  world,
  occupiedSpots,
  vacatedSpots,
  onReserveSpot,
  onReleaseSpot,
  onBuildSuccess,
}: RealmBuildActionOptions) => {
  if (!realmPosition) {
    toast.error("Select a realm before building.");
    return false;
  }

  if (!canAffordRealmBuilding({ entityId, target, useSimpleCost, world })) {
    toast.error("Insufficient resources to build.");
    return false;
  }

  const { outerCol, outerRow, tileManager, buildRadiusResolver } = createTileManager(entityId, realmPosition, world);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  const reservedSpots = resolveReservedSpots(entityId, occupiedSpots, vacatedSpots);
  const availableSpots = resolveAvailableBuildSpots(tileManager, reservedSpots, candidates);

  if (availableSpots.length === 0) {
    toast.error("No empty building tiles available.");
    return false;
  }

  let occupiedTileFailures = 0;

  try {
    for (const availableSpot of availableSpots) {
      const spotKey = toBuildSpotKey(availableSpot);
      reserveAutoBuildSpot(entityId, spotKey, onReserveSpot);

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

        releaseAutoBuildSpot(entityId, spotKey, onReleaseSpot);
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
