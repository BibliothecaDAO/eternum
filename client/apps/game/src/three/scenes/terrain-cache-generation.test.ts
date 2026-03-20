import { describe, expect, it } from "vitest";
import { createTerrainCacheGeneration, isTerrainCacheStale } from "./terrain-cache-generation";

describe("createTerrainCacheGeneration", () => {
  it("starts at generation 0", () => {
    const gen = createTerrainCacheGeneration();
    expect(gen.current()).toBe(0);
  });

  it("increments generation on bump", () => {
    const gen = createTerrainCacheGeneration();
    gen.bump();
    expect(gen.current()).toBe(1);
    gen.bump();
    expect(gen.current()).toBe(2);
  });
});

describe("isTerrainCacheStale", () => {
  it("returns false when cached generation matches current", () => {
    expect(isTerrainCacheStale(5, 5)).toBe(false);
  });

  it("returns true when cached generation is behind current", () => {
    expect(isTerrainCacheStale(3, 7)).toBe(true);
  });

  it("returns true when cached generation is undefined", () => {
    expect(isTerrainCacheStale(undefined, 1)).toBe(true);
  });

  it("returns false when both are 0 (initial state)", () => {
    expect(isTerrainCacheStale(0, 0)).toBe(false);
  });
});
