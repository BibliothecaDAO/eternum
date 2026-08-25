import { describe, expect, it } from "vitest";

import {
  buildVisibleTerrainMembership,
  replaceVisibleTerrainMembershipOwner,
} from "./worldmap-visible-terrain-membership";

describe("worldmap-visible-terrain-membership", () => {
  it("tracks biome ownership by hexKey after prepared terrain commit", () => {
    const result = buildVisibleTerrainMembership([
      { hexKey: "10,10", biomeKey: "Ocean", chunkKey: "0,0", instanceIndex: 0 },
      { hexKey: "10,11", biomeKey: "TemperateRainForest", chunkKey: "0,0", instanceIndex: 0 },
    ]);

    expect(result.conflicts).toEqual([]);
    expect(result.membership.get("10,10")).toEqual({
      biomeKey: "Ocean",
      chunkKey: "0,0",
      instanceIndex: 0,
    });
    expect(result.membership.get("10,11")).toEqual({
      biomeKey: "TemperateRainForest",
      chunkKey: "0,0",
      instanceIndex: 0,
    });
  });

  it("rebuilds membership from cached terrain replay", () => {
    const cachedReplay = buildVisibleTerrainMembership([
      { hexKey: "24,24", biomeKey: "Ocean", chunkKey: "24,24", instanceIndex: 4 },
      { hexKey: "25,24", biomeKey: "Ocean", chunkKey: "24,24", instanceIndex: 5 },
    ]);

    expect(Array.from(cachedReplay.membership.entries())).toEqual([
      ["24,24", { biomeKey: "Ocean", chunkKey: "24,24", instanceIndex: 4 }],
      ["25,24", { biomeKey: "Ocean", chunkKey: "24,24", instanceIndex: 5 }],
    ]);
  });

  it("removes prior same-hex owner before local biome replacement", () => {
    const result = buildVisibleTerrainMembership([
      { hexKey: "30,30", biomeKey: "Ocean", chunkKey: "24,24", instanceIndex: 1 },
    ]);

    const replaced = replaceVisibleTerrainMembershipOwner(result.membership, {
      hexKey: "30,30",
      biomeKey: "TemperateRainForest",
      chunkKey: "24,24",
      instanceIndex: 2,
    });

    expect(replaced).toEqual({
      biomeKey: "Ocean",
      chunkKey: "24,24",
      instanceIndex: 1,
    });
    expect(result.membership.get("30,30")).toEqual({
      biomeKey: "TemperateRainForest",
      chunkKey: "24,24",
      instanceIndex: 2,
    });
  });

  it("never reports two explored biome owners for one hexKey", () => {
    const result = buildVisibleTerrainMembership([
      { hexKey: "12,12", biomeKey: "Ocean", chunkKey: "0,0", instanceIndex: 0 },
      { hexKey: "12,12", biomeKey: "TemperateRainForest", chunkKey: "0,0", instanceIndex: 1 },
    ]);

    expect(result.membership.size).toBe(1);
    expect(result.conflicts).toEqual(["12,12"]);
  });
});
