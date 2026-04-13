import { resolvePlaySceneTarget } from "@/play/navigation/play-route-target";
import { SceneName } from "./types";

interface ResolveNavigationSceneTargetInput {
  requestedScene?: SceneName;
  currentPath: string;
  fastTravelEnabled?: boolean;
}

const FAST_TRAVEL_BOUNDARY_ENABLED = false;

export function resolveNavigationSceneTarget(input: ResolveNavigationSceneTargetInput): SceneName {
  const fastTravelEnabled = input.fastTravelEnabled ?? FAST_TRAVEL_BOUNDARY_ENABLED;
  const requestedScene =
    input.requestedScene ??
    (fastTravelEnabled && input.currentPath.includes("/travel")
      ? SceneName.FastTravel
      : input.currentPath.includes("/hex")
        ? SceneName.Hexception
        : SceneName.WorldMap);

  return resolvePlaySceneTarget(requestedScene, fastTravelEnabled) as SceneName;
}
