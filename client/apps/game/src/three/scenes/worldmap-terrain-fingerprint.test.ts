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
});
