import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveNavigationSceneTarget } from "./scene-navigation-boundary";
import { SceneName } from "./types";

function readNavigationSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const navigationPath = resolve(currentDir, "utils/navigation.ts");
  return readFileSync(navigationPath, "utf8");
}

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

  it("can still fall back to the current stable scene when fast travel is explicitly disabled", () => {
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

    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/travel?col=1&row=1",
      }),
    ).toBe(SceneName.FastTravel);
  });

  it("can still keep fast travel dormant when the boundary override disables it", () => {
    expect(
      resolveNavigationSceneTarget({
        currentPath: "/play/travel?col=1&row=1",
        fastTravelEnabled: false,
      }),
    ).toBe(SceneName.WorldMap);
  });

  it("keeps dormant fast-travel policy owned by the boundary instead of navigation helpers", () => {
    const source = readNavigationSource();

    expect(source).not.toMatch(/fastTravelEnabled:\s*false/);
  });
});
