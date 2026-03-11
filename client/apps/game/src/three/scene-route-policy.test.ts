import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveSceneNameFromRouteSegment } from "./scene-route-policy";
import { SceneName } from "./types";

function readGameRendererSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const rendererPath = resolve(currentDir, "game-renderer.ts");
  return readFileSync(rendererPath, "utf8");
}

describe("resolveSceneNameFromRouteSegment", () => {
  it("keeps existing world and hex scene slugs stable", () => {
    expect(resolveSceneNameFromRouteSegment(SceneName.WorldMap)).toBe(SceneName.WorldMap);
    expect(resolveSceneNameFromRouteSegment(SceneName.Hexception)).toBe(SceneName.Hexception);
  });

  it("accepts the dormant future fast-travel slug without changing the fallback", () => {
    expect(resolveSceneNameFromRouteSegment(SceneName.FastTravel)).toBe(SceneName.FastTravel);
    expect(resolveSceneNameFromRouteSegment("unknown-scene")).toBe(SceneName.WorldMap);
    expect(resolveSceneNameFromRouteSegment(undefined)).toBe(SceneName.WorldMap);
  });

  it("is wired into the renderer URL route handling without activating the scene", () => {
    const source = readGameRendererSource();

    expect(source).toMatch(/resolveSceneNameFromRouteSegment/);
    expect(source).toMatch(/SceneName\.FastTravel/);
  });
});
