import type {
  LaunchRotationStepId,
  LaunchSeriesStepId,
  SeriesLaunchGameStepState,
  SeriesLaunchGameSummary,
} from "../types";

type SeriesLikeStepId = LaunchSeriesStepId | LaunchRotationStepId;
type SeriesLikeStepStatus = SeriesLaunchGameStepState["status"];

interface ApplyTargetedSeriesLikeGameStepStatusOptions {
  games: SeriesLaunchGameSummary[];
  stepId: SeriesLikeStepId;
  targetGameNames?: string[];
  status: SeriesLikeStepStatus;
  latestEvent: string;
  timestamp: string;
  errorMessage?: string;
}

export function applyTargetedSeriesLikeGameStepStatus({
  games,
  stepId,
  targetGameNames,
  status,
  latestEvent,
  timestamp,
  errorMessage,
}: ApplyTargetedSeriesLikeGameStepStatusOptions): SeriesLaunchGameSummary[] {
  const targetedGameNames = resolveTargetedSeriesLikeGameNames(targetGameNames, stepId);
  if (!targetedGameNames) {
    return games;
  }

  return games.map((game) =>
    targetedGameNames.has(game.gameName)
      ? updateSeriesLikeGameStepStatus(game, stepId, status, latestEvent, timestamp, errorMessage)
      : game,
  );
}

function resolveTargetedSeriesLikeGameNames(targetGameNames: string[] | undefined, stepId: SeriesLikeStepId) {
  if (stepId !== "create-indexers" || !targetGameNames?.length) {
    return null;
  }

  return new Set(targetGameNames);
}

function updateSeriesLikeGameStepStatus(
  game: SeriesLaunchGameSummary,
  stepId: SeriesLikeStepId,
  status: SeriesLikeStepStatus,
  latestEvent: string,
  timestamp: string,
  errorMessage?: string,
): SeriesLaunchGameSummary {
  return {
    ...game,
    currentStepId: status === "succeeded" ? null : stepId,
    status,
    latestEvent,
    steps: game.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status,
            latestEvent,
            updatedAt: timestamp,
            errorMessage,
          }
        : step,
    ),
    artifacts:
      stepId === "create-indexers" && status === "succeeded"
        ? {
            ...game.artifacts,
            indexerCreated: true,
          }
        : game.artifacts,
  };
}
