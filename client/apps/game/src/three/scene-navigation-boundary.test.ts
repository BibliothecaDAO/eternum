import { describe, expect, it } from "vitest";

import { resolveNavigationSceneTarget } from "./scene-navigation-boundary";
import { SceneName } from "./types";

describe("resolveNavigationSceneTarget", () => {
  it("honors explicit map and hex requests", () => {
    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.WorldMap,
        currentPath: "/play/hex?col=1&row=1",
      }),
    ).toBe(SceneName.WorldMap);

    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.Hexception,
        currentPath: "/play/map?col=1&row=1",
      }),
    ).toBe(SceneName.Hexception);
  });

  it("falls back to the current stable scene when fast travel is still dormant", () => {
    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.FastTravel,
        currentPath: "/play/map?col=1&row=1",
        fastTravelEnabled: false,
      }),
    ).toBe(SceneName.WorldMap);

    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/travel?col=1&row=1",
        fastTravelEnabled: false,
      }),
    ).toBe(SceneName.WorldMap);
  });

  it("can resolve fast travel once the boundary is explicitly enabled", () => {
    expect(
      resolveNavigationSceneTarget({
        requestedScene: SceneName.FastTravel,
        currentPath: "/play/map?col=1&row=1",
        fastTravelEnabled: true,
      }),
    ).toBe(SceneName.FastTravel);

    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/travel?col=1&row=1",
        fastTravelEnabled: true,
      }),
    ).toBe(SceneName.FastTravel);
  });

  it("uses the current path when no explicit scene is requested", () => {
    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/hex?col=1&row=1",
      }),
    ).toBe(SceneName.Hexception);

    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/map?col=1&row=1",
      }),
    ).toBe(SceneName.WorldMap);
  });
});
