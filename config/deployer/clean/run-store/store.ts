import { DEFAULT_FACTORY_RUN_LEASE_DURATION_MS, DEFAULT_GAME_LAUNCH_WORKFLOW_FILE } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { loadLaunchSummaryIfPresent, resolveLaunchSummaryRelativePath } from "../launch/io";
import type { LaunchGameStepId, LaunchGameSummary } from "../types";
import {
  updateGitHubBranchJsonFile,
  requireGitHubBranchStoreConfig,
  type ResolveGitHubBranchStoreConfigOptions,
} from "./github";
import { resolveFactoryLaunchInputPath, resolveFactoryRunId, resolveFactoryRunRecordPath } from "./paths";
import type {
  FactoryLaunchInputRecord,
  FactoryRunArtifacts,
  FactoryRunExecutionMode,
  FactoryRunRecord,
  FactoryRunRequestContext,
  FactoryRunStepRecord,
  FactoryRunStoreEventContext,
  FactoryRunStatus,
  FactoryRunStepStatus,
  LaunchWorkflowScope,
} from "./types";

interface RecordFactoryLaunchOptions extends ResolveGitHubBranchStoreConfigOptions {}

interface FactoryLaunchEventRequest extends FactoryRunRequestContext {
  stepId?: LaunchGameStepId;
  errorMessage?: string;
}

export function resolveFactoryRunExecutionMode(scope: LaunchWorkflowScope): FactoryRunExecutionMode {
  return scope === "full" ? "fast_trial" : "guided_recovery";
}

function resolveWorkflowContext() {
  const workflowRunId = resolveOptionalNumber(process.env.GITHUB_RUN_ID);
  const workflowRunAttempt = resolveOptionalNumber(process.env.GITHUB_RUN_ATTEMPT);
  const workflowUrl =
    workflowRunId && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${workflowRunId}`
      : undefined;

  return {
    workflowName: process.env.GITHUB_WORKFLOW || DEFAULT_GAME_LAUNCH_WORKFLOW_FILE,
    workflowJob: process.env.GITHUB_JOB,
    workflowRunId,
    workflowRunAttempt,
    workflowUrl,
    ref: process.env.GITHUB_REF_NAME || process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
  };
}

function resolveOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function createLaunchRequestId(): string {
  if (process.env.GITHUB_RUN_ID) {
    return `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`;
  }

  return `local-${Date.now()}`;
}

function createEventContext(request: FactoryRunRequestContext): FactoryRunStoreEventContext {
  const launchRequestId = createLaunchRequestId();

  return {
    ...request,
    launchRequestId,
    inputPath: resolveFactoryLaunchInputPath(request, launchRequestId),
    executionMode: resolveFactoryRunExecutionMode(request.requestedLaunchStep),
    timestamp: new Date().toISOString(),
    workflow: resolveWorkflowContext(),
  };
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

function buildFactoryRunSteps(gameType: FactoryRunRecord["gameType"]): FactoryRunStepRecord[] {
  const sharedSteps: FactoryRunStepRecord[] = [
    buildFactoryRunStep("create-world", "Create world"),
    buildFactoryRunStep("wait-for-factory-index", "Wait for factory index"),
    buildFactoryRunStep("configure-world", "Configure world"),
    buildFactoryRunStep("grant-lootchest-role", "Grant loot chest role"),
    buildFactoryRunStep("create-indexer", "Create indexer"),
  ];

  if (gameType !== "eternum") {
    return sharedSteps;
  }

  return [
    ...sharedSteps.slice(0, 4),
    buildFactoryRunStep("grant-village-pass-role", "Grant village pass role"),
    buildFactoryRunStep("create-banks", "Create banks"),
    sharedSteps[4],
  ];
}

function buildFactoryRunStep(id: LaunchGameStepId, title: string): FactoryRunStepRecord {
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
    steps: buildFactoryRunSteps(environment.gameType),
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
    `Another launch is already running for ${context.environmentId}/${context.gameName} during ${resolveStepTitle(
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
  return `${resolveStepTitle(stepId)} started`;
}

function buildStepSucceededEvent(stepId: LaunchGameStepId): string {
  return `${resolveStepTitle(stepId)} succeeded`;
}

function buildStepFailedEvent(stepId: LaunchGameStepId, errorMessage: string | undefined): string {
  return errorMessage?.trim()
    ? `${resolveStepTitle(stepId)} failed: ${errorMessage.trim()}`
    : `${resolveStepTitle(stepId)} failed`;
}

function resolveStepTitle(stepId: LaunchGameStepId): string {
  return {
    "create-world": "Create world",
    "wait-for-factory-index": "Wait for factory index",
    "configure-world": "Configure world",
    "grant-lootchest-role": "Grant loot chest role",
    "grant-village-pass-role": "Grant village pass role",
    "create-banks": "Create banks",
    "create-indexer": "Create indexer",
  }[stepId];
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
  const context = createEventContext(request);
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

  const context = createEventContext(request);

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

  const context = createEventContext(request);

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

  const context = createEventContext(request);

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
