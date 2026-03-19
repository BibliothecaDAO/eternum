import type { LaunchGameStepId } from "../types";

export function resolveLaunchStepTitle(stepId: LaunchGameStepId): string {
  switch (stepId) {
    case "create-world":
      return "Create world";
    case "wait-for-factory-index":
      return "Wait for factory index";
    case "configure-world":
      return "Configure world";
    case "grant-lootchest-role":
      return "Grant loot chest role";
    case "grant-village-pass-role":
      return "Grant village pass roles";
    case "create-banks":
      return "Create banks";
    case "create-indexer":
      return "Create indexer";
  }
}
