import { SceneName } from "./types";

export function resolveSceneNameFromRouteSegment(sceneSlug: string | undefined): SceneName {
  if (sceneSlug === SceneName.WorldMap || sceneSlug === SceneName.Hexception || sceneSlug === SceneName.FastTravel) {
    return sceneSlug;
  }

  return SceneName.WorldMap;
}
