import { BUILDINGS_CENTER, RealmLevels, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  countOccupiedBuildingTilesByStructure,
  formatAvailableBuildingTilesLabel,
  formatPopulationStatusLabel,
  resolveOccupiedBuildingTilesForStructureStatus,
  resolveAvailableBuildingTiles,
  resolveStructureStatusSnapshot,
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

  it("treats missing building rows as zero occupied tiles once structure buildings have synced", () => {
    expect(
      resolveOccupiedBuildingTilesForStructureStatus({ occupiedBuildingTiles: undefined, hasStructureBuildings: true }),
    ).toBe(0);
    expect(
      resolveOccupiedBuildingTilesForStructureStatus({ occupiedBuildingTiles: undefined, hasStructureBuildings: false }),
    ).toBeNull();
  });

  it("resolves population totals by adding base capacity exactly once", () => {
    expect(
      resolveStructureStatusSnapshot({
        structureCategory: StructureType.Realm,
        structureLevel: RealmLevels.City,
        basePopulationCapacity: 6,
        occupiedBuildingTiles: 3,
        structureBuildings: {
          population: {
            current: 25,
            max: 24,
          },
        },
      }),
    ).toMatchObject({
      populationCurrent: 25,
      populationCapacityRaw: 24,
      populationCapacityTotal: 30,
      populationLabel: "25/30",
      buildingTilesAvailable: 15,
      buildingTilesTotal: 18,
      buildingTilesLabel: "15/18",
      hasAuthoritativePopulation: true,
      hasAuthoritativeBuildingTiles: true,
    });
  });

  it("withholds population stats when structure buildings have not synced", () => {
    expect(
      resolveStructureStatusSnapshot({
        structureCategory: StructureType.Realm,
        structureLevel: RealmLevels.City,
        basePopulationCapacity: 6,
        occupiedBuildingTiles: 0,
        structureBuildings: null,
      }),
    ).toMatchObject({
      populationCurrent: null,
      populationCapacityRaw: null,
      populationCapacityTotal: null,
      populationLabel: null,
      hasAuthoritativePopulation: false,
      buildingTilesAvailable: 18,
      buildingTilesTotal: 18,
      buildingTilesLabel: "18/18",
      hasAuthoritativeBuildingTiles: true,
    });
  });

  it("omits all compact stats for structures without population details", () => {
    expect(
      resolveStructureStatusSnapshot({
        structureCategory: StructureType.FragmentMine,
        structureLevel: 0,
        basePopulationCapacity: 6,
        occupiedBuildingTiles: 0,
        structureBuildings: {
          population: {
            current: 5,
            max: 7,
          },
        },
      }),
    ).toEqual({
      populationCurrent: null,
      populationCapacityRaw: null,
      populationCapacityTotal: null,
      populationLabel: null,
      buildingTilesAvailable: null,
      buildingTilesTotal: null,
      buildingTilesLabel: null,
      hasAuthoritativePopulation: false,
      hasAuthoritativeBuildingTiles: false,
    });
  });
});
