import { createSeriesIfNeededForSeriesLikeSummary, runGroupedSeriesLikeGameStep } from "./series-like-runner";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import {
  hydrateRotationLaunchSummary,
  persistRotationLaunchSummary,
  reconcileRotationLaunchSummary,
  resolveDefaultRotationRetryIntervalMinutes,
  resolveRotationRequestWithPersistedSchedule,
  validateRotationLaunchRequest,
} from "./rotation-summary";
import type {
  LaunchRotationRequest,
  LaunchRotationStepRequest,
  LaunchRotationSummary,
  RotationLaunchStepId,
} from "../types";
import { fileLaunchRunStore, type LaunchRunStore } from "./run-store";

async function resolvePlannedRotationSummary(
  request: LaunchRotationRequest,
  store: LaunchRunStore,
): Promise<LaunchRotationSummary> {
  const hydratedSummary = await hydrateRotationLaunchSummary(request, store);
  return persistRotationLaunchSummary(reconcileRotationLaunchSummary(request, hydratedSummary), store);
}

async function executeRotationStep(
  request: LaunchRotationStepRequest,
  summary: LaunchRotationSummary,
  store: LaunchRunStore,
): Promise<LaunchRotationSummary> {
  const persist = (next: LaunchRotationSummary) => persistRotationLaunchSummary(next, store);
  if (request.stepId === "create-series") {
    return createSeriesIfNeededForSeriesLikeSummary(request, summary, persist);
  }

  return runGroupedSeriesLikeGameStep({
    request,
    summary,
    stepId: request.stepId,
    persistSummary: persist,
    store,
  });
}

function buildDryRunRotationSummary(
  request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
  store: LaunchRunStore,
): Promise<LaunchRotationSummary> {
  return persistRotationLaunchSummary(
    {
      ...summary,
      autoRetryEnabled: request.autoRetryEnabled ?? true,
      autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
    },
    store,
  );
}

export async function runLaunchRotationStep(
  request: LaunchRotationStepRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchRotationSummary> {
  const scheduledRequest = await resolveRotationRequestWithPersistedSchedule(request, store);
  validateRotationLaunchRequest(scheduledRequest);
  const summary = await resolvePlannedRotationSummary(scheduledRequest, store);

  if (scheduledRequest.dryRun) {
    return buildDryRunRotationSummary(scheduledRequest, summary, store);
  }

  return executeRotationStep(scheduledRequest, summary, store);
}

export async function launchRotation(
  request: LaunchRotationRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchRotationSummary> {
  const scheduledRequest = await resolveRotationRequestWithPersistedSchedule(request, store);
  validateRotationLaunchRequest(scheduledRequest);
  let summary = await resolvePlannedRotationSummary(scheduledRequest, store);

  if (scheduledRequest.dryRun) {
    return buildDryRunRotationSummary(scheduledRequest, summary, store);
  }

  for (const stepId of resolveSeriesLaunchStepIds(scheduledRequest.environmentId)) {
    summary = await runLaunchRotationStep(
      {
        ...scheduledRequest,
        stepId: stepId as RotationLaunchStepId,
        resumeSummary: summary,
      },
      store,
    );
  }

  return summary;
}
