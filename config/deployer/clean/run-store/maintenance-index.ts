import { readGitHubBranchJsonFile, updateGitHubBranchJsonFile } from "./github";
import {
  resolveFactoryMaintenanceIndexPath,
  resolveFactoryRotationRunRecordPath,
  resolveFactoryRunRecordPath,
  resolveFactorySeriesRunRecordPath,
} from "./paths";
import type {
  FactoryGameRunMaintenanceIndexEntry,
  FactoryMaintenanceIndexKind,
  FactoryRotationRunMaintenanceIndexEntry,
  FactoryRotationRunRecord,
  FactoryRunMaintenanceIndexEntry,
  FactoryRunMaintenanceIndexRecord,
  FactoryRunRecord,
  FactoryRunStepStatus,
  FactorySeriesRunMaintenanceIndexEntry,
  FactorySeriesRunRecord,
} from "./types";

type GitHubBranchStoreConfig = Parameters<typeof updateGitHubBranchJsonFile>[0];

const RECOVERABLE_FACTORY_STEP_IDS = new Set(["create-world", "wait-for-factory-index"]);

const RECOVERABLE_FACTORY_SERIES_STEP_IDS = new Set(["create-series", "create-worlds", "wait-for-factory-indexes"]);

function resolveRecoverableFailedStepId(
  steps: Array<{ id: string; status: FactoryRunStepStatus }>,
  recoverableStepIds: Set<string>,
): string | null {
  const failedStep = steps.find((step) => step.status === "failed" && recoverableStepIds.has(step.id));
  return failedStep?.id || null;
}

function resolveRecoverablePendingStepId(
  steps: Array<{ id: string; status: FactoryRunStepStatus }>,
  currentStepId: string | null,
  recoverableStepIds: Set<string>,
): string | null {
  if (currentStepId && recoverableStepIds.has(currentStepId)) {
    const currentPendingStep = steps.find((step) => step.id === currentStepId && step.status === "pending");
    if (currentPendingStep) {
      return currentPendingStep.id;
    }
  }

  const pendingStep = steps.find((step) => step.status === "pending" && recoverableStepIds.has(step.id));
  return pendingStep?.id || null;
}

function buildGameRunMaintenanceIndexEntry(run: FactoryRunRecord): FactoryGameRunMaintenanceIndexEntry {
  return {
    kind: "game",
    environment: run.environment,
    gameName: run.gameName,
    path: resolveFactoryRunRecordPath({
      environmentId: run.environment,
      gameName: run.gameName,
    }),
    inputPath: run.inputPath,
    status: run.status,
    updatedAt: run.updatedAt,
    workflowRef: run.workflow.ref,
    currentStepId: run.currentStepId,
    activeLeaseExpiresAt: run.activeLease?.expiresAt,
    hasRunningStep: run.steps.some((step) => step.status === "running"),
    recoverableFailedStepId: resolveRecoverableFailedStepId(run.steps, RECOVERABLE_FACTORY_STEP_IDS),
    recoverablePendingStepId: resolveRecoverablePendingStepId(
      run.steps,
      run.currentStepId,
      RECOVERABLE_FACTORY_STEP_IDS,
    ),
  };
}

function buildSeriesRunMaintenanceIndexEntry(run: FactorySeriesRunRecord): FactorySeriesRunMaintenanceIndexEntry {
  return {
    kind: "series",
    environment: run.environment,
    seriesName: run.seriesName,
    path: resolveFactorySeriesRunRecordPath({
      environmentId: run.environment,
      seriesName: run.seriesName,
    }),
    inputPath: run.inputPath,
    status: run.status,
    updatedAt: run.updatedAt,
    workflowRef: run.workflow.ref,
    currentStepId: run.currentStepId,
    activeLeaseExpiresAt: run.activeLease?.expiresAt,
    hasRunningStep: run.steps.some((step) => step.status === "running"),
    recoverableFailedStepId: resolveRecoverableFailedStepId(run.steps, RECOVERABLE_FACTORY_SERIES_STEP_IDS),
    recoverablePendingStepId: resolveRecoverablePendingStepId(
      run.steps,
      run.currentStepId,
      RECOVERABLE_FACTORY_SERIES_STEP_IDS,
    ),
    autoRetry: run.autoRetry,
  };
}

function buildRotationRunMaintenanceIndexEntry(run: FactoryRotationRunRecord): FactoryRotationRunMaintenanceIndexEntry {
  return {
    kind: "rotation",
    environment: run.environment,
    rotationName: run.rotationName,
    path: resolveFactoryRotationRunRecordPath({
      environmentId: run.environment,
      rotationName: run.rotationName,
    }),
    inputPath: run.inputPath,
    status: run.status,
    updatedAt: run.updatedAt,
    workflowRef: run.workflow.ref,
    currentStepId: run.currentStepId,
    activeLeaseExpiresAt: run.activeLease?.expiresAt,
    hasRunningStep: run.steps.some((step) => step.status === "running"),
    recoverableFailedStepId: resolveRecoverableFailedStepId(run.steps, RECOVERABLE_FACTORY_SERIES_STEP_IDS),
    recoverablePendingStepId: resolveRecoverablePendingStepId(
      run.steps,
      run.currentStepId,
      RECOVERABLE_FACTORY_SERIES_STEP_IDS,
    ),
    autoRetry: run.autoRetry,
    evaluation: run.evaluation,
  };
}

function buildEmptyMaintenanceIndex(
  environment: FactoryRunRecord["environment"],
  kind: FactoryMaintenanceIndexKind,
): FactoryRunMaintenanceIndexRecord {
  return {
    version: 1,
    environment,
    kind,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

function resolveMaintenanceIndexEntryKey(entry: FactoryRunMaintenanceIndexEntry): string {
  switch (entry.kind) {
    case "game":
      return entry.gameName;
    case "series":
      return entry.seriesName;
    case "rotation":
      return entry.rotationName;
  }
}

async function recordFactoryMaintenanceIndexEntry(
  config: GitHubBranchStoreConfig,
  environment: FactoryRunRecord["environment"],
  kind: FactoryMaintenanceIndexKind,
  entry: FactoryRunMaintenanceIndexEntry,
): Promise<void> {
  const indexPath = resolveFactoryMaintenanceIndexPath(environment, kind);
  const entryKey = resolveMaintenanceIndexEntryKey(entry);

  await updateGitHubBranchJsonFile<FactoryRunMaintenanceIndexRecord>(
    config,
    indexPath,
    (currentIndex) => ({
      ...(currentIndex || buildEmptyMaintenanceIndex(environment, kind)),
      version: 1,
      environment,
      kind,
      updatedAt: entry.updatedAt,
      entries: {
        ...(currentIndex?.entries || {}),
        [entryKey]: entry,
      },
    }),
    `factory-runs: update ${kind} maintenance index for ${environment}/${entryKey}`,
  );
}

export async function removeFactoryMaintenanceIndexEntry(
  config: GitHubBranchStoreConfig,
  environment: FactoryRunRecord["environment"],
  kind: FactoryMaintenanceIndexKind,
  entryKey: string,
): Promise<void> {
  const indexPath = resolveFactoryMaintenanceIndexPath(environment, kind);
  const currentIndex = (await readGitHubBranchJsonFile<FactoryRunMaintenanceIndexRecord>(config, indexPath)).value;

  if (!currentIndex?.entries?.[entryKey]) {
    return;
  }

  await updateGitHubBranchJsonFile<FactoryRunMaintenanceIndexRecord>(
    config,
    indexPath,
    (existingIndex) => {
      const nextEntries = { ...(existingIndex?.entries || {}) };
      delete nextEntries[entryKey];

      return {
        ...(existingIndex || buildEmptyMaintenanceIndex(environment, kind)),
        version: 1,
        environment,
        kind,
        updatedAt: new Date().toISOString(),
        entries: nextEntries,
      };
    },
    `factory-runs: remove stale ${kind} maintenance index for ${environment}/${entryKey}`,
  );
}

export async function recordFactoryRunMaintenanceIndex(
  config: GitHubBranchStoreConfig,
  run: FactoryRunRecord,
): Promise<void> {
  await recordFactoryMaintenanceIndexEntry(config, run.environment, "game", buildGameRunMaintenanceIndexEntry(run));
}

export async function recordFactorySeriesMaintenanceIndex(
  config: GitHubBranchStoreConfig,
  run: FactorySeriesRunRecord,
): Promise<void> {
  await recordFactoryMaintenanceIndexEntry(config, run.environment, "series", buildSeriesRunMaintenanceIndexEntry(run));
}

export async function recordFactoryRotationMaintenanceIndex(
  config: GitHubBranchStoreConfig,
  run: FactoryRotationRunRecord,
): Promise<void> {
  await recordFactoryMaintenanceIndexEntry(
    config,
    run.environment,
    "rotation",
    buildRotationRunMaintenanceIndexEntry(run),
  );
}
