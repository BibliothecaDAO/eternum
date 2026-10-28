import { type IconMeaning } from "@/ui/design-system/icon";
import { buildingMeaning } from "@/ui/design-system/domain-icon-meaning";
import { buildOrderTarget, type BuildOrderGoal } from "@bibliothecadao/eternum/automation";

/** A goal's painting, as the maker's cards and palette and the Build order panel show it. */
export const buildOrderGoalIcon = (goal: BuildOrderGoal): IconMeaning => {
  const target = buildOrderTarget(goal);
  if (target.kind === "building") return buildingMeaning(target.building);
  if (target.kind === "barracks") return "barracks";
  return target.kind === "army" ? "deploy" : "upgrade";
};
