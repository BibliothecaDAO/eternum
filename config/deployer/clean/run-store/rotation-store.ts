import { DEFAULT_FACTORY_RUN_LEASE_DURATION_MS } from "../constants";
import {
  hydrateRotationLaunchSummary,
  persistRotationLaunchSummary,
  reconcileRotationLaunchSummary,
  resolveDefaultRotationRetryIntervalMinutes,
} from "../launch/rotation-summary";
import { loadRotationLaunchSummaryIfPresent, resolveRotationLaunchSummaryRelativePath } from "../launch/rotation-io";
import { resolveSeriesLaunchStepIds } from "../launch/series-plan";
import type { LaunchRotationStepId, LaunchRotationSummary, RotationLaunchStepId } from "../types";
import { createFactoryRotationRunStoreEventContext } from "./context";
import {
  updateGitHubBranchJsonFile,
  requireGitHubBranchStoreConfig,
  type ResolveGitHubBranchStoreConfigOptions,
} from "./github";
import { resolveFactoryRotationRunId, resolveFactoryRotationRunRecordPath } from "./paths";
import { resolveRotationStepTitle } from "./steps";
import type {
  FactoryRotationEvaluationState,
  FactoryRotationLaunchInputRecord,
  FactoryRotationRunRecord,
  FactoryRotationRunRequestContext,
  FactoryRotationRunStepRecord,
  FactoryRotationRunStoreEventContext,
  FactoryRunExecutionMode,
  FactoryRunStatus,
  FactoryRunStepStatus,
  FactorySeriesAutoRetryState,
} from "./types";

interface RecordFactoryRotationLaunchOptions extends ResolveGitHubBranchStoreConfigOptions {}

interface FactoryRotationLaunchEventRequest extends FactoryRotationRunRequestContext {
  stepId?: LaunchRotationStepId;
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

function buildFactoryRotationRunStep(id: LaunchRotationStepId): FactoryRotationRunStepRecord {
  const title = resolveRotationStepTitle(id);

  return {
    id,
    title,
    status: "pending",
    workflowStepName: title,
    latestEvent: "Waiting to run",
  };
}

function resolveRotationSummaryStepStatus(
  summary: LaunchRotationSummary,
  stepId: RotationLaunchStepId,
): FactoryRunStepStatus {
  if (stepId === "create-series") {
    return summary.seriesCreated ? "succeeded" : "pending";
  }

  const stepStates = summary.games.map((game) => game.steps.find((step) => step.id === stepId)).filter(Boolean);
  if (stepStates.some((step) => step?.status === "running")) {
    return "running";
  }

  if (stepStates.some((step) => step?.status === "failed")) {
    return "failed";
  }

  if (stepStates.length > 0 && stepStates.every((step) => step?.status === "succeeded")) {
    return "succeeded";
  }

  return "pending";
}

function resolveRotationSummaryStepEvent(summary: LaunchRotationSummary, stepId: RotationLaunchStepId): string {
  if (stepId === "create-series" && summary.seriesCreated) {
    return "Series is ready to accept rotation games";
  }

  switch (resolveRotationSummaryStepStatus(summary, stepId)) {
    case "running":
      return `${resolveRotationStepTitle(stepId)} is running`;
    case "failed":
      return `${resolveRotationStepTitle(stepId)} needs attention`;
    case "succeeded":
      return `${resolveRotationStepTitle(stepId)} is complete`;
    case "pending":
    default:
      return "Waiting to run";
  }
}

function buildFactoryRotationRunSteps(summary: LaunchRotationSummary): FactoryRotationRunStepRecord[] {
  return resolveSeriesLaunchStepIds(summary.environment).map((stepId) => ({
    ...buildFactoryRotationRunStep(stepId),
    status: resolveRotationSummaryStepStatus(summary, stepId),
    latestEvent: resolveRotationSummaryStepEvent(summary, stepId),
  }));
}

function buildPersistedRotationLaunchRequest(
  request: FactoryRotationRunRequestContext["request"],
  summary: LaunchRotationSummary,
): FactoryRotationRunRequestContext["request"] {
  return {
    ...request,
    rotationName: summary.rotationName,
    firstGameStartTime: summary.firstGameStartTime,
    gameIntervalMinutes: summary.gameIntervalMinutes,
    maxGames: summary.maxGames,
    advanceWindowGames: summary.advanceWindowGames,
    evaluationIntervalMinutes: summary.evaluationIntervalMinutes,
    autoRetryEnabled: summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    resumeSummary: undefined,
  };
}

function buildFactoryRotationLaunchInputRecord(
  context: FactoryRotationRunStoreEventContext,
  summary: LaunchRotationSummary,
): FactoryRotationLaunchInputRecord {
  return {
    version: 1,
    kind: "rotation",
    runId: resolveFactoryRotationRunId(context),
    launchRequestId: context.launchRequestId,
    environment: context.environmentId,
    chain: summary.chain,
    gameType: summary.gameType,
    rotationName: summary.rotationName,
    executionMode: context.executionMode,
    requestedLaunchStep: context.requestedLaunchStep,
    createdAt: context.timestamp,
    workflow: context.workflow,
    request: buildPersistedRotationLaunchRequest(context.request, summary),
  };
}

function createFactoryRotationAutoRetryState(
  summary: LaunchRotationSummary,
  current?: FactorySeriesAutoRetryState,
): FactorySeriesAutoRetryState {
  return {
    enabled: current?.cancelledAt ? false : summary.autoRetryEnabled,
    intervalMinutes: summary.autoRetryIntervalMinutes,
    nextRetryAt: current?.nextRetryAt,
    lastRetryAt: current?.lastRetryAt,
    cancelledAt: current?.cancelledAt,
    cancelReason: current?.cancelReason,
  };
}

function createFactoryRotationEvaluationState(
  summary: LaunchRotationSummary,
  timestamp: string,
  current?: FactoryRotationEvaluationState,
): FactoryRotationEvaluationState {
  return {
    intervalMinutes: summary.evaluationIntervalMinutes,
    nextEvaluationAt:
      current?.nextEvaluationAt ||
      new Date(Date.parse(timestamp) + summary.evaluationIntervalMinutes * 60_000).toISOString(),
    lastEvaluatedAt: current?.lastEvaluatedAt,
    lastNudgedAt: current?.lastNudgedAt,
  };
}

function createFactoryRotationRunRecord(
  context: FactoryRotationRunStoreEventContext,
  summary: LaunchRotationSummary,
): FactoryRotationRunRecord {
  return {
    version: 1,
    kind: "rotation",
    runId: resolveFactoryRotationRunId(context),
    environment: context.environmentId,
    chain: summary.chain,
    gameType: summary.gameType,
    rotationName: summary.rotationName,
    seriesName: summary.seriesName,
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
    autoRetry: createFactoryRotationAutoRetryState(summary),
    evaluation: createFactoryRotationEvaluationState(summary, context.timestamp),
    steps: buildFactoryRotationRunSteps(summary),
    summary,
    artifacts: {
      summaryPath: summary.outputPath,
      seriesCreated: summary.seriesCreated,
      seriesCreatedAt: summary.seriesCreatedAt,
    },
  };
}

function updateFactoryRotationRunContext(
  current: FactoryRotationRunRecord,
  context: FactoryRotationRunStoreEventContext,
  summary: LaunchRotationSummary,
): FactoryRotationRunRecord {
  return {
    ...current,
    rotationName: summary.rotationName,
    seriesName: summary.seriesName,
    requestedLaunchStep: context.requestedLaunchStep,
    executionMode: context.executionMode,
    inputPath: context.inputPath,
    latestLaunchRequestId: context.launchRequestId,
    updatedAt: context.timestamp,
    workflow: context.workflow,
    autoRetry: createFactoryRotationAutoRetryState(summary, current.autoRetry),
    evaluation: createFactoryRotationEvaluationState(summary, context.timestamp, current.evaluation),
  };
}

function buildFactoryRotationRunLease(context: FactoryRotationRunStoreEventContext, stepId: LaunchRotationStepId) {
  return {
    launchRequestId: context.launchRequestId,
    workflowRunId: context.workflow.workflowRunId,
    workflowRunAttempt: context.workflow.workflowRunAttempt,
    stepId,
    acquiredAt: context.timestamp,
    expiresAt: new Date(Date.parse(context.timestamp) + resolveFactoryRunLeaseDurationMs()).toISOString(),
  };
}

function markRotationStepStatus(
  steps: FactoryRotationRunStepRecord[],
  stepId: LaunchRotationStepId,
  status: FactoryRunStepStatus,
  latestEvent: string,
  timestamp: string,
  errorMessage?: string,
): FactoryRotationRunStepRecord[] {
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

function clearExpiredFactoryRotationRunLease(
  run: FactoryRotationRunRecord,
  timestamp: string,
): FactoryRotationRunRecord {
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

function ensureFactoryRotationRunLeaseAvailable(
  run: FactoryRotationRunRecord,
  context: FactoryRotationRunStoreEventContext,
): FactoryRotationRunRecord {
  const normalizedRun = clearExpiredFactoryRotationRunLease(run, context.timestamp);
  const activeLease = normalizedRun.activeLease;

  if (!activeLease || activeLease.launchRequestId === context.launchRequestId) {
    return normalizedRun;
  }

  const conflictTarget =
    normalizedRun.workflow.workflowUrl || normalizedRun.workflow.workflowName || "unknown workflow";
  throw new Error(
    `Another rotation launch is already running for ${context.environmentId}/${context.rotationName} during ${resolveRotationStepTitle(
      activeLease.stepId,
    )}. Active workflow: ${conflictTarget}`,
  );
}

function releaseFactoryRotationRunLease(
  run: FactoryRotationRunRecord,
  context: FactoryRotationRunStoreEventContext,
): FactoryRotationRunRecord {
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

function resolveRotationCurrentStepId(steps: FactoryRotationRunStepRecord[]): LaunchRotationStepId | null {
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

function resolveRotationRunStatus(run: FactoryRotationRunRecord): FactoryRunStatus {
  if (run.steps.some((step) => step.status === "failed")) {
    return "attention";
  }

  if (run.summary.games.length >= run.summary.maxGames && run.steps.every((step) => step.status === "succeeded")) {
    return "complete";
  }

  return "running";
}

function finalizeRotationRunRecord(run: FactoryRotationRunRecord, updatedAt: string): FactoryRotationRunRecord {
  const status = resolveRotationRunStatus(run);

  return {
    ...run,
    status,
    currentStepId: resolveRotationCurrentStepId(run.steps),
    updatedAt,
    completedAt: status === "complete" ? updatedAt : undefined,
  };
}

function buildRotationStepStartedEvent(stepId: LaunchRotationStepId): string {
  return `${resolveRotationStepTitle(stepId)} started`;
}

function buildRotationStepSucceededEvent(stepId: LaunchRotationStepId): string {
  return `${resolveRotationStepTitle(stepId)} succeeded`;
}

function buildRotationStepFailedEvent(stepId: LaunchRotationStepId, errorMessage: string | undefined): string {
  return errorMessage?.trim()
    ? `${resolveRotationStepTitle(stepId)} failed: ${errorMessage.trim()}`
    : `${resolveRotationStepTitle(stepId)} failed`;
}

function buildCommitMessage(action: string, request: { environmentId: string; rotationName: string }): string {
  return `factory-runs: ${action} for ${request.environmentId}/${request.rotationName}`;
}

function resolveRotationSummaryFromWorkspace(request: FactoryRotationRunRequestContext): LaunchRotationSummary | null {
  return loadRotationLaunchSummaryIfPresent(request.environmentId, request.rotationName);
}

function mergeRotationSummary(
  currentSummary: LaunchRotationSummary,
  nextSummary: LaunchRotationSummary | null,
): LaunchRotationSummary {
  return nextSummary || currentSummary;
}

function buildRotationAutoRetrySchedule(
  run: FactoryRotationRunRecord,
  status: FactoryRunStatus,
  timestamp: string,
): FactorySeriesAutoRetryState {
  if (!run.autoRetry.enabled || run.autoRetry.cancelledAt) {
    return run.autoRetry;
  }

  if (status === "complete") {
    return {
      ...run.autoRetry,
      nextRetryAt: undefined,
    };
  }

  if (status === "attention") {
    return {
      ...run.autoRetry,
      nextRetryAt: new Date(Date.parse(timestamp) + run.autoRetry.intervalMinutes * 60_000).toISOString(),
    };
  }

  return {
    ...run.autoRetry,
    nextRetryAt: undefined,
  };
}

function buildRotationEvaluationSchedule(
  run: FactoryRotationRunRecord,
  status: FactoryRunStatus,
  timestamp: string,
  lastNudgedAt?: string,
): FactoryRotationEvaluationState {
  if (status === "complete") {
    return {
      ...run.evaluation,
      nextEvaluationAt: undefined,
      lastEvaluatedAt: timestamp,
      lastNudgedAt: lastNudgedAt ?? run.evaluation.lastNudgedAt,
    };
  }

  return {
    ...run.evaluation,
    nextEvaluationAt: new Date(Date.parse(timestamp) + run.evaluation.intervalMinutes * 60_000).toISOString(),
    lastEvaluatedAt: timestamp,
    lastNudgedAt: lastNudgedAt ?? run.evaluation.lastNudgedAt,
  };
}

async function writeRotationLaunchInputRecord(
  context: FactoryRotationRunStoreEventContext,
  summary: LaunchRotationSummary,
  options: RecordFactoryRotationLaunchOptions,
): Promise<FactoryRotationLaunchInputRecord> {
  const config = requireGitHubBranchStoreConfig(options);
  const inputRecord = buildFactoryRotationLaunchInputRecord(context, summary);

  return updateGitHubBranchJsonFile<FactoryRotationLaunchInputRecord>(
    config,
    context.inputPath,
    () => inputRecord,
    buildCommitMessage("record rotation launch input", context),
  );
}

async function updateRotationRunRecord(
  context: FactoryRotationRunStoreEventContext,
  summary: LaunchRotationSummary,
  options: RecordFactoryRotationLaunchOptions,
  updateRecord: (current: FactoryRotationRunRecord) => FactoryRotationRunRecord,
  action: string,
): Promise<FactoryRotationRunRecord> {
  const config = requireGitHubBranchStoreConfig(options);
  const runRecordPath = resolveFactoryRotationRunRecordPath(context);

  return updateGitHubBranchJsonFile<FactoryRotationRunRecord>(
    config,
    runRecordPath,
    (current) => updateRecord(current || createFactoryRotationRunRecord(context, summary)),
    buildCommitMessage(action, context),
  );
}

async function resolvePlannedRotationSummary(request: FactoryRotationRunRequestContext["request"]) {
  const hydratedSummary = await hydrateRotationLaunchSummary(request);
  return persistRotationLaunchSummary(reconcileRotationLaunchSummary(request, hydratedSummary));
}

export async function recordFactoryRotationLaunchStarted(
  request: FactoryRotationRunRequestContext,
  options: RecordFactoryRotationLaunchOptions = {},
): Promise<FactoryRotationRunRecord> {
  const context = createFactoryRotationRunStoreEventContext(request);
  const summary = await resolvePlannedRotationSummary(request.request);
  await writeRotationLaunchInputRecord(context, summary, options);

  return updateRotationRunRecord(
    context,
    summary,
    options,
    (current) => {
      const normalizedCurrent = current
        ? ensureFactoryRotationRunLeaseAvailable(current, context)
        : createFactoryRotationRunRecord(context, summary);
      const nextRun = finalizeRotationRunRecord(
        {
          ...updateFactoryRotationRunContext(normalizedCurrent, context, summary),
          steps: buildFactoryRotationRunSteps(summary),
          summary,
          artifacts: {
            summaryPath: summary.outputPath,
            seriesCreated: summary.seriesCreated,
            seriesCreatedAt: summary.seriesCreatedAt,
          },
        },
        context.timestamp,
      );

      return {
        ...nextRun,
        autoRetry: buildRotationAutoRetrySchedule(nextRun, nextRun.status, context.timestamp),
        evaluation: buildRotationEvaluationSchedule(nextRun, nextRun.status, context.timestamp),
      };
    },
    "record rotation launch start",
  );
}

export async function recordFactoryRotationLaunchStepStarted(
  request: FactoryRotationLaunchEventRequest,
  options: RecordFactoryRotationLaunchOptions = {},
): Promise<FactoryRotationRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a started rotation step");
  }

  const context = createFactoryRotationRunStoreEventContext(request);
  const summary = request.request.resumeSummary || (await resolvePlannedRotationSummary(request.request));

  return updateRotationRunRecord(
    context,
    summary,
    options,
    (current) =>
      finalizeRotationRunRecord(
        {
          ...updateFactoryRotationRunContext(
            ensureFactoryRotationRunLeaseAvailable(current, context),
            context,
            current.summary,
          ),
          activeLease: buildFactoryRotationRunLease(context, request.stepId),
          steps: markRotationStepStatus(
            current.steps,
            request.stepId,
            "running",
            buildRotationStepStartedEvent(request.stepId),
            context.timestamp,
          ),
          summary: current.summary,
          autoRetry: {
            ...current.autoRetry,
            nextRetryAt: undefined,
          },
        },
        context.timestamp,
      ),
    `start ${request.stepId}`,
  );
}

export async function recordFactoryRotationLaunchStepSucceeded(
  request: FactoryRotationLaunchEventRequest,
  options: RecordFactoryRotationLaunchOptions = {},
): Promise<FactoryRotationRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a successful rotation step");
  }

  const context = createFactoryRotationRunStoreEventContext(request);

  return updateRotationRunRecord(
    context,
    await resolvePlannedRotationSummary(request.request),
    options,
    (current) => {
      const nextSummary = persistRotationLaunchSummary(
        mergeRotationSummary(current.summary, resolveRotationSummaryFromWorkspace(request)),
      );
      const nextRun = finalizeRotationRunRecord(
        {
          ...updateFactoryRotationRunContext(releaseFactoryRotationRunLease(current, context), context, nextSummary),
          steps: markRotationStepStatus(
            current.steps,
            request.stepId,
            "succeeded",
            buildRotationStepSucceededEvent(request.stepId),
            context.timestamp,
          ),
          summary: nextSummary,
          artifacts: {
            summaryPath:
              nextSummary.outputPath ||
              resolveRotationLaunchSummaryRelativePath(request.environmentId, request.rotationName),
            seriesCreated: nextSummary.seriesCreated,
            seriesCreatedAt: nextSummary.seriesCreatedAt,
          },
        },
        context.timestamp,
      );

      return {
        ...nextRun,
        autoRetry: buildRotationAutoRetrySchedule(nextRun, nextRun.status, context.timestamp),
        evaluation: buildRotationEvaluationSchedule(nextRun, nextRun.status, context.timestamp),
      };
    },
    `complete ${request.stepId}`,
  );
}

export async function recordFactoryRotationLaunchStepFailed(
  request: FactoryRotationLaunchEventRequest,
  options: RecordFactoryRotationLaunchOptions = {},
): Promise<FactoryRotationRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a failed rotation step");
  }

  const context = createFactoryRotationRunStoreEventContext(request);

  return updateRotationRunRecord(
    context,
    await resolvePlannedRotationSummary(request.request),
    options,
    (current) => {
      const nextSummary = mergeRotationSummary(current.summary, resolveRotationSummaryFromWorkspace(request));
      const nextRun = finalizeRotationRunRecord(
        {
          ...updateFactoryRotationRunContext(releaseFactoryRotationRunLease(current, context), context, nextSummary),
          steps: markRotationStepStatus(
            current.steps,
            request.stepId,
            "failed",
            buildRotationStepFailedEvent(request.stepId, request.errorMessage),
            context.timestamp,
            request.errorMessage,
          ),
          summary: nextSummary,
          artifacts: {
            summaryPath:
              nextSummary.outputPath ||
              resolveRotationLaunchSummaryRelativePath(request.environmentId, request.rotationName),
            seriesCreated: nextSummary.seriesCreated,
            seriesCreatedAt: nextSummary.seriesCreatedAt,
          },
        },
        context.timestamp,
      );

      return {
        ...nextRun,
        autoRetry: buildRotationAutoRetrySchedule(nextRun, nextRun.status, context.timestamp),
        evaluation: buildRotationEvaluationSchedule(nextRun, nextRun.status, context.timestamp),
      };
    },
    `fail ${request.stepId}`,
  );
}

export async function recordFactoryRotationRunNudged(
  request: FactoryRotationRunRequestContext,
  options: RecordFactoryRotationLaunchOptions = {},
): Promise<FactoryRotationRunRecord> {
  const context = createFactoryRotationRunStoreEventContext(request);
  const summary = await resolvePlannedRotationSummary(request.request);

  return updateRotationRunRecord(
    context,
    summary,
    options,
    (current) => {
      const nextRun = finalizeRotationRunRecord(
        {
          ...updateFactoryRotationRunContext(current, context, summary),
          summary,
          artifacts: {
            summaryPath: summary.outputPath,
            seriesCreated: summary.seriesCreated,
            seriesCreatedAt: summary.seriesCreatedAt,
          },
        },
        context.timestamp,
      );

      return {
        ...nextRun,
        evaluation: buildRotationEvaluationSchedule(nextRun, nextRun.status, context.timestamp, context.timestamp),
      };
    },
    "record rotation nudge",
  );
}
