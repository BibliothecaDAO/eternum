import { resolveIndexerArtifactState, resolveSlotToriiLiveState } from "../indexing/slot-torii";
import { toAwsRuntimeArtifact, type AwsRuntimeLiveState } from "../runtime/aws-runtime";
import type { IndexerTier, SeriesLaunchGameArtifacts, SeriesLaunchGameSummary } from "../types";
import type { FactoryRotationRunRecord, FactoryRunArtifacts, FactoryRunRecord, FactorySeriesRunRecord } from "./types";

type SlotToriiLiveState = ReturnType<typeof resolveSlotToriiLiveState>;
type IndexerMaintenanceLiveState = SlotToriiLiveState | AwsRuntimeLiveState;
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
  liveState: IndexerMaintenanceLiveState;
}

export interface TierSuccessIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "tier-success";
  tier: IndexerTier;
  liveState: IndexerMaintenanceLiveState;
}

export interface TierFailureIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "tier-failure";
  tier: IndexerTier;
  failedAt: string;
  errorMessage: string;
  liveState: IndexerMaintenanceLiveState;
}

export interface DeleteSuccessIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "delete-success";
  liveState: IndexerMaintenanceLiveState;
}

export interface DeleteFailureIndexerMaintenanceRunUpdate extends BaseIndexerMaintenanceRunUpdate {
  kind: "delete-failure";
  liveState: IndexerMaintenanceLiveState;
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
  liveState: IndexerMaintenanceLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveMaintenanceIndexerArtifactState(liveState),
    pendingIndexerTierTarget: isLiveIndexerExisting(liveState) ? undefined : currentArtifacts.pendingIndexerTierTarget,
    pendingIndexerTierRequestedAt: isLiveIndexerExisting(liveState)
      ? undefined
      : currentArtifacts.pendingIndexerTierRequestedAt,
    lastIndexerTierDispatchTarget: isLiveIndexerExisting(liveState)
      ? undefined
      : currentArtifacts.lastIndexerTierDispatchTarget,
    lastIndexerTierDispatchFailedAt: isLiveIndexerExisting(liveState)
      ? undefined
      : currentArtifacts.lastIndexerTierDispatchFailedAt,
    lastIndexerTierDispatchError: isLiveIndexerExisting(liveState)
      ? undefined
      : currentArtifacts.lastIndexerTierDispatchError,
  };
}

function buildTierSuccessArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  tier: IndexerTier,
  liveState: IndexerMaintenanceLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveMaintenanceIndexerArtifactState(liveState, tier),
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
  liveState: IndexerMaintenanceLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveMaintenanceIndexerArtifactState(liveState),
    pendingIndexerTierTarget: tier,
    pendingIndexerTierRequestedAt: failedAt,
    lastIndexerTierDispatchTarget: tier,
    lastIndexerTierDispatchFailedAt: failedAt,
    lastIndexerTierDispatchError: errorMessage,
  };
}

function buildDeleteSuccessArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: IndexerMaintenanceLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveMaintenanceIndexerArtifactState(liveState),
    indexerCreated: false,
    indexerTier: undefined,
    indexerUrl: undefined,
    indexerVersion: undefined,
    indexerBranch: undefined,
    runtimeProvider: isAwsRuntimeLiveState(liveState) ? "aws" : currentArtifacts.runtimeProvider,
    awsRuntime: undefined,
    pendingIndexerTierTarget: undefined,
    pendingIndexerTierRequestedAt: undefined,
    lastIndexerTierDispatchTarget: undefined,
    lastIndexerTierDispatchFailedAt: undefined,
    lastIndexerTierDispatchError: undefined,
  };
}

function buildDeleteFailureArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: IndexerMaintenanceLiveState,
): FactoryRunArtifacts | SeriesLaunchGameArtifacts {
  return {
    ...currentArtifacts,
    ...resolveMaintenanceIndexerArtifactState(liveState),
    pendingIndexerTierTarget: undefined,
    pendingIndexerTierRequestedAt: undefined,
    lastIndexerTierDispatchTarget: undefined,
    lastIndexerTierDispatchFailedAt: undefined,
    lastIndexerTierDispatchError: undefined,
  };
}

function isAwsRuntimeLiveState(liveState: IndexerMaintenanceLiveState): liveState is AwsRuntimeLiveState {
  return (liveState as AwsRuntimeLiveState).provider === "aws";
}

function isLiveIndexerExisting(liveState: IndexerMaintenanceLiveState): boolean {
  return isAwsRuntimeLiveState(liveState) ? liveState.status === "existing" : liveState.state === "existing";
}

function resolveMaintenanceIndexerArtifactState(liveState: IndexerMaintenanceLiveState, fallbackTier?: IndexerTier) {
  if (!isAwsRuntimeLiveState(liveState)) {
    return resolveIndexerArtifactState(liveState, { fallbackTier });
  }

  return {
    indexerCreated: liveState.status === "existing",
    indexerTier: liveState.tier || fallbackTier,
    indexerUrl: liveState.endpointUrl,
    indexerVersion: liveState.version,
    indexerBranch: undefined,
    lastIndexerDescribeAt: liveState.describedAt,
    runtimeProvider: "aws" as const,
    awsRuntime: toAwsRuntimeArtifact(liveState),
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
