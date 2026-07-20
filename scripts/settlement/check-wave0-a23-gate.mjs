import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const decision = readJson("packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json");
const schemaRegistry = readJson("packages/settlement-codec/schema/schema-registry-v1.json");
const frozenPosition = readJson("packages/settlement-codec/schema/frozen-position-a5-v1.json");
const mmrPlan = readJson("packages/settlement-codec/schema/mmr-plan-a13-v1.json");
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

  assertEqual(authority.status, "mutation-review-complete-observed-class-source-blocked", "A20 inventory status");
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
  assertEqual(
    authority.privilegedMutationPaths.length,
    inputs.authorityInventory.reviewedMutationPaths,
    "A20 path count",
  );
  for (const [disposition, field] of [
    [1, "canonicalStructuredPaths"],
    [2, "hardDisabledPaths"],
    [4, "migrationOnlyPaths"],
  ]) {
    assertEqual(
      authority.privilegedMutationPaths.filter(({ productionDisposition }) => productionDisposition === disposition)
        .length,
      inputs.authorityInventory[field],
      `A20 ${field}`,
    );
  }
  assertA20StopOutcome();
  assertFileHash("packages/settlement-codec/schema/authority-inventory-v1.json", inputs.authorityInventory.fileSha256);

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
  assertA22StopOutcome();
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
  assertProtocolHashCore(frozenRecoveryMaterialization.reproducibilityInputs);
  assertFileHash("packages/settlement-codec/schema/frozen-recovery-materialization-a21-v1.json", input.fileSha256);
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
    hardenedInbox.publicPatriciaEvidence.contractNodeCount,
    input.publicContractNodeCount,
    "A16 public contract proof nodes",
  );
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
  for (const [path, field] of [
    ["contracts/settlement_appchain/src/hardened_inbox_runtime.cairo", "runtimeSha256"],
    ["contracts/settlement_appchain/src/hardened_inbox_runtime_tests.cairo", "testsAndCapturedProofSha256"],
    ["contracts/settlement_appchain/src/hardened_inbox_runtime_mocks.cairo", "testMocksSha256"],
    ["contracts/settlement_protocol/src/interfaces.cairo", "protocolInterfacesSha256"],
    ["contracts/settlement_protocol/src/types.cairo", "protocolTypesSha256"],
  ]) {
    assertFileHash(path, hardenedInbox.reproducibilityInputs[field]);
  }
  assertFileHash("packages/settlement-codec/schema/hardened-inbox-a16-v1.json", input.fileSha256);
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

function assertA20StopOutcome() {
  const outcome = decision.stopOutcomes.find(({ id }) => id === "A20-AUTHORITY-FREEZE");
  assert(outcome, "A23 must declare the A20 authority-freeze outcome");
  assert(
    outcome.action.includes("89-path mutation review is complete") && outcome.action.includes("MMR class source"),
    "A20 authority-freeze outcome must distinguish completed mutation review from the class-source blocker",
  );
}

function assertA22StopOutcome() {
  const expectedFindings = [
    ["economic-false-negative", "contracts/game/src/models/agent.cairo:89:write_model"],
    ["economic-false-negative", "contracts/game/src/models/record.cairo:85:write_member"],
    ["configuration-false-positive", "contracts/game/src/models/hyperstructure.cairo:71:write_model"],
    ["missing-index-and-bound", "production:ExitPosition"],
  ];
  assertDeepEqual(
    exitFamilies.reviewFindings.map(({ kind, sourceWriteId }) => [kind, sourceWriteId]),
    expectedFindings,
    "A22 failed feasibility findings",
  );
  assert(
    exitFamilies.families.every(
      (family) =>
        family.sourceIdentity.status === "failed-no-canonical-index" &&
        family.cardinality.status === "failed-no-enforced-bound" &&
        family.cardinality.maximumPositionsPerGame === null,
    ),
    "A22 must fail closed while canonical indexes or enforced bounds are absent",
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
  assert(
    outcome.action.includes("false-negative") &&
      outcome.action.includes("canonical monotonic indexes") &&
      outcome.action.includes("rerun A8"),
    "A22 redesign outcome must name the failed properties and dependent benchmark",
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
