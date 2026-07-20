import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  getExitFamilyInventory,
  validateExitFamilyInventory,
  validateExitFamilyInventoryForRelease,
} from "./exit-family-inventory";

const economicWriteInventoryUrl = new URL("../schema/economic-write-inventory-v0.json", import.meta.url);

describe("A22 exit-family inventory", () => {
  test("projects every discovered write into exactly one reviewed bucket", () => {
    const inventory = getExitFamilyInventory();
    const writes = readJson(economicWriteInventoryUrl).entries as EconomicWrite[];
    const expectedCoveredIds = writes.filter((write) => write.exitCoveredCandidate).map((write) => write.id);
    const expectedExcludedIds = writes.filter((write) => !write.exitCoveredCandidate).map((write) => write.id);
    const projectedCoveredIds = inventory.families.flatMap((family) => family.sourceWriteIds);

    expect(() => validateExitFamilyInventory(inventory)).not.toThrow();
    expect(projectedCoveredIds.toSorted()).toEqual(expectedCoveredIds.toSorted());
    expect(new Set(projectedCoveredIds).size).toBe(projectedCoveredIds.length);
    expect(inventory.excludedWriteIds.toSorted()).toEqual(expectedExcludedIds.toSorted());
    expect(inventory.summary).toMatchObject({
      discoveredWrites: writes.length,
      exitCoveredWrites: expectedCoveredIds.length,
      excludedWrites: expectedExcludedIds.length,
      familyCount: 12,
    });
  });

  test("publishes one contiguous, append-only index layout for every frozen family", () => {
    const inventory = getExitFamilyInventory();

    expect(inventory.status).toBe("a22-candidate-incomplete");
    expect(inventory.releaseReady).toBe(false);
    expect(inventory.families.map((family) => family.familyId)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(inventory.families.map((family) => family.capabilityFamily)).toEqual([
      "resource",
      "structure_ownership",
      "lazy_production",
      "arrival",
      "military_and_cargo",
      "trade_and_donkey",
      "amm_and_lp",
      "reward_state",
      "pending_withdrawal",
      "active_exit_backing",
      "player_economic_lock",
      "exit_position",
    ]);

    for (const family of inventory.families) {
      expect(family.indexSchema).toEqual({
        key: ["game_id:GameId", "family:u16", "index:u64"],
        highWatermark: "exclusive",
        stableIds: "monotonic-never-reused",
        deletion: "explicit-tombstone",
      });
      expect(family.chunking.chunkSize).toBeGreaterThan(0);
      expect(family.chunking.splitRule).toContain("ascending stable index");
      expect(family.schemaHash).toMatch(/^0x[0-9a-f]+$/);
    }
    expect(inventory.familyRegistryHash).toBe("0x629ea1a717e1552114e5802873b00f43d9b005fba157c4c9d481f180e0377b9");
    expect(inventory.inventoryHash).toBe("0x6db7d817adfc8b232ed97212b841c8f321768b284ab3a0d666566c1bf7c0bf0");
  });

  test("fails closed when generated coverage is missing or duplicated", () => {
    const inventory = structuredClone(getExitFamilyInventory());
    const removedWrite = inventory.families[0].sourceWriteIds.pop();
    expect(removedWrite).toBeTruthy();
    expect(() => validateExitFamilyInventory(inventory)).toThrow(/source write projection/);

    const duplicate = structuredClone(getExitFamilyInventory());
    duplicate.families[1].sourceWriteIds.push(duplicate.families[0].sourceWriteIds[0]);
    expect(() => validateExitFamilyInventory(duplicate)).toThrow(/source write projection/);
  });

  test("blocks release until every family mapping and maximum cardinality is reviewed", () => {
    const inventory = getExitFamilyInventory();

    expect(inventory.unresolved.length).toBeGreaterThan(0);
    expect(inventory.families.every((family) => family.cardinality.maximumPositionsPerGame === null)).toBe(true);
    expect(() => validateExitFamilyInventoryForRelease(inventory)).toThrow(/not release ready/);

    const forgedRelease = structuredClone(inventory);
    forgedRelease.releaseReady = true;
    expect(() => validateExitFamilyInventory(forgedRelease)).toThrow(/unresolved release blockers/);
  });
});

interface EconomicWrite {
  id: string;
  exitCoveredCandidate: boolean;
}

function readJson(url: URL): any {
  return JSON.parse(readFileSync(url, "utf8"));
}
