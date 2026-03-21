import { DEFAULT_FACTORY_RUN_LEASE_DURATION_MS } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { loadLaunchSummaryIfPresent, resolveLaunchSummaryRelativePath } from "../launch/io";
import type { LaunchGameStepId, LaunchGameSummary } from "../types";
import { createFactoryRunStoreEventContext } from "./context";
import {
  updateGitHubBranchJsonFile,
  requireGitHubBranchStoreConfig,
  type ResolveGitHubBranchStoreConfigOptions,
} from "./github";
import { resolveFactoryRunId, resolveFactoryRunRecordPath } from "./paths";
import { resolveLaunchStepTitle } from "./steps";
import type {
  FactoryLaunchInputRecord,
  FactoryRunArtifacts,
  FactoryRunRecord,
  FactoryRunRequestContext,
  FactoryRunStepRecord,
  FactoryRunStoreEventContext,
  FactoryRunStatus,
  FactoryRunStepStatus,
} from "./types";

interface RecordFactoryLaunchOptions extends ResolveGitHubBranchStoreConfigOptions {}

interface FactoryLaunchEventRequest extends FactoryRunRequestContext {
  stepId?: LaunchGameStepId;
  errorMessage?: string;
}

function resolveFactoryRunLeaseDurationMs(): number {
  const rawSeconds = process.env.FACTORY_RUN_LEASE_DURATION_SECONDS;
  if (!rawSeconds) {
    return DEFAULT_FACTORY_RUN_LEASE_DURATION_MS;
  }

  const parsedSeconds = Number(rawSeconds);
  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
    throw new Error(`FACTORY_RUN_LEASE_DURATION_SECONDS must be a positive number, received "${rawSeconds}"`);
  }

  return parsedSeconds * 1000;
}

function shouldIncludeVillagePassRoleStep(run: Pick<FactoryRunRecord, "gameType">): boolean {
  return run.gameType === "eternum";
}

function shouldIncludeBanksStep(run: Pick<FactoryRunRecord, "gameType">): boolean {
  return run.gameType === "eternum";
}

function shouldIncludePaymasterStep(run: Pick<FactoryRunRecord, "chain">): boolean {
  return run.chain === "mainnet";
}

function buildFactoryRoleGrantSteps(run: Pick<FactoryRunRecord, "gameType">): FactoryRunStepRecord[] {
  const steps = [buildFactoryRunStep("grant-lootchest-role")];

  if (shouldIncludeVillagePassRoleStep(run)) {
    steps.push(buildFactoryRunStep("grant-village-pass-role"));
  }

  return steps;
}

function buildFactoryBankSteps(run: Pick<FactoryRunRecord, "gameType">): FactoryRunStepRecord[] {
  if (!shouldIncludeBanksStep(run)) {
    return [];
  }

  return [buildFactoryRunStep("create-banks")];
}

function buildFactoryPaymasterSteps(run: Pick<FactoryRunRecord, "chain">): FactoryRunStepRecord[] {
  if (!shouldIncludePaymasterStep(run)) {
    return [];
  }

  return [buildFactoryRunStep("sync-paymaster")];
}

function buildFactoryRunSteps(run: Pick<FactoryRunRecord, "chain" | "gameType">): FactoryRunStepRecord[] {
  return [
    buildFactoryRunStep("create-world"),
    buildFactoryRunStep("wait-for-factory-index"),
    buildFactoryRunStep("configure-world"),
    ...buildFactoryRoleGrantSteps(run),
    ...buildFactoryBankSteps(run),
    buildFactoryRunStep("create-indexer"),
    ...buildFactoryPaymasterSteps(run),
  ];
}

function buildFactoryRunStep(id: LaunchGameStepId): FactoryRunStepRecord {
  const title = resolveLaunchStepTitle(id);

  return {
    id,
    title,
    status: "pending",
    workflowStepName: title,
    latestEvent: "Waiting to run",
  };
}

function buildLaunchInputRecord(context: FactoryRunStoreEventContext): FactoryLaunchInputRecord {
  const environment = resolveDeploymentEnvironment(context.environmentId);

  return {
    version: 1,
    runId: resolveFactoryRunId(context),
    launchRequestId: context.launchRequestId,
    environment: context.environmentId,
    chain: environment.chain,
    gameType: environment.gameType,
    gameName: context.gameName,
    executionMode: context.executionMode,
    requestedLaunchStep: context.requestedLaunchStep,
    createdAt: context.timestamp,
    workflow: context.workflow,
    request: context.request,
  };
}

function createFactoryRunRecord(context: FactoryRunStoreEventContext): FactoryRunRecord {
  const environment = resolveDeploymentEnvironment(context.environmentId);

  return {
    version: 1,
    runId: resolveFactoryRunId(context),
    environment: context.environmentId,
    chain: environment.chain,
    gameType: environment.gameType,
    gameName: context.gameName,
    status: "running",
    executionMode: context.executionMode,
    requestedLaunchStep: context.requestedLaunchStep,
    inputPath: context.inputPath,
    latestLaunchRequestId: context.launchRequestId,
    currentStepId: null,
    createdAt: context.timestamp,
    updatedAt: context.timestamp,
    workflow: context.workflow,
    activeLease: undefined,
    steps: buildFactoryRunSteps(environment),
    artifacts: {},
  };
}

function updateFactoryRunContext(current: FactoryRunRecord, context: FactoryRunStoreEventContext): FactoryRunRecord {
  return {
    ...current,
    requestedLaunchStep: context.requestedLaunchStep,
    executionMode: context.executionMode,
    inputPath: context.inputPath,
    latestLaunchRequestId: context.launchRequestId,
    updatedAt: context.timestamp,
    workflow: context.workflow,
  };
}

function buildFactoryRunLease(context: FactoryRunStoreEventContext, stepId: LaunchGameStepId) {
  return {
    launchRequestId: context.launchRequestId,
    workflowRunId: context.workflow.workflowRunId,
    workflowRunAttempt: context.workflow.workflowRunAttempt,
    stepId,
    acquiredAt: context.timestamp,
    expiresAt: new Date(Date.parse(context.timestamp) + resolveFactoryRunLeaseDurationMs()).toISOString(),
  };
}

function markStepStatus(
  steps: FactoryRunStepRecord[],
  stepId: LaunchGameStepId,
  status: FactoryRunStepStatus,
  latestEvent: string,
  timestamp: string,
  errorMessage?: string,
): FactoryRunStepRecord[] {
  return steps.map((step) => {
    if (step.id !== stepId) {
      return step;
    }

    return {
      ...step,
      status,
      latestEvent,
      startedAt: status === "running" ? timestamp : step.startedAt,
      finishedAt: status === "succeeded" || status === "failed" ? timestamp : step.finishedAt,
      errorMessage,
    };
  });
}

function clearExpiredFactoryRunLease(run: FactoryRunRecord, timestamp: string): FactoryRunRecord {
  if (!run.activeLease) {
    return run;
  }

  if (Date.parse(run.activeLease.expiresAt) > Date.parse(timestamp)) {
    return run;
  }

  return {
    ...run,
    activeLease: undefined,
  };
}

function ensureFactoryRunLeaseAvailable(run: FactoryRunRecord, context: FactoryRunStoreEventContext): FactoryRunRecord {
  const normalizedRun = clearExpiredFactoryRunLease(run, context.timestamp);
  const activeLease = normalizedRun.activeLease;

  if (!activeLease || activeLease.launchRequestId === context.launchRequestId) {
    return normalizedRun;
  }

  const conflictTarget =
    normalizedRun.workflow.workflowUrl || normalizedRun.workflow.workflowName || "unknown workflow";
  throw new Error(
    `Another launch is already running for ${context.environmentId}/${context.gameName} during ${resolveLaunchStepTitle(
      activeLease.stepId,
    )}. Active workflow: ${conflictTarget}`,
  );
}

function releaseFactoryRunLease(run: FactoryRunRecord, context: FactoryRunStoreEventContext): FactoryRunRecord {
  if (!run.activeLease) {
    return run;
  }

  if (
    run.activeLease.launchRequestId !== context.launchRequestId &&
    Date.parse(run.activeLease.expiresAt) > Date.parse(context.timestamp)
  ) {
    return run;
  }

  return {
    ...run,
    activeLease: undefined,
  };
}

function resolveCurrentStepId(steps: FactoryRunStepRecord[]): LaunchGameStepId | null {
  const runningStep = steps.find((step) => step.status === "running");
  if (runningStep) {
    return runningStep.id;
  }

  const blockedStep = steps.find((step) => step.status === "failed");
  if (blockedStep) {
    return blockedStep.id;
  }

  const pendingStep = steps.find((step) => step.status === "pending");
  return pendingStep?.id || null;
}

function resolveRunStatus(steps: FactoryRunStepRecord[]): FactoryRunStatus {
  if (steps.some((step) => step.status === "failed")) {
    return "attention";
  }

  if (steps.every((step) => step.status === "succeeded")) {
    return "complete";
  }

  return "running";
}

function mergeLaunchArtifacts(
  currentArtifacts: FactoryRunArtifacts,
  summary: LaunchGameSummary | null,
  summaryPath: string,
): FactoryRunArtifacts {
  if (!summary) {
    return currentArtifacts;
  }

  return {
    ...currentArtifacts,
    summaryPath,
    worldAddress: summary.worldAddress || currentArtifacts.worldAddress,
    createGameTxHash: summary.createGameTxHash || currentArtifacts.createGameTxHash,
    configureTxHash: summary.configureTxHash || currentArtifacts.configureTxHash,
    lootChestRoleTxHash: summary.lootChestRoleTxHash || currentArtifacts.lootChestRoleTxHash,
    villagePassRoleTxHash: summary.villagePassRoleTxHash || currentArtifacts.villagePassRoleTxHash,
    createBanksTxHash: summary.createBanksTxHash || currentArtifacts.createBanksTxHash,
    paymasterSynced: summary.paymasterSynced ?? currentArtifacts.paymasterSynced,
    indexerCreated: summary.indexerCreated || currentArtifacts.indexerCreated,
    indexerWorkflowRun: summary.indexerWorkflowRun || currentArtifacts.indexerWorkflowRun,
  };
}

function finalizeRunRecord(run: FactoryRunRecord, updatedAt: string): FactoryRunRecord {
  const status = resolveRunStatus(run.steps);

  return {
    ...run,
    status,
    currentStepId: resolveCurrentStepId(run.steps),
    updatedAt,
    completedAt: status === "complete" ? updatedAt : undefined,
  };
}

function readLaunchArtifacts(request: FactoryRunRequestContext): FactoryRunArtifacts {
  const summary = loadLaunchSummaryIfPresent(request.environmentId, request.gameName);
  return mergeLaunchArtifacts({}, summary, resolveLaunchSummaryRelativePath(request.environmentId, request.gameName));
}

function buildStepStartedEvent(stepId: LaunchGameStepId): string {
  return `${resolveLaunchStepTitle(stepId)} started`;
}

function buildStepSucceededEvent(stepId: LaunchGameStepId): string {
  return `${resolveLaunchStepTitle(stepId)} succeeded`;
}

function buildStepFailedEvent(stepId: LaunchGameStepId, errorMessage: string | undefined): string {
  return errorMessage?.trim()
    ? `${resolveLaunchStepTitle(stepId)} failed: ${errorMessage.trim()}`
    : `${resolveLaunchStepTitle(stepId)} failed`;
}

function buildCommitMessage(action: string, request: FactoryRunRequestContext): string {
  return `factory-runs: ${action} for ${request.environmentId}/${request.gameName}`;
}

async function writeLaunchInputRecord(
  context: FactoryRunStoreEventContext,
  options: RecordFactoryLaunchOptions,
): Promise<FactoryLaunchInputRecord> {
  const config = requireGitHubBranchStoreConfig(options);
  const inputRecord = buildLaunchInputRecord(context);

  return updateGitHubBranchJsonFile<FactoryLaunchInputRecord>(
    config,
    context.inputPath,
    () => inputRecord,
    buildCommitMessage("record launch input", context),
  );
}

async function updateRunRecord(
  context: FactoryRunStoreEventContext,
  options: RecordFactoryLaunchOptions,
  updateRecord: (current: FactoryRunRecord) => FactoryRunRecord,
  action: string,
): Promise<FactoryRunRecord> {
  const config = requireGitHubBranchStoreConfig(options);
  const runRecordPath = resolveFactoryRunRecordPath(context);

  return updateGitHubBranchJsonFile<FactoryRunRecord>(
    config,
    runRecordPath,
    (current) => updateRecord(current || createFactoryRunRecord(context)),
    buildCommitMessage(action, context),
  );
}

export async function recordFactoryLaunchStarted(
  request: FactoryRunRequestContext,
  options: RecordFactoryLaunchOptions = {},
): Promise<FactoryRunRecord> {
  const context = createFactoryRunStoreEventContext(request);
  await writeLaunchInputRecord(context, options);

  return updateRunRecord(
    context,
    options,
    (current) =>
      finalizeRunRecord(
        {
          ...updateFactoryRunContext(ensureFactoryRunLeaseAvailable(current, context), context),
          artifacts: {
            ...current.artifacts,
            ...readLaunchArtifacts(request),
          },
        },
        context.timestamp,
      ),
    "record launch start",
  );
}

export async function recordFactoryLaunchStepStarted(
  request: FactoryLaunchEventRequest,
  options: RecordFactoryLaunchOptions = {},
): Promise<FactoryRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a started step");
  }

  const context = createFactoryRunStoreEventContext(request);

  return updateRunRecord(
    context,
    options,
    (current) =>
      finalizeRunRecord(
        {
          ...updateFactoryRunContext(ensureFactoryRunLeaseAvailable(current, context), context),
          activeLease: buildFactoryRunLease(context, request.stepId),
          steps: markStepStatus(
            current.steps,
            request.stepId,
            "running",
            buildStepStartedEvent(request.stepId),
            context.timestamp,
          ),
        },
        context.timestamp,
      ),
    `start ${request.stepId}`,
  );
}

export async function recordFactoryLaunchStepSucceeded(
  request: FactoryLaunchEventRequest,
  options: RecordFactoryLaunchOptions = {},
): Promise<FactoryRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a successful step");
  }

  const context = createFactoryRunStoreEventContext(request);

  return updateRunRecord(
    context,
    options,
    (current) =>
      finalizeRunRecord(
        {
          ...updateFactoryRunContext(releaseFactoryRunLease(current, context), context),
          steps: markStepStatus(
            current.steps,
            request.stepId,
            "succeeded",
            buildStepSucceededEvent(request.stepId),
            context.timestamp,
          ),
          artifacts: mergeLaunchArtifacts(
            current.artifacts,
            loadLaunchSummaryIfPresent(request.environmentId, request.gameName),
            resolveLaunchSummaryRelativePath(request.environmentId, request.gameName),
          ),
        },
        context.timestamp,
      ),
    `complete ${request.stepId}`,
  );
}

export async function recordFactoryLaunchStepFailed(
  request: FactoryLaunchEventRequest,
  options: RecordFactoryLaunchOptions = {},
): Promise<FactoryRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a failed step");
  }

  const context = createFactoryRunStoreEventContext(request);

  return updateRunRecord(
    context,
    options,
    (current) =>
      finalizeRunRecord(
        {
          ...updateFactoryRunContext(releaseFactoryRunLease(current, context), context),
          steps: markStepStatus(
            current.steps,
            request.stepId,
            "failed",
            buildStepFailedEvent(request.stepId, request.errorMessage),
            context.timestamp,
            request.errorMessage,
          ),
          artifacts: mergeLaunchArtifacts(
            current.artifacts,
            loadLaunchSummaryIfPresent(request.environmentId, request.gameName),
            resolveLaunchSummaryRelativePath(request.environmentId, request.gameName),
          ),
        },
        context.timestamp,
      ),
    `fail ${request.stepId}`,
  );
}
