#!/usr/bin/env bun
import * as fs from "node:fs";
import { DEFAULT_CARTRIDGE_API_BASE, DEFAULT_NAMESPACE, DEFAULT_INDEXER_MAINTENANCE_WORKFLOW_FILE } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { resolveFactoryGameIndexerRequest } from "../indexing/factory-indexer-request";
import {
  deleteSlotIndexerDeployment,
  ensureSlotIndexerDeployment,
  ensureSlotIndexerTier,
  listSlotToriiDeploymentNames,
  resolveSlotToriiLiveStates,
  resolveSlotToriiLiveState,
} from "../indexing/slot-torii";
import {
  deleteAwsRuntime,
  deleteAwsRuntimeGroup,
  describeAwsRuntime,
  findExpiredAwsRuntimes,
  resizeAwsRuntime,
  type AwsRuntimeLiveState,
  type AwsRuntimeRequest,
} from "../runtime/aws-runtime";
import { ensureIndexerDeployment } from "../runtime/indexer-provider";
import { resolveRuntimeProvider } from "../runtime/provider-config";
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
  removeFactoryMaintenanceIndexEntry,
  recordFactoryRotationMaintenanceIndex,
  recordFactoryRunMaintenanceIndex,
  recordFactorySeriesMaintenanceIndex,
} from "../run-store/maintenance-index";
import {
  applyIndexerMaintenanceRunUpdates,
  type DeleteFailureIndexerMaintenanceRunUpdate,
  type DeleteSuccessIndexerMaintenanceRunUpdate,
  type IndexerMaintenanceRunUpdate,
  type RefreshIndexerMaintenanceRunUpdate,
  type TierFailureIndexerMaintenanceRunUpdate,
  type TierSuccessIndexerMaintenanceRunUpdate,
  type RuntimeDeleteFailureIndexerMaintenanceRunUpdate,
  type RuntimeDeleteSuccessIndexerMaintenanceRunUpdate,
} from "../run-store/indexer-maintenance-updates";
import type { FactoryRotationRunRecord, FactoryRunRecord, FactorySeriesRunRecord } from "../run-store/types";
import type { DeploymentEnvironmentId, IndexerTier, RuntimeProvider, RuntimeTeardownReason } from "../types";
import { requireRuntimeInstanceId } from "../runtime/runtime-identity";
import { parseArgs } from "./args";

type IndexerMaintenanceRunKind = "game" | "series" | "rotation";
type IndexerMaintenanceAction =
  | "inspect"
  | "inspect-account"
  | "create"
  | "set-tier"
  | "delete"
  | "delete-runtime-tags"
  | "sweep-expired-runtimes";
type IndexerMaintenanceRunRecord = FactoryRunRecord | FactorySeriesRunRecord | FactoryRotationRunRecord | null;
type IndexerMaintenanceLiveState = ReturnType<typeof resolveSlotToriiLiveState> | AwsRuntimeLiveState;

interface IndexerMaintenanceOperation {
  action: IndexerMaintenanceAction;
  kind?: IndexerMaintenanceRunKind;
  environmentId: string;
  recordPath?: string;
  runName?: string;
  gameName?: string;
  tier?: IndexerTier;
  reason?: RuntimeTeardownReason;
  runtimeInstanceId?: string;
  expectedDeleteAfter?: string;
}

interface IndexerMaintenanceCliArgs {
  operations: IndexerMaintenanceOperation[];
  expectedEnvironmentId?: DeploymentEnvironmentId;
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
    | "runtime-deleted"
    | "skipped-stale"
    | "runtime-swept"
    | "stale-run-removed"
    | "failed";
  previousTier?: IndexerTier;
  currentTier?: IndexerTier;
  runtimeInstanceIds?: string[];
  message: string;
}

class IndexerMaintenanceBatchError extends Error {
  constructor(
    message: string,
    readonly results: IndexerMaintenanceResult[],
  ) {
    super(message);
    this.name = "IndexerMaintenanceBatchError";
  }
}

function usage() {
  console.log(
    [
      "",
      `Usage: bun config/deployer/clean/cli/indexer-maintenance.ts --operations-file <path> --expected-environment <environment>`,
      "",
      "Operation shape:",
      '  [{"action":"inspect|inspect-account|create|set-tier|delete|delete-runtime-tags|sweep-expired-runtimes","kind":"game|series|rotation","environmentId":"slot.blitz","recordPath":"runs/...json","runName":"bltz-franky","gameName":"bltz-franky-01","tier":"pro"}]',
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
    operations: parseOperations(resolveOperationsJson(args)),
    expectedEnvironmentId: resolveExpectedEnvironment(args["expected-environment"]),
  };
}

function resolveOperationsJson(args: Record<string, string>): string | undefined {
  const operationsFile = args["operations-file"];
  if (!operationsFile) {
    return args["operations-json"];
  }

  return fs.readFileSync(operationsFile, "utf8");
}

function resolveExpectedEnvironment(value: string | undefined): DeploymentEnvironmentId | undefined {
  if (!value) {
    return undefined;
  }

  return resolveDeploymentEnvironment(value).id;
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
  const reason = `${operation.reason || ""}`.trim().toLowerCase();
  const runtimeInstanceId = `${operation.runtimeInstanceId || ""}`.trim();
  const expectedDeleteAfter = `${operation.expectedDeleteAfter || operation.deleteAfter || ""}`.trim();

  if (kind !== undefined && kind !== "game" && kind !== "series" && kind !== "rotation") {
    throw new Error(`Unsupported maintenance run kind "${kind}"`);
  }

  if (
    action !== "inspect" &&
    action !== "inspect-account" &&
    action !== "create" &&
    action !== "set-tier" &&
    action !== "delete" &&
    action !== "delete-runtime-tags" &&
    action !== "sweep-expired-runtimes"
  ) {
    throw new Error(`Unsupported maintenance action "${action}"`);
  }

  if (!environmentId) {
    throw new Error("Maintenance operations require environmentId");
  }

  if (action === "set-tier" && tier !== "basic" && tier !== "pro" && tier !== "legendary" && tier !== "epic") {
    throw new Error(`Unsupported indexer tier "${tier}"`);
  }

  if (action !== "inspect-account" && action !== "sweep-expired-runtimes" && !gameName) {
    throw new Error(`Maintenance action "${action}" requires gameName`);
  }

  if (action === "delete-runtime-tags" && (!runtimeInstanceId || !expectedDeleteAfter)) {
    throw new Error("Runtime teardown operations require runtimeInstanceId and expectedDeleteAfter");
  }

  if (runtimeInstanceId) {
    requireRuntimeInstanceId(runtimeInstanceId);
  }

  if (
    resolveMaintenanceRuntimeProvider(environmentId) === "aws" &&
    action !== "inspect-account" &&
    action !== "sweep-expired-runtimes" &&
    !runtimeInstanceId
  ) {
    throw new Error(`AWS maintenance action "${action}" requires runtimeInstanceId`);
  }

  if (resolveMaintenanceRuntimeProvider(environmentId) === "aws" && action === "delete" && !expectedDeleteAfter) {
    throw new Error('AWS maintenance action "delete" requires expectedDeleteAfter');
  }

  if (
    action !== "sweep-expired-runtimes" &&
    (recordPath || runName || kind !== undefined) &&
    (!recordPath || !runName || kind === undefined)
  ) {
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
    ...(reason === "expired" || reason === "ttl-fallback" || reason === "manual" ? { reason } : {}),
    ...(runtimeInstanceId ? { runtimeInstanceId } : {}),
    ...(expectedDeleteAfter ? { expectedDeleteAfter } : {}),
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

function buildAlreadyMatchedMessage(gameName: string, tier: IndexerTier) {
  return `Indexer tier already matched ${tier} for ${gameName}`;
}

function buildIndexerInspectedMessage(gameName: string, liveState: IndexerMaintenanceLiveState) {
  if (isLiveIndexerExisting(liveState)) {
    return `Live indexer state refreshed for ${gameName}`;
  }

  if (isLiveIndexerMissing(liveState)) {
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

function isAwsRuntimeLiveState(liveState: IndexerMaintenanceLiveState): liveState is AwsRuntimeLiveState {
  return (liveState as AwsRuntimeLiveState).provider === "aws";
}

function isLiveIndexerExisting(liveState: IndexerMaintenanceLiveState): boolean {
  return isAwsRuntimeLiveState(liveState) ? liveState.status === "existing" : liveState.state === "existing";
}

function isLiveIndexerMissing(liveState: IndexerMaintenanceLiveState): boolean {
  return isAwsRuntimeLiveState(liveState) ? liveState.status === "missing" : liveState.state === "missing";
}

function isLiveIndexerIndeterminate(liveState: IndexerMaintenanceLiveState): boolean {
  return isAwsRuntimeLiveState(liveState) ? liveState.status === "indeterminate" : liveState.state === "indeterminate";
}

function resolveLiveIndexerTier(liveState: IndexerMaintenanceLiveState): IndexerTier | undefined {
  return isAwsRuntimeLiveState(liveState) ? liveState.tier : liveState.currentTier;
}

function resolveLiveIndexerError(liveState: IndexerMaintenanceLiveState): string | undefined {
  return liveState.describeError;
}

function resolveMaintenanceRuntimeProvider(environmentId: string): RuntimeProvider {
  return resolveRuntimeProvider(resolveDeploymentEnvironment(environmentId));
}

function shouldUseAwsRuntime(operation: IndexerMaintenanceOperation): boolean {
  return resolveMaintenanceRuntimeProvider(operation.environmentId) === "aws";
}

function buildAwsRuntimeRequestForOperation(
  operation: IndexerMaintenanceOperation,
  tier?: IndexerTier,
): AwsRuntimeRequest {
  const environment = resolveDeploymentEnvironment(operation.environmentId);

  return {
    environmentId: environment.id,
    runtimeKind: "torii",
    runtimeName: operation.gameName!,
    runtimeInstanceId: operation.runtimeInstanceId,
    tier,
    domain: environment.runtimeDomain,
  };
}

function buildAwsRuntimeResizeRequest(
  operation: IndexerMaintenanceOperation,
  tier: IndexerTier,
  liveState: IndexerMaintenanceLiveState,
): AwsRuntimeRequest {
  if (!isAwsRuntimeLiveState(liveState) || !liveState.imageDigest || !liveState.exposurePolicy) {
    throw new Error(`AWS runtime "${operation.gameName}" is missing immutable desired-state metadata`);
  }

  return {
    ...buildAwsRuntimeRequestForOperation(operation, tier),
    imageDigest: liveState.imageDigest,
    exposurePolicy: liveState.exposurePolicy,
    upstreamRpcSecretArn: process.env.AWS_RUNTIME_UPSTREAM_RPC_SECRET_ARN,
    routingShard: liveState.routingShard,
  };
}

async function resolveLiveIndexerState(operation: IndexerMaintenanceOperation): Promise<IndexerMaintenanceLiveState> {
  if (shouldUseAwsRuntime(operation)) {
    return describeAwsRuntime(buildAwsRuntimeRequestForOperation(operation));
  }

  return resolveSlotToriiLiveState(operation.gameName!, {
    onProgress: (message) => console.error(message),
  });
}

function buildRefreshRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
  liveState: IndexerMaintenanceLiveState,
): RefreshIndexerMaintenanceRunUpdate {
  return {
    kind: "refresh",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: new Date().toISOString(),
    liveState,
  };
}

function buildTierSuccessRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
  tier: IndexerTier,
  liveState: IndexerMaintenanceLiveState,
): TierSuccessIndexerMaintenanceRunUpdate {
  return {
    kind: "tier-success",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: new Date().toISOString(),
    tier,
    liveState,
  };
}

function buildTierFailureRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
  tier: IndexerTier,
  failedAt: string,
  errorMessage: string,
  liveState: IndexerMaintenanceLiveState,
): TierFailureIndexerMaintenanceRunUpdate {
  return {
    kind: "tier-failure",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: failedAt,
    tier,
    failedAt,
    errorMessage,
    liveState,
  };
}

function buildDeleteSuccessRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
  liveState: IndexerMaintenanceLiveState,
): DeleteSuccessIndexerMaintenanceRunUpdate {
  return {
    kind: "delete-success",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: new Date().toISOString(),
    liveState,
  };
}

function buildDeleteFailureRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
  liveState: IndexerMaintenanceLiveState,
): DeleteFailureIndexerMaintenanceRunUpdate {
  return {
    kind: "delete-failure",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: new Date().toISOString(),
    liveState,
  };
}

function buildRuntimeDeleteSuccessRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
): RuntimeDeleteSuccessIndexerMaintenanceRunUpdate {
  return {
    kind: "runtime-delete-success",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: new Date().toISOString(),
    reason: operation.reason || "expired",
  };
}

function buildRuntimeDeleteFailureRunUpdate(
  operation: IndexerMaintenanceOperation,
  message: string,
  errorMessage: string,
): RuntimeDeleteFailureIndexerMaintenanceRunUpdate {
  return {
    kind: "runtime-delete-failure",
    target: resolveRunUpdateTarget(operation),
    message,
    updatedAt: new Date().toISOString(),
    reason: operation.reason || "expired",
    errorMessage,
  };
}

function resolveRunUpdateTarget(operation: IndexerMaintenanceOperation) {
  return {
    gameName: operation.gameName,
    recordPath: operation.recordPath,
  };
}

function resolveTierForOperation(operation: IndexerMaintenanceOperation): IndexerTier {
  if (!operation.tier) {
    throw new Error(`Missing indexer tier for ${operation.gameName}`);
  }

  return operation.tier;
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

function resolveStaleMaintenanceEntryKey(operation: IndexerMaintenanceOperation): string {
  if (!operation.runName) {
    throw new Error("Stale run cleanup requires runName");
  }

  return operation.runName;
}

function resolveStaleRunLabel(operation: IndexerMaintenanceOperation): string {
  const kindLabel = operation.kind || "run";
  return `${kindLabel} "${operation.runName}"`;
}

function buildStaleRunRecordRemovedMessage(operations: IndexerMaintenanceOperation[]): string {
  const leadOperation = operations[0]!;
  const skippedOperationCount = operations.length;
  const skippedLabel = skippedOperationCount === 1 ? "operation" : "operations";

  return `Removed stale ${resolveStaleRunLabel(leadOperation)} from the ${leadOperation.environmentId} maintenance index because ${leadOperation.recordPath} no longer exists. Skipped ${skippedOperationCount} queued indexer maintenance ${skippedLabel}.`;
}

async function removeStaleRunMaintenanceIndexEntry(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  operations: IndexerMaintenanceOperation[],
): Promise<IndexerMaintenanceResult[]> {
  const leadOperation = operations[0]!;

  if (!leadOperation.kind) {
    throw new Error("Stale run cleanup requires kind");
  }

  await removeFactoryMaintenanceIndexEntry(
    config,
    leadOperation.environmentId as DeploymentEnvironmentId,
    leadOperation.kind,
    resolveStaleMaintenanceEntryKey(leadOperation),
  );

  return [
    {
      operation: leadOperation,
      outcome: "stale-run-removed",
      message: buildStaleRunRecordRemovedMessage(operations),
    },
  ];
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

async function runIndexerMaintenanceOperation(operation: IndexerMaintenanceOperation): Promise<{
  update?: IndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  if (operation.action === "sweep-expired-runtimes") {
    return runSweepExpiredRuntimesOperation(operation);
  }

  if (operation.action === "delete-runtime-tags") {
    return runDeleteRuntimeTagsOperation(operation);
  }

  if (operation.action === "inspect-account") {
    return runInspectAccountOperation(operation);
  }

  if (operation.action === "inspect") {
    return runInspectOperation(operation);
  }

  if (operation.action === "create") {
    return runCreateOperation(operation);
  }

  return operation.action === "delete" ? runDeleteOperation(operation) : runTierOperation(operation);
}

async function runDeleteRuntimeTagsOperation(operation: IndexerMaintenanceOperation): Promise<{
  update?: RuntimeDeleteSuccessIndexerMaintenanceRunUpdate | RuntimeDeleteFailureIndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  try {
    const deleteResult = await deleteAwsRuntimeGroup({
      environmentId: operation.environmentId as DeploymentEnvironmentId,
      runtimeInstanceId: operation.runtimeInstanceId!,
      expectedDeleteAfter: operation.expectedDeleteAfter!,
      gameName: operation.gameName!,
      runKind: operation.kind,
      runName: operation.runName,
    });
    const deletedCount = deleteResult.deleted.length;
    const skippedCount = deleteResult.skipped.length;

    if (deleteResult.failed.length > 0) {
      const errorMessage = deleteResult.failed.map((failure) => failure.errorMessage).join("; ");
      const message = `Runtime teardown failed for ${operation.gameName}: ${errorMessage}`;
      return {
        update: buildRuntimeDeleteFailureRunUpdate(operation, message, errorMessage),
        result: {
          operation,
          outcome: "failed",
          message,
        },
      };
    }

    if (deleteResult.outcomes.some((outcome) => outcome.status === "skipped-stale")) {
      const message = `Skipped stale or protected runtime teardown for ${operation.gameName}`;
      return {
        result: {
          operation,
          outcome: "skipped-stale",
          message,
        },
      };
    }

    const message = `Deleted ${deletedCount} tagged runtime(s) for ${operation.gameName}; skipped ${skippedCount} stale or protected runtime(s)`;
    return {
      update: buildRuntimeDeleteSuccessRunUpdate(operation, message),
      result: {
        operation,
        outcome: "runtime-deleted",
        runtimeInstanceIds: [operation.runtimeInstanceId!],
        message,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = `Runtime teardown failed for ${operation.gameName}: ${errorMessage}`;
    return {
      update: buildRuntimeDeleteFailureRunUpdate(operation, message, errorMessage),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }
}

async function runSweepExpiredRuntimesOperation(operation: IndexerMaintenanceOperation): Promise<{
  result: IndexerMaintenanceResult;
}> {
  if (operation.environmentId.startsWith("mainnet.")) {
    return {
      result: {
        operation,
        outcome: "runtime-swept",
        message: `Skipped expired runtime sweep for protected environment ${operation.environmentId}`,
      },
    };
  }

  const expiredRuntimes = await findExpiredAwsRuntimes({
    environmentId: operation.environmentId as DeploymentEnvironmentId,
  });
  const failures: string[] = [];
  const deletedRuntimeInstanceIds: string[] = [];
  let deletedCount = 0;
  let skippedCount = 0;

  for (const runtime of expiredRuntimes) {
    if (!runtime.runtimeInstanceId || !runtime.deleteAfter) {
      skippedCount += 1;
      continue;
    }
    try {
      const deleteResult = await deleteAwsRuntime({
        environmentId: operation.environmentId as DeploymentEnvironmentId,
        runtimeKind: runtime.runtimeKind,
        runtimeName: runtime.runtimeName,
        runtimeInstanceId: runtime.runtimeInstanceId,
        expectedDeleteAfter: runtime.deleteAfter,
      });
      if (deleteResult.action === "skipped-stale") {
        skippedCount += 1;
        continue;
      }
      deletedCount += 1;
      deletedRuntimeInstanceIds.push(runtime.runtimeInstanceId);
    } catch (error) {
      if (error instanceof Error && error.name === "AwsRuntimeStaleTeardownError") {
        skippedCount += 1;
        continue;
      }
      failures.push(
        `${runtime.runtimeKind}/${runtime.runtimeName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (failures.length > 0) {
    return {
      result: {
        operation,
        outcome: "failed",
        runtimeInstanceIds: deletedRuntimeInstanceIds,
        message: `Expired runtime sweep deleted ${deletedCount} runtime(s), failed ${failures.length}: ${failures.join("; ")}`,
      },
    };
  }

  return {
    result: {
      operation,
      outcome: "runtime-swept",
      runtimeInstanceIds: deletedRuntimeInstanceIds,
      message: `Expired runtime sweep deleted ${deletedCount} runtime(s) and skipped ${skippedCount} stale runtime(s) for ${operation.environmentId}`,
    },
  };
}

async function runInspectAccountOperation(operation: IndexerMaintenanceOperation): Promise<{
  update?: IndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  const providerLabel =
    resolveMaintenanceRuntimeProvider(operation.environmentId) === "aws" ? "AWS runtime" : "Slot Torii";

  return {
    result: {
      operation,
      outcome: "inspected",
      message: `Refreshed live ${providerLabel} deployments for ${operation.environmentId}`,
    },
  };
}

async function runInspectOperation(operation: IndexerMaintenanceOperation): Promise<{
  update: RefreshIndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  const gameName = operation.gameName!;
  const liveState = await resolveLiveIndexerState(operation);
  const message = buildIndexerInspectedMessage(gameName, liveState);

  return {
    update: buildRefreshRunUpdate(operation, message, liveState),
    result: {
      operation,
      outcome: "inspected",
      currentTier: resolveLiveIndexerTier(liveState),
      message,
    },
  };
}

async function runCreateOperation(operation: IndexerMaintenanceOperation): Promise<{
  update: RefreshIndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  const gameName = operation.gameName!;

  try {
    const indexerRequest = await resolveFactoryGameIndexerRequest({
      environmentId: operation.environmentId as DeploymentEnvironmentId,
      gameName,
      runtimeInstanceId: operation.runtimeInstanceId,
      cartridgeApiBase: process.env.CARTRIDGE_API_BASE || DEFAULT_CARTRIDGE_API_BASE,
      toriiNamespaces: process.env.TORII_NAMESPACES || DEFAULT_NAMESPACE,
    });
    const createdIndexer = await ensureIndexerDeployment(indexerRequest);
    const message =
      createdIndexer.action === "already-live"
        ? buildIndexerAlreadyLiveMessage(gameName)
        : buildIndexerCreatedMessage(gameName);

    return {
      update: buildRefreshRunUpdate(operation, message, createdIndexer.liveState),
      result: {
        operation,
        outcome: createdIndexer.action === "already-live" ? "already-live" : "created",
        previousTier: createdIndexer.previousTier,
        currentTier: resolveLiveIndexerTier(createdIndexer.liveState),
        message,
      },
    };
  } catch (error) {
    const liveState = await resolveLiveIndexerState(operation);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = buildFailureMessage(operation, errorMessage);

    return {
      update: buildRefreshRunUpdate(operation, message, liveState),
      result: {
        operation,
        outcome: "failed",
        currentTier: resolveLiveIndexerTier(liveState),
        message,
      },
    };
  }
}

async function runTierOperation(operation: IndexerMaintenanceOperation): Promise<{
  update: TierSuccessIndexerMaintenanceRunUpdate | TierFailureIndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  const tier = resolveTierForOperation(operation);
  const liveState = await resolveLiveIndexerState(operation);

  if (!isLiveIndexerExisting(liveState)) {
    const failedAt = new Date().toISOString();
    const errorMessage = isLiveIndexerMissing(liveState)
      ? `Torii deployment "${operation.gameName}" does not exist`
      : resolveLiveIndexerError(liveState) || `Unable to verify the Torii deployment state for "${operation.gameName}"`;
    const message = buildFailureMessage(operation, errorMessage);

    return {
      update: buildTierFailureRunUpdate(operation, message, tier, failedAt, errorMessage, liveState),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }

  if (resolveLiveIndexerTier(liveState) === tier) {
    const message = buildAlreadyMatchedMessage(operation.gameName, tier);
    return {
      update: buildTierSuccessRunUpdate(operation, message, tier, liveState),
      result: {
        operation,
        outcome: "tier-already-matched",
        currentTier: resolveLiveIndexerTier(liveState),
        message,
      },
    };
  }

  const updatedIndexer = shouldUseAwsRuntime(operation)
    ? await resizeAwsRuntime(buildAwsRuntimeResizeRequest(operation, tier, liveState))
    : ensureSlotIndexerTier({
        name: operation.gameName,
        tier,
        onProgress: (message) => console.error(message),
      });
  const message = buildTierUpdatedMessage(operation.gameName, updatedIndexer.previousTier, tier);

  return {
    update: buildTierSuccessRunUpdate(operation, message, tier, updatedIndexer.liveState),
    result: {
      operation,
      outcome: "tier-updated",
      previousTier: updatedIndexer.previousTier,
      currentTier: resolveLiveIndexerTier(updatedIndexer.liveState),
      message,
    },
  };
}

async function runDeleteOperation(operation: IndexerMaintenanceOperation): Promise<{
  update: DeleteSuccessIndexerMaintenanceRunUpdate | DeleteFailureIndexerMaintenanceRunUpdate;
  result: IndexerMaintenanceResult;
}> {
  const currentState = await resolveLiveIndexerState(operation);

  if (isLiveIndexerIndeterminate(currentState)) {
    const errorMessage =
      resolveLiveIndexerError(currentState) ||
      `Unable to verify the Torii deployment state for "${operation.gameName}"`;
    const message = buildFailureMessage(operation, errorMessage);

    return {
      update: buildDeleteFailureRunUpdate(operation, message, currentState),
      result: {
        operation,
        outcome: "failed",
        message,
      },
    };
  }

  try {
    const deleteResult = shouldUseAwsRuntime(operation)
      ? await deleteAwsRuntime({
          ...buildAwsRuntimeRequestForOperation(operation),
          expectedDeleteAfter: operation.expectedDeleteAfter,
        })
      : deleteSlotIndexerDeployment({
          name: operation.gameName,
          onProgress: (message) => console.error(message),
        });

    if (deleteResult.action === "skipped-stale") {
      const message = `Skipped stale runtime teardown for ${operation.gameName}; the live lifecycle changed`;
      return {
        result: {
          operation,
          outcome: "skipped-stale",
          message,
        },
      };
    }

    if (deleteResult.action === "already-missing") {
      const message = buildIndexerAlreadyMissingMessage(operation.gameName);

      return {
        update: buildDeleteSuccessRunUpdate(operation, message, deleteResult.liveState),
        result: {
          operation,
          outcome: "already-missing",
          previousTier: deleteResult.previousTier,
          ...(shouldUseAwsRuntime(operation) && operation.runtimeInstanceId
            ? { runtimeInstanceIds: [operation.runtimeInstanceId] }
            : {}),
          message,
        },
      };
    }

    const message = buildIndexerDeletedMessage(operation.gameName);

    return {
      update: buildDeleteSuccessRunUpdate(operation, message, deleteResult.liveState),
      result: {
        operation,
        outcome: "deleted",
        previousTier: deleteResult.previousTier,
        ...(shouldUseAwsRuntime(operation) && operation.runtimeInstanceId
          ? { runtimeInstanceIds: [operation.runtimeInstanceId] }
          : {}),
        message,
      },
    };
  } catch (error) {
    const failedState = await resolveLiveIndexerState(operation);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = buildFailureMessage(operation, errorMessage);

    return {
      update: buildDeleteFailureRunUpdate(operation, message, failedState),
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
    return removeStaleRunMaintenanceIndexEntry(config, operations);
  }

  const results: IndexerMaintenanceResult[] = [];
  const updates: IndexerMaintenanceRunUpdate[] = [];

  for (const operation of operations) {
    const staleTeardown = await resolvePersistedRuntimeTeardownResult(config, recordPath, operation);
    if (staleTeardown) {
      results.push(staleTeardown);
      continue;
    }

    const applied = await runIndexerMaintenanceOperation(operation);
    if (applied.update) {
      updates.push(applied.update);
    }
    results.push(applied.result);
  }

  if (recordPath && currentRun) {
    const nextRun = await updateGitHubBranchJsonFile<Exclude<IndexerMaintenanceRunRecord, null>>(
      config,
      recordPath,
      (latestRun) => {
        if (!latestRun) {
          throw new Error(`Could not find run record at ${recordPath}`);
        }

        return applyIndexerMaintenanceRunUpdates(latestRun, updates) as Exclude<IndexerMaintenanceRunRecord, null>;
      },
      buildRunStoreCommitMessage(operations[operations.length - 1]!),
    );

    await recordUpdatedMaintenanceIndex(config, nextRun);
  }

  return results;
}

async function resolvePersistedRuntimeTeardownResult(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  recordPath: string | undefined,
  operation: IndexerMaintenanceOperation,
): Promise<IndexerMaintenanceResult | undefined> {
  if (!isPersistedRuntimeTeardownOperation(operation) || !recordPath) {
    return undefined;
  }

  const latestRun =
    (await readGitHubBranchJsonFile<Exclude<IndexerMaintenanceRunRecord, null>>(config, recordPath)).value || null;
  if (!latestRun) {
    return {
      operation,
      outcome: "skipped-stale",
      message: `Skipped stale runtime teardown for ${operation.gameName}; the persisted run no longer exists`,
    };
  }

  return resolveStaleRuntimeTeardownResult(latestRun, operation);
}

function isPersistedRuntimeTeardownOperation(operation: IndexerMaintenanceOperation): boolean {
  return (
    operation.action === "delete-runtime-tags" || (operation.action === "delete" && shouldUseAwsRuntime(operation))
  );
}

function resolveStaleRuntimeTeardownResult(
  run: IndexerMaintenanceRunRecord,
  operation: IndexerMaintenanceOperation,
): IndexerMaintenanceResult | undefined {
  if (!run || !isPersistedRuntimeTeardownOperation(operation)) {
    return undefined;
  }

  const artifacts = resolveOperationArtifacts(run, operation.gameName);
  const runtime = artifacts?.awsRuntime;
  const currentDeleteAfter = artifacts?.runtimeTeardown?.deleteAfter || runtime?.deleteAfter;
  const isCurrent =
    runtime?.runtimeInstanceId === operation.runtimeInstanceId &&
    currentDeleteAfter === operation.expectedDeleteAfter &&
    runtime?.autoTeardown === true &&
    runtime?.lifecycleClass === "ephemeral";
  if (isCurrent) {
    return undefined;
  }

  return {
    operation,
    outcome: "skipped-stale",
    message: `Skipped stale runtime teardown for ${operation.gameName}; the persisted lifecycle or runtime identity changed`,
  };
}

function resolveOperationArtifacts(run: Exclude<IndexerMaintenanceRunRecord, null>, gameName: string | undefined) {
  if (run.kind === "game") {
    return run.gameName === gameName ? run.artifacts : undefined;
  }

  return run.summary.games.find((game) => game.gameName === gameName)?.artifacts;
}

export async function runIndexerMaintenance(args: IndexerMaintenanceCliArgs) {
  validateOperationEnvironmentBoundary(args);
  const config = requireGitHubBranchStoreConfig();
  const groupedOperations = groupOperationsByRecordPath(args.operations);
  const results: IndexerMaintenanceResult[] = [];

  for (const [groupKey, operations] of groupedOperations.entries()) {
    const operationResults = await processOperationGroup(config, groupKey, operations);
    results.push(...operationResults);
  }

  await updateLiveIndexerSnapshots(config, args.operations);
  writeWorkflowSummary(results);

  const failures = results.filter((result) => result.outcome === "failed");
  if (failures.length > 0) {
    throw new IndexerMaintenanceBatchError(
      `${failures.length} maintenance operation(s) failed: ${failures.map((failure) => failure.message).join("; ")}`,
      results,
    );
  }
  return results;
}

function validateOperationEnvironmentBoundary(args: IndexerMaintenanceCliArgs): void {
  if (!args.expectedEnvironmentId) {
    return;
  }

  const mismatched = args.operations.find((operation) => operation.environmentId !== args.expectedEnvironmentId);
  if (mismatched) {
    throw new Error(
      `Maintenance operation environment ${mismatched.environmentId} does not match selected environment ${args.expectedEnvironmentId}`,
    );
  }
}

async function main() {
  try {
    writeStructuredMaintenanceResult(await runIndexerMaintenance(resolveCliArgs()));
  } catch (error) {
    if (error instanceof IndexerMaintenanceBatchError) {
      writeStructuredMaintenanceResult(error.results);
    }
    throw error;
  }
}

if (import.meta.main) {
  await main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

function writeStructuredMaintenanceResult(results: IndexerMaintenanceResult[]): void {
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, results }, null, 2)}\n`);
}

function resolveSummaryTargetName(result: IndexerMaintenanceResult) {
  if (result.outcome === "stale-run-removed" && result.operation.runName) {
    return result.operation.runName;
  }

  if (result.operation.action === "inspect-account") {
    return "runtime-account";
  }

  return result.operation.gameName || result.operation.runName || "unknown";
}

function formatSummaryLine(result: IndexerMaintenanceResult) {
  return `- ${result.operation.environmentId} / ${resolveSummaryTargetName(result)}: ${result.message}`;
}

function writeWorkflowSummary(results: IndexerMaintenanceResult[]) {
  const lines = ["# Indexer Maintenance", "", ...results.map(formatSummaryLine), ""];
  const summary = `${lines.join("\n")}\n`;
  process.stderr.write(summary);

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
  if (operations.every((operation) => resolveMaintenanceRuntimeProvider(operation.environmentId) === "aws")) {
    return;
  }

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
