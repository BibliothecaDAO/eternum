import { SceneName } from "../types/common";

export interface WorldmapVisualTerrainRefreshLifecycleInput {
  currentChunk: string;
  currentScene: SceneName | undefined;
  hasInitialized: boolean;
  isSwitchedOff: boolean;
  rollingWindowEnabled: boolean;
}

export interface WorldmapVisualTerrainPageBuildLifecycleInput extends WorldmapVisualTerrainRefreshLifecycleInput {
  currentGeneration: number;
  currentTransitionToken: number;
  pageKey: string;
  requestGeneration: number;
  requestTransitionToken: number;
  targetPageKeys: ReadonlySet<string>;
}

export function canRefreshWorldmapVisualTerrain(input: WorldmapVisualTerrainRefreshLifecycleInput): boolean {
  return (
    input.rollingWindowEnabled &&
    !input.isSwitchedOff &&
    input.hasInitialized &&
    input.currentScene === SceneName.WorldMap &&
    input.currentChunk !== "null"
  );
}

export function shouldApplyWorldmapVisualTerrainPageBuild(
  input: WorldmapVisualTerrainPageBuildLifecycleInput,
): boolean {
  return (
    canRefreshWorldmapVisualTerrain(input) &&
    input.requestGeneration === input.currentGeneration &&
    input.requestTransitionToken === input.currentTransitionToken &&
    input.targetPageKeys.has(input.pageKey)
  );
}
