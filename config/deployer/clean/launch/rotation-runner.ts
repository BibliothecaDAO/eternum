import { createSeriesIfNeededForSeriesLikeSummary, runGroupedSeriesLikeGameStep } from "./series-like-runner";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import {
  hydrateRotationLaunchSummary,
  persistRotationLaunchSummary,
  reconcileRotationLaunchSummary,
  resolveDefaultRotationRetryIntervalMinutes,
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
  validateRotationLaunchRequest(request);
  const summary = await resolvePlannedRotationSummary(request);

  if (request.dryRun) {
    return buildDryRunRotationSummary(request, summary);
  }

  return executeRotationStep(request, summary);
}

export async function launchRotation(request: LaunchRotationRequest): Promise<LaunchRotationSummary> {
  validateRotationLaunchRequest(request);
  let summary = await resolvePlannedRotationSummary(request);

  if (request.dryRun) {
    return buildDryRunRotationSummary(request, summary);
  }

  for (const stepId of resolveSeriesLaunchStepIds(request.environmentId)) {
    summary = await runLaunchRotationStep({
      ...request,
      stepId: stepId as RotationLaunchStepId,
      resumeSummary: summary,
    });
  }

  return summary;
}
