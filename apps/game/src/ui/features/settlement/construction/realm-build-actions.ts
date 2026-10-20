import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";
import { generateBuildablePositions } from "@bibliothecadao/eternum/automation";
import { BUILDINGS_CENTER, BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { buildableRadius, type BuildingTiles, type GameClient } from "@bibliothecadao/eternum";
import { toast } from "@/ui/features/event-feed/notify";
import { gameTaskScope } from "@/ui/features/infrastructure/automation/model/game-task-scope";
import { isPlotInFlight, sendBuilding } from "./send-building";
import { getActiveGameStore, requireActiveGameClient } from "@/sync/active-game-client";
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
  structureId: number;
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
  signal?: AbortSignal;
  onBuildSuccess?: (selection: BuildSelection) => void;
};

type RealmAvailableTileOptions = {
  entityId: number;
  realmPosition?: RealmPosition | null;
};

const realmBuildLocks = new Map<string, { semaphore: Semaphore.Semaphore; users: number }>();

const runWithRealmBuildLock = <Result>(
  key: string,
  task: () => Promise<Result>,
  signal?: AbortSignal,
): Promise<Result> => {
  const acquire = Effect.sync(() => {
    const lock = realmBuildLocks.get(key) ?? { semaphore: Semaphore.makeUnsafe(1), users: 0 };
    lock.users++;
    realmBuildLocks.set(key, lock);
    return lock;
  });
  return Effect.runPromise(
    Effect.acquireUseRelease(
      acquire,
      (lock) =>
        lock.semaphore.withPermit(
          Effect.uninterruptible(
            Effect.tryPromise({
              try: task,
              catch: (error) => error,
            }),
          ),
        ),
      (lock) =>
        Effect.sync(() => {
          if (--lock.users === 0) realmBuildLocks.delete(key);
        }),
    ),
    { signal },
  );
};

const isCenterBuildSpot = (spot: BuildSpot) => spot.col === BUILDINGS_CENTER[0] && spot.row === BUILDINGS_CENTER[1];

const isAvailableBuildSpot = (tileManager: BuildingTiles, spot: BuildSpot) => {
  if (isCenterBuildSpot(spot)) return false;
  return !tileManager.isHexOccupied(spot);
};

const resolveAvailableBuildSpots = (tileManager: BuildingTiles, candidates: BuildSpot[]) =>
  candidates.filter((candidate) => isAvailableBuildSpot(tileManager, candidate));

const readRealmTiles = (client: GameClient, entityId: number) => {
  const tileManager = client.views.buildingTiles(entityId);

  return {
    tileManager,
    buildRadiusResolver: () => buildableRadius(Number(tileManager.getRealmLevel(entityId))),
  };
};

const hasBuildableCandidate = ({ entityId, realmPosition }: RealmAvailableTileOptions) => {
  if (!realmPosition) return true;

  const { tileManager, buildRadiusResolver } = readRealmTiles(requireActiveGameClient(), entityId);
  const buildRadius = buildRadiusResolver();
  const candidates = generateBuildablePositions(buildRadius);
  return candidates.some((candidate) => isAvailableBuildSpot(tileManager, candidate));
};

export const resolveRealmHasAvailableBuildingTile = (options: RealmAvailableTileOptions) =>
  hasBuildableCandidate(options);

/**
 * Builds on the first free plot the building can stand on and sends it once. A plot is free when nothing stands on it in
 * the store and no building of ours is on its way to it; the realm's lock holds until this build's own outcome, so the
 * next quick build reads a board that holds it. One press sends one build: a refusal is reported, never retried on
 * another plot.
 */
const submitRealmBuilding = async (
  client: GameClient,
  isCurrentGame: () => boolean,
  { entityId, realm, mode, target, useSimpleCost, onBuildSuccess, signal }: RealmBuildActionOptions,
) => {
  const { setup } = client;
  const buildability = (targetSpot?: BuildSpot, tileManager?: BuildingTiles) =>
    resolveConstructionBuildability({
      entityId,
      buildingType: target.type,
      useSimpleCost,
      store: setup.store,
      realm,
      mode,
      targetSpot,
      tileManager,
    });

  const base = buildability();
  if (!base.canSubmit) {
    toast.error(base.reason ?? "Building cannot be submitted.");
    return false;
  }

  const { tileManager, buildRadiusResolver } = readRealmTiles(client, entityId);
  const plot = resolveAvailableBuildSpots(tileManager, generateBuildablePositions(buildRadiusResolver())).find(
    (spot) => !isPlotInFlight(entityId, spot) && buildability(spot, tileManager).canSubmit,
  );
  if (!plot) {
    toast.error("No empty building tiles available.");
    return false;
  }
  if (signal?.aborted || !isCurrentGame()) return false;

  try {
    const sent = await sendBuilding({ realmId: entityId, type: target.type, plot, useSimpleCost });
    if (sent === null) return false;
    if (!signal?.aborted && isCurrentGame())
      onBuildSuccess?.({ structureId: entityId, innerCol: plot.col, innerRow: plot.row });
    return true;
  } catch (error) {
    if (signal?.aborted || !isCurrentGame()) return false;
    toast.failed(error, "Building failed. Please try again.");
    return false;
  }
};

export const buildRealmBuilding = async (options: RealmBuildActionOptions) => {
  if (!options.realmPosition) {
    toast.error("Select a realm before building.");
    return false;
  }

  const client = requireActiveGameClient();
  const scope = gameTaskScope(client);
  const isCurrentGame = () => getActiveGameStore() !== null && gameTaskScope(requireActiveGameClient()) === scope;
  return runWithRealmBuildLock(
    `${scope}:${options.entityId}`,
    () => {
      if (!isCurrentGame()) throw new Error("The active game changed before building.");
      return submitRealmBuilding(client, isCurrentGame, options);
    },
    options.signal,
  );
};
