import { describe, expect, it } from "vitest";

import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";

describe("terrain coordinate hash", () => {
  it("matches golden vectors across signed coordinates and seeds", () => {
    expect(hash({ col: 0, row: 0 })).toBe(583_470_684);
    expect(hash({ col: 17, row: -29 })).toBe(71_099_725);
    expect(hash({ col: -17, row: 29, elevationSeed: 137, moistureSeed: 991 })).toBe(2_994_984_974);
    expect(hash({ col: -2_147_483_648, row: 2_147_483_647 })).toBe(77_679_736);
  });

  it("keeps named layers independent and maps output to [0, 1)", () => {
    const terrain = hash({ col: 8, row: 12, salt: "terrain-relief-v1" });
    const props = hash({ col: 8, row: 12, salt: "tree-candidate-v1" });

    expect(terrain).not.toBe(props);
    expect(terrainHashToUnitFloat(terrain)).toBeGreaterThanOrEqual(0);
    expect(terrainHashToUnitFloat(terrain)).toBeLessThan(1);
  });

  it("rejects ambiguous inputs instead of silently changing identity", () => {
    expect(() => hash({ col: 0.5, row: 0 })).toThrow("Terrain hash col must be a safe integer");
    expect(() => hash({ col: 0, row: 0, salt: "" })).toThrow("Terrain hash salt must not be empty");
  });
});

function hash({
  col,
  elevationSeed = 0,
  moistureSeed = 0,
  row,
  salt = "terrain-relief-v1",
}: {
  col: number;
  elevationSeed?: number;
  moistureSeed?: number;
  row: number;
  salt?: string;
}): number {
  return hashTerrainCoordinates({ col, elevationSeed, moistureSeed, row, salt });
}
