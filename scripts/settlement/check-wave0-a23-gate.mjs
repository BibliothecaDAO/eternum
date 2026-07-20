import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const decision = readJson("packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json");
const schemaRegistry = readJson("packages/settlement-codec/schema/schema-registry-v1.json");
const authority = readJson("packages/settlement-codec/schema/authority-inventory-v1.json");
const exitFamilies = readJson("packages/settlement-codec/schema/exit-family-inventory-v0.json");

assertStopDecision();
assertProductionDependencyMatrix();
assertFrozenAndCandidateInputs();
assertA17Evidence();
assertAuthorizationState();
assertRuntimeEnforcement();

function assertStopDecision() {
  assertEqual(decision.schemaVersion, 1, "A23 schema version");
  assertEqual(decision.ticket, "A23", "decision ticket");
  assertEqual(decision.decision, "STOP", "Wave 0 decision");
  assertEqual(decision.releaseReady, false, "release readiness");
  assertEqual(decision.productionStartAuthorized, false, "production authorization");

  const blockers = decision.wave0.filter((ticket) => ticket.mandatoryBlocker);
  assert(blockers.length > 0, "A23 STOP record must enumerate mandatory blockers");
  assert(
    blockers.every((ticket) => ticket.status !== "complete"),
    "A23 mandatory blockers cannot be marked complete",
  );
}

function assertProductionDependencyMatrix() {
  for (const epic of ["B", "C", "D", "E", "F"]) {
    const entry = decision.productionEpics[epic];
    assertEqual(entry?.status, "blocked", `Epic ${epic} status`);
    assertDeepEqual(entry?.dependsOn, ["A23"], `Epic ${epic} dependency`);
  }
}

function assertFrozenAndCandidateInputs() {
  const inputs = decision.frozenAndCandidateInputs;
  assertEqual(inputs.protocolSchema.registryHash, schemaRegistry.schemaRegistryHash, "protocol registry hash");
  assertFileHash("packages/settlement-codec/schema/schema-registry-v1.json", inputs.protocolSchema.fileSha256);

  assertEqual(authority.status, "blocked-a20-mutation-review", "A20 inventory status");
  assertEqual(authority.releaseReady, false, "A20 release readiness");
  assertEqual(
    authority.authoritativeAddressInputsHash,
    inputs.authorityInventory.authoritativeAddressInputsHash,
    "A20 address input hash",
  );
  assertEqual(
    authority.privilegedMutationPathsHash,
    inputs.authorityInventory.privilegedMutationPathsHash,
    "A20 mutation path hash",
  );
  assertEqual(
    authority.authoritySchema.authoritySchemaHash,
    inputs.authorityInventory.candidateAuthoritySchemaHash,
    "A20 candidate authority schema hash",
  );
  assertEqual(
    authority.unresolvedMutationCandidates.length,
    inputs.authorityInventory.unresolvedMutationCandidates,
    "A20 unresolved mutation count",
  );
  assertFileHash("packages/settlement-codec/schema/authority-inventory-v1.json", inputs.authorityInventory.fileSha256);

  assertEqual(exitFamilies.status, "a22-candidate-incomplete", "A22 inventory status");
  assertEqual(exitFamilies.releaseReady, false, "A22 release readiness");
  for (const field of ["familyRegistryHash", "inventoryHash", "sourceProjectionHash", "excludedProjectionHash"]) {
    assertEqual(exitFamilies[field], inputs.exitFamilyInventory[field], `A22 ${field}`);
  }
  for (const field of [
    "discoveredWrites",
    "exitCoveredWrites",
    "excludedWrites",
    "familyCount",
    "familiesWithoutDiscoveredWrites",
  ]) {
    assertEqual(exitFamilies.summary[field], inputs.exitFamilyInventory[field], `A22 ${field}`);
  }
  assertFileHash(
    "packages/settlement-codec/schema/exit-family-inventory-v0.json",
    inputs.exitFamilyInventory.fileSha256,
  );
  assertFileHash(
    "packages/settlement-codec/schema/economic-write-inventory-v0.json",
    inputs.economicWriteInventorySha256,
  );
  assertFileHash("packages/settlement-codec/schema/onchain-observation-a20-v1.json", inputs.onchainObservationSha256);
}

function assertA17Evidence() {
  const evidence = decision.performanceEvidence.a17;
  assertEqual(evidence.result, "pass", "A17 result");
  for (const field of [
    "atomicAppendSteps",
    "mixedMaximumJourneySteps",
    "rolloverSteps",
    "thirtyTwoWorldClosureSteps",
    "worstDistributionSteps",
  ]) {
    assert(evidence[field] <= evidence.ciCeiling, `A17 ${field} exceeds the declared CI ceiling`);
  }
  assertEqual(decision.topologyDecision.status, "redesign-selected-rebaseline-required", "A17 topology decision");
}

function assertAuthorizationState() {
  assertEqual(decision.authorization.status, "awaiting-authorized-signatures", "A23 authorization status");
  assertDeepEqual(decision.authorization.signatures, [], "A23 signatures");
  assertDeepEqual(decision.authorization.namedTicketDris, [], "A23 DRI assignments");
  assertDeepEqual(decision.authorization.namedIndependentReviewers, [], "A23 reviewer assignments");
  assertDeepEqual(decision.authorization.namedAuditOwners, [], "A23 audit assignments");
}

function assertRuntimeEnforcement() {
  const apiSource = readText("config/deployer/clean/runtime/aws/game-stack-api.ts");
  const orchestratorSource = readText("config/deployer/clean/game-stack/orchestrator.ts");
  assert(
    apiSource.includes("wave0-a23-stop-decision-v1.json") && apiSource.includes("assertProductionReleaseAuthorized"),
    "AWS game-stack admission must consume the checked-in A23 release decision",
  );
  assert(
    orchestratorSource.includes("dependencies.assertProductionReleaseAuthorized"),
    "game-stack publication must recheck A23 production authorization",
  );
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function assertFileHash(relativePath, expectedHash) {
  const content = readFileSync(resolve(repositoryRoot, relativePath));
  const actualHash = createHash("sha256").update(content).digest("hex");
  assertEqual(actualHash, expectedHash, `${relativePath} SHA-256`);
}

function assertEqual(actual, expected, label) {
  assert(
    actual === expected,
    `${label} mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}

function assertDeepEqual(actual, expected, label) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
