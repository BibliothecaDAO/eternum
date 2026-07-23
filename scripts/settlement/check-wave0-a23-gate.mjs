import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  A23_PRODUCTION_TICKET_IDS,
  A23_WAVE0_TICKET_IDS,
} from "../../config/deployer/clean/game-stack/a23-decision.mts";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const decision = readJson("packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json");
const schemaRegistry = readJson("packages/settlement-codec/schema/schema-registry-v1.json");
const frozenPosition = readJson("packages/settlement-codec/schema/frozen-position-a5-v1.json");
const mmrPlan = readJson("packages/settlement-codec/schema/mmr-plan-a13-v1.json");
const mmrPlanSp1Fixture = readJson("proofs/eternum-settlement/sp1/mmr-plan-a13-fixture-evidence-v0.json");
const emergencySealed = readJson("packages/settlement-codec/schema/emergency-sealed-a15-v1.json");
const hardenedInbox = readJson("packages/settlement-codec/schema/hardened-inbox-a16-v1.json");
const legacyMmrDerivation = readJson("packages/settlement-codec/schema/legacy-mmr-derivation-a19-v1.json");
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
  assertEqual(decision.productionProgramStartAuthorized, false, "production program-start authorization");

  assertDeepEqual(
    decision.wave0.map(({ ticket, status, mandatoryBlocker }) => ({
      ticket,
      status,
      mandatoryBlocker: mandatoryBlocker === true,
    })),
    expectedWave0Projection(),
    "A23 exact Wave 0 projection",
  );
  assertDeepEqual(
    decision.stopOutcomes.map(({ id }) => id),
    ["A22-BOUNDS-FREEZE", "TEE-SOURCE-GATE", "MISSING-PROOF-GATES"],
    "A23 stop outcomes",
  );
  assertDeepEqual(
    decision.performanceEvidence.unavailableMandatoryCampaigns,
    [
      "A5-production-katana-sp1",
      "A8",
      "A13-production-codec-reproducible-elf-receipt-vk-cairo-verifier-and-maximum-bound",
      "A15-production-receipt-and-maximum-bound",
      "A16-production-finality-cancelled-slot-proof-and-cost-campaign",
      "A19-finalized-source-inventory-and-production-recursive-receipts",
      "A21-production-segmented-recursive-receipts-and-maximum-bound",
    ],
    "A23 unavailable mandatory campaigns",
  );
  assertEvidenceChronology();
}

function assertProductionDependencyMatrix() {
  for (const epic of ["B", "C", "D", "E", "F"]) {
    const entry = decision.productionEpics[epic];
    assertEqual(entry?.status, "blocked", `Epic ${epic} status`);
    assertDeepEqual(entry?.dependsOn, ["A23"], `Epic ${epic} dependency`);
  }
  const matrix = decision.productionTicketDependencyMatrix;
  assertEqual(matrix.status, "blocked", "production ticket matrix status");
  assertEqual(matrix.appliesToEachTicket, true, "production ticket matrix application");
  assertDeepEqual(matrix.dependsOn, ["A23"], "production ticket matrix dependency");
  assertDeepEqual(matrix.ticketIds, A23_PRODUCTION_TICKET_IDS, "production ticket matrix ticket set");
}

function expectedWave0Projection() {
  const statuses = [
    "complete",
    "complete",
    "complete",
    "complete",
    "reference-seam-complete-production-proof-blocked",
    "complete",
    "complete",
    "blocked-on-failed-a22-and-authorized-aws",
    "complete",
    "complete",
    "complete",
    "complete",
    "reference-guest-and-verifier-complete-production-receipt-blocked",
    "complete",
    "reference-guest-and-verifier-complete-production-receipt-blocked",
    "reference-runtime-and-public-patricia-proof-complete-production-finality-blocked",
    "complete",
    "public-feasibility-complete-private-tee-source-blocked",
    "pending-typed-derivation-reference-seam-complete-source-inventory-and-production-proofs-blocked",
    "a20-evidence-complete-awaiting-a23-freeze",
    "reference-guests-and-verifiers-complete-production-receipts-blocked",
    "stop-redesign-required",
    "stop-record-awaiting-authorized-signatures",
  ];
  const blockerTickets = new Set(["A5", "A8", "A13", "A15", "A16", "A18", "A19", "A21", "A22", "A23"]);
  return statuses.map((status, index) => {
    const ticket = A23_WAVE0_TICKET_IDS[index];
    return { ticket, status, mandatoryBlocker: blockerTickets.has(ticket) };
  });
}

function assertEvidenceChronology() {
  const decisionTime = Date.parse(`${decision.recordedAt}T23:59:59Z`);
  const evidenceTimes = [
    Date.parse(mmrPlanSp1Fixture.capturedAt),
    Date.parse(hardenedInbox.publicPatriciaEvidence.rpcObservation.observedAt),
  ];
  assert(Number.isFinite(decisionTime), "A23 recordedAt must be an ISO date");
  assert(evidenceTimes.every(Number.isFinite), "A23 evidence timestamps must be ISO dates");
  assert(
    evidenceTimes.every((evidenceTime) => evidenceTime <= decisionTime),
    "A23 cannot predate evidence that it binds",
  );
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
  assertFileHash(
    "proofs/eternum-settlement/src/frozen_position.rs",
    frozenPosition.reproducibilityInputs.guestCoreSha256,
  );
  assertProtocolHashCore(frozenPosition.reproducibilityInputs);
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
  assertProtocolHashCore(mmrPlan.reproducibilityInputs);
  assertFileHash("proofs/eternum-settlement/Cargo.lock", mmrPlan.reproducibilityInputs.cargoLockSha256);
  assertFileHash(
    "contracts/settlement_protocol/src/mmr_plan_verifier_spike.cairo",
    mmrPlan.reproducibilityInputs.cairoVerifierSha256,
  );
  assertFileHash("packages/settlement-codec/schema/mmr-plan-a13-v1.json", inputs.mmrPlanProof.fileSha256);
  assertA13Sp1FixtureEvidence(inputs.mmrPlanProof);

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
  assertProtocolHashCore(emergencySealed.reproducibilityInputs);
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
  assertA16Evidence(inputs.hardenedInboxProof);
  assertA19Evidence(inputs.legacyMmrDerivationProof);
  assertA20EvidenceComplete(inputs.authorityInventory);

  assertEqual(exitFamilies.status, "a22-stop-redesign-required", "A22 inventory status");
  assertEqual(
    decision.wave0.find(({ ticket }) => ticket === "A22")?.status,
    "stop-redesign-required",
    "A22 Wave 0 status",
  );
  assertEqual(
    decision.wave0.find(({ ticket }) => ticket === "A8")?.status,
    "blocked-on-failed-a22-and-authorized-aws",
    "A8 Wave 0 status",
  );
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
  assertEqual(exitFamilies.reviewFindings.length, inputs.exitFamilyInventory.reviewFindingCount, "A22 review findings");
  assertEqual(
    exitFamilies.implementationIssues.length,
    inputs.exitFamilyInventory.implementationIssueCount,
    "A22 implementation issues",
  );
  assertEqual(exitFamilies.families.length, inputs.exitFamilyInventory.sourceAuditCount, "A22 source audit count");
  assertEqual(
    exitFamilies.families.reduce(
      (count, family) =>
        count +
        family.sourceAudit.knownReassignments.reduce(
          (familyCount, reassignment) => familyCount + reassignment.sourceWriteIds.length,
          0,
        ),
      0,
    ),
    inputs.exitFamilyInventory.knownReassignmentCount,
    "A22 known source reassignment count",
  );
  assertA22StopOutcome();
  assertFileHash(
    "packages/settlement-codec/schema/exit-family-inventory-v0.json",
    inputs.exitFamilyInventory.fileSha256,
  );
  assertFileHash(
    "packages/settlement-codec/src/exit-family-layout.ts",
    inputs.exitFamilyInventory.referenceLayoutSha256,
  );
  assertFileHash(
    "packages/settlement-codec/src/exit-family-source-identity.ts",
    inputs.exitFamilyInventory.sourceIdentityValidatorSha256,
  );
  assertFileHash(
    "packages/settlement-codec/schema/economic-write-classification-policy-v0.json",
    inputs.economicWriteClassificationPolicySha256,
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
  const deploymentRefundFamily = schemaRegistry.indexFamilies.find(({ name }) => name === "DEPLOYMENT_REFUND_SOURCE");
  assertDeepEqual(
    deploymentRefundFamily,
    { code: 65_535, name: "DEPLOYMENT_REFUND_SOURCE", scope: "deployment" },
    "A21 deployment-refund index family",
  );
  assertEqual(
    frozenRecoveryMaterialization.materializationContract.deploymentRefundFamilyReferenceValue,
    deploymentRefundFamily.code,
    "A21 deployment-refund family value",
  );
  assertEqual(
    frozenRecoveryMaterialization.materializationContract.deploymentRefundFamilyStatus,
    "frozen-A3-named-index-family",
    "A21 deployment-refund family status",
  );
  assert(
    frozenRecoveryMaterialization.productionBlockers.every(({ id }) => id !== "DEPLOYMENT-REFUND-FAMILY-VALUE"),
    "A21 must not retain the resolved deployment-refund family blocker",
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
  assertProtocolHashCore(frozenRecoveryMaterialization.reproducibilityInputs);
  assertFileHash("packages/settlement-codec/schema/frozen-recovery-materialization-a21-v1.json", input.fileSha256);
}

function assertA13Sp1FixtureEvidence(input) {
  assertA13Sp1Identity(input);
  assertA13Sp1InputProjection();
  assertA13Sp1Execution(input);
  assertA13Sp1Performance();
  assertA13Sp1ProductionBlockers();
}

function assertA13Sp1Identity(input) {
  const pointer = mmrPlan.sp1FixtureEvidence;

  assertEqual(pointer.status, input.sp1FixtureStatus, "A13 SP1 fixture status");
  assertEqual(pointer.fileSha256, input.sp1FixtureEvidenceSha256, "A13 SP1 fixture evidence hash");
  assertEqual(
    pointer.ciEvidenceCheckerSha256,
    input.sp1FixtureCiEvidenceCheckerSha256,
    "A13 SP1 CI evidence checker hash",
  );
  assertEqual(
    pointer.ciElfIdentityCheckerSha256,
    input.sp1FixtureCiElfIdentityCheckerSha256,
    "A13 SP1 CI ELF identity checker hash",
  );
  assertEqual(pointer.fixtureElfSha256, input.sp1FixtureElfSha256, "A13 SP1 fixture ELF hash");
  assertEqual(pointer.sp1Commit, input.sp1Commit, "A13 SP1 source commit");
  assertEqual(pointer.sp1BuildContainerImage, input.sp1BuildContainerImage, "A13 SP1 build-container image");
  assertEqual(
    pointer.sp1BuildContainerManifestSha256,
    input.sp1BuildContainerManifestSha256,
    "A13 SP1 build-container manifest",
  );
  assertEqual(pointer.sp1BuildPlatform, input.sp1BuildPlatform, "A13 SP1 build platform");
  assertEqual(pointer.executionKind, input.sp1ExecutionKind, "A13 SP1 execution kind");
  assertEqual(pointer.publicValuesDomain, input.sp1PublicValuesDomain, "A13 public-values domain");
  assertEqual(pointer.publicValuesEncoding, input.sp1PublicValuesEncoding, "A13 public-values encoding");
  assertEqual(pointer.publicValuesLengthBytes, input.sp1PublicValuesLengthBytes, "A13 public-values length");
  assertEqual(pointer.releaseReady, false, "A13 SP1 fixture release readiness");
  assertFileHash(pointer.artifact, pointer.fileSha256);
  assertFileHash("scripts/settlement/check-a13-sp1-fixture-execution.mjs", pointer.ciEvidenceCheckerSha256);
  assertFileHash("scripts/settlement/check-a13-sp1-fixture-elf.mjs", pointer.ciElfIdentityCheckerSha256);

  assertEqual(mmrPlanSp1Fixture.schema, "eternum.a13.sp1-fixture-evidence.v0", "A13 evidence schema");
  assertEqual(mmrPlanSp1Fixture.scope, "wave0-fixture-only", "A13 evidence scope");
  assertEqual(mmrPlanSp1Fixture.status, pointer.status, "A13 evidence status");
  assertEqual(mmrPlanSp1Fixture.releaseReady, false, "A13 evidence release readiness");
  assertEqual(
    mmrPlanSp1Fixture.sourceState,
    "uncommitted-complete-input-projection-bound-by-sha256",
    "A13 evidence source state",
  );
  assertEqual(mmrPlanSp1Fixture.sp1.tag, pointer.sp1Tag, "A13 SP1 tag");
  assertEqual(mmrPlanSp1Fixture.sp1.commit, pointer.sp1Commit, "A13 SP1 commit");
  assertEqual(
    mmrPlanSp1Fixture.sp1.buildContainer.image,
    pointer.sp1BuildContainerImage,
    "A13 SP1 build-container image",
  );
  assertEqual(
    mmrPlanSp1Fixture.sp1.buildContainer.manifestSha256,
    pointer.sp1BuildContainerManifestSha256,
    "A13 SP1 build-container manifest",
  );
  assertEqual(
    mmrPlanSp1Fixture.sp1.buildContainer.platform,
    pointer.sp1BuildPlatform,
    "A13 SP1 build-container platform",
  );
  assertEqual(mmrPlanSp1Fixture.fixtureElf.sha256, pointer.fixtureElfSha256, "A13 fixture ELF identity");
  assertEqual(mmrPlanSp1Fixture.fixtureElf.compileStatus, "passed", "A13 fixture compile status");
  assertEqual(mmrPlanSp1Fixture.fixtureElf.executionStatus, "passed", "A13 fixture execution status");
  assertEqual(mmrPlanSp1Fixture.fixtureElf.publicValues.domain, pointer.publicValuesDomain, "A13 ELF journal domain");
  assertEqual(
    mmrPlanSp1Fixture.fixtureElf.publicValues.encoding,
    pointer.publicValuesEncoding,
    "A13 ELF public-values encoding",
  );
  assertEqual(
    mmrPlanSp1Fixture.fixtureElf.publicValues.lengthBytes,
    pointer.publicValuesLengthBytes,
    "A13 ELF public-values length",
  );
  assertEqual(
    mmrPlanSp1Fixture.fixtureElf.reproducibilityStatus,
    "local-single-build-independent-ci-reproduction-required",
    "A13 fixture reproducibility status",
  );
}

function assertA13Sp1InputProjection() {
  assertA13CompleteInputProjection(mmrPlanSp1Fixture.inputSha256);
}

function assertA13Sp1Execution(input) {
  const execution = mmrPlanSp1Fixture.execution;
  const validGuest = execution.guestExecution;
  const badSnapshot = findUniqueByName(execution.nativeNegativeAssertions, "bad-snapshot", "A13 native negative");
  const substitutedRoot = findUniqueByName(
    execution.nativeNegativeAssertions,
    "substituted-plan-root",
    "A13 native negative",
  );

  assertEqual(execution.schema, "eternum.a13.sp1-execution.v1", "A13 execution schema");
  assertEqual(execution.kind, input.sp1ExecutionKind, "A13 execution kind");
  assertEqual(execution.testsPassed, 1, "A13 execution passed tests");
  assertEqual(execution.testsFailed, 0, "A13 execution failed tests");
  assertEqual(Object.hasOwn(execution, "fixtures"), false, "A13 parallel fixture output wire removal");
  assertDeepEqual(
    execution.nativeNegativeAssertions.map(({ name }) => name).sort(),
    ["bad-snapshot", "substituted-plan-root"],
    "A13 exact native negative set",
  );

  assertEqual(validGuest.name, "valid-tie-gap", "A13 valid guest name");
  assertEqual(validGuest.status, "accepted", "A13 valid guest status");
  assertEqual(
    validGuest.publicJournalHashHex,
    mmrPlanSp1Fixture.fixtureElf.expectedJournalHash,
    "A13 normative guest journal hash",
  );
  assertPositiveSafeInteger(validGuest.elapsedMs, "A13 valid guest elapsed time");
  assertPositiveSafeInteger(validGuest.instructions, "A13 valid guest instructions");
  assertPositiveSafeInteger(validGuest.totalCycles, "A13 valid guest total cycles");
  assertEqual(validGuest.syscalls, 0, "A13 valid guest syscalls");

  assertA13NativeNegative(badSnapshot, "invalid-plan:snapshot");
  assertA13NativeNegative(substitutedRoot, "substituted-plan-root");
}

function assertA13NativeNegative(negative, expectedError) {
  assertEqual(negative.status, "rejected", `A13 ${negative.name} rejection status`);
  assertEqual(negative.exactError, expectedError, `A13 ${negative.name} exact error`);
  assertPositiveSafeInteger(negative.elapsedMs, `A13 ${negative.name} elapsed time`);
  assertEqual(Object.hasOwn(negative, "publicOutcomeHex"), false, `A13 ${negative.name} public outcome absence`);
  assertEqual(Object.hasOwn(negative, "publicJournalHashHex"), false, `A13 ${negative.name} public hash absence`);
}

function assertA13Sp1Performance() {
  const execution = mmrPlanSp1Fixture.execution;
  const validGuest = execution.guestExecution;

  assertEqual(decision.performanceEvidence.a13.sp1FixtureExecutionStatus, "passed", "A13 fixture performance status");
  assertEqual(decision.performanceEvidence.a13.sp1FixtureExecutionKind, execution.kind, "A13 fixture performance kind");
  assertEqual(
    decision.performanceEvidence.a13.sp1FixtureProverInitializationMs,
    execution.proverInitializationMs,
    "A13 fixture initialization performance",
  );
  assertEqual(decision.performanceEvidence.a13.productionProofPerformanceAvailable, false, "A13 production cost claim");
  assertEqual(
    decision.performanceEvidence.a13.sp1FixtureValidInstructions,
    validGuest.instructions,
    "A13 valid fixture instructions",
  );
  assertEqual(
    decision.performanceEvidence.a13.sp1FixtureNegativeAssertionMode,
    "native-shared-core-exact-errors",
    "A13 negative assertion mode",
  );
  for (const [value, label] of [
    [execution.proverInitializationMs, "prover initialization"],
    [execution.suiteElapsedMs, "suite elapsed time"],
    [execution.commandWallMs, "command wall time"],
    [execution.maxResidentSetBytes, "maximum resident set"],
  ]) {
    assertPositiveSafeInteger(value, `A13 ${label}`);
  }
  assert(execution.userCpuSeconds > 0, "A13 user CPU evidence must be positive");
  assert(execution.systemCpuSeconds > 0, "A13 system CPU evidence must be positive");
  assertEqual(execution.swaps, 0, "A13 execution swaps");
}

function assertA13Sp1ProductionBlockers() {
  for (const [field, value] of Object.entries(mmrPlanSp1Fixture.production)) {
    assertEqual(value, null, `A13 production ${field}`);
  }
  assertEqual(mmrPlanSp1Fixture.blockers.length, 6, "A13 fixture blocker count");
  assert(
    mmrPlanSp1Fixture.blockers.every((blocker) => typeof blocker === "string" && blocker.trim().length > 0),
    "A13 fixture blockers must be non-empty strings",
  );
  assertDeepEqual(
    mmrPlan.productionBlockers.map(({ id }) => id),
    ["SP1-PROGRAM-AND-RECEIPT", "REPRODUCIBLE-RELEASE-BUILD", "GARAGA-VERIFIER", "MAXIMUM-BOUND-CAMPAIGN"],
    "A13 production blockers",
  );
}

function findUniqueByName(entries, name, label) {
  const matches = entries.filter((entry) => entry.name === name);
  assertEqual(matches.length, 1, `${label} ${name} uniqueness`);
  return matches[0];
}

function assertA13CompleteInputProjection(inputHashes) {
  const expectedPaths = [
    "proofs/eternum-settlement/Cargo.lock",
    "proofs/eternum-settlement/Cargo.toml",
    "proofs/eternum-settlement/sp1/mmr-plan-host/Cargo.lock",
    "proofs/eternum-settlement/sp1/mmr-plan-host/Cargo.toml",
    "proofs/eternum-settlement/sp1/mmr-plan-host/build.rs",
    "proofs/eternum-settlement/sp1/mmr-plan-host/tests/mmr_plan_execution.rs",
    "proofs/eternum-settlement/sp1/mmr-plan-program/Cargo.lock",
    "proofs/eternum-settlement/sp1/mmr-plan-program/Cargo.toml",
    "proofs/eternum-settlement/sp1/mmr-plan-program/src/main.rs",
    ...listRustSources("proofs/eternum-settlement/src"),
  ].sort();

  assertDeepEqual(Object.keys(inputHashes).sort(), expectedPaths, "A13 complete input projection");
  for (const path of expectedPaths) assertFileHash(path, inputHashes[path]);
}

function listRustSources(relativeDirectory) {
  return listFilesRecursively(resolve(repositoryRoot, relativeDirectory))
    .filter((path) => path.endsWith(".rs"))
    .map((path) => relative(repositoryRoot, path))
    .sort();
}

function listFilesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(path) : [path];
  });
}

function assertPositiveSafeInteger(value, label) {
  assert(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
}

function assertA16Evidence(input) {
  assertEqual(
    hardenedInbox.status,
    "reference-runtime-and-public-patricia-proof-complete-production-finality-blocked",
    "A16 hardened-inbox status",
  );
  assertEqual(hardenedInbox.releaseReady, false, "A16 release readiness");
  assertEqual(decision.wave0.find(({ ticket }) => ticket === "A16")?.status, hardenedInbox.status, "A16 Wave 0 status");
  assertEqual(hardenedInbox.protocolRegistryHash, schemaRegistry.schemaRegistryHash, "A16 protocol registry hash");
  assertEqual(hardenedInbox.publicPatriciaEvidence.status, input.publicEvidenceStatus, "A16 public proof status");
  assertEqual(hardenedInbox.publicPatriciaEvidence.blockNumber, input.publicBlockNumber, "A16 public proof block");
  assertEqual(
    hardenedInbox.publicPatriciaEvidence.finalityStatus,
    input.publicFinalityStatus,
    "A16 observed block finality status",
  );
  assertEqual(
    hardenedInbox.publicPatriciaEvidence.rpcObservation.productionRecursiveFinalityVerified,
    input.productionRecursiveFinalityVerified,
    "A16 production recursive finality claim",
  );
  assertEqual(
    hardenedInbox.publicPatriciaEvidence.historicalStorageProofReplay.errorCode,
    input.historicalStorageProofErrorCode,
    "A16 historical storage-proof replay error",
  );
  assertEqual(
    hardenedInbox.externalSourcePins.starknetRpcSpec.commit,
    input.starknetRpcSpecCommit,
    "A16 Starknet RPC specification pin",
  );
  assertEqual(
    hardenedInbox.externalSourcePins.publicPiltover.commit,
    input.publicPiltoverCommit,
    "A16 public Piltover source pin",
  );
  assertEqual(
    hardenedInbox.publicPatriciaEvidence.contractNodeCount,
    input.publicContractNodeCount,
    "A16 public contract proof nodes",
  );
  for (const [field, inputField, label] of [
    ["contractLeaf", "publicContractLeaf", "contract leaf"],
    ["contractsRoot", "publicContractsRoot", "contracts root"],
    ["classesRoot", "publicClassesRoot", "classes root"],
    ["stateRoot", "publicStateRoot", "state root"],
  ]) {
    assertEqual(hardenedInbox.publicPatriciaEvidence[field], input[inputField], `A16 public ${label}`);
  }
  assertEqual(
    hardenedInbox.publicPatriciaEvidence.containsCancelledMarkerStorageProof,
    false,
    "A16 marker proof claim",
  );
  assertEqual(hardenedInbox.mandatoryBlockers.length, input.mandatoryBlockerCount, "A16 blocker count");
  assertDeepEqual(
    hardenedInbox.mandatoryBlockers.map(({ id }) => id),
    [
      "production-recursive-finality-source-absent",
      "finalized-cancelled-slot-fixture-absent",
      "public-piltover-layout-incompatible",
      "production-cost-campaign-absent",
    ],
    "A16 mandatory blockers",
  );
  assertEqual(
    decision.performanceEvidence.a16.positiveApplyReplayL2Gas,
    hardenedInbox.testEvidence.positiveApplyReplayL2Gas,
    "A16 apply/replay cost",
  );
  assertEqual(
    decision.performanceEvidence.a16.capturedContractProofL2Gas,
    hardenedInbox.testEvidence.capturedContractProofL2Gas,
    "A16 public Patricia cost",
  );
  assertEqual(hardenedInbox.testEvidence.productionRecursiveFinalityVerifyL2Gas, null, "A16 production finality cost");
  assertEqual(hardenedInbox.testEvidence.productionMaximumStorageProofL2Gas, null, "A16 maximum proof cost");
  assertEqual(hardenedInbox.testEvidence.command, input.focusedTestCommand, "A16 focused test command");
  assertEqual(hardenedInbox.reproducibilityInputs.manifestSha256, input.manifestSha256, "A16 manifest identity");
  assertEqual(hardenedInbox.reproducibilityInputs.lockfileSha256, input.lockfileSha256, "A16 lockfile identity");
  for (const [path, field] of [
    ["contracts/settlement_appchain/Scarb.toml", "manifestSha256"],
    ["contracts/settlement_appchain/Scarb.lock", "lockfileSha256"],
    ["contracts/settlement_appchain/src/hardened_inbox_runtime.cairo", "runtimeSha256"],
    ["contracts/settlement_appchain/src/hardened_inbox_runtime_tests.cairo", "testsAndCapturedProofSha256"],
    ["contracts/settlement_appchain/src/hardened_inbox_runtime_mocks.cairo", "testMocksSha256"],
    ["contracts/settlement_protocol/src/interfaces.cairo", "protocolInterfacesSha256"],
    ["contracts/settlement_protocol/src/types.cairo", "protocolTypesSha256"],
  ]) {
    assertFileHash(path, hardenedInbox.reproducibilityInputs[field]);
  }
  assertFileHash("packages/settlement-codec/schema/hardened-inbox-a16-v1.json", input.fileSha256);
  assertFileHash("packages/settlement-codec/src/hardened-inbox-evidence.ts", input.evidenceValidatorSha256);
  assertFileHash("packages/settlement-codec/src/hardened-inbox-evidence.test.ts", input.evidenceValidatorTestSha256);
  assertFileHash("scripts/settlement/check-hardened-inbox-a16-evidence.ts", input.structuredEvidenceCheckerSha256);
}

function assertA19Evidence(input) {
  assertEqual(
    legacyMmrDerivation.status,
    "pending-typed-derivation-reference-seam-complete-source-inventory-and-production-proofs-blocked",
    "A19 legacy MMR derivation status",
  );
  assertEqual(legacyMmrDerivation.releaseReady, false, "A19 release readiness");
  assertEqual(
    decision.wave0.find(({ ticket }) => ticket === "A19")?.status,
    legacyMmrDerivation.status,
    "A19 Wave 0 status",
  );
  assertEqual(
    legacyMmrDerivation.protocolRegistryHash,
    schemaRegistry.schemaRegistryHash,
    "A19 protocol registry hash",
  );
  assertEqual(legacyMmrDerivation.trustBoundary.historicalRpcReadsAfterFreeze, false, "A19 post-freeze RPC reads");
  assertEqual(
    legacyMmrDerivation.trustBoundary.preFreezeFinalizedSourceInventoryProgramImplemented,
    false,
    "A19 source inventory implementation claim",
  );
  assertEqual(
    legacyMmrDerivation.trustBoundary.sourceAndDerivationProgramsRemainDistinct,
    true,
    "A19 distinct program boundary",
  );
  assertDeepEqual(
    legacyMmrDerivation.derivation.supportedSettlementChunkSizes,
    [1, 2, 4, 8, 16, 32],
    "A19 settlement chunk sizes",
  );
  assertEqual(legacyMmrDerivation.trees.dispositions.depth, 32, "A19 disposition tree depth");
  assertEqual(legacyMmrDerivation.trees.importedJobs.depth, 32, "A19 imported-job tree depth");
  for (const tree of Object.values(legacyMmrDerivation.trees)) {
    const registeredTree = schemaRegistry.trees.find(({ name }) => name === tree.registryName);
    assert(registeredTree, `A19 tree is not registered: ${tree.registryName}`);
    assertEqual(registeredTree.depth, tree.depth, `A19 ${tree.registryName} registered depth`);
    assertEqual(registeredTree.nodeDomain, tree.nodeDomain, `A19 ${tree.registryName} registered node domain`);
  }
  for (const field of [
    "provedSourceInventoryHash",
    "syntheticDeploymentId",
    "dispositionsRoot",
    "importedJobsRoot",
    "fundingScopeId",
  ]) {
    assertEqual(legacyMmrDerivation.overlappingPendingGamesVector[field], input[field], `A19 ${field}`);
  }
  assertEqual(
    legacyMmrDerivation.sequentialOverlapVector.jobTwoPlanRoot,
    input.jobTwoPlanRoot,
    "A19 job-two plan root",
  );
  assertEqual(legacyMmrDerivation.sequentialOverlapVector.postJobOneMmr, 1502, "A19 post-job-one MMR");
  assertEqual(legacyMmrDerivation.sequentialOverlapVector.orderedFinalMmr, 1514, "A19 ordered final MMR");
  assertEqual(legacyMmrDerivation.sequentialOverlapVector.reversedFinalMmr, 1513, "A19 reversed final MMR");
  assertDeepEqual(
    legacyMmrDerivation.sequentialOverlapVector.balanceOrder,
    ["0x3e8", "0x3e9", "0x3ea", "0x3eb", "0x3ec", "0x3ed", "0x3ee", "0x3ef", "0x3f0", "0x3f1", "0x3f2"],
    "A19 balance identity order",
  );
  assertDeepEqual(
    legacyMmrDerivation.sequentialOverlapVector.postJobOneBalances,
    [1512, 1502, 1493, 1484, 1476, 1470, 1500, 1500, 1500, 1500, 1500],
    "A19 complete post-job-one balances",
  );
  assertDeepEqual(
    legacyMmrDerivation.sequentialOverlapVector.orderedFinalBalances,
    [1512, 1514, 1493, 1484, 1476, 1470, 1502, 1493, 1484, 1476, 1470],
    "A19 complete ordered final balances",
  );
  assertDeepEqual(
    legacyMmrDerivation.sequentialOverlapVector.reversedFinalBalances,
    [1512, 1513, 1493, 1484, 1476, 1470, 1502, 1493, 1484, 1476, 1470],
    "A19 complete reversed final balances",
  );
  assertEqual(legacyMmrDerivation.mandatoryBlockers.length, input.mandatoryBlockerCount, "A19 blocker count");
  assertDeepEqual(
    legacyMmrDerivation.mandatoryBlockers.map(({ id }) => id),
    [
      "non-pending-disposition-source-evidence-absent",
      "pre-freeze-finalized-source-inventory-program-absent",
      "production-recursive-receipts-absent",
      "deployed-mmr-source-and-authority-schema-unfrozen",
      "production-finality-input-absent",
      "production-cost-campaigns-absent",
    ],
    "A19 mandatory blockers",
  );
  for (const field of [
    "sp1SourceInventoryProgramId",
    "sp1SourceInventoryVerificationKeyHash",
    "sp1TypedDerivationProgramId",
    "sp1TypedDerivationVerificationKeyHash",
    "sourceInventoryProveDurationMs",
    "typedDerivationProveDurationMs",
    "typedDerivationVerifyDurationMs",
  ]) {
    assertEqual(legacyMmrDerivation.testEvidence[field], null, `A19 ${field}`);
  }
  for (const [path, field] of [
    ["proofs/eternum-settlement/src/legacy_mmr_derivation.rs", "typedDerivationCoreSha256"],
    ["proofs/eternum-settlement/tests/legacy_mmr_derivation.rs", "typedDerivationTestsSha256"],
    ["proofs/eternum-settlement/Cargo.lock", "cargoLockSha256"],
  ]) {
    assertFileHash(path, legacyMmrDerivation.reproducibilityInputs[field]);
  }
  assertProtocolHashCore(legacyMmrDerivation.reproducibilityInputs);
  assertFileHash("packages/settlement-codec/schema/legacy-mmr-derivation-a19-v1.json", input.fileSha256);
}

function assertA20EvidenceComplete(input) {
  const wave0 = decision.wave0.find(({ ticket }) => ticket === "A20");
  const observation = authority.onchainObservations.find(({ semanticKey }) => semanticKey === "mmrToken");
  const rebuild = observation?.deployedSourceRebuild;

  assertEqual(authority.status, "a20-evidence-complete-awaiting-a23-freeze", "A20 inventory status");
  assertEqual(authority.status, input.status, "A20 decision status");
  assertEqual(authority.evidenceComplete, true, "A20 evidence completion");
  assertEqual(authority.evidenceComplete, input.evidenceComplete, "A20 decision evidence completion");
  assertEqual(authority.releaseReady, false, "A20 release readiness");
  assertEqual(wave0?.status, authority.status, "A20 Wave 0 status");
  assertEqual(wave0?.mandatoryBlocker, undefined, "A20 completed evidence must not remain a feasibility blocker");
  assert(
    !decision.stopOutcomes.some(({ id }) => id === "A20-AUTHORITY-FREEZE"),
    "A20 source-provenance blocker must be removed after exact reproduction",
  );

  assertEqual(authority.authoritativeAddressInputsHash, input.authoritativeAddressInputsHash, "A20 address input hash");
  assertEqual(authority.privilegedMutationPathsHash, input.privilegedMutationPathsHash, "A20 mutation path hash");
  assertEqual(
    authority.authoritySchema.authoritySchemaHash,
    input.candidateAuthoritySchemaHash,
    "A20 candidate authority schema hash",
  );
  assertEqual(authority.authoritySchema.status, input.authoritySchemaStatus, "A20 authority schema status");
  assertEqual(
    authority.authoritySchema.observedClassMatchesLocalStorageLayoutSource,
    true,
    "A20 deployed source and layout identity",
  );
  assertEqual(
    authority.unresolvedMutationCandidates.length,
    input.unresolvedMutationCandidates,
    "A20 unresolved mutation count",
  );
  assertEqual(
    authority.addressSourceRecords.length,
    input.concreteAddressSourceRecords,
    "A20 concrete address source count",
  );
  assertEqual(
    authority.dynamicAddressInputs.length,
    input.dynamicAddressInputRecords,
    "A20 dynamic address input count",
  );
  assertEqual(authority.dynamicAddressInputRecords.length, input.dynamicAddressInputRecords, "A20 dynamic wire count");
  assertEqual(authority.dynamicAddressInputsHash, input.dynamicAddressInputsHash, "A20 dynamic address input hash");
  assertA20DynamicAddressInputCounts(input);
  assertEqual(authority.privilegedMutationPaths.length, input.reviewedMutationPaths, "A20 path count");
  assertA20DispositionCounts(input);

  assert(observation, "A20 MMR-token observation must exist");
  assert(rebuild, "A20 deployed-source rebuild evidence must exist");
  assertEqual(rebuild.sourceCommit, input.deployedSourceCommit, "A20 deployed source commit");
  assertEqual(rebuild.cleanBuilds.length, input.cleanBuildCount, "A20 clean rebuild count");
  assertEqual(rebuild.sierraClassHash, input.deployedSierraClassHash, "A20 rebuilt Sierra class hash");
  assertEqual(rebuild.compiledClassHash, input.deployedCompiledClassHash, "A20 rebuilt compiled class hash");
  assertEqual(
    rebuild.storageLayoutIdentityHash,
    input.historicalStorageLayoutIdentityHash,
    "A20 historical storage layout identity",
  );
  assertEqual(
    rebuild.topLevelStorageDeclarationHash,
    input.historicalTopLevelStorageDeclarationHash,
    "A20 historical top-level storage declaration",
  );
  assertEqual(
    authority.authoritySchema.tokenStorageLayoutHash,
    rebuild.storageLayoutIdentityHash,
    "A20 schema layout identity",
  );
  assertEqual(observation.rpcChainId, input.rpcChainId, "A20 RPC chain identity");
  assertEqual(observation.observationKind, input.observationKind, "A20 finalized-RPC trust boundary");
  assertEqual(
    rebuild.rpcRepresentableClassExactMatch,
    input.rpcRepresentableClassExactMatch,
    "A20 normalized RPC class match",
  );
  assertEqual(observation.classHash, rebuild.sierraClassHash, "A20 observed/rebuilt Sierra class identity");
  assertEqual(observation.declaration.compiledClassHash, rebuild.compiledClassHash, "A20 declaration/CASM identity");
  assertEqual(observation.declaration.finalityStatus, input.declarationFinalityStatus, "A20 declaration finality");
  assertEqual(observation.deployment.finalityStatus, input.deploymentFinalityStatus, "A20 deployment finality");
  assertEqual(
    observation.deployment.transactionVersion,
    input.deploymentTransactionVersion,
    "A20 deployment transaction version",
  );
  assertEqual(observation.deployment.udc.address, input.deploymentUdcAddress, "A20 deployment UDC address");
  assertEqual(
    observation.deployment.udc.deployContractSelector,
    input.deploymentUdcSelector,
    "A20 UDC deployment selector",
  );
  assertEqual(observation.deployment.udc.salt, input.deploymentSalt, "A20 deployment salt");
  assertEqual(
    observation.deployment.contractDeployedEvent.selector,
    input.contractDeployedEventSelector,
    "A20 ContractDeployed selector",
  );
  assertEqual(
    observation.deployment.contractDeployedEvent.fromAddress,
    observation.deployment.udc.address,
    "A20 ContractDeployed emitter",
  );

  assertEqual(
    authority.externalAuthorization.status,
    input.externalAuthorizationStatus,
    "A20 external authorization status",
  );
  assertEqual(
    authority.externalAuthorization.authoritySchemaHash,
    authority.authoritySchema.authoritySchemaHash,
    "A20 authorization schema identity",
  );
  assertEqual(authority.externalAuthorization.approvalRecordHash, input.approvalRecordHash, "A20 approval record");

  assertFileHash("packages/settlement-codec/schema/authority-inventory-v1.json", input.fileSha256);
  assertFileHash("packages/settlement-codec/schema/authority-mutation-policy-v1.json", input.mutationPolicySha256);
  assertFileHash("packages/settlement-codec/src/authority-inventory.ts", input.validatorSha256);
  assertFileHash("packages/settlement-codec/src/authority-inventory.test.ts", input.validatorTestSha256);
  assertFileHash("packages/settlement-codec/src/authority-commitments.ts", input.authorityCommitmentsSha256);
  assertFileHash("packages/settlement-codec/src/authority-address-discovery.ts", input.addressDiscoverySha256);
  assertFileHash("packages/settlement-codec/src/authority-address-discovery.test.ts", input.addressDiscoveryTestSha256);
  assertFileHash(
    "packages/settlement-codec/src/authority-deployment-provenance.test.ts",
    input.deploymentProvenanceTestSha256,
  );
  assertFileHash("packages/settlement-codec/src/authority-role-provenance.test.ts", input.roleProvenanceTestSha256);
  assertFileHash("scripts/settlement/generate-authority-inventory.mjs", input.generatorSha256);
  assertFileHash("scripts/settlement/verify-authority-observation.mjs", input.observationVerifierSha256);
  assertFileHash("scripts/settlement/verify-authority-source-rebuild.mjs", input.sourceRebuildVerifierSha256);
}

function assertA20DynamicAddressInputCounts(input) {
  for (const [inputKind, field] of [
    ["environment", "dynamicEnvironmentInputs"],
    ["cli", "dynamicCliInputs"],
    ["runtime-field", "dynamicRuntimeFieldInputs"],
  ]) {
    assertEqual(
      authority.dynamicAddressInputs.filter((entry) => entry.inputKind === inputKind).length,
      input[field],
      `A20 ${inputKind} address input count`,
    );
  }
}

function assertA20DispositionCounts(input) {
  for (const [disposition, field] of [
    [1, "canonicalStructuredPaths"],
    [2, "hardDisabledPaths"],
    [3, "readOnlySemanticReferencePaths"],
    [4, "migrationOnlyPaths"],
  ]) {
    assertEqual(
      authority.privilegedMutationPaths.filter(({ productionDisposition }) => productionDisposition === disposition)
        .length,
      input[field],
      `A20 ${field}`,
    );
  }
}

function assertA22StopOutcome() {
  const expectedFindings = [["missing-production-index-and-enforcement", "production:ExitPosition"]];
  assertDeepEqual(
    exitFamilies.reviewFindings.map(({ kind, sourceWriteId }) => [kind, sourceWriteId]),
    expectedFindings,
    "A22 failed feasibility findings",
  );
  assert(
    exitFamilies.families.every(hasReferenceIndexSemantics),
    "A22 must preserve the frozen non-production reference index semantics",
  );
  assert(
    exitFamilies.families.every(hasUnresolvedCardinalityBound),
    "A22 must keep every cardinality bound unresolved",
  );
  assertDeepEqual(
    exitFamilies.families
      .filter(({ sourceIdentity }) => sourceIdentity.status === "unresolved")
      .map(({ familyId }) => familyId),
    [4, 5, 6, 7, 8],
    "A22 unresolved typed source identities",
  );
  assertDeepEqual(
    exitFamilies.families
      .filter(({ sourceIdentity }) => sourceIdentity.status === "interface-reviewed")
      .map(({ familyId }) => familyId),
    [1, 2, 3, 9, 10, 11, 12],
    "A22 interface-reviewed source identity candidates",
  );
  assert(
    exitFamilies.families
      .filter(({ sourceIdentity }) => sourceIdentity.status === "interface-reviewed")
      .every(({ sourceIdentity }) =>
        sourceIdentity.fields.every(({ type }) => typeof type === "string" && type.length > 0),
      ),
    "A22 interface-reviewed source identity candidates must freeze every field type",
  );
  assert(
    exitFamilies.families.every(
      ({ sourceAudit }) =>
        sourceAudit.lifecycle.length > 0 &&
        sourceAudit.ownerDerivation.trim().length > 0 &&
        sourceAudit.highWaterAllocation.trim().length > 0 &&
        sourceAudit.projectionFindings.length > 0,
    ),
    "A22 source audits must bind lifecycle, owner, allocation, and projection findings",
  );
  assertDeepEqual(
    exitFamilies.families
      .filter(({ sourceAudit }) => sourceAudit.knownReassignments.length > 0)
      .map(({ familyId, sourceAudit }) => [
        familyId,
        sourceAudit.knownReassignments.reduce((count, reassignment) => count + reassignment.sourceWriteIds.length, 0),
      ]),
    [
      [7, 14],
      [8, 21],
    ],
    "A22 exact known source reassignments",
  );

  const issueProjection = exitFamilies.implementationIssues.map(
    ({ ticket, familyIds, sourceWriteCount, sourceFileCount, missingProductionFamilyIds }) => ({
      ticket,
      familyIds,
      sourceWriteCount,
      sourceFileCount,
      missingProductionFamilyIds,
    }),
  );
  assertDeepEqual(decision.backlogRebaseline.d5ThroughD9.issues, issueProjection, "A22 D5-D9 issue projection");
  assertEqual(
    decision.backlogRebaseline.d5ThroughD9.status,
    "enumerated-redesign-unestimated-until-enforced-bounds",
    "A22 D5-D9 rebaseline status",
  );
  assertDeepEqual(decision.backlogRebaseline.d5ThroughD9.estimates, [], "A22 D5-D9 estimates");
  const coveredFamilies = decision.backlogRebaseline.d5ThroughD9.issues.flatMap(({ familyIds }) => familyIds);
  assertDeepEqual(
    [...coveredFamilies].sort((left, right) => left - right),
    Array.from({ length: 12 }, (_, index) => index + 1),
    "A22 D5-D9 family coverage",
  );

  const outcome = decision.stopOutcomes.find(({ id }) => id === "A22-BOUNDS-FREEZE");
  assert(outcome, "A23 must declare the A22 redesign outcome");
  assert(namesRequiredA22RedesignWork(outcome.action), "A22 redesign outcome must name every remaining gate");
}

function hasReferenceIndexSemantics(family) {
  return (
    JSON.stringify(family.indexSchema) ===
      JSON.stringify({
        key: ["game_id:GameId", "family:u16", "index:u64"],
        highWatermark: "exclusive",
        stableIds: "monotonic-never-reused",
        deletion: "explicit-tombstone",
      }) && family.chunking.chunkSize === 64
  );
}

function hasUnresolvedCardinalityBound(family) {
  return (
    family.cardinality.status === "failed-no-reviewed-bound" && family.cardinality.maximumPositionsPerGame === null
  );
}

function namesRequiredA22RedesignWork(action) {
  const requiredWork = [
    "reference u64 index",
    "per-family maxima",
    "typed source projections",
    "production indexes",
    "reviewed caps",
    "A8",
  ];
  return requiredWork.every((requirement) => action.includes(requirement));
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
  const evidence = decision.runtimeEnforcement;
  const expectedSources = [
    "config/deployer/clean/game-stack/a23-decision.mts",
    "config/deployer/clean/game-stack/api.ts",
    "config/deployer/clean/game-stack/orchestrator.ts",
    "config/deployer/clean/game-stack/release-authorization.ts",
    "config/deployer/clean/runtime/aws/game-stack-api.ts",
    "config/deployer/clean/runtime/aws/game-stack-provisioning.ts",
    "config/deployer/clean/runtime/aws/wave0-release.ts",
  ];
  const expectedTests = [
    "config/deployer/clean/tests/aws-game-stack-provisioning.test.ts",
    "config/deployer/clean/tests/game-stack-api.test.ts",
    "config/deployer/clean/tests/game-stack-orchestrator.test.ts",
    "config/deployer/clean/tests/game-stack-provisioning-handler.test.ts",
    "config/deployer/clean/tests/game-stack-release-authorization.test.ts",
    "config/deployer/clean/tests/game-stack-runtime.test.ts",
    "config/deployer/clean/tests/wave0-release.test.ts",
  ];
  assertDeepEqual(Object.keys(evidence.sourceSha256), expectedSources, "A23 runtime enforcement source set");
  assertDeepEqual(Object.keys(evidence.testSha256), expectedTests, "A23 runtime enforcement test set");
  for (const path of expectedSources) assertFileHash(path, evidence.sourceSha256[path]);
  for (const path of expectedTests) assertFileHash(path, evidence.testSha256[path]);
  assertFileHash(".github/workflows/aws-runtime-ci.yml", evidence.ciWorkflowSha256);
  assertFileHash(".github/workflows/settlement-protocol-ci.yml", evidence.settlementCiWorkflowSha256);
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertProtocolHashCore(reproducibilityInputs) {
  assertFileHash("proofs/eternum-settlement/src/protocol_hash.rs", reproducibilityInputs.protocolHashCoreSha256);
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
