import {
  isEternumDeploymentEnvironment,
  isMainnetDeploymentEnvironment,
  resolveDeploymentEnvironment,
} from "../environment";
import type { DeploymentEnvironmentId, LaunchGameStepId, LaunchSeriesStepId } from "../types";

export const SERIES_GAME_STEP_BY_GROUPED_STEP: Record<
  Exclude<LaunchSeriesStepId, "create-series">,
  LaunchGameStepId
> = {
  "create-worlds": "create-world",
  "wait-for-factory-indexes": "wait-for-factory-index",
  "configure-worlds": "configure-world",
  "grant-lootchest-roles": "grant-lootchest-role",
  "grant-village-pass-roles": "grant-village-pass-role",
  "create-banks": "create-banks",
  "create-indexers": "create-indexer",
  "sync-paymaster": "sync-paymaster",
};

export function resolveSeriesLaunchStepIds(environmentId: DeploymentEnvironmentId): LaunchSeriesStepId[] {
  const environment = resolveDeploymentEnvironment(environmentId);
  const stepIds: LaunchSeriesStepId[] = [
    "create-series",
    "create-worlds",
    "wait-for-factory-indexes",
    "configure-worlds",
    "grant-lootchest-roles",
  ];

  if (isEternumDeploymentEnvironment(environment)) {
    stepIds.push("grant-village-pass-roles", "create-banks");
  }

  stepIds.push("create-indexers");

  if (isMainnetDeploymentEnvironment(environment)) {
    stepIds.push("sync-paymaster");
  }

  return stepIds;
}

export function resolveSeriesLaunchStepTitle(stepId: LaunchSeriesStepId): string {
  switch (stepId) {
    case "create-series":
      return "Creating series";
    case "create-worlds":
      return "Creating games";
    case "wait-for-factory-indexes":
      return "Waiting for games";
    case "configure-worlds":
      return "Applying settings";
    case "grant-lootchest-roles":
      return "Setting up loot chests";
    case "grant-village-pass-roles":
      return "Setting up village pass";
    case "create-banks":
      return "Preparing banks";
    case "create-indexers":
      return "Finishing setup";
    case "sync-paymaster":
      return "Setting up gas coverage";
  }
}
