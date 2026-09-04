import type { DeploymentEnvironmentId, LaunchGameStepId, LaunchSeriesStepId } from "../types";

export const SERIES_GAME_STEP_BY_GROUPED_STEP: Record<
  Exclude<LaunchSeriesStepId, "create-series">,
  LaunchGameStepId
> = {
  "create-worlds": "create-world",
  "wait-for-factory-indexes": "wait-for-factory-index",
};

export function resolveSeriesLaunchStepIds(_environmentId: DeploymentEnvironmentId): LaunchSeriesStepId[] {
  return ["create-series", "create-worlds", "wait-for-factory-indexes"];
}

export function resolveSeriesLaunchStepTitle(stepId: LaunchSeriesStepId): string {
  switch (stepId) {
    case "create-series":
      return "Creating series";
    case "create-worlds":
      return "Creating games";
    case "wait-for-factory-indexes":
      return "Waiting for games";
  }
}
