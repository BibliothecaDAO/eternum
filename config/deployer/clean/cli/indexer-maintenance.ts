#!/usr/bin/env bun
import * as fs from "node:fs";
import { DEFAULT_CARTRIDGE_API_BASE, DEFAULT_NAMESPACE, DEFAULT_INDEXER_MAINTENANCE_WORKFLOW_FILE } from "../constants";
import { resolveFactoryGameIndexerRequest } from "../indexing/factory-indexer-request";
import {
  deleteSlotIndexerDeployment,
  ensureSlotIndexerDeployment,
  ensureSlotIndexerTier,
  listSlotToriiDeploymentNames,
  resolveIndexerArtifactState,
  resolveSlotToriiLiveStates,
  resolveSlotToriiLiveState,
} from "../indexing/slot-torii";
import {
  requireGitHubBranchStoreConfig,
  readGitHubBranchJsonFile,
  updateGitHubBranchJsonFile,
} from "../run-store/github";
import {
  replaceFactoryLiveIndexerSnapshot,
  updateFactoryLiveIndexerSnapshotEntries,
} from "../run-store/indexer-live-snapshot";
import {
  recordFactoryRotationMaintenanceIndex,
  recordFactoryRunMaintenanceIndex,
  recordFactorySeriesMaintenanceIndex,
} from "../run-store/maintenance-index";
import type {
  FactoryRotationRunRecord,
  FactoryRunArtifacts,
  FactoryRunRecord,
  FactorySeriesRunRecord,
} from "../run-store/types";
import type {
  DeploymentEnvironmentId,
  IndexerTier,
  SeriesLaunchGameArtifacts,
  SeriesLaunchGameSummary,
} from "../types";
import { parseArgs } from "./args";

type IndexerMaintenanceRunKind = "game" | "series" | "rotation";
type IndexerMaintenanceAction = "inspect" | "inspect-account" | "create" | "set-tier" | "delete";
type IndexerMaintenanceRunRecord = FactoryRunRecord | FactorySeriesRunRecord | FactoryRotationRunRecord | null;

interface IndexerMaintenanceOperation {
  action: IndexerMaintenanceAction;
  kind?: IndexerMaintenanceRunKind;
  environmentId: string;
  recordPath?: string;
  runName?: string;
  gameName?: string;
  tier?: IndexerTier;
}

interface IndexerMaintenanceCliArgs {
  operations: IndexerMaintenanceOperation[];
}

interface IndexerMaintenanceResult {
  operation: IndexerMaintenanceOperation;
  outcome:
    | "inspected"
    | "created"
    | "already-live"
    | "tier-updated"
    | "tier-already-matched"
    | "deleted"
    | "already-missing"
    | "failed";
  previousTier?: IndexerTier;
  currentTier?: IndexerTier;
  message: string;
}

function usage() {
  console.log(
    [
      "",
      `Usage: bun config/deployer/clean/cli/indexer-maintenance.ts --operations-json '<json-array>'`,
      "",
      "Operation shape:",
      '  [{"action":"inspect|inspect-account|create|set-tier|delete","kind":"game|series|rotation","environmentId":"slot.blitz","recordPath":"runs/...json","runName":"bltz-franky","gameName":"bltz-franky-01","tier":"pro"}]',
      "",
      `This workflow is normally dispatched by ${DEFAULT_INDEXER_MAINTENANCE_WORKFLOW_FILE}.`,
      "",
    ].join("\n"),
  );
}

function resolveCliArgs(): IndexerMaintenanceCliArgs {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    usage();
    process.exit(0);
  }

  return {
    operations: parseOperations(args["operations-json"]),
  };
}

function parseOperations(value: string | undefined): IndexerMaintenanceOperation[] {
  if (!value) {
    throw new Error("--operations-json is required");
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error("--operations-json must be valid JSON");
  }

  if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
    throw new Error("--operations-json must be a non-empty JSON array");
  }

  return parsedValue.map(parseOperation);
}

function parseOperation(value: unknown): IndexerMaintenanceOperation {
  if (!value || typeof value !== "object") {
    throw new Error("Each maintenance operation must be an object");
  }

  const operation = value as Record<string, unknown>;
  const kind = operation.kind;
  const action = `${operation.action || "set-tier"}`.trim().toLowerCase();
  const environmentId = `${operation.environmentId || ""}`.trim();
  const recordPath = `${operation.recordPath || ""}`.trim();
  const runName = `${operation.runName || ""}`.trim();
  const gameName = `${operation.gameName || ""}`.trim();
  const tier = `${operation.tier || ""}`.trim().toLowerCase();

  if (kind !== undefined && kind !== "game" && kind !== "series" && kind !== "rotation") {
    throw new Error(`Unsupported maintenance run kind "${kind}"`);
  }

  if (
    action !== "inspect" &&
    action !== "inspect-account" &&
    action !== "create" &&
    action !== "set-tier" &&
    action !== "delete"
  ) {
    throw new Error(`Unsupported maintenance action "${action}"`);
  }

  if (!environmentId) {
    throw new Error("Maintenance operations require environmentId");
  }

  if (action === "set-tier" && tier !== "basic" && tier !== "pro" && tier !== "legendary" && tier !== "epic") {
    throw new Error(`Unsupported indexer tier "${tier}"`);
  }

  if (action !== "inspect-account" && !gameName) {
    throw new Error(`Maintenance action "${action}" requires gameName`);
  }

  if ((recordPath || runName || kind !== undefined) && (!recordPath || !runName || kind === undefined)) {
    throw new Error("Run-bound maintenance operations require kind, recordPath, and runName together");
  }

  return {
    action,
    ...(kind ? { kind: kind as IndexerMaintenanceRunKind } : {}),
    environmentId,
    ...(recordPath ? { recordPath } : {}),
    ...(runName ? { runName } : {}),
    ...(gameName ? { gameName } : {}),
    ...(action === "set-tier" ? { tier: tier as IndexerTier } : {}),
  };
}

function groupOperationsByRecordPath(operations: IndexerMaintenanceOperation[]) {
  const groups = new Map<string, IndexerMaintenanceOperation[]>();

  for (const operation of operations) {
    const groupKey =
      operation.recordPath ||
      (operation.action === "inspect-account"
        ? `__inspect_account__:${operation.environmentId}`
        : `__direct__:${operation.environmentId}:${operation.action}:${operation.gameName}`);
    const current = groups.get(groupKey) || [];
    current.push(operation);
    groups.set(groupKey, current);
  }

  return groups;
}

function buildTierSuccessArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  tier: IndexerTier,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
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

function buildDeleteSuccessArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
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

function buildTierFailureArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  tier: IndexerTier,
  failedAt: string,
  errorMessage: string,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
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

function buildDeleteFailureArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
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

function buildAlreadyMatchedMessage(gameName: string, tier: IndexerTier) {
  return `Indexer tier already matched ${tier} for ${gameName}`;
}

function buildIndexerInspectedMessage(gameName: string, liveState: ReturnType<typeof resolveSlotToriiLiveState>) {
  if (liveState.state === "existing") {
    return `Live indexer state refreshed for ${gameName}`;
  }

  if (liveState.state === "missing") {
    return `Indexer is missing for ${gameName}`;
  }

  return `Indexer state is indeterminate for ${gameName}`;
}

function buildIndexerCreatedMessage(gameName: string) {
  return `Created indexer for ${gameName}`;
}

function buildIndexerAlreadyLiveMessage(gameName: string) {
  return `Indexer was already live for ${gameName}`;
}

function buildTierUpdatedMessage(gameName: string, previousTier: IndexerTier | undefined, nextTier: IndexerTier) {
  return `Indexer tier updated ${previousTier || "unknown"} -> ${nextTier} for ${gameName}`;
}

function buildIndexerDeletedMessage(gameName: string) {
  return `Deleted indexer for ${gameName}`;
}

function buildIndexerAlreadyMissingMessage(gameName: string) {
  return `Indexer was already missing for ${gameName}`;
}

function buildFailureMessage(operation: IndexerMaintenanceOperation, errorMessage: string) {
  if (operation.action === "create") {
    return `Indexer creation failed for ${operation.gameName}: ${errorMessage}`;
  }

  if (operation.action === "inspect" || operation.action === "inspect-account") {
    return operation.gameName
      ? `Indexer inspection failed for ${operation.gameName}: ${errorMessage}`
      : `Indexer inspection failed: ${errorMessage}`;
  }

  if (operation.action === "delete") {
    return `Indexer deletion failed for ${operation.gameName}: ${errorMessage}`;
  }

  return `Indexer maintenance failed for ${operation.gameName}: ${errorMessage}`;
}

function updateSeriesLikeGame(
  games: SeriesLaunchGameSummary[],
  operation: IndexerMaintenanceOperation,
  updateGame: (game: SeriesLaunchGameSummary) => SeriesLaunchGameSummary,
) {
  let didUpdate = false;
  const nextGames = games.map((game) => {
    if (game.gameName !== operation.gameName) {
      return game;
    }

    didUpdate = true;
    return updateGame(game);
  });

  if (!didUpdate) {
    throw new Error(`Could not find ${operation.gameName} in ${operation.recordPath}`);
  }

  return nextGames;
}

function buildRefreshedArtifacts(
  currentArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
) {
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

function updateRunRecordForSuccess(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
  message: string,
  nextArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
) {
  if (!run) {
    return null;
  }

  switch (run.kind) {
    case "game":
      return {
        ...run,
        updatedAt: new Date().toISOString(),
        artifacts: nextArtifacts as FactoryRunArtifacts,
      } satisfies FactoryRunRecord;
    case "series":
      return {
        ...run,
        updatedAt: new Date().toISOString(),
        summary: {
          ...run.summary,
          games: updateSeriesLikeGame(run.summary.games, operation, (game) => ({
            ...game,
            latestEvent: message,
            artifacts: nextArtifacts as SeriesLaunchGameArtifacts,
          })),
        },
      } satisfies FactorySeriesRunRecord;
    case "rotation":
      return {
        ...run,
        updatedAt: new Date().toISOString(),
        summary: {
          ...run.summary,
          games: updateSeriesLikeGame(run.summary.games, operation, (game) => ({
            ...game,
            latestEvent: message,
            artifacts: nextArtifacts as SeriesLaunchGameArtifacts,
          })),
        },
      } satisfies FactoryRotationRunRecord;
  }
}

function updateRunRecordForFailure(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
  message: string,
  nextArtifacts: FactoryRunArtifacts | SeriesLaunchGameArtifacts,
) {
  if (!run) {
    return null;
  }

  switch (run.kind) {
    case "game":
      return {
        ...run,
        updatedAt: new Date().toISOString(),
        artifacts: nextArtifacts as FactoryRunArtifacts,
      } satisfies FactoryRunRecord;
    case "series":
      return {
        ...run,
        updatedAt: new Date().toISOString(),
        summary: {
          ...run.summary,
          games: updateSeriesLikeGame(run.summary.games, operation, (game) => ({
            ...game,
            latestEvent: message,
            artifacts: nextArtifacts as SeriesLaunchGameArtifacts,
          })),
        },
      } satisfies FactorySeriesRunRecord;
    case "rotation":
      return {
        ...run,
        updatedAt: new Date().toISOString(),
        summary: {
          ...run.summary,
          games: updateSeriesLikeGame(run.summary.games, operation, (game) => ({
            ...game,
            latestEvent: message,
            artifacts: nextArtifacts as SeriesLaunchGameArtifacts,
          })),
        },
      } satisfies FactoryRotationRunRecord;
  }
}

function resolveTierForOperation(operation: IndexerMaintenanceOperation): IndexerTier {
  if (!operation.tier) {
    throw new Error(`Missing indexer tier for ${operation.gameName}`);
  }

  return operation.tier;
}

function resolveCurrentArtifacts(run: IndexerMaintenanceRunRecord, operation: IndexerMaintenanceOperation) {
  if (!run) {
    return {};
  }

  switch (run.kind) {
    case "game":
      return run.artifacts;
    case "series":
    case "rotation": {
      const matchingGame = run.summary.games.find((game) => game.gameName === operation.gameName);
      if (!matchingGame) {
        throw new Error(`Could not find ${operation.gameName} in ${operation.recordPath}`);
      }
      return matchingGame.artifacts;
    }
  }
}

function buildRunStoreCommitMessage(operation: IndexerMaintenanceOperation) {
  if (!operation.gameName) {
    return `factory-runs: refresh live indexer snapshot for ${operation.environmentId}`;
  }

  if (operation.action === "create") {
    return `factory-runs: create indexer for ${operation.environmentId}/${operation.gameName}`;
  }

  if (operation.action === "inspect") {
    return `factory-runs: refresh indexer state for ${operation.environmentId}/${operation.gameName}`;
  }

  return operation.action === "delete"
    ? `factory-runs: delete indexer for ${operation.environmentId}/${operation.gameName}`
    : `factory-runs: reconcile indexer tier for ${operation.environmentId}/${operation.gameName}`;
}

async function recordUpdatedMaintenanceIndex(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  run: IndexerMaintenanceRunRecord,
) {
  if (!run) {
    return;
  }

  switch (run.kind) {
    case "game":
      await recordFactoryRunMaintenanceIndex(config, run);
      return;
    case "series":
      await recordFactorySeriesMaintenanceIndex(config, run);
      return;
    case "rotation":
      await recordFactoryRotationMaintenanceIndex(config, run);
      return;
  }
}

async function applyOperationToRun(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): Promise<{
  run: IndexerMaintenanceRunRecord;
  result: IndexerMaintenanceResult;
}> {
  if (operation.action === "inspect-account") {
    return applyInspectAccountOperation(run, operation);
  }

  if (operation.action === "inspect") {
    return applyInspectOperationToRun(run, operation);
  }

  if (operation.action === "create") {
    return applyCreateOperationToRun(run, operation);
  }

  return operation.action === "delete"
    ? applyDeleteOperationToRun(run, operation)
    : applyTierOperationToRun(run, operation);
}

async function applyInspectAccountOperation(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): Promise<{
  run: IndexerMaintenanceRunRecord;
  result: IndexerMaintenanceResult;
}> {
  return {
    run,
    result: {
      operation,
      outcome: "inspected",
      message: `Refreshed live Slot Torii deployments for ${operation.environmentId}`,
    },
  };
}

async function applyInspectOperationToRun(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): Promise<{
  run: IndexerMaintenanceRunRecord;
  result: IndexerMaintenanceResult;
}> {
  const gameName = operation.gameName!;
  const liveState = resolveSlotToriiLiveState(gameName, {
    onProgress: (message) => console.error(message),
  });
  const message = buildIndexerInspectedMessage(gameName, liveState);
  const nextArtifacts = buildRefreshedArtifacts(resolveCurrentArtifacts(run, operation), liveState);

  return {
    run: updateRunRecordForSuccess(run, operation, message, nextArtifacts),
    result: {
      operation,
      outcome: "inspected",
      currentTier: liveState.currentTier,
      message,
    },
  };
}

async function applyCreateOperationToRun(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): Promise<{
  run: IndexerMaintenanceRunRecord;
  result: IndexerMaintenanceResult;
}> {
  const gameName = operation.gameName!;

  try {
    const indexerRequest = await resolveFactoryGameIndexerRequest({
      environmentId: operation.environmentId as DeploymentEnvironmentId,
      gameName,
      cartridgeApiBase: process.env.CARTRIDGE_API_BASE || DEFAULT_CARTRIDGE_API_BASE,
      toriiNamespaces: process.env.TORII_NAMESPACES || DEFAULT_NAMESPACE,
    });
    const createdIndexer = ensureSlotIndexerDeployment(indexerRequest, {
      onProgress: (message) => console.error(message),
    });
    const message =
      createdIndexer.action === "already-live"
        ? buildIndexerAlreadyLiveMessage(gameName)
        : buildIndexerCreatedMessage(gameName);
    const nextArtifacts = buildRefreshedArtifacts(resolveCurrentArtifacts(run, operation), createdIndexer.liveState);

    return {
      run: updateRunRecordForSuccess(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: createdIndexer.action === "already-live" ? "already-live" : "created",
        previousTier: createdIndexer.previousTier,
        currentTier: createdIndexer.liveState.currentTier,
        message,
      },
    };
  } catch (error) {
    const liveState = resolveSlotToriiLiveState(gameName, {
      onProgress: (message) => console.error(message),
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = buildFailureMessage(operation, errorMessage);
    const nextArtifacts = buildRefreshedArtifacts(resolveCurrentArtifacts(run, operation), liveState);

    return {
      run: updateRunRecordForFailure(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: "failed",
        currentTier: liveState.currentTier,
        message,
      },
    };
  }
}

async function applyTierOperationToRun(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): Promise<{
  run: IndexerMaintenanceRunRecord;
  result: IndexerMaintenanceResult;
}> {
  const tier = resolveTierForOperation(operation);
  const liveState = resolveSlotToriiLiveState(operation.gameName, {
    onProgress: (message) => console.error(message),
  });

  if (liveState.state !== "existing") {
    const failedAt = new Date().toISOString();
    const errorMessage =
      liveState.state === "missing"
        ? `Torii deployment "${operation.gameName}" does not exist`
        : liveState.describeError || `Unable to verify the Torii deployment state for "${operation.gameName}"`;
    const message = buildFailureMessage(operation, errorMessage);
    const nextArtifacts = buildTierFailureArtifacts(
      resolveCurrentArtifacts(run, operation),
      tier,
      failedAt,
      errorMessage,
      liveState,
    );

    return {
      run: updateRunRecordForFailure(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }

  if (liveState.currentTier === tier) {
    const message = buildAlreadyMatchedMessage(operation.gameName, tier);
    const nextArtifacts = buildTierSuccessArtifacts(resolveCurrentArtifacts(run, operation), tier, liveState);
    return {
      run: updateRunRecordForSuccess(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: "tier-already-matched",
        currentTier: liveState.currentTier,
        message,
      },
    };
  }

  const updatedIndexer = ensureSlotIndexerTier({
    name: operation.gameName,
    tier,
    onProgress: (message) => console.error(message),
  });
  const message = buildTierUpdatedMessage(operation.gameName, updatedIndexer.previousTier, tier);
  const nextArtifacts = buildTierSuccessArtifacts(
    resolveCurrentArtifacts(run, operation),
    tier,
    updatedIndexer.liveState,
  );

  return {
    run: updateRunRecordForSuccess(run, operation, message, nextArtifacts),
    result: {
      operation,
      outcome: "tier-updated",
      previousTier: updatedIndexer.previousTier,
      currentTier: updatedIndexer.liveState.currentTier,
      message,
    },
  };
}

async function applyDeleteOperationToRun(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): Promise<{
  run: IndexerMaintenanceRunRecord;
  result: IndexerMaintenanceResult;
}> {
  const currentArtifacts = resolveCurrentArtifacts(run, operation);
  const currentState = resolveSlotToriiLiveState(operation.gameName, {
    onProgress: (message) => console.error(message),
  });

  if (currentState.state === "indeterminate") {
    const errorMessage =
      currentState.describeError || `Unable to verify the Torii deployment state for "${operation.gameName}"`;
    const message = buildFailureMessage(operation, errorMessage);
    const nextArtifacts = buildDeleteFailureArtifacts(currentArtifacts, currentState);

    return {
      run: updateRunRecordForFailure(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }

  try {
    const deleteResult = deleteSlotIndexerDeployment({
      name: operation.gameName,
      onProgress: (message) => console.error(message),
    });

    if (deleteResult.action === "already-missing") {
      const message = buildIndexerAlreadyMissingMessage(operation.gameName);
      const nextArtifacts = buildDeleteSuccessArtifacts(currentArtifacts, deleteResult.liveState);

      return {
        run: updateRunRecordForSuccess(run, operation, message, nextArtifacts),
        result: {
          operation,
          outcome: "already-missing",
          previousTier: deleteResult.previousTier,
          message,
        },
      };
    }

    const message = buildIndexerDeletedMessage(operation.gameName);
    const nextArtifacts = buildDeleteSuccessArtifacts(currentArtifacts, deleteResult.liveState);

    return {
      run: updateRunRecordForSuccess(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: "deleted",
        previousTier: deleteResult.previousTier,
        message,
      },
    };
  } catch (error) {
    const failedState = resolveSlotToriiLiveState(operation.gameName, {
      onProgress: (message) => console.error(message),
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = buildFailureMessage(operation, errorMessage);
    const nextArtifacts = buildDeleteFailureArtifacts(currentArtifacts, failedState);

    return {
      run: updateRunRecordForFailure(run, operation, message, nextArtifacts),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }
}

async function processOperationGroup(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  _groupKey: string,
  operations: IndexerMaintenanceOperation[],
) {
  const recordPath = operations[0]?.recordPath;
  const currentRun = recordPath
    ? (await readGitHubBranchJsonFile<Exclude<IndexerMaintenanceRunRecord, null>>(config, recordPath)).value || null
    : null;

  if (recordPath && !currentRun) {
    throw new Error(`Could not find run record at ${recordPath}`);
  }

  let nextRun: IndexerMaintenanceRunRecord = currentRun;
  const results: IndexerMaintenanceResult[] = [];

  for (const operation of operations) {
    const applied = await applyOperationToRun(nextRun, operation);
    nextRun = applied.run;
    results.push(applied.result);
  }

  if (recordPath && nextRun) {
    await updateGitHubBranchJsonFile<Exclude<IndexerMaintenanceRunRecord, null>>(
      config,
      recordPath,
      () => nextRun as Exclude<IndexerMaintenanceRunRecord, null>,
      buildRunStoreCommitMessage(operations[operations.length - 1]!),
    );
    await recordUpdatedMaintenanceIndex(config, nextRun);
  }

  return results;
}

function formatSummaryLine(result: IndexerMaintenanceResult) {
  return `- ${result.operation.environmentId} / ${result.operation.gameName}: ${result.message}`;
}

function writeWorkflowSummary(results: IndexerMaintenanceResult[]) {
  const lines = ["# Indexer Maintenance", "", ...results.map(formatSummaryLine), ""];
  const summary = `${lines.join("\n")}\n`;
  process.stdout.write(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}

function resolveNamedSnapshotGameNames(operations: IndexerMaintenanceOperation[]) {
  const orderedGameNames: string[] = [];
  const seenGameNames = new Set<string>();

  for (const operation of operations) {
    if (!operation.gameName || seenGameNames.has(operation.gameName)) {
      continue;
    }

    seenGameNames.add(operation.gameName);
    orderedGameNames.push(operation.gameName);
  }

  return orderedGameNames;
}

async function updateLiveIndexerSnapshots(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  operations: IndexerMaintenanceOperation[],
) {
  if (operations.some((operation) => operation.action === "inspect-account")) {
    const gameNames = listSlotToriiDeploymentNames();
    const liveStates = resolveSlotToriiLiveStates(gameNames);
    await replaceFactoryLiveIndexerSnapshot(
      config,
      liveStates.map((entry) => ({
        gameName: entry.gameName,
        liveState: entry.liveState,
        updatedAt: new Date().toISOString(),
      })),
      "factory-runs: refresh live indexer snapshot",
    );
    return;
  }

  const gameNames = resolveNamedSnapshotGameNames(operations);
  if (gameNames.length === 0) {
    return;
  }

  const liveStates = resolveSlotToriiLiveStates(gameNames);
  await updateFactoryLiveIndexerSnapshotEntries(
    config,
    liveStates.map((entry) => ({
      gameName: entry.gameName,
      liveState: entry.liveState,
    })),
    `factory-runs: refresh live indexer states for ${gameNames.join(", ")}`,
  );
}

async function main() {
  const args = resolveCliArgs();
  const config = requireGitHubBranchStoreConfig();
  const groupedOperations = groupOperationsByRecordPath(args.operations);
  const results: IndexerMaintenanceResult[] = [];

  for (const [groupKey, operations] of groupedOperations.entries()) {
    const operationResults = await processOperationGroup(config, groupKey, operations);
    results.push(...operationResults);
  }

  await updateLiveIndexerSnapshots(config, args.operations);
  writeWorkflowSummary(results);
}

await main();
