import type { LaunchSeriesRequest, LaunchSeriesStepId, LaunchSeriesStepRequest, LaunchSeriesSummary } from "../types";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import { createSeriesIfNeededForSeriesLikeSummary, runGroupedSeriesLikeGameStep } from "./series-like-runner";
import {
  hydrateSeriesLaunchSummary,
  persistSeriesLaunchSummary,
  resolveDefaultSeriesRetryIntervalMinutes,
  validateSeriesLaunchRequest,
} from "./series-summary";

async function executeSeriesStep(
  request: LaunchSeriesStepRequest,
  summary: LaunchSeriesSummary,
): Promise<LaunchSeriesSummary> {
  if (request.stepId === "create-series") {
    return createSeriesIfNeededForSeriesLikeSummary(request, summary, persistSeriesLaunchSummary);
  }

  return runGroupedSeriesLikeGameStep({
    request,
    summary,
    stepId: request.stepId,
    persistSummary: persistSeriesLaunchSummary,
  });
}

function buildDryRunSeriesSummary(request: LaunchSeriesRequest, summary: LaunchSeriesSummary): LaunchSeriesSummary {
  return persistSeriesLaunchSummary({
    ...summary,
    autoRetryEnabled: request.autoRetryEnabled ?? true,
    autoRetryIntervalMinutes: resolveDefaultSeriesRetryIntervalMinutes(request),
  });
}

export async function runLaunchSeriesStep(request: LaunchSeriesStepRequest): Promise<LaunchSeriesSummary> {
  validateSeriesLaunchRequest(request);
  const summary = await hydrateSeriesLaunchSummary(request);

  if (request.dryRun) {
    return buildDryRunSeriesSummary(request, summary);
  }

  return executeSeriesStep(request, summary);
}

export async function launchSeries(request: LaunchSeriesRequest): Promise<LaunchSeriesSummary> {
  validateSeriesLaunchRequest(request);
  let summary = await hydrateSeriesLaunchSummary(request);

  if (request.dryRun) {
    return buildDryRunSeriesSummary(request, summary);
  }

  for (const stepId of resolveSeriesLaunchStepIds(request.environmentId)) {
    summary = await runLaunchSeriesStep({
      ...request,
      stepId,
      resumeSummary: summary,
    });
  }

  return summary;
}
