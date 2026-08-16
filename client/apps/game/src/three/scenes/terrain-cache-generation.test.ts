import { describe, expect, it } from "vitest";
import { createTerrainCacheGeneration, isTerrainCacheStale } from "./terrain-cache-generation";

describe("createTerrainCacheGeneration", () => {
  it("starts every chunk at generation 0", () => {
    const gen = createTerrainCacheGeneration();
    expect(gen.current("0,0")).toBe(0);
    expect(gen.current("24,48")).toBe(0);
  });

  it("increments only the bumped chunk keys", () => {
    const gen = createTerrainCacheGeneration();
    gen.bump(["0,0"]);
    expect(gen.current("0,0")).toBe(1);
    gen.bump(["0,0"]);
    expect(gen.current("0,0")).toBe(2);
  });

  // Phase 1.3: this is the whole point — a tile mutation inside one chunk must
  // NOT invalidate cached terrain for unrelated chunks. The previous single
  // global counter advanced for every tile change anywhere, so every cached
  // chunk read as stale during exploration.
  it("does not advance other chunks when one chunk is bumped", () => {
    const gen = createTerrainCacheGeneration();
    gen.bump(["0,0"]);
    expect(gen.current("0,0")).toBe(1);
    expect(gen.current("24,0")).toBe(0);
    expect(gen.current("0,24")).toBe(0);
  });

  it("bumps every key passed in a single call", () => {
    const gen = createTerrainCacheGeneration();
    gen.bump(["0,0", "24,0", "0,24"]);
    expect(gen.current("0,0")).toBe(1);
    expect(gen.current("24,0")).toBe(1);
    expect(gen.current("0,24")).toBe(1);
  });

  it("forgets generations outside the retained render set", () => {
    const gen = createTerrainCacheGeneration();
    gen.bump(["0,0", "24,0", "48,0"]);

    gen.retain(new Set(["24,0"]));

    expect(gen.current("0,0")).toBe(0);
    expect(gen.current("24,0")).toBe(1);
    expect(gen.current("48,0")).toBe(0);
  });

  it("resets all chunk generations on clear", () => {
    const gen = createTerrainCacheGeneration();
    gen.bump(["0,0", "24,0"]);
    gen.clear();
    expect(gen.current("0,0")).toBe(0);
    expect(gen.current("24,0")).toBe(0);
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
