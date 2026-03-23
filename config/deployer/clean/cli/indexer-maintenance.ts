#!/usr/bin/env bun
import * as fs from "node:fs";
import { DEFAULT_INDEXER_MAINTENANCE_WORKFLOW_FILE } from "../constants";
import { ensureSlotIndexerTier, resolveIndexerArtifactState, resolveSlotToriiLiveState } from "../indexing/slot-torii";
import {
  requireGitHubBranchStoreConfig,
  readGitHubBranchJsonFile,
  updateGitHubBranchJsonFile,
} from "../run-store/github";
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
import type { IndexerTier, SeriesLaunchGameArtifacts, SeriesLaunchGameSummary } from "../types";
import { parseArgs } from "./args";

type IndexerMaintenanceRunKind = "game" | "series" | "rotation";
type IndexerMaintenanceRunRecord = FactoryRunRecord | FactorySeriesRunRecord | FactoryRotationRunRecord;

interface IndexerMaintenanceOperation {
  kind: IndexerMaintenanceRunKind;
  environmentId: string;
  recordPath: string;
  runName: string;
  gameName: string;
  tier: IndexerTier;
}

interface IndexerMaintenanceCliArgs {
  operations: IndexerMaintenanceOperation[];
}

interface IndexerMaintenanceResult {
  operation: IndexerMaintenanceOperation;
  outcome: "tier-updated" | "tier-already-matched" | "failed";
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
      '  [{"kind":"game|series|rotation","environmentId":"slot.blitz","recordPath":"runs/...json","runName":"bltz-franky","gameName":"bltz-franky-01","tier":"pro"}]',
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
  const environmentId = `${operation.environmentId || ""}`.trim();
  const recordPath = `${operation.recordPath || ""}`.trim();
  const runName = `${operation.runName || ""}`.trim();
  const gameName = `${operation.gameName || ""}`.trim();
  const tier = `${operation.tier || ""}`.trim().toLowerCase();

  if (kind !== "game" && kind !== "series" && kind !== "rotation") {
    throw new Error(`Unsupported maintenance run kind "${kind}"`);
  }

  if (!environmentId || !recordPath || !runName || !gameName) {
    throw new Error("Maintenance operations require environmentId, recordPath, runName, and gameName");
  }

  if (tier !== "basic" && tier !== "pro" && tier !== "legendary" && tier !== "epic") {
    throw new Error(`Unsupported indexer tier "${tier}"`);
  }

  return {
    kind,
    environmentId,
    recordPath,
    runName,
    gameName,
    tier,
  };
}

function groupOperationsByRecordPath(operations: IndexerMaintenanceOperation[]) {
  const groups = new Map<string, IndexerMaintenanceOperation[]>();

  for (const operation of operations) {
    const current = groups.get(operation.recordPath) || [];
    current.push(operation);
    groups.set(operation.recordPath, current);
  }

  return groups;
}

function buildSuccessArtifacts(
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

function buildFailureArtifacts(
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

function buildAlreadyMatchedMessage(gameName: string, tier: IndexerTier) {
  return `Indexer tier already matched ${tier} for ${gameName}`;
}

function buildTierUpdatedMessage(gameName: string, previousTier: IndexerTier | undefined, nextTier: IndexerTier) {
  return `Indexer tier updated ${previousTier || "unknown"} -> ${nextTier} for ${gameName}`;
}

function buildFailureMessage(gameName: string, errorMessage: string) {
  return `Indexer maintenance failed for ${gameName}: ${errorMessage}`;
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

function updateRunRecordForSuccess(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
  message: string,
  tier: IndexerTier,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
) {
  const nextArtifacts = buildSuccessArtifacts(resolveCurrentArtifacts(run, operation), tier, liveState);

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
  failedAt: string,
  liveState: ReturnType<typeof resolveSlotToriiLiveState>,
) {
  const nextArtifacts = buildFailureArtifacts(
    resolveCurrentArtifacts(run, operation),
    operation.tier,
    failedAt,
    message,
    liveState,
  );

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

function resolveCurrentArtifacts(run: IndexerMaintenanceRunRecord, operation: IndexerMaintenanceOperation) {
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
  return `factory-runs: reconcile indexer tier for ${operation.environmentId}/${operation.gameName}`;
}

async function recordUpdatedMaintenanceIndex(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  run: IndexerMaintenanceRunRecord,
) {
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
  const liveState = resolveSlotToriiLiveState(operation.gameName, {
    onProgress: (message) => console.error(message),
  });

  if (liveState.state !== "existing") {
    const failedAt = new Date().toISOString();
    const errorMessage =
      liveState.state === "missing"
        ? `Torii deployment "${operation.gameName}" does not exist`
        : liveState.describeError || `Unable to verify the Torii deployment state for "${operation.gameName}"`;
    const message = buildFailureMessage(operation.gameName, errorMessage);

    return {
      run: updateRunRecordForFailure(run, operation, message, failedAt, liveState),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }

  if (liveState.currentTier === operation.tier) {
    const message = buildAlreadyMatchedMessage(operation.gameName, operation.tier);
    return {
      run: updateRunRecordForSuccess(run, operation, message, operation.tier, liveState),
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
    tier: operation.tier,
    onProgress: (message) => console.error(message),
  });
  const message = buildTierUpdatedMessage(operation.gameName, updatedIndexer.previousTier, operation.tier);

  return {
    run: updateRunRecordForSuccess(run, operation, message, operation.tier, updatedIndexer.liveState),
    result: {
      operation,
      outcome: "tier-updated",
      previousTier: updatedIndexer.previousTier,
      currentTier: updatedIndexer.liveState.currentTier,
      message,
    },
  };
}

async function processOperationGroup(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  recordPath: string,
  operations: IndexerMaintenanceOperation[],
) {
  const { value: currentRun } = await readGitHubBranchJsonFile<IndexerMaintenanceRunRecord>(config, recordPath);

  if (!currentRun) {
    throw new Error(`Could not find run record at ${recordPath}`);
  }

  let nextRun = currentRun;
  const results: IndexerMaintenanceResult[] = [];

  for (const operation of operations) {
    const applied = await applyOperationToRun(nextRun, operation);
    nextRun = applied.run;
    results.push(applied.result);
  }

  await updateGitHubBranchJsonFile<IndexerMaintenanceRunRecord>(
    config,
    recordPath,
    () => nextRun,
    buildRunStoreCommitMessage(operations[operations.length - 1]!),
  );
  await recordUpdatedMaintenanceIndex(config, nextRun);

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

async function main() {
  const args = resolveCliArgs();
  const config = requireGitHubBranchStoreConfig();
  const groupedOperations = groupOperationsByRecordPath(args.operations);
  const results: IndexerMaintenanceResult[] = [];

  for (const [recordPath, operations] of groupedOperations.entries()) {
    const operationResults = await processOperationGroup(config, recordPath, operations);
    results.push(...operationResults);
  }

  writeWorkflowSummary(results);
}

await main();
