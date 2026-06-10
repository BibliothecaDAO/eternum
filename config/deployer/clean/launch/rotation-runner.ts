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

async function resolvePlannedRotationSummary(request: LaunchRotationRequest): Promise<LaunchRotationSummary> {
  const hydratedSummary = await hydrateRotationLaunchSummary(request);
  return persistRotationLaunchSummary(reconcileRotationLaunchSummary(request, hydratedSummary));
}

async function executeRotationStep(
  request: LaunchRotationStepRequest,
  summary: LaunchRotationSummary,
): Promise<LaunchRotationSummary> {
  if (request.stepId === "create-series") {
    return createSeriesIfNeededForSeriesLikeSummary(request, summary, persistRotationLaunchSummary);
  }

  return runGroupedSeriesLikeGameStep({
    request,
    summary,
    stepId: request.stepId,
    persistSummary: persistRotationLaunchSummary,
  });
}

function buildDryRunRotationSummary(
  request: LaunchRotationRequest,
  summary: LaunchRotationSummary,
): LaunchRotationSummary {
  return persistRotationLaunchSummary({
    ...summary,
    autoRetryEnabled: request.autoRetryEnabled ?? true,
    autoRetryIntervalMinutes: resolveDefaultRotationRetryIntervalMinutes(request),
  });
}

export async function runLaunchRotationStep(request: LaunchRotationStepRequest): Promise<LaunchRotationSummary> {
  const scheduledRequest = resolveRotationRequestWithPersistedSchedule(request);
  validateRotationLaunchRequest(scheduledRequest);
  const summary = await resolvePlannedRotationSummary(scheduledRequest);

  if (scheduledRequest.dryRun) {
    return buildDryRunRotationSummary(scheduledRequest, summary);
  }

  return executeRotationStep(scheduledRequest, summary);
}

export async function launchRotation(request: LaunchRotationRequest): Promise<LaunchRotationSummary> {
  const scheduledRequest = resolveRotationRequestWithPersistedSchedule(request);
  validateRotationLaunchRequest(scheduledRequest);
  let summary = await resolvePlannedRotationSummary(scheduledRequest);

  if (scheduledRequest.dryRun) {
    return buildDryRunRotationSummary(scheduledRequest, summary);
  }

  for (const stepId of resolveSeriesLaunchStepIds(scheduledRequest.environmentId)) {
    summary = await runLaunchRotationStep({
      ...scheduledRequest,
      stepId: stepId as RotationLaunchStepId,
      resumeSummary: summary,
    });
  }

  return summary;
}
