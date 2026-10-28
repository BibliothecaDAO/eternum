import { type IconMeaning } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { blitzBuildingResource, buildOrderTarget, type BuildOrderGoal } from "@bibliothecadao/eternum/automation";
import { BuildingType } from "@bibliothecadao/types";

/** A Blitz building's painting: the farm and the worker hut their own, every other building what it makes. */
export const blitzBuildingIcon = (building: BuildingType): IconMeaning => {
  if (building === BuildingType.ResourceWheat) return "farm";
  if (building === BuildingType.WorkersHut) return "workers-hut";
  const resource = blitzBuildingResource(building);
  if (resource === undefined) throw new Error(`Blitz has no building ${building}`);
  return resourceMeaning(resource);
};

/** A goal's painting, as the maker's cards and palette and the Build order panel show it. */
export const buildOrderGoalIcon = (goal: BuildOrderGoal): IconMeaning => {
  const target = buildOrderTarget(goal);
  if (target.kind === "building") return blitzBuildingIcon(target.building);
  if (target.kind === "barracks") return "barracks";
  return target.kind === "army" ? "deploy" : "upgrade";
};
