import { resolveSeriesLaunchStepTitle } from "../launch/series-plan";
import type { LaunchGameStepId, LaunchRotationStepId, LaunchSeriesStepId } from "../types";

export function resolveLaunchStepTitle(stepId: LaunchGameStepId): string {
  switch (stepId) {
    case "create-world":
      return "Creating world";
    case "wait-for-factory-index":
      return "Waiting for game";
  }
}

export function resolveSeriesStepTitle(stepId: LaunchSeriesStepId): string {
  return resolveSeriesLaunchStepTitle(stepId);
}

export function resolveRotationStepTitle(stepId: LaunchRotationStepId): string {
  return resolveSeriesLaunchStepTitle(stepId);
}
