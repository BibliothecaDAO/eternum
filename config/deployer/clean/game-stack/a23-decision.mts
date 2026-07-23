import { assertKatanaTeeReleaseProjection, getKatanaTeeReleaseProjection } from "@bibliothecadao/settlement-codec";

const PRODUCTION_EPICS = ["B", "C", "D", "E", "F"] as const;
const REQUIRED_INPUTS = [
  "authorityInventory",
  "economicWriteClassificationPolicySha256",
  "economicWriteInventorySha256",
  "emergencySealedProof",
  "exitFamilyInventory",
  "frozenPositionProof",
  "frozenRecoveryMaterializationProofs",
  "hardenedInboxProof",
  "katanaTeeRelease",
  "legacyMmrDerivationProof",
  "mmrPlanProof",
  "onchainObservationSha256",
  "protocolSchema",
] as const;
const PERFORMANCE_TICKETS = ["a5", "a8", "a13", "a15", "a16", "a17", "a19", "a21"] as const;
const PERFORMANCE_HASH_FIELDS: Record<(typeof PERFORMANCE_TICKETS)[number], readonly string[]> = {
  a5: ["programId", "verificationKeyHash", "receiptSha256"],
  a8: ["exactFamilyBoundsHash", "awsRunArtifactSha256"],
  a13: ["programId", "verificationKeyHash", "receiptSha256", "elfSha256"],
  a15: ["programId", "verificationKeyHash", "receiptSha256"],
  a16: ["recursiveFinalityProgramId", "recursiveFinalityVerificationKeyHash", "cancelledMarkerProofHash"],
  a17: ["benchmarkArtifactSha256"],
  a19: ["sourceInventoryProgramId", "typedDerivationProgramId", "verificationKeySetHash", "receiptSetHash"],
  a21: ["programSetHash", "verificationKeySetHash", "receiptSetHash"],
};
const PERFORMANCE_NUMBER_FIELDS: Record<(typeof PERFORMANCE_TICKETS)[number], readonly string[]> = {
  a5: ["proveDurationMs", "verifyDurationMs", "maximumBoundDurationMs", "proofBytes", "cairoVerifierL2Gas"],
  a8: ["budgetUsd", "maximumCardinalityDurationMs"],
  a13: ["proveDurationMs", "verifyDurationMs", "maximumBoundDurationMs", "proofBytes", "cairoVerifierL2Gas"],
  a15: ["proveDurationMs", "verifyDurationMs", "maximumBoundDurationMs", "proofBytes", "cairoVerifierL2Gas"],
  a16: ["recursiveFinalityVerifyL2Gas", "maximumStorageProofL2Gas", "recursiveFinalityProofBytes"],
  a17: [
    "katanaStepLimit",
    "ciCeiling",
    "atomicAppendSteps",
    "rolloverSteps",
    "thirtyTwoWorldClosureSteps",
    "worstDistributionSteps",
    "mixedMaximumJourneySteps",
  ],
  a19: [
    "sourceInventoryProveDurationMs",
    "typedDerivationProveDurationMs",
    "typedDerivationVerifyDurationMs",
    "sourceInventoryProofBytes",
    "typedDerivationProofBytes",
    "sourceInventoryVerifyL2Gas",
    "typedDerivationVerifyL2Gas",
  ],
  a21: [
    "maximumBoundProveDurationMs",
    "maximumBoundVerifyDurationMs",
    "segmentedProofBytes",
    "recursiveProofBytes",
    "materializationProofBytes",
    "cairoVerifierL2Gas",
  ],
};
const A17_STEP_FIELDS = [
  "atomicAppendSteps",
  "rolloverSteps",
  "thirtyTwoWorldClosureSteps",
  "worstDistributionSteps",
  "mixedMaximumJourneySteps",
] as const;
const PINNED_KATANA_TEE_RELEASE = getKatanaTeeReleaseProjection();
const INPUT_READY_STATUSES: Record<(typeof REQUIRED_INPUTS)[number], string> = {
  authorityInventory: "production-ready",
  economicWriteClassificationPolicySha256: "production-ready",
  economicWriteInventorySha256: "production-ready",
  emergencySealedProof: "production-ready",
  exitFamilyInventory: "production-ready",
  frozenPositionProof: "production-ready",
  frozenRecoveryMaterializationProofs: "production-ready",
  hardenedInboxProof: "production-ready",
  katanaTeeRelease: "production-ready",
  legacyMmrDerivationProof: "production-ready",
  mmrPlanProof: "production-ready",
  onchainObservationSha256: "production-ready",
  protocolSchema: "frozen-production-v1",
};
const INPUT_IDENTITY_FIELDS: Record<(typeof REQUIRED_INPUTS)[number], readonly string[]> = {
  authorityInventory: ["candidateAuthoritySchemaHash", "approvalRecordHash", "onchainObservationSha256"],
  economicWriteClassificationPolicySha256: ["policySha256"],
  economicWriteInventorySha256: ["inventorySha256"],
  emergencySealedProof: ["programId", "verificationKeyHash", "receiptSha256", "journalHash"],
  exitFamilyInventory: ["inventoryHash", "sourceProjectionHash", "reviewedBoundsHash"],
  frozenPositionProof: ["programId", "verificationKeyHash", "receiptSha256", "journalHash"],
  frozenRecoveryMaterializationProofs: ["programSetHash", "verificationKeySetHash", "receiptSetHash"],
  hardenedInboxProof: [
    "recursiveFinalityProgramId",
    "recursiveFinalityVerificationKeyHash",
    "recursiveFinalityReceiptSha256",
    "cancelledMarkerProofHash",
    "stateRoot",
  ],
  katanaTeeRelease: ["releaseIdentitySha256"],
  legacyMmrDerivationProof: [
    "sourceInventoryProgramId",
    "typedDerivationProgramId",
    "verificationKeySetHash",
    "sourceInventoryReceiptSha256",
    "typedDerivationReceiptSha256",
  ],
  mmrPlanProof: ["programId", "verificationKeyHash", "receiptSha256", "elfSha256", "journalHash"],
  onchainObservationSha256: ["observationSha256", "stateRoot"],
  protocolSchema: ["registryHash", "fileSha256"],
};
const REBASELINE_TICKETS = ["D5", "D6", "D7", "D8", "D9"] as const;
export const A23_REQUIRED_AUDITS = ["cairo", "accounting", "tee-transport", "sp1", "release-process"] as const;

export const A23_WAVE0_TICKET_IDS = ticketRange("A", 1, 23);
export const A23_PRODUCTION_TICKET_IDS = [
  ...ticketRange("B", 1, 8),
  ...ticketRange("C", 1, 23),
  ...ticketRange("D", 2, 12),
  ...ticketRange("E", 1, 10),
  ...ticketRange("F", 1, 8),
];
export const A23_PROGRAM_TICKET_IDS = [
  ...A23_WAVE0_TICKET_IDS,
  ...A23_PRODUCTION_TICKET_IDS,
  ...ticketRange("G", 1, 17),
];

export interface A23GoDecision {
  schemaVersion: 1;
  ticket: "A23";
  recordedAt: string;
  decision: "GO";
  decisionReason: string;
  releaseReady: false;
  productionStartAuthorized: false;
  productionProgramStartAuthorized: true;
  productionEpics: Record<string, { dependsOn: string[]; status: string }>;
  productionTicketDependencyMatrix: {
    status: string;
    appliesToEachTicket: boolean;
    dependsOn: string[];
    ticketIds: string[];
  };
  wave0: Array<{ ticket: string; status: string; mandatoryBlocker?: boolean }>;
  frozenAndCandidateInputs: Record<string, unknown>;
  performanceEvidence: Record<string, unknown>;
  topologyDecision: Record<string, unknown>;
  backlogRebaseline: Record<string, unknown>;
  stopOutcomes: unknown[];
  authorization: {
    status: string;
    namedTicketDris: Array<{ ticket: string; individual: string }>;
    namedIndependentReviewers: Array<{ ticket: string; individual: string }>;
    namedAuditOwners: Array<{ audit: string; individual: string }>;
    signatures: unknown;
  };
  [key: string]: unknown;
}

export function assertCompleteA23GoDecision(value: unknown): asserts value is A23GoDecision {
  const decision = asObject(value, "A23 Wave 0 release decision");
  assertReleaseFlags(decision);
  assertProductionDependencies(decision);
  assertWave0Complete(decision);
  assertEvidenceComplete(decision);
  assertBacklogRebaselineComplete(decision);
  assertAuthorizationAssignmentsComplete(decision);
}

function assertReleaseFlags(decision: Record<string, unknown>): void {
  if (decision.schemaVersion !== 1 || decision.ticket !== "A23") throw malformedDecision();
  if (
    decision.decision !== "GO" ||
    decision.releaseReady !== false ||
    decision.productionStartAuthorized !== false ||
    decision.productionProgramStartAuthorized !== true
  ) {
    throw new Error("Production implementation is blocked by the current A23 Wave 0 decision");
  }
  requireNonBlank(decision.decisionReason, "A23 decision reason");
  if (!isIsoDate(decision.recordedAt)) throw new Error("A23 GO decision requires a valid recordedAt date");
}

function assertProductionDependencies(decision: Record<string, unknown>): void {
  const epics = asObject(decision.productionEpics, "A23 production epic dependencies");
  assertExactKeys(epics, PRODUCTION_EPICS, "A23 production epic dependencies");
  for (const epic of PRODUCTION_EPICS) {
    const entry = asObject(epics[epic], `A23 Epic ${epic} dependency`);
    assertStringArray(entry.dependsOn, ["A23"], `A23 Epic ${epic} dependency`);
    if (entry.status !== "ready") throw new Error(`A23 Epic ${epic} is not ready`);
  }

  const matrix = asObject(decision.productionTicketDependencyMatrix, "A23 production ticket dependency matrix");
  if (matrix.status !== "ready" || matrix.appliesToEachTicket !== true) {
    throw new Error("A23 production ticket dependency matrix is not ready");
  }
  assertStringArray(matrix.dependsOn, ["A23"], "A23 production ticket dependency");
  assertStringArray(matrix.ticketIds, A23_PRODUCTION_TICKET_IDS, "A23 production ticket set");
}

function assertWave0Complete(decision: Record<string, unknown>): void {
  if (!Array.isArray(decision.wave0)) throw new Error("A23 GO decision requires the complete Wave 0 projection");
  const projection = decision.wave0.map((entry, index) => {
    const ticket = asObject(entry, `A23 Wave 0 entry ${index}`);
    return { ticket: ticket.ticket, status: ticket.status, mandatoryBlocker: ticket.mandatoryBlocker === true };
  });
  const expected = A23_WAVE0_TICKET_IDS.map((ticket) => ({ ticket, status: "complete", mandatoryBlocker: false }));
  if (JSON.stringify(projection) !== JSON.stringify(expected)) {
    throw new Error("A23 GO decision requires every A1-A23 ticket complete with zero mandatory blockers");
  }
  if (!Array.isArray(decision.stopOutcomes) || decision.stopOutcomes.length !== 0) {
    throw new Error("A23 GO decision cannot retain stop outcomes");
  }
}

function assertEvidenceComplete(decision: Record<string, unknown>): void {
  const inputs = asObject(decision.frozenAndCandidateInputs, "A23 frozen evidence inputs");
  assertExactKeys(inputs, REQUIRED_INPUTS, "A23 frozen evidence inputs");
  for (const name of REQUIRED_INPUTS) {
    const evidence = assertReadyEvidence(inputs[name], INPUT_READY_STATUSES[name], `A23 frozen evidence input ${name}`);
    assertRequiredIdentityFields(evidence, INPUT_IDENTITY_FIELDS[name], `A23 frozen evidence input ${name}`);
  }
  assertInputSpecificCompletion(inputs);

  const performance = asObject(decision.performanceEvidence, "A23 performance evidence");
  assertExactKeys(performance, [...PERFORMANCE_TICKETS, "unavailableMandatoryCampaigns"], "A23 performance evidence");
  const unavailable = performance.unavailableMandatoryCampaigns;
  if (!Array.isArray(unavailable) || unavailable.length !== 0) {
    throw new Error("A23 GO decision retains unavailable mandatory campaigns");
  }
  for (const ticket of PERFORMANCE_TICKETS) {
    const evidence = assertReadyEvidence(performance[ticket], "complete", `A23 ${ticket} performance evidence`);
    requireNonBlank(evidence.artifact, `A23 ${ticket} performance artifact`);
    assertRequiredIdentityFields(evidence, PERFORMANCE_HASH_FIELDS[ticket], `A23 ${ticket} performance evidence`);
    for (const field of PERFORMANCE_NUMBER_FIELDS[ticket]) {
      const complete =
        field === "budgetUsd" ? isPositiveNumber(evidence[field]) : isPositiveIntegerAtLeast(evidence[field], 1);
      if (!complete) throw new Error(`A23 ${ticket} performance field is incomplete: ${field}`);
    }
    if (evidence.maximumBoundStatus !== "passed") {
      throw new Error(`A23 ${ticket} maximum-bound campaign is incomplete`);
    }
    if (ticket === "a17" && (evidence.result !== "pass" || evidence.overBoundWorldRejectStatus !== "passed")) {
      throw new Error("A23 a17 performance evidence is incomplete");
    }
    if (ticket === "a17" && !a17MetricsRespectHeadroom(evidence)) {
      throw new Error("A23 a17 performance evidence violates its ceiling or mandatory headroom");
    }
  }
  const topology = assertReadyEvidence(decision.topologyDecision, "frozen-hub-owned-v1", "A23 topology decision");
  if (topology.status !== "frozen-hub-owned-v1") throw new Error("A23 topology decision is not frozen");
}

function a17MetricsRespectHeadroom(evidence: Record<string, unknown>): boolean {
  const ceiling = evidence.ciCeiling as number;
  const stepLimit = evidence.katanaStepLimit as number;
  return ceiling * 5 <= stepLimit * 4 && A17_STEP_FIELDS.every((field) => (evidence[field] as number) <= ceiling);
}

function assertBacklogRebaselineComplete(decision: Record<string, unknown>): void {
  const rebaseline = asObject(decision.backlogRebaseline, "A23 backlog rebaseline");
  assertExactKeys(
    rebaseline,
    ["c16FactoryFamilies", "c17WorldMmrFamilies", "d5ThroughD9", "staffing", "criticalPath", "riskReserve"],
    "A23 backlog rebaseline",
  );
  assertEvidenceBackedRange(rebaseline.staffing, "assigned", "rangeFte", "A23 staffing");
  assertStaffingPlan(rebaseline.staffing);
  assertEvidenceBackedRange(rebaseline.criticalPath, "evidence-backed", "rangeWeeks", "A23 critical path");
  assertEvidenceBackedRange(rebaseline.riskReserve, "evidence-backed", "rangeWeeks", "A23 risk reserve");
  for (const [name, expectedStatus] of [
    ["c16FactoryFamilies", "estimated"],
    ["c17WorldMmrFamilies", "estimated"],
  ] as const) {
    const entry = asObject(rebaseline[name], `A23 ${name}`);
    if (
      entry.status !== expectedStatus ||
      !Array.isArray(entry.issues) ||
      !isPositiveRange(entry.rangeWeeks) ||
      !isSha256(entry.evidenceSha256)
    ) {
      throw new Error(`A23 ${name} rebaseline is incomplete`);
    }
    assertRebaselineIssues(entry.issues, `A23 ${name}`);
  }
  const d5ThroughD9 = asObject(rebaseline.d5ThroughD9, "A23 D5-D9 rebaseline");
  if (d5ThroughD9.status !== "estimated" || !isSha256(d5ThroughD9.evidenceSha256)) {
    throw new Error("A23 D5-D9 rebaseline is incomplete");
  }
  assertTicketEstimates(d5ThroughD9.estimates);
}

function assertStaffingPlan(value: unknown): void {
  const staffing = asObject(value, "A23 staffing");
  if (!isSha256(staffing.parallelismPlanSha256) || !isPositiveIntegerAtLeast(staffing.parallelLanes, 1)) {
    throw new Error("A23 staffing parallelism plan is incomplete");
  }
  if (!Array.isArray(staffing.namedLaneOwners) || staffing.namedLaneOwners.length !== staffing.parallelLanes) {
    throw new Error("A23 staffing lane ownership is incomplete");
  }
  const lanes = new Set<string>();
  const owners = new Set<string>();
  for (const [index, item] of staffing.namedLaneOwners.entries()) {
    const assignment = asObject(item, `A23 staffing lane ${index}`);
    requireNonBlank(assignment.lane, "A23 staffing lane");
    requireNonBlank(assignment.individual, "A23 staffing lane owner");
    if (lanes.has(assignment.lane as string) || owners.has(assignment.individual as string)) {
      throw new Error("A23 staffing lanes require distinct lane and owner assignments");
    }
    lanes.add(assignment.lane as string);
    owners.add(assignment.individual as string);
  }
}

function assertRebaselineIssues(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} issue projection is incomplete`);
  const issueIds = new Set<string>();
  for (const [index, item] of value.entries()) {
    const issue = asObject(item, `${label} issue ${index}`);
    requireNonBlank(issue.issueId, `${label} issue ID`);
    if (issue.disposition !== "planned" && issue.disposition !== "resolved") {
      throw new Error(`${label} issue disposition is incomplete`);
    }
    if (!isPositiveRange(issue.rangeWeeks) || !isSha256(issue.evidenceSha256)) {
      throw new Error(`${label} issue estimate is incomplete`);
    }
    if (issueIds.has(issue.issueId as string)) throw new Error(`${label} issue IDs contain duplicates`);
    issueIds.add(issue.issueId as string);
  }
}

function assertReadyEvidence(value: unknown, expectedStatus: string, label: string): Record<string, unknown> {
  const evidence = asObject(value, label);
  if (evidence.status !== expectedStatus || evidence.releaseReady !== true || !isSha256(evidence.evidenceSha256)) {
    throw new Error(`${label} is incomplete`);
  }
  assertNoBlockedEvidence(evidence, label);
  return evidence;
}

function assertRequiredIdentityFields(
  evidence: Record<string, unknown>,
  requiredFields: readonly string[],
  label: string,
): void {
  for (const field of requiredFields) {
    if (!isHash(evidence[field])) throw new Error(`${label} lacks required identity ${field}`);
  }
}

function assertInputSpecificCompletion(inputs: Record<string, unknown>): void {
  const authority = asObject(inputs.authorityInventory, "A23 authority inventory");
  if (
    authority.evidenceComplete !== true ||
    authority.externalAuthorizationStatus !== "authorized" ||
    authority.unresolvedMutationCandidates !== 0 ||
    !isPositiveIntegerAtLeast(authority.cleanBuildCount, 2)
  ) {
    throw new Error("A23 authority inventory is incomplete");
  }

  const exitFamilies = asObject(inputs.exitFamilyInventory, "A23 exit-family inventory");
  if (
    exitFamilies.reviewFindingCount !== 0 ||
    exitFamilies.implementationIssueCount !== 0 ||
    exitFamilies.familiesWithoutDiscoveredWrites !== 0
  ) {
    throw new Error("A23 exit-family inventory retains unresolved coverage");
  }

  const inbox = asObject(inputs.hardenedInboxProof, "A23 hardened-inbox proof");
  if (inbox.productionRecursiveFinalityVerified !== true || inbox.mandatoryBlockerCount !== 0) {
    throw new Error("A23 hardened-inbox proof is incomplete");
  }

  assertKatanaTeeReleaseComplete(inputs.katanaTeeRelease);
}

function assertKatanaTeeReleaseComplete(value: unknown): void {
  const release = asObject(value, "A23 Katana TEE release");
  assertKatanaTeeReleaseProjection(release, "A23 Katana TEE release");
  for (const field of [
    "sourceAuditStatus",
    "releaseArtifactVerificationStatus",
    "buildReproductionStatus",
    "launchMeasurementReproductionStatus",
  ]) {
    if (release[field] !== "passed") {
      throw new Error(`A23 Katana TEE release evidence is incomplete: ${field}`);
    }
  }
  if (
    release.productionDagSourceCommit !== PINNED_KATANA_TEE_RELEASE.sourceCommit ||
    release.productionIdentityAligned !== true ||
    !isPositiveIntegerAtLeast(release.independentBuildCount, 2) ||
    release.realTeeEvidenceStatus !== "passed" ||
    release.measuredProvisionerStatus !== "passed" ||
    !isSha256(release.sbomSha256) ||
    !isSha256(release.provenanceSha256) ||
    !isSha256(release.measuredProvisionerArtifactSha256)
  ) {
    throw new Error(
      "A23 Katana TEE production identity, supply chain, provisioner, or real-hardware evidence is incomplete",
    );
  }
}

function assertNoBlockedEvidence(value: unknown, label: string): void {
  if (value === null) throw new Error(`${label} contains unresolved null evidence`);
  if (Array.isArray(value)) {
    for (const item of value) assertNoBlockedEvidence(item, label);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, candidate] of Object.entries(value)) {
    if (key === "releaseReady" && candidate !== true) throw new Error(`${label} is not release ready`);
    if (/blockerCount$/i.test(key) && candidate !== 0) throw new Error(`${label} retains mandatory blockers`);
    if (/blockers$/i.test(key) && Array.isArray(candidate) && candidate.length > 0) {
      throw new Error(`${label} retains mandatory blockers`);
    }
    if (
      /status$/i.test(key) &&
      typeof candidate === "string" &&
      /(absent|blocked|failed|incomplete|missing|awaiting|unavailable|pending|reference|stop|redesign)/i.test(candidate)
    ) {
      throw new Error(`${label} retains an incomplete status`);
    }
    assertNoBlockedEvidence(candidate, label);
  }
}

function assertTicketEstimates(value: unknown): void {
  if (!Array.isArray(value)) throw new Error("A23 D5-D9 rebaseline is incomplete");
  const tickets = value.map((item, index) => {
    const estimate = asObject(item, `A23 D5-D9 estimate ${index}`);
    if (!isPositiveRange(estimate.rangeWeeks) || !isSha256(estimate.evidenceSha256)) {
      throw new Error("A23 D5-D9 rebaseline is incomplete");
    }
    return estimate.ticket;
  });
  if (JSON.stringify(tickets) !== JSON.stringify(REBASELINE_TICKETS)) {
    throw new Error("A23 D5-D9 rebaseline does not cover the exact required ticket set");
  }
}

function assertAuthorizationAssignmentsComplete(decision: Record<string, unknown>): void {
  const authorization = asObject(decision.authorization, "A23 authorization");
  if (authorization.status !== "authorized") throw new Error("A23 GO decision is not authorized");
  const dris = readAssignments(authorization.namedTicketDris, "ticket", "A23 ticket DRI");
  const reviewers = readAssignments(authorization.namedIndependentReviewers, "ticket", "A23 independent reviewer");
  assertAssignmentCoverage(dris, A23_PROGRAM_TICKET_IDS, "A23 ticket DRI");
  assertAssignmentCoverage(reviewers, A23_PROGRAM_TICKET_IDS, "A23 independent reviewer");
  for (const ticket of A23_PROGRAM_TICKET_IDS) {
    if (dris.get(ticket) === reviewers.get(ticket)) {
      throw new Error(`A23 ticket requires an independent reviewer distinct from its DRI: ${ticket}`);
    }
  }
  const audits = readAssignments(authorization.namedAuditOwners, "audit", "A23 audit owner");
  assertAssignmentCoverage(audits, A23_REQUIRED_AUDITS, "A23 audit owner");
}

function assertEvidenceBackedRange(value: unknown, status: string, field: string, label: string): void {
  const entry = asObject(value, label);
  if (entry.status !== status || !isPositiveRange(entry[field]) || !isSha256(entry.evidenceSha256)) {
    throw new Error(`${label} is incomplete`);
  }
}

function readAssignments(value: unknown, key: "ticket" | "audit", label: string): Map<string, string> {
  if (!Array.isArray(value)) throw new Error(`${label} assignments are unavailable`);
  const assignments = new Map<string, string>();
  for (const item of value) {
    const assignment = asObject(item, `${label} assignment`);
    const identity = assignment[key];
    requireNonBlank(identity, `${label} identity`);
    requireNonBlank(assignment.individual, `${label} individual`);
    if (assignments.has(identity as string)) throw new Error(`${label} assignments contain duplicates`);
    assignments.set(identity as string, assignment.individual as string);
  }
  return assignments;
}

function assertAssignmentCoverage(assignments: Map<string, string>, expected: readonly string[], label: string): void {
  if (JSON.stringify([...assignments.keys()]) !== JSON.stringify(expected)) {
    throw new Error(`${label} assignments do not cover the exact required set`);
  }
}

function isHash(value: unknown): boolean {
  return typeof value === "string" && (/^0x(?!0+$)[0-9a-f]{1,64}$/i.test(value) || isSha256(value));
}

function isSha256(value: unknown): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value) && !/^0+$/.test(value);
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) throw new Error(`${label} keys mismatch`);
}

function assertStringArray(value: unknown, expected: readonly string[], label: string): void {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch`);
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} is unavailable or malformed`);
  return value as Record<string, unknown>;
}

function requireNonBlank(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be non-blank`);
}

function isIsoDate(value: unknown): boolean {
  return (
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
  );
}

function isPositiveRange(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => Number.isFinite(item) && item > 0) &&
    value[0] <= value[1]
  );
}

function isPositiveIntegerAtLeast(value: unknown, minimum: number): boolean {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function ticketRange(epic: string, first: number, last: number): string[] {
  return Array.from({ length: last - first + 1 }, (_, index) => `${epic}${first + index}`);
}

function malformedDecision(): Error {
  return new Error("A23 Wave 0 release decision is unavailable or malformed");
}
