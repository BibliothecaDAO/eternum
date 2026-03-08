import { describe, it, expect } from "vitest";
import { parseRealmSnapshot } from "../../../src/automation/snapshot.js";

describe("parseRealmSnapshot", () => {
  it("parses hex balance columns into resource ID map", () => {
    // RESOURCE_PRECISION is 1_000_000_000
    // Coal (ResourcesIds 2): 5000 units = 5000 * 1e9 = 0x48C27395000
    // Wheat (ResourcesIds 35): 2000 units = 2000 * 1e9 = 0x1D1A94A2000
    const row: Record<string, any> = {
      entity_id: 100,
      COAL_BALANCE: "0x48C27395000",
      WOOD_BALANCE: "0x0",
      WHEAT_BALANCE: "0x1D1A94A2000",
      // Production columns
      "COAL_PRODUCTION.building_count": 1,
      "WOOD_PRODUCTION.building_count": 0,
      "WHEAT_PRODUCTION.building_count": 2,
    };

    const snapshot = parseRealmSnapshot(row);

    // Coal: ResourcesIds.Coal = 2
    expect(snapshot.balances.get(2)).toBe(5000);
    // Wood is 0, should not be in the map
    expect(snapshot.balances.has(3)).toBe(false);
    // Wheat: ResourcesIds.Wheat = 35
    expect(snapshot.balances.get(35)).toBe(2000);

    // BuildingType = ResourcesIds + 2
    // Coal building: ResourcesIds.Coal(2) + 2 = 4
    expect(snapshot.buildingCounts.get(4)).toBe(1);
    expect(snapshot.activeBuildings.has(4)).toBe(true);
    // Wood building: ResourcesIds.Wood(3) + 2 = 5, count=0 so not included
    expect(snapshot.activeBuildings.has(5)).toBe(false);
    // Wheat building: ResourcesIds.Wheat(35) + 2 = 37
    expect(snapshot.buildingCounts.get(37)).toBe(2);
    expect(snapshot.activeBuildings.has(37)).toBe(true);
  });

  it("returns empty maps for null/undefined row", () => {
    const snapshot = parseRealmSnapshot(null);
    expect(snapshot.balances.size).toBe(0);
    expect(snapshot.buildingCounts.size).toBe(0);
    expect(snapshot.activeBuildings.size).toBe(0);
  });

  it("returns empty maps for undefined row", () => {
    const snapshot = parseRealmSnapshot(undefined);
    expect(snapshot.balances.size).toBe(0);
    expect(snapshot.buildingCounts.size).toBe(0);
    expect(snapshot.activeBuildings.size).toBe(0);
  });

  it("handles malformed hex gracefully", () => {
    const row: Record<string, any> = {
      COAL_BALANCE: "not-hex",
      WOOD_BALANCE: null,
      WHEAT_BALANCE: undefined,
    };

    const snapshot = parseRealmSnapshot(row);
    expect(snapshot.balances.size).toBe(0);
  });
});
