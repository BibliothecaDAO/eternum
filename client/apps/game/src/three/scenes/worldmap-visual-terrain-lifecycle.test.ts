import { describe, expect, it } from "vitest";

import {
  canRefreshWorldmapVisualTerrain,
  shouldApplyWorldmapVisualTerrainPageBuild,
} from "./worldmap-visual-terrain-lifecycle";
import { SceneName } from "../types/common";

const activeRefreshInput = {
  currentChunk: "0,0",
  currentScene: SceneName.WorldMap,
  hasInitialized: true,
  isSwitchedOff: false,
  rollingWindowEnabled: true,
};

const activeBuildInput = {
  ...activeRefreshInput,
  currentGeneration: 7,
  currentTransitionToken: 11,
  pageKey: "0,0",
  requestGeneration: 7,
  requestTransitionToken: 11,
  targetPageKeys: new Set(["0,0"]),
};

describe("worldmap visual terrain lifecycle", () => {
  it("rejects rolling terrain before the worldmap has completed initial setup", () => {
    expect(
      canRefreshWorldmapVisualTerrain({
        ...activeRefreshInput,
        hasInitialized: false,
      }),
    ).toBe(false);
  });

  it("rejects rolling terrain when another scene owns the renderer", () => {
    expect(
      canRefreshWorldmapVisualTerrain({
        ...activeRefreshInput,
        currentScene: SceneName.Hexception,
      }),
    ).toBe(false);
  });

  it("rejects rolling terrain before chunk authority is resolved", () => {
    expect(
      canRefreshWorldmapVisualTerrain({
        ...activeRefreshInput,
        currentChunk: "null",
      }),
    ).toBe(false);
  });

  it("accepts rolling terrain only for the initialized active worldmap chunk", () => {
    expect(canRefreshWorldmapVisualTerrain(activeRefreshInput)).toBe(true);
  });

  it("rejects visual page builds for stale generation, transition, or page window", () => {
    expect(
      shouldApplyWorldmapVisualTerrainPageBuild({
        ...activeBuildInput,
        requestGeneration: 6,
      }),
    ).toBe(false);
    expect(
      shouldApplyWorldmapVisualTerrainPageBuild({
        ...activeBuildInput,
        requestTransitionToken: 10,
      }),
    ).toBe(false);
    expect(
      shouldApplyWorldmapVisualTerrainPageBuild({
        ...activeBuildInput,
        pageKey: "0,24",
      }),
    ).toBe(false);
  });

  it("accepts only fully current visual page builds", () => {
    expect(shouldApplyWorldmapVisualTerrainPageBuild(activeBuildInput)).toBe(true);
  });
});
