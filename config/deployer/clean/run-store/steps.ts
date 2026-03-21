import type { LaunchGameStepId } from "../types";

export function resolveLaunchStepTitle(stepId: LaunchGameStepId): string {
  switch (stepId) {
    case "create-world":
      return "Creating world";
    case "wait-for-factory-index":
      return "Waiting for game";
    case "configure-world":
      return "Applying settings";
    case "grant-lootchest-role":
      return "Setting up loot chests";
    case "grant-village-pass-role":
      return "Setting up village pass";
    case "create-banks":
      return "Preparing banks";
    case "create-indexer":
      return "Finishing setup";
    case "sync-paymaster":
      return "Setting up gas coverage";
  }
}
