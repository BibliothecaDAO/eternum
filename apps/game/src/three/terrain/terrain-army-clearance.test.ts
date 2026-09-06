import { CatmullRomCurve3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { isTerrainArmySpaceClear } from "./terrain-army-clearance";
import { findNearestTerrainHex, terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";

describe("permanent army clearance", () => {
  it("reserves destinations and every curved turn between neighboring hexes", () => {
    for (const origin of [
      { col: 0, row: 0 },
      { col: -3, row: -3 },
      { col: 4, row: 1 },
    ]) {
      const center = terrainHexToWorld(origin.col, origin.row);
      const neighbors = terrainNeighborCoordinates(origin.col, origin.row).map(({ col, row }) =>
        terrainHexToWorld(col, row),
      );
      for (const entry of neighbors) {
        for (const exit of neighbors) {
          if (entry === exit) continue;
          const curve = new CatmullRomCurve3(
            [entry, center, exit].map(({ x, z }) => new Vector3(x, 0, z)),
            false,
            "centripetal",
          );
          for (let sample = 0; sample <= 40; sample++) {
            const point = curve.getPoint(sample / 40);
            const hex = findNearestTerrainHex(point.x, point.z);
            const anchor = terrainHexToWorld(hex.col, hex.row);
            expect(isTerrainArmySpaceClear(point.x - anchor.x, point.z - anchor.z)).toBe(false);
          }
        }
      }
    }
  });

  it("leaves room at hex corners while checking the solid footprint near the standing area", () => {
    expect(isTerrainArmySpaceClear(0, 0.9, 0.2)).toBe(true);
    expect(isTerrainArmySpaceClear(0, 0.5, 0.2)).toBe(false);
  });
});
