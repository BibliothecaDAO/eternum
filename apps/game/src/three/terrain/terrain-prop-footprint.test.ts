import { describe, expect, it } from "vitest";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { isTerrainPropFootprintClear } from "./terrain-prop-footprint";

describe("prop footprints", () => {
  it("hides canopy extending into an occupied neighboring tile, then restores it", () => {
    const ownerCol = 3,
      ownerRow = 3;
    const center = terrainHexToWorld(ownerCol, ownerRow);
    const adjacent = terrainNeighborCoordinates(ownerCol, ownerRow)[0];
    const neighbor = terrainHexToWorld(adjacent.col, adjacent.row);
    const prop = {
      archetype: "broadleaf" as const,
      scale: 1,
      ownerCol,
      ownerRow,
      worldX: center.x + (neighbor.x - center.x) * 0.46,
      worldZ: center.z + (neighbor.z - center.z) * 0.46,
    };
    expect(isTerrainPropFootprintClear(prop, () => false)).toBe(true);
    expect(isTerrainPropFootprintClear(prop, (col, row) => col === adjacent.col && row === adjacent.row)).toBe(false);
    expect(isTerrainPropFootprintClear(prop, () => false)).toBe(true);
  });

  it("hides a tree anywhere on a hex beside an occupied one, however far from that edge", () => {
    const ownerCol = 3,
      ownerRow = 3;
    const center = terrainHexToWorld(ownerCol, ownerRow);
    const [toward, , , away] = terrainNeighborCoordinates(ownerCol, ownerRow);
    const farSide = terrainHexToWorld(away.col, away.row);
    const tree = {
      archetype: "broadleaf" as const,
      scale: 1,
      ownerCol,
      ownerRow,
      worldX: center.x + (farSide.x - center.x) * 0.3,
      worldZ: center.z + (farSide.z - center.z) * 0.3,
    };
    expect(isTerrainPropFootprintClear(tree, (col, row) => col === toward.col && row === toward.row)).toBe(false);
  });

  it("keeps a low prop beside an occupied hex when it stays clear of the shared edge", () => {
    const ownerCol = 3,
      ownerRow = 3;
    const center = terrainHexToWorld(ownerCol, ownerRow);
    const [toward] = terrainNeighborCoordinates(ownerCol, ownerRow);
    const stone = {
      archetype: "grass-tuft" as const,
      scale: 1,
      ownerCol,
      ownerRow,
      worldX: center.x,
      worldZ: center.z,
    };
    expect(isTerrainPropFootprintClear(stone, (col, row) => col === toward.col && row === toward.row)).toBe(true);
  });
});
