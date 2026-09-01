import type { LaunchSeriesRequest, LaunchSeriesStepRequest, LaunchSeriesSummary } from "../types";
import { resolveSeriesLaunchStepIds } from "./series-plan";
import { createSeriesIfNeededForSeriesLikeSummary, runGroupedSeriesLikeGameStep } from "./series-like-runner";
import {
  hydrateSeriesLaunchSummary,
  persistSeriesLaunchSummary,
  resolveDefaultSeriesRetryIntervalMinutes,
  validateSeriesLaunchRequest,
} from "./series-summary";
import { fileLaunchRunStore, type LaunchRunStore } from "./run-store";

async function executeSeriesStep(
  request: LaunchSeriesStepRequest,
  summary: LaunchSeriesSummary,
  store: LaunchRunStore,
): Promise<LaunchSeriesSummary> {
  const persist = (next: LaunchSeriesSummary) => persistSeriesLaunchSummary(next, store);
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

function buildDryRunSeriesSummary(
  request: LaunchSeriesRequest,
  summary: LaunchSeriesSummary,
  store: LaunchRunStore,
): Promise<LaunchSeriesSummary> {
  return persistSeriesLaunchSummary(
    {
      ...summary,
      autoRetryEnabled: request.autoRetryEnabled ?? true,
      autoRetryIntervalMinutes: resolveDefaultSeriesRetryIntervalMinutes(request),
    },
    store,
  );
}

export async function runLaunchSeriesStep(
  request: LaunchSeriesStepRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchSeriesSummary> {
  validateSeriesLaunchRequest(request);
  const summary = await hydrateSeriesLaunchSummary(request, store);

  if (request.dryRun) {
    return buildDryRunSeriesSummary(request, summary, store);
  }

  return executeSeriesStep(request, summary, store);
}

export async function launchSeries(
  request: LaunchSeriesRequest,
  store: LaunchRunStore = fileLaunchRunStore,
): Promise<LaunchSeriesSummary> {
  validateSeriesLaunchRequest(request);
  let summary = await hydrateSeriesLaunchSummary(request, store);

  if (request.dryRun) {
    return buildDryRunSeriesSummary(request, summary, store);
  }

  for (const stepId of resolveSeriesLaunchStepIds(request.environmentId)) {
    summary = await runLaunchSeriesStep(
      {
        ...request,
        stepId,
        resumeSummary: summary,
      },
      store,
    );
  }

  return summary;
}
