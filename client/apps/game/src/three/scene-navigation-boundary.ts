import { SceneName } from "./types";

interface ResolveNavigationSceneTargetInput {
  requestedScene?: SceneName;
  currentPath: string;
  fastTravelEnabled?: boolean;
}

export function resolveNavigationSceneTarget(input: ResolveNavigationSceneTargetInput): SceneName {
  const fastTravelEnabled = input.fastTravelEnabled === true;

  if (input.requestedScene === SceneName.WorldMap || input.requestedScene === SceneName.Hexception) {
    return input.requestedScene;
  }

  if (input.requestedScene === SceneName.FastTravel) {
    return fastTravelEnabled ? SceneName.FastTravel : SceneName.WorldMap;
  }

  if (fastTravelEnabled && input.currentPath.includes("/travel")) {
    return SceneName.FastTravel;
  }

  if (input.currentPath.includes("/hex")) {
    return SceneName.Hexception;
  }

  return SceneName.WorldMap;
}
