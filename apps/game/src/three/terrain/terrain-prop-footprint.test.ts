import { describe, expect, it } from "vitest";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import { isTerrainPropFootprintClear } from "./terrain-prop-footprint";

const nothing = () => false;
/** Something stands on `hex`: an army or a structure, on ground a prop may not reach into. */
const standing = (hex: { col: number; row: number }) => {
  const on = (col: number, row: number) => col === hex.col && row === hex.row;
  return { isBlocked: on, isOccupied: on };
};
/** `hex` is not ground a prop may reach into (unexplored, or past the page), and nothing stands on it. */
const unexplored = (hex: { col: number; row: number }) => ({
  isBlocked: (col: number, row: number) => col === hex.col && row === hex.row,
  isOccupied: nothing,
});
const open = { isBlocked: nothing, isOccupied: nothing };

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
    expect(isTerrainPropFootprintClear(prop, open)).toBe(true);
    expect(isTerrainPropFootprintClear(prop, standing(adjacent))).toBe(false);
    expect(isTerrainPropFootprintClear(prop, open)).toBe(true);
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
    expect(isTerrainPropFootprintClear(tree, standing(toward))).toBe(false);
  });

  it("keeps a tree beside unexplored ground when it stays clear of the shared edge", () => {
    const ownerCol = 3,
      ownerRow = 3;
    const center = terrainHexToWorld(ownerCol, ownerRow);
    const [toward] = terrainNeighborCoordinates(ownerCol, ownerRow);
    const tree = { archetype: "broadleaf" as const, scale: 1, ownerCol, ownerRow, worldX: center.x, worldZ: center.z };
    expect(isTerrainPropFootprintClear(tree, unexplored(toward))).toBe(true);
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
    expect(isTerrainPropFootprintClear(stone, standing(toward))).toBe(true);
  });
});
