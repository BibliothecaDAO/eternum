import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  computeExitFamilyInventoryHash,
  computeExitFamilyRegistryHash,
  computeExitFamilySchemaHash,
  computeExitFamilySourceProjectionHash,
  computeExitSourceProjectionHash,
} from "../../packages/settlement-codec/src/exit-family-commitments";
import {
  resolveExitFamilyReleaseBlockerFamilyIds,
  type ExitFamilyReleaseBlockerScope,
  type ExitFamilySourceIdentityPolicy,
  validateExitFamilySourceIdentityPolicy,
  validateExitFamilySourceModelEvidence,
} from "../../packages/settlement-codec/src/exit-family-source-identity";
import {
  type ExitFamilyCardinalityReview,
  type ExitFamilySourceAudit,
  validateExitFamilyCardinalityReview,
} from "../../packages/settlement-codec/src/exit-family-inventory";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const policyPath = resolve(repositoryRoot, "packages/settlement-codec/schema/exit-family-policy-v0.json");
const capabilityRegistryPath = resolve(
  repositoryRoot,
  "packages/settlement-codec/schema/economic-capability-registry-v1.json",
);
const economicWriteInventoryPath = resolve(
  repositoryRoot,
  "packages/settlement-codec/schema/economic-write-inventory-v0.json",
);
const outputPath = resolve(repositoryRoot, "packages/settlement-codec/schema/exit-family-inventory-v0.json");
const shouldCheck = process.argv.includes("--check");

const policy = readJson(policyPath) as ExitFamilyPolicy;
const capabilityRegistry = readJson(capabilityRegistryPath) as EconomicCapabilityRegistry;
const economicWriteInventory = readJson(economicWriteInventoryPath) as EconomicWriteInventory;
const validWriteDispositions = new Set([...capabilityRegistry.families.map((family) => family.id), "out_of_scope"]);
const inventory = buildExitFamilyInventory();
const rendered = `${JSON.stringify(inventory, null, 2)}\n`;

if (shouldCheck) {
  assertGeneratedArtifactIsCurrent();
} else {
  writeFileSync(outputPath, rendered);
}

function buildExitFamilyInventory() {
  assertPolicyMatchesFrozenCapabilities();
  assertCardinalityReviewsAreComplete();
  assertSourceAuditsAreComplete();
  const reviewFindings = validateReviewFindings();
  const families = policy.families.map(buildFamilyInventory);
  const coveredSourceWriteIds = families.flatMap((family) => family.sourceWriteIds);
  const excludedWriteIds = economicWriteInventory.entries
    .filter((entry) => !entry.exitCoveredCandidate)
    .map((entry) => entry.id);
  const familyRegistryHash = computeExitFamilyRegistryHash(families.map((family) => family.schemaHash));

  return {
    version: policy.version,
    status: policy.status,
    generatedFrom: {
      policyVersion: policy.version,
      economicCapabilityRegistryVersion: capabilityRegistry.version,
      economicWriteInventoryVersion: economicWriteInventory.version,
    },
    familyRegistryHash,
    sourceProjectionHash: computeExitSourceProjectionHash(coveredSourceWriteIds),
    excludedProjectionHash: computeExitSourceProjectionHash(excludedWriteIds),
    inventoryHash: computeExitFamilyInventoryHash({
      familyRegistryHash,
      familySourceProjectionHashes: families.map((family) => family.familyProjectionHash),
      excludedSourceWriteIds: excludedWriteIds,
    }),
    releaseReady: false,
    exclusionReviewStatus: policy.reviewPolicy.exclusionStatus,
    summary: {
      discoveredWrites: economicWriteInventory.entries.length,
      exitCoveredWrites: coveredSourceWriteIds.length,
      excludedWrites: excludedWriteIds.length,
      familyCount: families.length,
      familiesWithoutDiscoveredWrites: families.filter((family) => family.sourceWriteCount === 0).length,
    },
    families,
    excludedWriteIds,
    reviewFindings,
    implementationIssues: buildImplementationIssues(families),
    unresolved: buildReleaseBlockers(families),
  };
}

function buildFamilyInventory(familyPolicy: ExitFamilyPolicy["families"][number]) {
  validateExitFamilySourceIdentityPolicy(familyPolicy.familyId, familyPolicy.sourceIdentity);
  validateExitFamilySourceModelEvidence(
    familyPolicy.familyId,
    familyPolicy.sourceIdentity.sourceModels,
    readRepositorySource,
  );
  const operations = capabilityRegistry.operations.filter(
    (candidate) => candidate.family === familyPolicy.capabilityFamily,
  );
  if (operations.length === 0) throw new Error(`missing operation for exit family: ${familyPolicy.capabilityFamily}`);

  const sourceWrites = economicWriteInventory.entries.filter(
    (entry) => entry.exitCoveredCandidate && entry.classification === familyPolicy.capabilityFamily,
  );
  const sourceFiles = [...new Set(sourceWrites.map((entry) => entry.path))].sort();
  const cardinalityReview = resolveCardinalityReview(familyPolicy.familyId);
  const sourceAudit = resolveSourceAudit(familyPolicy.familyId);
  const commitmentInput = {
    familyId: familyPolicy.familyId,
    capabilityFamily: familyPolicy.capabilityFamily,
    sourceIdentityFields: familyPolicy.sourceIdentity.fields,
    indexKey: policy.indexSchema.key,
    highWatermark: policy.indexSchema.highWatermark,
    stableIds: policy.indexSchema.stableIds,
    deletion: policy.indexSchema.deletion,
    chunkSize: policy.chunking.chunkSize,
    splitRule: policy.chunking.splitRule,
    maximumPositionsPerGame: policy.reviewPolicy.maximumPositionsPerGame,
    operationIds: operations.map((operation) => operation.operationId),
    affectedModels: operations.flatMap((operation) => operation.affectedModels),
  };

  return {
    familyId: familyPolicy.familyId,
    capabilityFamily: familyPolicy.capabilityFamily,
    sourceIdentity: {
      ...familyPolicy.sourceIdentity,
    },
    sourceAudit,
    indexSchema: policy.indexSchema,
    chunking: policy.chunking,
    cardinality: {
      maximumPositionsPerGame: policy.reviewPolicy.maximumPositionsPerGame,
      status: policy.reviewPolicy.cardinalityStatus,
      ...projectCardinalityReview(cardinalityReview),
    },
    sourceWriteMappingStatus:
      sourceWrites.length === 0 ? "missing-production-interface" : policy.reviewPolicy.sourceWriteMappingStatus,
    operationIds: commitmentInput.operationIds,
    affectedModels: commitmentInput.affectedModels,
    sourceWriteIds: sourceWrites.map((entry) => entry.id),
    sourceFiles,
    sourceWriteCount: sourceWrites.length,
    sourceFileCount: sourceFiles.length,
    familyProjectionHash: computeExitFamilySourceProjectionHash(
      familyPolicy.familyId,
      sourceWrites.map((entry) => entry.id),
    ),
    schemaHash: computeExitFamilySchemaHash(commitmentInput),
  };
}

function resolveCardinalityReview(familyId: number) {
  const review = policy.cardinalityReviews.find((candidate) => candidate.familyId === familyId);
  if (!review) throw new Error(`missing A22 cardinality review for family ${familyId}`);
  return review;
}

function resolveSourceAudit(familyId: number) {
  const audit = policy.sourceAudits.find((candidate) => candidate.familyId === familyId);
  if (!audit) throw new Error(`missing A22 source audit for family ${familyId}`);
  return audit;
}

function projectCardinalityReview({ familyId: _, ...review }: ExitFamilyPolicy["cardinalityReviews"][number]) {
  return review;
}

function validateReviewFindings() {
  const writesById = new Map(economicWriteInventory.entries.map((entry) => [entry.id, entry]));
  return policy.reviewFindings.map((finding) => {
    if (finding.sourceWriteId === "production:ExitPosition") return finding;
    const source = writesById.get(finding.sourceWriteId);
    if (!source || source.classification !== finding.observedClassification) {
      throw new Error(`A22 review finding no longer matches the source inventory: ${finding.sourceWriteId}`);
    }
    return finding;
  });
}

function buildImplementationIssues(families: ReturnType<typeof buildFamilyInventory>[]) {
  const familiesById = new Map(families.map((family) => [family.familyId, family]));
  const coveredFamilyIds = policy.implementationIssues.flatMap(({ familyIds }) => familyIds);
  if (
    new Set(coveredFamilyIds).size !== coveredFamilyIds.length ||
    JSON.stringify(coveredFamilyIds.toSorted((left, right) => left - right)) !==
      JSON.stringify(families.map(({ familyId }) => familyId))
  ) {
    throw new Error("A22 D5-D9 issues must cover every family exactly once");
  }
  return policy.implementationIssues.map((issue) => {
    const issueFamilies = issue.familyIds.map((familyId) => {
      const family = familiesById.get(familyId);
      if (!family) throw new Error(`A22 implementation issue names unknown family ${familyId}`);
      return family;
    });
    const sourceFiles = [...new Set(issueFamilies.flatMap(({ sourceFiles }) => sourceFiles))].sort();
    return {
      ...issue,
      sourceWriteCount: issueFamilies.reduce((total, family) => total + family.sourceWriteCount, 0),
      sourceFileCount: sourceFiles.length,
      sourceFiles,
      missingProductionFamilyIds: issueFamilies
        .filter(({ sourceWriteCount }) => sourceWriteCount === 0)
        .map(({ familyId }) => familyId),
      requiredBoundEvidence: [
        "enforced-exclusive-high-water-cap",
        "monotonic-never-reused-index",
        "generation-and-explicit-tombstone",
        "exact-source-to-exit-position-projection",
        "bound-and-bound-plus-one-tests",
        "A8-maximum-witness-benchmark",
      ],
    };
  });
}

function buildReleaseBlockers(families: ReturnType<typeof buildFamilyInventory>[]) {
  return policy.releaseBlockers.map(({ kind, scope, detail }) => ({
    kind,
    familyIds: resolveExitFamilyReleaseBlockerFamilyIds(scope, families),
    detail,
  }));
}

function assertPolicyMatchesFrozenCapabilities() {
  const capabilityFamilies = capabilityRegistry.families.map((family) => family.id);
  const policyFamilies = policy.families.map((family) => family.capabilityFamily);
  if (JSON.stringify(policyFamilies) !== JSON.stringify(capabilityFamilies)) {
    throw new Error("exit-family policy does not match the ordered frozen capability families");
  }
  const expectedIds = policy.families.map((_, index) => index + 1);
  if (JSON.stringify(policy.families.map((family) => family.familyId)) !== JSON.stringify(expectedIds)) {
    throw new Error("exit-family policy IDs must be contiguous and one-based");
  }
}

function assertCardinalityReviewsAreComplete() {
  const expectedIds = policy.families.map((family) => family.familyId);
  if (JSON.stringify(policy.cardinalityReviews.map((review) => review.familyId)) !== JSON.stringify(expectedIds)) {
    throw new Error("A22 cardinality reviews must cover every family in frozen order");
  }
  for (const review of policy.cardinalityReviews) {
    validateExitFamilyCardinalityReview(review.familyId, review);
  }
}

function assertSourceAuditsAreComplete() {
  const expectedIds = policy.families.map((family) => family.familyId);
  if (JSON.stringify(policy.sourceAudits.map((audit) => audit.familyId)) !== JSON.stringify(expectedIds)) {
    throw new Error("A22 source audits must cover every family in frozen order");
  }

  const writesById = new Map(economicWriteInventory.entries.map((entry) => [entry.id, entry]));
  const reassignedWriteIds = new Set<string>();
  for (const audit of policy.sourceAudits) {
    assertSourceAuditNarrativeIsComplete(audit);
    const capabilityFamily = policy.families.find((family) => family.familyId === audit.familyId)?.capabilityFamily;
    if (!capabilityFamily) throw new Error(`A22 source audit names unknown family ${audit.familyId}`);
    for (const reassignment of audit.knownReassignments) {
      if (
        reassignment.observedClassification !== capabilityFamily ||
        reassignment.sourceWriteIds.length === 0 ||
        !validWriteDispositions.has(reassignment.requiredDisposition) ||
        !/^[0-9a-f]{64}$/.test(reassignment.sourceProjectionSha256)
      ) {
        throw new Error(`A22 source reassignment contract is invalid for family ${audit.familyId}`);
      }
      for (const sourceWriteId of reassignment.sourceWriteIds) {
        if (reassignedWriteIds.has(sourceWriteId)) {
          throw new Error(`A22 source reassignment is duplicated: ${sourceWriteId}`);
        }
        reassignedWriteIds.add(sourceWriteId);
        const write = writesById.get(sourceWriteId);
        if (
          !write ||
          write.originalClassification !== reassignment.observedClassification ||
          write.classification !== reassignment.requiredDisposition ||
          write.classificationSource !== "a22-source-audit-reassignment"
        ) {
          throw new Error(`A22 source reassignment is stale: ${sourceWriteId}`);
        }
        if (reassignment.requiredDisposition === reassignment.observedClassification) {
          throw new Error(`A22 source reassignment preserves the incorrect family: ${sourceWriteId}`);
        }
      }
    }
  }
}

function assertSourceAuditNarrativeIsComplete(audit: ExitFamilySourceAudit) {
  const requiredText = [audit.status, audit.ownerDerivation, audit.highWaterAllocation];
  const productionAbsent = audit.status === "interface-candidate-production-model-absent";
  if (
    requiredText.some((value) => value.trim().length === 0) ||
    (!productionAbsent && audit.sourceModelKeys.length === 0) ||
    audit.sourceModelKeys.some((value) => value.trim().length === 0) ||
    audit.lifecycle.length === 0 ||
    audit.lifecycle.some((value) => value.trim().length === 0) ||
    audit.projectionFindings.length === 0 ||
    audit.projectionFindings.some((value) => value.trim().length === 0)
  ) {
    throw new Error(`A22 source audit narrative is incomplete for family ${audit.familyId}`);
  }
}

function assertGeneratedArtifactIsCurrent() {
  const current = readFileSync(outputPath, "utf8");
  if (JSON.stringify(JSON.parse(current)) !== JSON.stringify(inventory)) {
    throw new Error(`stale generated exit-family inventory: ${relative(repositoryRoot, outputPath)}`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readRepositorySource(path: string): string {
  const sourcePath = resolve(repositoryRoot, path);
  if (!sourcePath.startsWith(`${repositoryRoot}/`))
    throw new Error(`source model evidence escapes repository: ${path}`);
  return readFileSync(sourcePath, "utf8");
}

interface ExitFamilyPolicy {
  version: 0;
  status: "a22-stop-redesign-required";
  indexSchema: {
    key: string[];
    highWatermark: "exclusive";
    stableIds: "monotonic-never-reused";
    deletion: "explicit-tombstone";
  };
  chunking: { chunkSize: number; splitRule: string };
  families: Array<{
    familyId: number;
    capabilityFamily: string;
    sourceIdentity: ExitFamilySourceIdentityPolicy;
  }>;
  cardinalityReviews: Array<{ familyId: number } & ExitFamilyCardinalityReview>;
  sourceAudits: ExitFamilySourceAudit[];
  reviewPolicy: {
    sourceWriteMappingStatus: "failed-heuristic-projection";
    exclusionStatus: "failed-known-false-negative" | "reviewed";
    maximumPositionsPerGame: null;
    cardinalityStatus: "failed-no-reviewed-bound";
  };
  reviewFindings: Array<{
    kind: string;
    sourceWriteId: string;
    observedClassification: string;
    requiredDisposition: string;
    detail: string;
  }>;
  implementationIssues: Array<{ ticket: `D${5 | 6 | 7 | 8 | 9}`; familyIds: number[]; scope: string }>;
  releaseBlockers: Array<{
    kind: string;
    scope: ExitFamilyReleaseBlockerScope;
    detail: string;
  }>;
}

interface EconomicCapabilityRegistry {
  version: number;
  families: Array<{ id: string }>;
  operations: Array<{ operationId: number; family: string; affectedModels: string[] }>;
}

interface EconomicWriteInventory {
  version: number;
  entries: Array<{
    id: string;
    path: string;
    classification: string;
    exitCoveredCandidate: boolean;
    originalClassification?: string;
    classificationSource?: string;
  }>;
}
