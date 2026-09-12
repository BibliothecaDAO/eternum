import { SceneName } from "./types";

interface ResolveNavigationSceneTargetInput {
  requestedScene?: SceneName;
  currentPath: string;
}

export function resolveNavigationSceneTarget(input: ResolveNavigationSceneTargetInput): SceneName {
  return input.requestedScene ?? (input.currentPath.includes("/hex") ? SceneName.Hexception : SceneName.WorldMap);
}
