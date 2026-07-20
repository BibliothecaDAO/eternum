import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const decision = readJson("packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json");
const schemaRegistry = readJson("packages/settlement-codec/schema/schema-registry-v1.json");
const frozenPosition = readJson("packages/settlement-codec/schema/frozen-position-a5-v1.json");
const mmrPlan = readJson("packages/settlement-codec/schema/mmr-plan-a13-v1.json");
const emergencySealed = readJson("packages/settlement-codec/schema/emergency-sealed-a15-v1.json");
const frozenRecoveryMaterialization = readJson(
  "packages/settlement-codec/schema/frozen-recovery-materialization-a21-v1.json",
);
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

  assertEqual(frozenPosition.status, "reference-seam-complete-production-proof-blocked", "A5 frozen-position status");
  assertEqual(frozenPosition.releaseReady, false, "A5 release readiness");
  assertEqual(decision.wave0.find(({ ticket }) => ticket === "A5")?.status, frozenPosition.status, "A5 Wave 0 status");
  assertEqual(frozenPosition.protocolRegistryHash, schemaRegistry.schemaRegistryHash, "A5 protocol registry hash");
  assertEqual(
    frozenPosition.crossLanguageVector.journalHash,
    inputs.frozenPositionProof.journalHash,
    "A5 journal hash",
  );
  assertEqual(frozenPosition.costEvidence.sp1ProveDurationMs, null, "A5 SP1 prove evidence");
  assertEqual(frozenPosition.costEvidence.sp1VerifyDurationMs, null, "A5 SP1 verify evidence");
  assertFileHash("packages/settlement-codec/schema/frozen-position-a5-v1.json", inputs.frozenPositionProof.fileSha256);

  assertEqual(
    mmrPlan.status,
    "reference-guest-and-verifier-complete-production-receipt-blocked",
    "A13 MMR-plan status",
  );
  assertEqual(mmrPlan.releaseReady, false, "A13 release readiness");
  assertEqual(decision.wave0.find(({ ticket }) => ticket === "A13")?.status, mmrPlan.status, "A13 Wave 0 status");
  assertEqual(mmrPlan.protocolRegistryHash, schemaRegistry.schemaRegistryHash, "A13 protocol registry hash");
  assertEqual(mmrPlan.publicJournal.crossLanguageHash, inputs.mmrPlanProof.journalHash, "A13 journal hash");
  assertEqual(mmrPlan.costEvidence.sp1ProgramId, null, "A13 SP1 program identity");
  assertEqual(mmrPlan.costEvidence.sp1VerificationKeyHash, null, "A13 SP1 verification key");
  assertEqual(mmrPlan.costEvidence.sp1ProveDurationMs, null, "A13 SP1 prove evidence");
  assertEqual(mmrPlan.costEvidence.sp1VerifyDurationMs, null, "A13 SP1 verify evidence");
  assertFileHash("proofs/eternum-settlement/src/mmr_plan.rs", mmrPlan.reproducibilityInputs.guestCoreSha256);
  assertFileHash("proofs/eternum-settlement/Cargo.lock", mmrPlan.reproducibilityInputs.cargoLockSha256);
  assertFileHash(
    "contracts/settlement_protocol/src/mmr_plan_verifier_spike.cairo",
    mmrPlan.reproducibilityInputs.cairoVerifierSha256,
  );
  assertFileHash("packages/settlement-codec/schema/mmr-plan-a13-v1.json", inputs.mmrPlanProof.fileSha256);

  assertEqual(
    emergencySealed.status,
    "reference-guest-and-verifier-complete-production-receipt-blocked",
    "A15 emergency-sealed status",
  );
  assertEqual(emergencySealed.releaseReady, false, "A15 release readiness");
  assertEqual(
    decision.wave0.find(({ ticket }) => ticket === "A15")?.status,
    emergencySealed.status,
    "A15 Wave 0 status",
  );
  assertEqual(emergencySealed.protocolRegistryHash, schemaRegistry.schemaRegistryHash, "A15 protocol registry hash");
  assertEqual(
    emergencySealed.crossLanguageVector.journalHash,
    inputs.emergencySealedProof.journalHash,
    "A15 journal hash",
  );
  assertEqual(emergencySealed.costEvidence.sp1ProgramId, null, "A15 SP1 program identity");
  assertEqual(emergencySealed.costEvidence.sp1VerificationKeyHash, null, "A15 SP1 verification key");
  assertEqual(emergencySealed.costEvidence.sp1ProveDurationMs, null, "A15 SP1 prove evidence");
  assertEqual(emergencySealed.costEvidence.sp1VerifyDurationMs, null, "A15 SP1 verify evidence");
  assertEqual(
    decision.performanceEvidence.a15.cairoVectorTestL2Gas,
    emergencySealed.costEvidence.referenceCairoVectorTestL2Gas,
    "A15 Cairo vector cost",
  );
  assertEqual(
    decision.performanceEvidence.a15.cairoNegativeTestL2Gas,
    emergencySealed.costEvidence.referenceCairoNegativeTestL2Gas,
    "A15 Cairo negative cost",
  );
  assertFileHash(
    "proofs/eternum-settlement/src/emergency_sealed.rs",
    emergencySealed.reproducibilityInputs.guestCoreSha256,
  );
  assertFileHash("proofs/eternum-settlement/Cargo.lock", emergencySealed.reproducibilityInputs.cargoLockSha256);
  assertFileHash(
    "contracts/settlement_protocol/src/emergency_sealed_verifier_spike.cairo",
    emergencySealed.reproducibilityInputs.cairoVerifierSha256,
  );
  assertFileHash(
    "packages/settlement-codec/schema/emergency-sealed-a15-v1.json",
    inputs.emergencySealedProof.fileSha256,
  );

  assertA21Evidence(inputs.frozenRecoveryMaterializationProofs);

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
  assertA20StopOutcomeCount(inputs.authorityInventory.unresolvedMutationCandidates);
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

function assertA21Evidence(input) {
  assertEqual(
    frozenRecoveryMaterialization.status,
    "reference-guests-and-verifiers-complete-production-receipts-blocked",
    "A21 frozen recovery/materialization status",
  );
  assertEqual(frozenRecoveryMaterialization.releaseReady, false, "A21 release readiness");
  assertEqual(
    decision.wave0.find(({ ticket }) => ticket === "A21")?.status,
    frozenRecoveryMaterialization.status,
    "A21 Wave 0 status",
  );
  assertEqual(
    frozenRecoveryMaterialization.protocolRegistryHash,
    schemaRegistry.schemaRegistryHash,
    "A21 protocol registry hash",
  );
  for (const field of [
    "frozenRecoveryJournalHash",
    "deploymentRefundMaterializationJournalHash",
    "positionMaterializationJournalHash",
  ]) {
    assertEqual(frozenRecoveryMaterialization.crossLanguageVectors[field], input[field], `A21 ${field}`);
  }
  assertEqual(
    frozenRecoveryMaterialization.costEvidence.perGameSegment.sp1ProgramId,
    null,
    "A21 per-game SP1 program identity",
  );
  assertEqual(
    frozenRecoveryMaterialization.costEvidence.recursiveThirtyTwoGameAggregator.sp1ProgramId,
    null,
    "A21 recursive SP1 program identity",
  );
  assertEqual(
    decision.performanceEvidence.a21.cairoVectorTestL2Gas,
    frozenRecoveryMaterialization.costEvidence.referenceCairoVectorTestL2Gas,
    "A21 Cairo vector cost",
  );
  assertEqual(
    decision.performanceEvidence.a21.cairoNegativeTestL2Gas,
    frozenRecoveryMaterialization.costEvidence.referenceCairoNegativeTestL2Gas,
    "A21 Cairo negative cost",
  );
  for (const [path, field] of [
    ["proofs/eternum-settlement/src/frozen_recovery.rs", "frozenRecoveryCoreSha256"],
    ["proofs/eternum-settlement/src/materialization.rs", "deploymentRefundMaterializationCoreSha256"],
    ["proofs/eternum-settlement/src/position_materialization.rs", "positionMaterializationCoreSha256"],
    ["proofs/eternum-settlement/Cargo.lock", "cargoLockSha256"],
    ["contracts/settlement_protocol/src/frozen_recovery_verifier_spike.cairo", "cairoVerifierSha256"],
    ["packages/settlement-codec/src/frozen-recovery.ts", "typescriptVerifierSha256"],
  ]) {
    assertFileHash(path, frozenRecoveryMaterialization.reproducibilityInputs[field]);
  }
  assertFileHash("packages/settlement-codec/schema/frozen-recovery-materialization-a21-v1.json", input.fileSha256);
}

function assertA20StopOutcomeCount(unresolvedMutationCandidates) {
  const outcome = decision.stopOutcomes.find(({ id }) => id === "A20-AUTHORITY-FREEZE");
  assert(outcome, "A23 must declare the A20 authority-freeze outcome");
  assert(
    outcome.action.includes(`all ${unresolvedMutationCandidates} mutation candidates`),
    "A20 authority-freeze outcome must name the current unresolved mutation count",
  );
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
  assertEqual(decision.topologyDecision.status, "frozen-hub-owned-v1", "A17 topology decision");
  assertEqual(
    decision.topologyDecision.protocolRegistryHash,
    schemaRegistry.schemaRegistryHash,
    "A17 topology registry hash",
  );
  assertEqual(decision.topologyDecision.aggregateViewTrait, "ISeasonSettlementHubAggregateView", "A17 aggregate view");

  const callback = findProtocolDeclaration("IGameEconomicSettlementCallbacks");
  const aggregateView = findProtocolDeclaration("ISeasonSettlementHubAggregateView");
  assert(
    callback.members.every((method) => !method.includes("promote_sealed_batch")),
    "A17 callback topology cannot retain seal-time promotion",
  );
  assertEqual(aggregateView.kind, "trait", "A17 aggregate view declaration");
  assertEqual(decision.wave0.find(({ ticket }) => ticket === "A17")?.status, "complete", "A17 Wave 0 status");
}

function findProtocolDeclaration(name) {
  const declaration = schemaRegistry.declarations.find((candidate) => candidate.name === name);
  assert(declaration, `protocol declaration is missing: ${name}`);
  return declaration;
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
