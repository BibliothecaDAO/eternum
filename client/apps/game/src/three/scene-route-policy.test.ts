import { describe, expect, it } from "vitest";

import { resolveSceneNameFromRouteSegment } from "./scene-route-policy";
import { SceneName } from "./types";

describe("resolveSceneNameFromRouteSegment", () => {
  it("keeps existing world and hex scene slugs stable", () => {
    expect(resolveSceneNameFromRouteSegment(SceneName.WorldMap)).toBe(SceneName.WorldMap);
    expect(resolveSceneNameFromRouteSegment(SceneName.Hexception)).toBe(SceneName.Hexception);
  });

  it("accepts the fast-travel slug as a valid scene name", () => {
    expect(resolveSceneNameFromRouteSegment(SceneName.FastTravel)).toBe(SceneName.FastTravel);
  });

  it("falls back to WorldMap for unknown slugs", () => {
    expect(resolveSceneNameFromRouteSegment("unknown-scene")).toBe(SceneName.WorldMap);
  });

  it("falls back to WorldMap for undefined input", () => {
    expect(resolveSceneNameFromRouteSegment(undefined)).toBe(SceneName.WorldMap);
  });

  it("does not accept arbitrary strings that happen to contain valid names", () => {
    expect(resolveSceneNameFromRouteSegment("map-extra")).toBe(SceneName.WorldMap);
    expect(resolveSceneNameFromRouteSegment("")).toBe(SceneName.WorldMap);
  });
});
