import { BUILDINGS_CENTER, RealmLevels } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  countOccupiedBuildingTilesByStructure,
  formatAvailableBuildingTilesLabel,
  formatPopulationStatusLabel,
  resolveAvailableBuildingTiles,
} from "./structure-status";

describe("structure-status", () => {
  it("formats population labels explicitly", () => {
    expect(formatPopulationStatusLabel(7, 12)).toBe("7/12");
  });

  it("formats available building tile labels explicitly", () => {
    expect(formatAvailableBuildingTilesLabel(53, 60)).toBe("53/60");
  });

  it("counts occupied building tiles from RECS rows and skips the center keep tile", () => {
    expect(
      countOccupiedBuildingTilesByStructure({
        trackedStructureIds: new Set([7, 8]),
        buildings: [
          { outerEntityId: 7, innerCol: BUILDINGS_CENTER[0], innerRow: BUILDINGS_CENTER[1] },
          { outerEntityId: 7, innerCol: 1, innerRow: 0 },
          { outerEntityId: 7, innerCol: 1, innerRow: 1 },
          { outerEntityId: 8, innerCol: 0, innerRow: 1 },
          { outerEntityId: 99, innerCol: 2, innerRow: 0 },
        ],
      }),
    ).toEqual({
      7: 2,
      8: 1,
    });
  });

  it("resolves realm buildable tile totals from level progression", () => {
    expect(resolveAvailableBuildingTiles({ level: RealmLevels.Settlement, occupiedBuildingTiles: 0 })).toEqual({
      available: 6,
      occupied: 0,
      total: 6,
    });
    expect(resolveAvailableBuildingTiles({ level: RealmLevels.City, occupiedBuildingTiles: 0 })).toEqual({
      available: 18,
      occupied: 0,
      total: 18,
    });
    expect(resolveAvailableBuildingTiles({ level: RealmLevels.Kingdom, occupiedBuildingTiles: 0 })).toEqual({
      available: 36,
      occupied: 0,
      total: 36,
    });
    expect(resolveAvailableBuildingTiles({ level: RealmLevels.Empire, occupiedBuildingTiles: 0 })).toEqual({
      available: 60,
      occupied: 0,
      total: 60,
    });
  });

  it("clamps occupied tiles to the available buildable capacity", () => {
    expect(resolveAvailableBuildingTiles({ level: RealmLevels.Settlement, occupiedBuildingTiles: 9 })).toEqual({
      available: 0,
      occupied: 6,
      total: 6,
    });
  });
});
