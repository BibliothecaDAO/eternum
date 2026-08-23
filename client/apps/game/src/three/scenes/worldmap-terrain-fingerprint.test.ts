import { describe, expect, it } from "vitest";

import { createWorldmapTerrainFingerprint } from "./worldmap-terrain-fingerprint";

describe("createWorldmapTerrainFingerprint", () => {
  it("is stable regardless of entry order", () => {
    const first = createWorldmapTerrainFingerprint([
      { hexKey: "10,10", biomeKey: "Ocean" },
      { hexKey: "10,11", biomeKey: "TemperateRainForest" },
    ]);
    const second = createWorldmapTerrainFingerprint([
      { hexKey: "10,11", biomeKey: "TemperateRainForest" },
      { hexKey: "10,10", biomeKey: "Ocean" },
    ]);

    expect(first).toBe(second);
  });

  it("changes when biome identity changes at the same hex", () => {
    const ocean = createWorldmapTerrainFingerprint([{ hexKey: "10,10", biomeKey: "Ocean" }]);
    const forest = createWorldmapTerrainFingerprint([{ hexKey: "10,10", biomeKey: "TemperateRainForest" }]);

    expect(ocean).not.toBe(forest);
  });

  // Phase 1.4: the fingerprint must be a compact hash, not an O(n) concatenated
  // string. A 48x48 render window holds up to ~2300 explored cells; the old
  // joined-string implementation produced a ~60KB string per cached chunk and
  // rebuilt/compared it on the cache-hit fast path. A bounded-length digest keeps
  // the hit path O(n)-to-compute but O(1)-to-store-and-compare.
  it("produces a bounded-length digest even for large terrain windows", () => {
    const entries = Array.from({ length: 5000 }, (_, index) => ({
      hexKey: `${index % 70},${Math.floor(index / 70)}`,
      biomeKey: index % 2 === 0 ? "Ocean" : "TemperateRainForest",
    }));

    const fingerprint = createWorldmapTerrainFingerprint(entries);

    expect(fingerprint.length).toBeLessThanOrEqual(48);
  });

  it("distinguishes a biome swap between two hexes (same key/biome multiset)", () => {
    // {A:Ocean, B:Forest} vs {A:Forest, B:Ocean} share the same set of hexKeys
    // and the same set of biomeKeys but pair them differently — a naive
    // hash-hexes-and-biomes-separately scheme would collide; the digest must not.
    const layout = createWorldmapTerrainFingerprint([
      { hexKey: "1,1", biomeKey: "Ocean" },
      { hexKey: "2,2", biomeKey: "TemperateRainForest" },
    ]);
    const swapped = createWorldmapTerrainFingerprint([
      { hexKey: "1,1", biomeKey: "TemperateRainForest" },
      { hexKey: "2,2", biomeKey: "Ocean" },
    ]);

    expect(layout).not.toBe(swapped);
  });

  it("changes when a cell is added or removed (entry count matters)", () => {
    const single = createWorldmapTerrainFingerprint([{ hexKey: "1,1", biomeKey: "Ocean" }]);
    const withExtra = createWorldmapTerrainFingerprint([
      { hexKey: "1,1", biomeKey: "Ocean" },
      { hexKey: "2,2", biomeKey: "Ocean" },
    ]);

    expect(single).not.toBe(withExtra);
  });

  it("changes when terrain occupancy adds or removes a structure pad", () => {
    const open = createWorldmapTerrainFingerprint([{ hexKey: "1,1", biomeKey: "Grassland", occupied: false }]);
    const occupied = createWorldmapTerrainFingerprint([{ hexKey: "1,1", biomeKey: "Grassland", occupied: true }]);

    expect(open).not.toBe(occupied);
  });

  it("returns a stable digest for empty input", () => {
    expect(createWorldmapTerrainFingerprint([])).toBe(createWorldmapTerrainFingerprint([]));
  });
});
