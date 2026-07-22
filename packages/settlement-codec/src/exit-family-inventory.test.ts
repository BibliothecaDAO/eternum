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
import {
  validateExitFamilySourceIdentityCandidateValue,
  validateExitFamilySourceIdentityPolicy,
  validateExitFamilySourceModelEvidence,
} from "./exit-family-source-identity";

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
    expect(inventory.familyRegistryHash).toBe("0x462a2e6b6d1f6f3d815c25d5b223ee06914dace9f96db73fb530223bd3bc1eb");
    expect(inventory.inventoryHash).toBe("0x550dd0326b6db4d6fbf528d3980eac2a7ef269c0cec806aea8ed3a1e50c0c4f");
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
    expect(
      computeExitFamilySchemaHash({
        ...schemaInput,
        sourceIdentityFields: schemaInput.sourceIdentityFields.map((field) =>
          field.name === "resource_id" ? { ...field, type: "u64" } : field,
        ),
      }),
    ).not.toBe(computeExitFamilySchemaHash(schemaInput));
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

  test("records the remaining feasibility failures and exact D5-D9 redesign split", () => {
    const inventory = getExitFamilyInventory();

    expect(inventory.unresolved.length).toBeGreaterThan(0);
    expect(inventory.families.every((family) => family.cardinality.maximumPositionsPerGame === null)).toBe(true);
    expect(inventory.families.every((family) => family.cardinality.status === "failed-no-reviewed-bound")).toBe(true);
    expect(
      inventory.families.every(
        (family) =>
          family.cardinality.formula.length > 0 &&
          family.cardinality.requiredInputs.length > 0 &&
          family.cardinality.capExhaustion.length > 0,
      ),
    ).toBe(true);
    expect(inventory.families.map((family) => family.cardinality.candidateMaximumPositionsPerGame)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      4096,
      null,
      null,
    ]);
    expect(
      inventory.families
        .filter((family) => family.sourceIdentity.status === "interface-reviewed")
        .map(({ familyId }) => familyId),
    ).toEqual([1, 2, 3, 9, 10, 11, 12]);
    expect(
      inventory.families
        .filter((family) => family.sourceIdentity.status === "unresolved")
        .map(({ familyId }) => familyId),
    ).toEqual([4, 5, 6, 7, 8]);
    expect(
      inventory.families
        .filter((family) => family.sourceIdentity.status === "interface-reviewed")
        .every((family) => family.sourceIdentity.fields.every(({ type }) => type !== null)),
    ).toBe(true);
    expect(
      inventory.families
        .filter((family) => family.sourceIdentity.status === "unresolved")
        .every((family) => family.sourceIdentity.unresolvedReason),
    ).toBe(true);
    const invalidEvidence = structuredClone(inventory.families[0].sourceIdentity);
    invalidEvidence.fields[0].interfaceMembers[0].member = "not_a_frozen_member";
    expect(() => validateExitFamilySourceIdentityPolicy(1, invalidEvidence)).toThrow(/not in the frozen ABI/);
    expect(() =>
      validateExitFamilySourceIdentityCandidateValue(
        1,
        { ...inventory.families[0].sourceIdentity, status: "unknown" as never },
        { entity_id: 1, resource_id: 1 },
      ),
    ).toThrow(/unknown source identity status/);
    expect(() =>
      validateExitFamilySourceModelEvidence(
        1,
        [{ path: "resource.cairo", model: "Resource", members: ["missing_member"] }],
        () => "pub struct Resource {\n    entity_id: u32,\n}",
      ),
    ).toThrow(/source model evidence is stale/);
    expect(inventory.exclusionReviewStatus).toBe("reviewed");
    expect(inventory.reviewFindings).toEqual([
      expect.objectContaining({
        kind: "missing-production-index-and-enforcement",
        sourceWriteId: "production:ExitPosition",
      }),
    ]);
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
