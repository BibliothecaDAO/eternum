import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  getExitFamilyInventory,
  validateExitFamilyInventory,
  validateExitFamilyInventoryForRelease,
} from "./exit-family-inventory";
import {
  computeExitFamilyInventoryHash,
  computeExitFamilySchemaHash,
  computeExitFamilySourceProjectionHash,
} from "./exit-family-commitments";

const economicWriteInventoryUrl = new URL("../schema/economic-write-inventory-v0.json", import.meta.url);

describe("A22 exit-family inventory", () => {
  test("returns an isolated inventory that cannot corrupt later reads", () => {
    const inventory = getExitFamilyInventory();
    inventory.families[0].sourceWriteIds.pop();

    expect(() => validateExitFamilyInventory(inventory)).toThrow(/source write projection/);
    expect(() => validateExitFamilyInventory(getExitFamilyInventory())).not.toThrow();
  });

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

    expect(inventory.status).toBe("a22-stop-redesign-required");
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
    expect(inventory.familyRegistryHash).toBe("0xb4a640a21643ae02efd007c6f1cfbb7abed63a18e8447f1996f2c910af997b");
    expect(inventory.inventoryHash).toBe("0x697a50dd0181120563a75da511fffcc6217821944b11b6e72b4b7c1e7dedf04");
  });

  test("binds reviewed cardinality and each writer's family assignment into commitments", () => {
    const inventory = getExitFamilyInventory();
    const family = inventory.families[0];
    const schemaInput = {
      familyId: family.familyId,
      capabilityFamily: family.capabilityFamily,
      sourceIdentityFields: family.sourceIdentity.fields,
      indexKey: family.indexSchema.key,
      highWatermark: family.indexSchema.highWatermark,
      stableIds: family.indexSchema.stableIds,
      deletion: family.indexSchema.deletion,
      chunkSize: family.chunking.chunkSize,
      splitRule: family.chunking.splitRule,
      maximumPositionsPerGame: family.cardinality.maximumPositionsPerGame,
      operationIds: family.operationIds,
      affectedModels: family.affectedModels,
    };

    expect(computeExitFamilySchemaHash({ ...schemaInput, maximumPositionsPerGame: 1024 })).not.toBe(
      computeExitFamilySchemaHash(schemaInput),
    );
    expect(computeExitFamilySourceProjectionHash(1, ["writer-a"])).not.toBe(
      computeExitFamilySourceProjectionHash(2, ["writer-a"]),
    );
    expect(family.familyProjectionHash).toBe(
      computeExitFamilySourceProjectionHash(family.familyId, family.sourceWriteIds),
    );
    const familySourceProjectionHashes = inventory.families.map((candidate) => candidate.familyProjectionHash);
    expect(
      computeExitFamilyInventoryHash({
        familyRegistryHash: inventory.familyRegistryHash,
        familySourceProjectionHashes,
        excludedSourceWriteIds: inventory.excludedWriteIds,
      }),
    ).toBe(inventory.inventoryHash);
    familySourceProjectionHashes[0] = computeExitFamilySourceProjectionHash(2, family.sourceWriteIds);
    expect(
      computeExitFamilyInventoryHash({
        familyRegistryHash: inventory.familyRegistryHash,
        familySourceProjectionHashes,
        excludedSourceWriteIds: inventory.excludedWriteIds,
      }),
    ).not.toBe(inventory.inventoryHash);
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

  test("records the failed feasibility properties and exact D5-D9 redesign split", () => {
    const inventory = getExitFamilyInventory();

    expect(inventory.unresolved.length).toBeGreaterThan(0);
    expect(inventory.families.every((family) => family.cardinality.maximumPositionsPerGame === null)).toBe(true);
    expect(inventory.families.every((family) => family.cardinality.status === "failed-no-enforced-bound")).toBe(true);
    expect(inventory.families.every((family) => family.sourceIdentity.status === "failed-no-canonical-index")).toBe(
      true,
    );
    expect(inventory.reviewFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "economic-false-negative",
          sourceWriteId: "contracts/game/src/models/agent.cairo:89:write_model",
        }),
        expect.objectContaining({
          kind: "configuration-false-positive",
          sourceWriteId: "contracts/game/src/models/hyperstructure.cairo:71:write_model",
        }),
      ]),
    );
    expect(inventory.implementationIssues.map(({ ticket }) => ticket).toSorted()).toEqual([
      "D5",
      "D6",
      "D7",
      "D8",
      "D9",
    ]);
    expect(inventory.implementationIssues.flatMap(({ familyIds }) => familyIds).toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
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
