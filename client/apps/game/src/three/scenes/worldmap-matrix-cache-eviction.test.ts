import { describe, expect, it } from "vitest";
import { computeMatrixCacheEvictions } from "./worldmap-matrix-cache-eviction";

describe("computeMatrixCacheEvictions", () => {
  it("returns immediately with no evictions when cache is within limit", () => {
    const result = computeMatrixCacheEvictions(
      ["a", "b", "c"],
      new Set<string>(),
      5,
    );
    expect(result.evictedKeys).toHaveLength(0);
    expect(result.limitedByPinning).toBe(false);
  });

  it("returns immediately with no iterations when all entries are pinned", () => {
    const pinned = new Set(["a", "b", "c", "d", "e"]);
    const result = computeMatrixCacheEvictions(
      ["a", "b", "c", "d", "e"],
      pinned,
      3,
    );
    // Early bail: zero evictions, pinning-limited
    expect(result.evictedKeys).toHaveLength(0);
    expect(result.limitedByPinning).toBe(true);
  });

  it("evicts only non-pinned entries when a mix of pinned and unpinned exists", () => {
    // 5 entries, limit 3, 2 are pinned
    const pinned = new Set(["b", "d"]);
    const result = computeMatrixCacheEvictions(
      ["a", "b", "c", "d", "e"],
      pinned,
      3,
    );
    // Need to evict 2 entries to go from 5 to 3.
    // Non-pinned in order: a, c, e. Evict oldest first: a, c.
    expect(result.evictedKeys).toEqual(["a", "c"]);
    expect(result.limitedByPinning).toBe(false);
  });

  it("stops evicting after removing enough entries to meet the limit", () => {
    // 6 entries, limit 4, none pinned
    const result = computeMatrixCacheEvictions(
      ["a", "b", "c", "d", "e", "f"],
      new Set<string>(),
      4,
    );
    // Only need to evict 2 (oldest: a, b)
    expect(result.evictedKeys).toEqual(["a", "b"]);
    expect(result.limitedByPinning).toBe(false);
  });

  it("signals pinning-limited when pinned entries exceed capacity after evicting all non-pinned", () => {
    // 5 entries, limit 2, 4 are pinned
    const pinned = new Set(["a", "b", "c", "d"]);
    const result = computeMatrixCacheEvictions(
      ["a", "b", "c", "d", "e"],
      pinned,
      2,
    );
    // Can only evict "e", leaving 4 entries (all pinned) > limit of 2
    expect(result.evictedKeys).toEqual(["e"]);
    expect(result.limitedByPinning).toBe(true);
  });

  it("handles empty cache gracefully", () => {
    const result = computeMatrixCacheEvictions([], new Set<string>(), 5);
    expect(result.evictedKeys).toHaveLength(0);
    expect(result.limitedByPinning).toBe(false);
  });

  it("handles cache size exactly at limit with no evictions needed", () => {
    const result = computeMatrixCacheEvictions(
      ["a", "b", "c"],
      new Set<string>(),
      3,
    );
    expect(result.evictedKeys).toHaveLength(0);
    expect(result.limitedByPinning).toBe(false);
  });
});
