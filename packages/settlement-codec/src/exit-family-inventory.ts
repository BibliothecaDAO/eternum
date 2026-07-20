import economicCapabilityRegistryJson from "../schema/economic-capability-registry-v1.json";
import economicWriteInventoryJson from "../schema/economic-write-inventory-v0.json";
import exitFamilyInventoryJson from "../schema/exit-family-inventory-v0.json";
import exitFamilyPolicyJson from "../schema/exit-family-policy-v0.json";
import {
  computeExitFamilyInventoryHash,
  computeExitFamilyRegistryHash,
  computeExitFamilySchemaHash,
  computeExitFamilySourceProjectionHash,
  computeExitSourceProjectionHash,
} from "./exit-family-commitments";

export type ExitFamilyReviewStatus = "failed-no-canonical-index" | "reviewed";
export type ExitFamilyMappingStatus = "failed-heuristic-projection" | "missing-production-interface" | "reviewed";

export interface ExitFamilyInventoryFamily {
  familyId: number;
  capabilityFamily: string;
  sourceIdentity: { fields: string[]; status: ExitFamilyReviewStatus };
  indexSchema: {
    key: string[];
    highWatermark: "exclusive";
    stableIds: "monotonic-never-reused";
    deletion: "explicit-tombstone";
  };
  chunking: { chunkSize: number; splitRule: string };
  cardinality: { maximumPositionsPerGame: number | null; status: "failed-no-enforced-bound" | "reviewed" };
  sourceWriteMappingStatus: ExitFamilyMappingStatus;
  operationIds: number[];
  affectedModels: string[];
  sourceWriteIds: string[];
  sourceFiles: string[];
  sourceWriteCount: number;
  sourceFileCount: number;
  familyProjectionHash: string;
  schemaHash: string;
}

export interface ExitFamilyInventory {
  version: 0;
  status: "a22-stop-redesign-required" | "a22-frozen";
  generatedFrom: {
    policyVersion: number;
    economicCapabilityRegistryVersion: number;
    economicWriteInventoryVersion: number;
  };
  familyRegistryHash: string;
  sourceProjectionHash: string;
  excludedProjectionHash: string;
  inventoryHash: string;
  releaseReady: boolean;
  exclusionReviewStatus: "failed-known-false-negative" | "reviewed";
  summary: {
    discoveredWrites: number;
    exitCoveredWrites: number;
    excludedWrites: number;
    familyCount: number;
    familiesWithoutDiscoveredWrites: number;
  };
  families: ExitFamilyInventoryFamily[];
  excludedWriteIds: string[];
  reviewFindings: Array<{
    kind: string;
    sourceWriteId: string;
    observedClassification: string;
    requiredDisposition: string;
    detail: string;
  }>;
  implementationIssues: Array<{
    ticket: "D5" | "D6" | "D7" | "D8" | "D9";
    familyIds: number[];
    scope: string;
    sourceWriteCount: number;
    sourceFileCount: number;
    sourceFiles: string[];
    missingProductionFamilyIds: number[];
    requiredBoundEvidence: string[];
  }>;
  unresolved: Array<{ kind: string; familyIds: number[]; detail: string }>;
}

const INVENTORY = exitFamilyInventoryJson as ExitFamilyInventory;
const POLICY = exitFamilyPolicyJson;
const CAPABILITY_REGISTRY = economicCapabilityRegistryJson;
const ECONOMIC_WRITES = economicWriteInventoryJson.entries;

export function getExitFamilyInventory(): ExitFamilyInventory {
  return structuredClone(INVENTORY);
}

export function validateExitFamilyInventory(inventory: ExitFamilyInventory): void {
  validateGeneratedVersions(inventory);
  validateFamilyProjection(inventory);
  validateSourceWriteProjection(inventory);
  validateCommitments(inventory);
  validateReleaseClaim(inventory);
}

export function validateExitFamilyInventoryForRelease(inventory: ExitFamilyInventory): void {
  validateExitFamilyInventory(inventory);
  const blockers = collectReleaseBlockers(inventory);
  if (blockers.length > 0) {
    throw new Error(`exit-family inventory is not release ready: ${blockers.join("; ")}`);
  }
}

function validateGeneratedVersions(inventory: ExitFamilyInventory): void {
  if (inventory.version !== POLICY.version || inventory.generatedFrom.policyVersion !== POLICY.version) {
    throw new Error("exit-family inventory policy version mismatch");
  }
  if (inventory.generatedFrom.economicCapabilityRegistryVersion !== CAPABILITY_REGISTRY.version) {
    throw new Error("exit-family inventory capability-registry version mismatch");
  }
  if (inventory.generatedFrom.economicWriteInventoryVersion !== economicWriteInventoryJson.version) {
    throw new Error("exit-family inventory economic-write version mismatch");
  }
}

function validateFamilyProjection(inventory: ExitFamilyInventory): void {
  if (inventory.status !== POLICY.status) throw new Error("exit-family inventory review status mismatch");
  if (inventory.exclusionReviewStatus !== POLICY.reviewPolicy.exclusionStatus) {
    throw new Error("exit-family exclusion review status mismatch");
  }
  const expectedFamilies = CAPABILITY_REGISTRY.families.map((family, index) => ({
    familyId: index + 1,
    capabilityFamily: family.id,
  }));
  const actualFamilies = inventory.families.map(({ familyId, capabilityFamily }) => ({ familyId, capabilityFamily }));
  assertEqualJson(actualFamilies, expectedFamilies, "exit-family capability projection mismatch");
  assertEqualJson(
    inventory.families.map((family) => family.sourceIdentity.fields),
    POLICY.families.map((family) => family.sourceIdentity),
    "exit-family source identity projection mismatch",
  );

  for (const family of inventory.families) {
    assertEqualJson(family.indexSchema, POLICY.indexSchema, `exit-family ${family.familyId} index schema mismatch`);
    assertEqualJson(family.chunking, POLICY.chunking, `exit-family ${family.familyId} chunking mismatch`);
    if (family.sourceIdentity.status !== POLICY.reviewPolicy.sourceIdentityStatus) {
      throw new Error(`exit-family ${family.familyId} source identity review mismatch`);
    }
    assertEqualJson(
      family.cardinality,
      {
        maximumPositionsPerGame: POLICY.reviewPolicy.maximumPositionsPerGame,
        status: POLICY.reviewPolicy.cardinalityStatus,
      },
      `exit-family ${family.familyId} cardinality review mismatch`,
    );
    const operations = CAPABILITY_REGISTRY.operations.filter(
      (operation) => operation.family === family.capabilityFamily,
    );
    assertEqualJson(
      family.operationIds,
      operations.map((operation) => operation.operationId),
      `exit-family ${family.familyId} operation projection mismatch`,
    );
    assertEqualJson(
      family.affectedModels,
      operations.flatMap((operation) => operation.affectedModels),
      `exit-family ${family.familyId} model projection mismatch`,
    );
    const expectedMappingStatus =
      family.sourceWriteIds.length === 0
        ? "missing-production-interface"
        : POLICY.reviewPolicy.sourceWriteMappingStatus;
    if (family.sourceWriteMappingStatus !== expectedMappingStatus) {
      throw new Error(`exit-family ${family.familyId} write mapping review mismatch`);
    }
  }
  const allFamilyIds = inventory.families.map((family) => family.familyId);
  const expectedReleaseBlockers = POLICY.releaseBlockers.map(({ kind, scope, detail }) => ({
    kind,
    familyIds: scope === "all-families" ? allFamilyIds : [],
    detail,
  }));
  assertEqualJson(inventory.unresolved, expectedReleaseBlockers, "exit-family release blockers mismatch");
  assertEqualJson(inventory.reviewFindings, POLICY.reviewFindings, "exit-family review findings mismatch");
  validateImplementationIssues(inventory);
}

function validateImplementationIssues(inventory: ExitFamilyInventory): void {
  const coveredFamilyIds = inventory.implementationIssues.flatMap(({ familyIds }) => familyIds);
  assertUniqueAndEqual(
    coveredFamilyIds.map(String),
    inventory.families.map(({ familyId }) => String(familyId)),
    "D5-D9 family issue projection",
  );
  for (const issue of inventory.implementationIssues) {
    const families = inventory.families.filter(({ familyId }) => issue.familyIds.includes(familyId));
    const sourceFiles = [...new Set(families.flatMap((family) => family.sourceFiles))].sort();
    if (
      issue.sourceWriteCount !== families.reduce((total, family) => total + family.sourceWriteCount, 0) ||
      issue.sourceFileCount !== sourceFiles.length
    ) {
      throw new Error(`${issue.ticket} source projection count mismatch`);
    }
    assertEqualJson(issue.sourceFiles, sourceFiles, `${issue.ticket} source file projection mismatch`);
    assertEqualJson(
      issue.missingProductionFamilyIds,
      families.filter(({ sourceWriteCount }) => sourceWriteCount === 0).map(({ familyId }) => familyId),
      `${issue.ticket} missing production family projection mismatch`,
    );
    if (issue.requiredBoundEvidence.length === 0) throw new Error(`${issue.ticket} has no bound evidence contract`);
  }
}

function validateSourceWriteProjection(inventory: ExitFamilyInventory): void {
  const expectedCoveredIds = ECONOMIC_WRITES.filter((write) => write.exitCoveredCandidate).map((write) => write.id);
  const actualCoveredIds = inventory.families.flatMap((family) => family.sourceWriteIds);
  const expectedExcludedIds = ECONOMIC_WRITES.filter((write) => !write.exitCoveredCandidate).map((write) => write.id);

  assertUniqueAndEqual(actualCoveredIds, expectedCoveredIds, "source write projection");
  assertUniqueAndEqual(inventory.excludedWriteIds, expectedExcludedIds, "excluded source write projection");

  for (const family of inventory.families) {
    const expectedWrites = ECONOMIC_WRITES.filter(
      (write) => write.exitCoveredCandidate && write.classification === family.capabilityFamily,
    );
    assertEqualJson(
      family.sourceWriteIds,
      expectedWrites.map((write) => write.id),
      `exit-family ${family.familyId} source write projection mismatch`,
    );
    assertEqualJson(
      family.sourceFiles,
      [...new Set(expectedWrites.map((write) => write.path))].sort(),
      `exit-family ${family.familyId} source file projection mismatch`,
    );
    if (
      family.sourceWriteCount !== family.sourceWriteIds.length ||
      family.sourceFileCount !== family.sourceFiles.length
    ) {
      throw new Error(`exit-family ${family.familyId} source projection count mismatch`);
    }
    if (family.familyProjectionHash !== computeExitFamilySourceProjectionHash(family.familyId, family.sourceWriteIds)) {
      throw new Error(`exit-family ${family.familyId} source projection commitment mismatch`);
    }
  }

  const expectedSummary = {
    discoveredWrites: ECONOMIC_WRITES.length,
    exitCoveredWrites: expectedCoveredIds.length,
    excludedWrites: expectedExcludedIds.length,
    familyCount: inventory.families.length,
    familiesWithoutDiscoveredWrites: inventory.families.filter((family) => family.sourceWriteCount === 0).length,
  };
  assertEqualJson(inventory.summary, expectedSummary, "exit-family inventory summary mismatch");
}

function validateCommitments(inventory: ExitFamilyInventory): void {
  const expectedFamilyHashes = inventory.families.map((family) =>
    computeExitFamilySchemaHash(familyCommitment(family)),
  );
  assertEqualJson(
    inventory.families.map((family) => family.schemaHash),
    expectedFamilyHashes,
    "exit-family schema commitment mismatch",
  );

  const coveredIds = inventory.families.flatMap((family) => family.sourceWriteIds);
  const familyRegistryHash = computeExitFamilyRegistryHash(expectedFamilyHashes);
  const sourceProjectionHash = computeExitSourceProjectionHash(coveredIds);
  const excludedProjectionHash = computeExitSourceProjectionHash(inventory.excludedWriteIds);
  if (inventory.familyRegistryHash !== familyRegistryHash) throw new Error("exit-family registry commitment mismatch");
  if (inventory.sourceProjectionHash !== sourceProjectionHash)
    throw new Error("source write projection commitment mismatch");
  if (inventory.excludedProjectionHash !== excludedProjectionHash) {
    throw new Error("excluded source write projection commitment mismatch");
  }
  const inventoryHash = computeExitFamilyInventoryHash({
    familyRegistryHash,
    familySourceProjectionHashes: inventory.families.map((family) => family.familyProjectionHash),
    excludedSourceWriteIds: inventory.excludedWriteIds,
  });
  if (inventory.inventoryHash !== inventoryHash) throw new Error("exit-family inventory commitment mismatch");
}

function validateReleaseClaim(inventory: ExitFamilyInventory): void {
  if (inventory.releaseReady && collectReleaseBlockers(inventory).length > 0) {
    throw new Error("exit-family inventory claims release readiness with unresolved release blockers");
  }
}

function collectReleaseBlockers(inventory: ExitFamilyInventory): string[] {
  const blockers = inventory.unresolved.map((blocker) => blocker.kind);
  if (inventory.status !== "a22-frozen") blockers.push("status is not a22-frozen");
  if (!inventory.releaseReady) blockers.push("releaseReady is false");
  if (inventory.exclusionReviewStatus !== "reviewed") blockers.push("exclusions are not reviewed");
  for (const family of inventory.families) {
    if (family.sourceIdentity.status !== "reviewed")
      blockers.push(`family ${family.familyId} source identity is unreviewed`);
    if (family.sourceWriteMappingStatus !== "reviewed")
      blockers.push(`family ${family.familyId} write mapping is unreviewed`);
    if (
      family.cardinality.status !== "reviewed" ||
      !Number.isSafeInteger(family.cardinality.maximumPositionsPerGame) ||
      (family.cardinality.maximumPositionsPerGame ?? 0) < 1
    ) {
      blockers.push(`family ${family.familyId} cardinality is unresolved`);
    }
  }
  return blockers;
}

function familyCommitment(family: ExitFamilyInventoryFamily) {
  return {
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
}

function assertUniqueAndEqual(actual: string[], expected: string[], label: string): void {
  if (
    new Set(actual).size !== actual.length ||
    JSON.stringify(actual.toSorted()) !== JSON.stringify(expected.toSorted())
  ) {
    throw new Error(`${label} does not cover each discovered write exactly once`);
  }
}

function assertEqualJson(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}
