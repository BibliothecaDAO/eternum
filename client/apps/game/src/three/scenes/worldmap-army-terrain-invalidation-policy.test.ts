import { describe, expect, it } from "vitest";

import { shouldInvalidateTerrainForArmyTileUpdate } from "./worldmap-army-terrain-invalidation-policy";

describe("shouldInvalidateTerrainForArmyTileUpdate", () => {
  // Phase 1.2: cached terrain is built from biome tiles and structures only — it
  // does not depend on army positions. An army merely moving into/out of a hex
  // must NOT invalidate the terrain matrix cache (doing so destroyed up to ~8
  // cached chunks per move). The only reason an army tile update touches terrain
  // is the provisional-biome write that reveals an unexplored spawn hex.
  it("does not invalidate terrain when the army update only changed army position", () => {
    expect(shouldInvalidateTerrainForArmyTileUpdate({ wroteProvisionalBiome: false })).toBe(false);
  });

  it("invalidates terrain when the army update wrote a provisional biome (terrain changed)", () => {
    expect(shouldInvalidateTerrainForArmyTileUpdate({ wroteProvisionalBiome: true })).toBe(true);
  });
});
