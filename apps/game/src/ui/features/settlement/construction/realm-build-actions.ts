import { generateBuildablePositions } from "@bibliothecadao/eternum/automation";
import { BUILDINGS_CENTER, BuildingType, ResourcesIds } from "@bibliothecadao/types";
import type { BuildingTiles } from "@bibliothecadao/eternum";
import { toast } from "@/ui/features/event-feed/notify";
import { getScopedGameId } from "@bibliothecadao/eternum/game-client";
import { requireActiveGameClient } from "@/sync/active-game-client";
import {
  resolveConstructionBuildability,
  type ConstructionBuildabilityInput,
} from "@bibliothecadao/eternum/automation";

type RealmPosition = {
  x: bigint | number;
  y: bigint | number;
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
  onBuildSuccess?: (selection: BuildSelection) => void;
};

type RealmAvailableTileOptions = {
  entityId: number;
  realmPosition?: RealmPosition | null;
};

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

const isAvailableBuildSpot = (tileManager: BuildingTiles, spot: BuildSpot) => {
  if (isCenterBuildSpot(spot)) return false;
  return !tileManager.isHexOccupied(spot);
};

const resolveAvailableBuildSpots = (tileManager: BuildingTiles, candidates: BuildSpot[]) =>
  candidates.filter((candidate) => isAvailableBuildSpot(tileManager, candidate));

const readRealmTiles = (entityId: number) => {
  const tileManager = requireActiveGameClient().views.buildingTiles(entityId);
  const { col: outerCol, row: outerRow } = tileManager.getHexCoords();

  return {
    outerCol,
    outerRow,
    tileManager,
    buildRadiusResolver: () => Math.max(1, Number(tileManager.getRealmLevel(entityId)) + 1),
  };
};

const hasBuildableCandidate = ({ entityId, realmPosition }: RealmAvailableTileOptions) => {
  if (!realmPosition) return true;

  const { tileManager, buildRadiusResolver } = readRealmTiles(entityId);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  return candidates.some((candidate) => isAvailableBuildSpot(tileManager, candidate));
};

export const resolveRealmHasAvailableBuildingTile = (options: RealmAvailableTileOptions) =>
  hasBuildableCandidate(options);

const submitRealmBuilding = async ({
  entityId,
  realm,
  mode,
  target,
  useSimpleCost,
  onBuildSuccess,
}: RealmBuildActionOptions) => {
  const { setup, actions } = requireActiveGameClient();
  const baseBuildability = resolveConstructionBuildability({
    entityId,
    buildingType: target.type,
    useSimpleCost,
    store: setup.store,
    realm,
    mode,
  });

  if (!baseBuildability.canSubmit) {
    toast.error(baseBuildability.reason ?? "Building cannot be submitted.");
    return false;
  }

  const { outerCol, outerRow, tileManager, buildRadiusResolver } = readRealmTiles(entityId);
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
        store: setup.store,
        realm,
        mode,
        targetSpot: availableSpot,
        tileManager,
      });

      if (!spotBuildability.canSubmit) {
        continue;
      }

      try {
        await actions.placeBuilding({
          structureId: entityId,
          buildingType: target.type,
          hex: { col: availableSpot.col, row: availableSpot.row },
          useSimpleCost,
        });

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
  if (!options.realmPosition) {
    toast.error("Select a realm before building.");
    return false;
  }

  return runWithRealmBuildLock(options.entityId, () => submitRealmBuilding(options));
};
