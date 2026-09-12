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

    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/travel?col=1&row=1",
      }),
    ).toBe(SceneName.WorldMap);
  });
});
