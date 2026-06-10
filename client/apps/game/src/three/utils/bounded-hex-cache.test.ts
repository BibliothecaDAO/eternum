import { describe, expect, it, vi } from "vitest";

import { BoundedHexCache } from "./bounded-hex-cache";

describe("BoundedHexCache", () => {
  // Phase 3.1: moving armies resolved their hex biome via BigInt/simplex noise twice
  // per frame per entity, though biome is immutable per hex. Memoizing by hex keeps
  // the resolve to once per distinct hex.
  it("resolves a hex value once and returns the cached value on repeat", () => {
    const cache = new BoundedHexCache<string>(16);
    const resolve = vi.fn(() => "grass");

    expect(cache.get(3, 4, resolve)).toBe("grass");
    expect(cache.get(3, 4, resolve)).toBe("grass");

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("resolves distinct hexes independently", () => {
    const cache = new BoundedHexCache<string>(16);
    cache.get(0, 0, () => "a");
    cache.get(1, 0, () => "b");

    expect(cache.get(0, 0, () => "x")).toBe("a");
    expect(cache.get(1, 0, () => "x")).toBe("b");
  });

  it("caches falsy values (e.g. enum value 0) without re-resolving", () => {
    const cache = new BoundedHexCache<number>(16);
    const resolve = vi.fn(() => 0);

    cache.get(2, 2, resolve);
    cache.get(2, 2, resolve);

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("evicts the oldest entry when the cap is exceeded", () => {
    const cache = new BoundedHexCache<string>(2);
    cache.get(0, 0, () => "a");
    cache.get(1, 1, () => "b");
    cache.get(2, 2, () => "c"); // exceeds cap → evicts the oldest (0,0)

    expect(cache.size).toBe(2);

    const reResolve = vi.fn(() => "a2");
    expect(cache.get(0, 0, reResolve)).toBe("a2"); // (0,0) was evicted, so it re-resolves
    expect(reResolve).toHaveBeenCalledTimes(1);
  });

  it("clear empties the cache", () => {
    const cache = new BoundedHexCache<string>(16);
    cache.get(0, 0, () => "a");

    cache.clear();
    expect(cache.size).toBe(0);

    const resolve = vi.fn(() => "a");
    cache.get(0, 0, resolve);
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
