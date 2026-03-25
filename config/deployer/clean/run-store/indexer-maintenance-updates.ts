import { resolveIndexerArtifactState, resolveSlotToriiLiveState } from "../indexing/slot-torii";
import type { IndexerTier, SeriesLaunchGameArtifacts, SeriesLaunchGameSummary } from "../types";
import type { FactoryRotationRunRecord, FactoryRunArtifacts, FactoryRunRecord, FactorySeriesRunRecord } from "./types";

type SlotToriiLiveState = ReturnType<typeof resolveSlotToriiLiveState>;
type IndexerMaintenanceRunRecord = FactoryRunRecord | FactorySeriesRunRecord | FactoryRotationRunRecord | null;

interface IndexerMaintenanceRunTarget {
  gameName?: string;
  recordPath?: string;
}

interface BaseIndexerMaintenanceRunUpdate {
  target: IndexerMaintenanceRunTarget;
  message: string;
  updatedAt: string;
}

export interface RefreshIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "refresh";
  liveState: SlotToriiLiveState;
}

export interface TierSuccessIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "tier-success";
  tier: IndexerTier;
  liveState: SlotToriiLiveState;
}

export interface TierFailureIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "tier-failure";
  tier: IndexerTier;
  failedAt: string;
  errorMessage: string;
  liveState: SlotToriiLiveState;
}

export interface DeleteSuccessIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "delete-success";
  liveState: SlotToriiLiveState;
}

export interface DeleteFailureIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "delete-failure";
  liveState: SlotToriiLiveState;
}

export type IndexerMaintenanceRunUpdate =
  | RefreshIndexerMaintenanceRunUpdate
  | TierSuccessIndexerMaintenanceRunUpdate
  | TierFailureIndexerMaintenanceRunUpdate
  | DeleteSuccessIndexerMaintenanceRunUpdate
  | DeleteFailureIndexerMaintenanceRunUpdate;

export function applyIndexerMaintenanceRunUpdates(
  run: IndexerMaintenanceRunRecord,
  updates: IndexerMaintenanceRunUpdate[],
): IndexerMaintenanceRunRecord {
  return updates.reduce<IndexerMaintenanceRunRecord>(
    (currentRun, update) => applyIndexerMaintenanceRunUpdate(currentRun, update),
    run,
  );
}

export function applyIndexerMaintenanceRunUpdate(
  run: IndexerMaintenanceRunRecord,
  update: IndexerMaintenanceRunUpdate,
): IndexerMaintenanceRunRecord {
  if (!run) {
    return null;
  }

  switch (run.kind) {
    case "game":
      return {
        ...run,
        updatedAt: update.updatedAt,
        artifacts: buildNextArtifacts(run.artifacts, update) as FactoryRunArtifacts,
      } satisfies FactoryRunRecord;
    case "series":
      return {
        ...run,
        updatedAt: update.updatedAt,
        summary: {
          ...run.summary,
          games: updateSeriesLikeGame(run.summary.games, update, (game) => ({
            ...game,
            latestEvent: update.message,
            artifacts: buildNextArtifacts(game.artifacts, update) as SeriesLaunchGameArtifacts,
          })),
        },
      } satisfies FactorySeriesRunRecord;
    case "rotation":
      return {
        ...run,
        updatedAt: update.updatedAt,
        summary: {
          ...run.summary,
          games: updateSeriesLikeGame(run.summary.games, update, (game) => ({
            ...game,
            latestEvent: update.message,
            artifacts: buildNextArtifacts(game.artifacts, update) as SeriesLaunchGameArtifacts,
          })),
        },
      } satisfies FactoryRotationRunRecord;
  }
}

function buildNextArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  update: IndexerMaintenanceRunUpdate,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  switch (update.kind) {
    case "refresh":
      return buildRefreshedArtifacts(currentArtifacts, update.liveState);
    case "tier-success":
      return buildTierSuccessArtifacts(currentArtifacts, update.tier, update.liveState);
    case "tier-failure":
      return buildTierFailureArtifacts(
        currentArtifacts,
        update.tier,
        update.failedAt,
        update.errorMessage,
        update.liveState,
      );
    case "delete-success":
      return buildDeleteSuccessArtifacts(currentArtifacts, update.liveState);
    case "delete-failure":
      return buildDeleteFailureArtifacts(currentArtifacts, update.liveState);
  }
}

function buildRefreshedArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: SlotToriiLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveIndexerArtifactState(liveState),
    pendingIndexerTierTarget: liveState.state === "existing" ? undefined : currentArtifacts.pendingIndexerTierTarget,
    pendingIndexerTierRequestedAt:
      liveState.state === "existing" ? undefined : currentArtifacts.pendingIndexerTierRequestedAt,
    lastIndexerTierDispatchTarget:
      liveState.state === "existing" ? undefined : currentArtifacts.lastIndexerTierDispatchTarget,
    lastIndexerTierDispatchFailedAt:
      liveState.state === "existing" ? undefined : currentArtifacts.lastIndexerTierDispatchFailedAt,
    lastIndexerTierDispatchError:
      liveState.state === "existing" ? undefined : currentArtifacts.lastIndexerTierDispatchError,
  };
}

function buildTierSuccessArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  tier: IndexerTier,
  liveState: SlotToriiLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveIndexerArtifactState(liveState, { fallbackTier: tier }),
    pendingIndexerTierTarget: undefined,
    pendingIndexerTierRequestedAt: undefined,
    lastIndexerTierDispatchTarget: undefined,
    lastIndexerTierDispatchFailedAt: undefined,
    lastIndexerTierDispatchError: undefined,
  };
}

function buildTierFailureArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  tier: IndexerTier,
  failedAt: string,
  errorMessage: string,
  liveState: SlotToriiLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveIndexerArtifactState(liveState),
    pendingIndexerTierTarget: tier,
    pendingIndexerTierRequestedAt: failedAt,
    lastIndexerTierDispatchTarget: tier,
    lastIndexerTierDispatchFailedAt: failedAt,
    lastIndexerTierDispatchError: errorMessage,
  };
}

function buildDeleteSuccessArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: SlotToriiLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveIndexerArtifactState(liveState),
    indexerCreated: false,
    indexerTier: undefined,
    indexerUrl: undefined,
    indexerVersion: undefined,
    indexerBranch: undefined,
    pendingIndexerTierTarget: undefined,
    pendingIndexerTierRequestedAt: undefined,
    lastIndexerTierDispatchTarget: undefined,
    lastIndexerTierDispatchFailedAt: undefined,
    lastIndexerTierDispatchError: undefined,
  };
}

function buildDeleteFailureArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: SlotToriiLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveIndexerArtifactState(liveState),
    pendingIndexerTierTarget: undefined,
    pendingIndexerTierRequestedAt: undefined,
    lastIndexerTierDispatchTarget: undefined,
    lastIndexerTierDispatchFailedAt: undefined,
    lastIndexerTierDispatchError: undefined,
  };
}

function updateSeriesLikeGame(
  games: SeriesLaunchGameSummary[],
  update: IndexerMaintenanceRunUpdate,
  updateGame: (game: SeriesLaunchGameSummary) => SeriesLaunchGameSummary,
) {
  let didUpdate = false;
  const nextGames = games.map((game) => {
    if (game.gameName !== update.target.gameName) {
      return game;
    }

    didUpdate = true;
    return updateGame(game);
  });

  if (!didUpdate) {
    throw new Error(`Could not find ${update.target.gameName} in ${update.target.recordPath}`);
  }

  return nextGames;
}
