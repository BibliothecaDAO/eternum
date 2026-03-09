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

describe("parseRealmSnapshot — balance projection", () => {
  it("projects balance forward using production_rate and elapsed time", () => {
    // Coal: raw balance 5000 units, production_rate 2e9 (2/sec in precision),
    // last_updated_at 100, currentTimestamp 160 (60 seconds elapsed)
    // Projected: 5000 + (60 * 2) = 5120
    const row: Record<string, any> = {
      COAL_BALANCE: "0x48C27395000", // 5000 * 1e9
      "COAL_PRODUCTION.building_count": 1,
      "COAL_PRODUCTION.production_rate": "0x77359400", // 2e9 = 2 per second in precision
      "COAL_PRODUCTION.output_amount_left": "0x2E90EDD00000", // 50000 * 1e9 (plenty of fuel)
      "COAL_PRODUCTION.last_updated_at": 100,
    };

    const snapshot = parseRealmSnapshot(row, 160);

    // 5000 + floor(60 * 2) = 5120
    expect(snapshot.balances.get(2)).toBe(5120);
  });

  it("caps projected production by output_amount_left for non-food", () => {
    // Coal: raw balance 5000, production_rate 2/sec, 60 seconds elapsed
    // Would produce 120, but output_amount_left is only 50 units (50e9 in precision)
    const row: Record<string, any> = {
      COAL_BALANCE: "0x48C27395000", // 5000 * 1e9
      "COAL_PRODUCTION.building_count": 1,
      "COAL_PRODUCTION.production_rate": "0x77359400", // 2e9
      "COAL_PRODUCTION.output_amount_left": "0xBA43B7400", // 50 * 1e9 (only 50 fuel left)
      "COAL_PRODUCTION.last_updated_at": 100,
    };

    const snapshot = parseRealmSnapshot(row, 160);

    // 5000 + 50 (capped by fuel) = 5050
    expect(snapshot.balances.get(2)).toBe(5050);
  });

  it("does not cap food resources by output_amount_left", () => {
    // Wheat (ResourcesIds 35) is food — production is unlimited
    const row: Record<string, any> = {
      WHEAT_BALANCE: "0x1D1A94A2000", // 2000 * 1e9
      "WHEAT_PRODUCTION.building_count": 1,
      "WHEAT_PRODUCTION.production_rate": "0x3B9ACA00", // 1e9 = 1 per second
      "WHEAT_PRODUCTION.output_amount_left": "0x0", // zero fuel — should NOT cap food
      "WHEAT_PRODUCTION.last_updated_at": 100,
    };

    const snapshot = parseRealmSnapshot(row, 160);

    // 2000 + 60 = 2060 (not capped by output_amount_left)
    expect(snapshot.balances.get(35)).toBe(2060);
  });

  it("falls back to raw balance when no currentTimestamp provided", () => {
    const row: Record<string, any> = {
      COAL_BALANCE: "0x48C27395000", // 5000 * 1e9
      "COAL_PRODUCTION.building_count": 1,
      "COAL_PRODUCTION.production_rate": "0x77359400",
      "COAL_PRODUCTION.output_amount_left": "0x2E90EDD00000",
      "COAL_PRODUCTION.last_updated_at": 100,
    };

    const snapshot = parseRealmSnapshot(row);

    expect(snapshot.balances.get(2)).toBe(5000);
  });

  it("handles zero production_rate gracefully", () => {
    const row: Record<string, any> = {
      COAL_BALANCE: "0x48C27395000", // 5000
      "COAL_PRODUCTION.building_count": 1,
      "COAL_PRODUCTION.production_rate": "0x0",
      "COAL_PRODUCTION.output_amount_left": "0x2E90EDD00000",
      "COAL_PRODUCTION.last_updated_at": 100,
    };

    const snapshot = parseRealmSnapshot(row, 160);

    expect(snapshot.balances.get(2)).toBe(5000);
  });

  it("handles missing production columns gracefully", () => {
    const row: Record<string, any> = {
      COAL_BALANCE: "0x48C27395000", // 5000
      "COAL_PRODUCTION.building_count": 1,
    };

    const snapshot = parseRealmSnapshot(row, 160);

    expect(snapshot.balances.get(2)).toBe(5000);
  });
});
