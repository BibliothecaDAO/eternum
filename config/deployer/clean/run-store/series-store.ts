import { DEFAULT_FACTORY_RUN_LEASE_DURATION_MS } from "../constants";
import {
  buildInitialSeriesLaunchSummary,
  hydrateSeriesLaunchSummary,
  persistSeriesLaunchSummary,
  resolveDefaultSeriesRetryIntervalMinutes,
} from "../launch/series-summary";
import { loadSeriesLaunchSummaryIfPresent, resolveSeriesLaunchSummaryRelativePath } from "../launch/series-io";
import type { LaunchSeriesStepId, LaunchSeriesSummary } from "../types";
import { createFactorySeriesRunStoreEventContext } from "./context";
import {
  updateGitHubBranchJsonFile,
  requireGitHubBranchStoreConfig,
  type ResolveGitHubBranchStoreConfigOptions,
} from "./github";
import { resolveFactorySeriesRunId, resolveFactorySeriesRunRecordPath } from "./paths";
import { applyTargetedSeriesLikeGameStepStatus } from "./series-like-step-status";
import { resolveSeriesStepTitle } from "./steps";
import type {
  FactorySeriesAutoRetryState,
  FactorySeriesLaunchInputRecord,
  FactorySeriesRunRecord,
  FactorySeriesRunRequestContext,
  FactorySeriesRunStepRecord,
  FactorySeriesRunStoreEventContext,
  FactoryRunExecutionMode,
  FactoryRunStatus,
  FactoryRunStepStatus,
} from "./types";

interface RecordFactorySeriesLaunchOptions extends ResolveGitHubBranchStoreConfigOptions {}

interface FactorySeriesLaunchEventRequest extends FactorySeriesRunRequestContext {
  stepId?: LaunchSeriesStepId;
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

function buildFactorySeriesRunStep(id: LaunchSeriesStepId): FactorySeriesRunStepRecord {
  const title = resolveSeriesStepTitle(id);

  return {
    id,
    title,
    status: "pending",
    workflowStepName: title,
    latestEvent: "Waiting to run",
  };
}

function buildFactorySeriesRunSteps(summary: LaunchSeriesSummary): FactorySeriesRunStepRecord[] {
  return summary.games[0]?.steps.map((step) => buildFactorySeriesRunStep(step.id)) ?? [];
}

function resolveSeriesSummaryStepStatus(
  summary: LaunchSeriesSummary,
  stepId: LaunchSeriesStepId,
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

function resolveSeriesSummaryStepEvent(summary: LaunchSeriesSummary, stepId: LaunchSeriesStepId): string {
  if (stepId === "create-series" && summary.seriesCreated) {
    return "Series is ready to accept child games";
  }

  switch (resolveSeriesSummaryStepStatus(summary, stepId)) {
    case "running":
      return `${resolveSeriesStepTitle(stepId)} is running`;
    case "failed":
      return `${resolveSeriesStepTitle(stepId)} needs attention`;
    case "succeeded":
      return `${resolveSeriesStepTitle(stepId)} is complete`;
    case "pending":
    default:
      return "Waiting to run";
  }
}

function buildPersistedSeriesLaunchRequest(
  request: FactorySeriesRunRequestContext["request"],
  summary: LaunchSeriesSummary,
): FactorySeriesRunRequestContext["request"] {
  return {
    ...request,
    seriesName: summary.seriesName,
    autoRetryEnabled: summary.autoRetryEnabled,
    autoRetryIntervalMinutes: resolveDefaultSeriesRetryIntervalMinutes(request),
    games: summary.games.map((game) => ({
      gameName: game.gameName,
      startTime: game.startTime,
      seriesGameNumber: game.seriesGameNumber,
    })),
    targetGameNames: undefined,
    resumeSummary: undefined,
  };
}

function buildFactorySeriesLaunchInputRecord(
  context: FactorySeriesRunStoreEventContext,
  summary: LaunchSeriesSummary,
): FactorySeriesLaunchInputRecord {
  const persistedRequest = buildPersistedSeriesLaunchRequest(context.request, summary);

  return {
    version: 1,
    kind: "series",
    runId: resolveFactorySeriesRunId(context),
    launchRequestId: context.launchRequestId,
    environment: context.environmentId,
    chain: summary.chain,
    gameType: summary.gameType,
    seriesName: summary.seriesName,
    executionMode: context.executionMode,
    requestedLaunchStep: context.requestedLaunchStep,
    createdAt: context.timestamp,
    workflow: context.workflow,
    request: persistedRequest,
  };
}

function createFactorySeriesAutoRetryState(
  summary: LaunchSeriesSummary,
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

function createFactorySeriesRunRecord(
  context: FactorySeriesRunStoreEventContext,
  summary: LaunchSeriesSummary,
): FactorySeriesRunRecord {
  return {
    version: 1,
    kind: "series",
    runId: resolveFactorySeriesRunId(context),
    environment: context.environmentId,
    chain: summary.chain,
    gameType: summary.gameType,
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
    autoRetry: createFactorySeriesAutoRetryState(summary),
    steps: buildFactorySeriesRunSteps(summary),
    summary,
    artifacts: {
      summaryPath: summary.outputPath,
      seriesCreated: summary.seriesCreated,
      seriesCreatedAt: summary.seriesCreatedAt,
    },
  };
}

function updateFactorySeriesRunContext(
  current: FactorySeriesRunRecord,
  context: FactorySeriesRunStoreEventContext,
  summary: LaunchSeriesSummary,
): FactorySeriesRunRecord {
  return {
    ...current,
    seriesName: summary.seriesName,
    requestedLaunchStep: context.requestedLaunchStep,
    executionMode: context.executionMode,
    inputPath: context.inputPath,
    latestLaunchRequestId: context.launchRequestId,
    updatedAt: context.timestamp,
    workflow: context.workflow,
    autoRetry: createFactorySeriesAutoRetryState(summary, current.autoRetry),
  };
}

function buildFactorySeriesRunLease(context: FactorySeriesRunStoreEventContext, stepId: LaunchSeriesStepId) {
  return {
    launchRequestId: context.launchRequestId,
    workflowRunId: context.workflow.workflowRunId,
    workflowRunAttempt: context.workflow.workflowRunAttempt,
    stepId,
    acquiredAt: context.timestamp,
    expiresAt: new Date(Date.parse(context.timestamp) + resolveFactoryRunLeaseDurationMs()).toISOString(),
  };
}

function markSeriesStepStatus(
  steps: FactorySeriesRunStepRecord[],
  stepId: LaunchSeriesStepId,
  status: FactoryRunStepStatus,
  latestEvent: string,
  timestamp: string,
  errorMessage?: string,
): FactorySeriesRunStepRecord[] {
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

function clearExpiredFactorySeriesRunLease(run: FactorySeriesRunRecord, timestamp: string): FactorySeriesRunRecord {
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

function ensureFactorySeriesRunLeaseAvailable(
  run: FactorySeriesRunRecord,
  context: FactorySeriesRunStoreEventContext,
): FactorySeriesRunRecord {
  const normalizedRun = clearExpiredFactorySeriesRunLease(run, context.timestamp);
  const activeLease = normalizedRun.activeLease;

  if (!activeLease || activeLease.launchRequestId === context.launchRequestId) {
    return normalizedRun;
  }

  const conflictTarget =
    normalizedRun.workflow.workflowUrl || normalizedRun.workflow.workflowName || "unknown workflow";
  throw new Error(
    `Another series launch is already running for ${context.environmentId}/${context.seriesName} during ${resolveSeriesStepTitle(
      activeLease.stepId,
    )}. Active workflow: ${conflictTarget}`,
  );
}

function releaseFactorySeriesRunLease(
  run: FactorySeriesRunRecord,
  context: FactorySeriesRunStoreEventContext,
): FactorySeriesRunRecord {
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

function resolveSeriesCurrentStepId(steps: FactorySeriesRunStepRecord[]): LaunchSeriesStepId | null {
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

function resolveSeriesRunStatus(steps: FactorySeriesRunStepRecord[]): FactoryRunStatus {
  if (steps.some((step) => step.status === "failed")) {
    return "attention";
  }

  if (steps.every((step) => step.status === "succeeded")) {
    return "complete";
  }

  return "running";
}

function finalizeSeriesRunRecord(run: FactorySeriesRunRecord, updatedAt: string): FactorySeriesRunRecord {
  const status = resolveSeriesRunStatus(run.steps);

  return {
    ...run,
    status,
    currentStepId: resolveSeriesCurrentStepId(run.steps),
    updatedAt,
    completedAt: status === "complete" ? updatedAt : undefined,
  };
}

function buildSeriesStepStartedEvent(stepId: LaunchSeriesStepId): string {
  return `${resolveSeriesStepTitle(stepId)} started`;
}

function buildSeriesStepSucceededEvent(stepId: LaunchSeriesStepId): string {
  return `${resolveSeriesStepTitle(stepId)} succeeded`;
}

function buildSeriesStepFailedEvent(stepId: LaunchSeriesStepId, errorMessage: string | undefined): string {
  return errorMessage?.trim()
    ? `${resolveSeriesStepTitle(stepId)} failed: ${errorMessage.trim()}`
    : `${resolveSeriesStepTitle(stepId)} failed`;
}

function buildCommitMessage(action: string, request: { environmentId: string; seriesName: string }): string {
  return `factory-runs: ${action} for ${request.environmentId}/${request.seriesName}`;
}

function resolveSeriesSummaryFromWorkspace(request: FactorySeriesRunRequestContext): LaunchSeriesSummary | null {
  return loadSeriesLaunchSummaryIfPresent(request.environmentId, request.seriesName);
}

function mergeSeriesSummary(
  currentSummary: LaunchSeriesSummary,
  nextSummary: LaunchSeriesSummary | null,
  options: {
    stepId?: LaunchSeriesStepId;
    targetGameNames?: string[];
    status?: FactoryRunStepStatus;
    latestEvent?: string;
    timestamp?: string;
    errorMessage?: string;
  } = {},
): LaunchSeriesSummary {
  const mergedSummary = nextSummary || currentSummary;
  if (!options.stepId || !options.status || !options.latestEvent || !options.timestamp) {
    return mergedSummary;
  }

  const nextGames = applyTargetedSeriesLikeGameStepStatus({
    games: mergedSummary.games,
    stepId: options.stepId,
    targetGameNames: options.targetGameNames,
    status: options.status,
    latestEvent: options.latestEvent,
    timestamp: options.timestamp,
    errorMessage: options.errorMessage,
  });
  if (nextGames === mergedSummary.games) {
    return mergedSummary;
  }

  return {
    ...mergedSummary,
    games: nextGames,
  };
}

function buildAutoRetrySchedule(
  run: FactorySeriesRunRecord,
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

async function writeSeriesLaunchInputRecord(
  context: FactorySeriesRunStoreEventContext,
  summary: LaunchSeriesSummary,
  options: RecordFactorySeriesLaunchOptions,
): Promise<FactorySeriesLaunchInputRecord> {
  const config = requireGitHubBranchStoreConfig(options);
  const inputRecord = buildFactorySeriesLaunchInputRecord(context, summary);

  return updateGitHubBranchJsonFile<FactorySeriesLaunchInputRecord>(
    config,
    context.inputPath,
    () => inputRecord,
    buildCommitMessage("record series launch input", context),
  );
}

async function updateSeriesRunRecord(
  context: FactorySeriesRunStoreEventContext,
  summary: LaunchSeriesSummary,
  options: RecordFactorySeriesLaunchOptions,
  updateRecord: (current: FactorySeriesRunRecord) => FactorySeriesRunRecord,
  action: string,
): Promise<FactorySeriesRunRecord> {
  const config = requireGitHubBranchStoreConfig(options);
  const runRecordPath = resolveFactorySeriesRunRecordPath(context);

  return updateGitHubBranchJsonFile<FactorySeriesRunRecord>(
    config,
    runRecordPath,
    (current) => updateRecord(current || createFactorySeriesRunRecord(context, summary)),
    buildCommitMessage(action, context),
  );
}

export async function recordFactorySeriesLaunchStarted(
  request: FactorySeriesRunRequestContext,
  options: RecordFactorySeriesLaunchOptions = {},
): Promise<FactorySeriesRunRecord> {
  const context = createFactorySeriesRunStoreEventContext(request);
  const summary = await hydrateSeriesLaunchSummary(request.request);
  await writeSeriesLaunchInputRecord(context, summary, options);

  return updateSeriesRunRecord(
    context,
    summary,
    options,
    (current) =>
      finalizeSeriesRunRecord(
        {
          ...updateFactorySeriesRunContext(ensureFactorySeriesRunLeaseAvailable(current, context), context, summary),
          summary,
          artifacts: {
            summaryPath: summary.outputPath,
            seriesCreated: summary.seriesCreated,
            seriesCreatedAt: summary.seriesCreatedAt,
          },
        },
        context.timestamp,
      ),
    "record series launch start",
  );
}

export async function recordFactorySeriesLaunchStepStarted(
  request: FactorySeriesLaunchEventRequest,
  options: RecordFactorySeriesLaunchOptions = {},
): Promise<FactorySeriesRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a started series step");
  }

  const context = createFactorySeriesRunStoreEventContext(request);
  const summary = request.request.resumeSummary || buildInitialSeriesLaunchSummary(request.request);

  return updateSeriesRunRecord(
    context,
    summary,
    options,
    (current) => {
      const nextSummary = mergeSeriesSummary(current.summary, null, {
        stepId: request.stepId,
        targetGameNames: request.request.targetGameNames,
        status: "running",
        latestEvent: buildSeriesStepStartedEvent(request.stepId),
        timestamp: context.timestamp,
      });

      return finalizeSeriesRunRecord(
        {
          ...updateFactorySeriesRunContext(
            ensureFactorySeriesRunLeaseAvailable(current, context),
            context,
            nextSummary,
          ),
          activeLease: buildFactorySeriesRunLease(context, request.stepId),
          steps: markSeriesStepStatus(
            current.steps,
            request.stepId,
            "running",
            buildSeriesStepStartedEvent(request.stepId),
            context.timestamp,
          ),
          summary: nextSummary,
          autoRetry: {
            ...current.autoRetry,
            nextRetryAt: undefined,
          },
        },
        context.timestamp,
      );
    },
    `start ${request.stepId}`,
  );
}

export async function recordFactorySeriesLaunchStepSucceeded(
  request: FactorySeriesLaunchEventRequest,
  options: RecordFactorySeriesLaunchOptions = {},
): Promise<FactorySeriesRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a successful series step");
  }

  const context = createFactorySeriesRunStoreEventContext(request);

  return updateSeriesRunRecord(
    context,
    buildInitialSeriesLaunchSummary(request.request),
    options,
    (current) => {
      const nextSummary = persistSeriesLaunchSummary(
        mergeSeriesSummary(current.summary, resolveSeriesSummaryFromWorkspace(request), {
          stepId: request.stepId,
          targetGameNames: request.request.targetGameNames,
          status: "succeeded",
          latestEvent: buildSeriesStepSucceededEvent(request.stepId),
          timestamp: context.timestamp,
        }),
      );
      const nextStepStatus = resolveSeriesSummaryStepStatus(nextSummary, request.stepId);
      const nextStepEvent = resolveSeriesSummaryStepEvent(nextSummary, request.stepId);
      const nextRun = finalizeSeriesRunRecord(
        {
          ...updateFactorySeriesRunContext(releaseFactorySeriesRunLease(current, context), context, nextSummary),
          steps: markSeriesStepStatus(current.steps, request.stepId, nextStepStatus, nextStepEvent, context.timestamp),
          summary: nextSummary,
          artifacts: {
            summaryPath:
              nextSummary.outputPath ||
              resolveSeriesLaunchSummaryRelativePath(request.environmentId, request.seriesName),
            seriesCreated: nextSummary.seriesCreated,
            seriesCreatedAt: nextSummary.seriesCreatedAt,
          },
        },
        context.timestamp,
      );

      return {
        ...nextRun,
        autoRetry: buildAutoRetrySchedule(nextRun, nextRun.status, context.timestamp),
      };
    },
    `complete ${request.stepId}`,
  );
}

export async function recordFactorySeriesLaunchStepFailed(
  request: FactorySeriesLaunchEventRequest,
  options: RecordFactorySeriesLaunchOptions = {},
): Promise<FactorySeriesRunRecord> {
  if (!request.stepId) {
    throw new Error("stepId is required to record a failed series step");
  }

  const context = createFactorySeriesRunStoreEventContext(request);

  return updateSeriesRunRecord(
    context,
    buildInitialSeriesLaunchSummary(request.request),
    options,
    (current) => {
      const nextSummary = mergeSeriesSummary(current.summary, resolveSeriesSummaryFromWorkspace(request), {
        stepId: request.stepId,
        targetGameNames: request.request.targetGameNames,
        status: "failed",
        latestEvent: buildSeriesStepFailedEvent(request.stepId, request.errorMessage),
        timestamp: context.timestamp,
        errorMessage: request.errorMessage,
      });
      const nextRun = finalizeSeriesRunRecord(
        {
          ...updateFactorySeriesRunContext(releaseFactorySeriesRunLease(current, context), context, nextSummary),
          steps: markSeriesStepStatus(
            current.steps,
            request.stepId,
            "failed",
            buildSeriesStepFailedEvent(request.stepId, request.errorMessage),
            context.timestamp,
            request.errorMessage,
          ),
          summary: nextSummary,
          artifacts: {
            summaryPath:
              nextSummary.outputPath ||
              resolveSeriesLaunchSummaryRelativePath(request.environmentId, request.seriesName),
            seriesCreated: nextSummary.seriesCreated,
            seriesCreatedAt: nextSummary.seriesCreatedAt,
          },
        },
        context.timestamp,
      );

      return {
        ...nextRun,
        autoRetry: buildAutoRetrySchedule(nextRun, nextRun.status, context.timestamp),
      };
    },
    `fail ${request.stepId}`,
  );
}
