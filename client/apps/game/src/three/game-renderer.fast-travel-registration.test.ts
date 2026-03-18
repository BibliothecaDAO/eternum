import { describe, expect, it } from "vitest";

import { resolveNavigationSceneTarget } from "./scene-navigation-boundary";
import { resolveSceneNameFromRouteSegment } from "./scene-route-policy";
import { SceneName } from "./types";

describe("GameRenderer fast-travel bootstrap", () => {
  it("resolves the fast-travel slug to the FastTravel scene name", () => {
    expect(resolveSceneNameFromRouteSegment(SceneName.FastTravel)).toBe(SceneName.FastTravel);
  });

  it("gates fast-travel scene activation through the navigation boundary", () => {
    // When fast travel is enabled, the boundary resolves to FastTravel
    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.FastTravel,
        fastTravelEnabled: true,
      }),
    ).toBe(SceneName.FastTravel);

    // When fast travel is disabled, the boundary falls back to WorldMap
    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.FastTravel,
        fastTravelEnabled: false,
      }),
    ).toBe(SceneName.WorldMap);
  });

  it("does not affect non-fast-travel scenes when fast travel is disabled", () => {
    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.WorldMap,
        fastTravelEnabled: false,
      }),
    ).toBe(SceneName.WorldMap);

    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.Hexception,
        fastTravelEnabled: false,
      }),
    ).toBe(SceneName.Hexception);
  });

  it("URL slug resolution feeds into navigation boundary correctly", () => {
    // Simulate the full path: URL slug → scene name → navigation boundary
    const resolved = resolveSceneNameFromRouteSegment("travel");
    const target = resolveNavigationSceneTarget({
      requestedScene: resolved,
      fastTravelEnabled: true,
    });
    expect(target).toBe(SceneName.FastTravel);
  });
});
