import { describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  A23_PRODUCTION_TICKET_IDS,
  A23_PROGRAM_TICKET_IDS,
  A23_WAVE0_TICKET_IDS,
  assertA23ProgramStartAuthorized,
  assertProductionReleaseAuthorized,
  buildA23ProgramAuthorizationMessage,
  type A23ReleaseAuthorizationVerification,
} from "../game-stack";

describe("Wave 0 production release authorization", () => {
  test("fails closed for the current unsigned A23 STOP shape", () => {
    expect(() =>
      assertProductionReleaseAuthorized({
        schemaVersion: 1,
        ticket: "A23",
        decision: "STOP",
        releaseReady: false,
        productionStartAuthorized: false,
        authorization: { status: "awaiting-authorized-signatures", signatures: [] },
      }),
    ).toThrow("Production implementation is blocked by the current A23 Wave 0 decision");
  });

  test("rejects a skeletal GO record before signature verification", () => {
    expect(() =>
      assertProductionReleaseAuthorized({
        schemaVersion: 1,
        ticket: "A23",
        recordedAt: "2026-07-23",
        decision: "GO",
        decisionReason: "Incomplete.",
        releaseReady: false,
        productionStartAuthorized: false,
        productionProgramStartAuthorized: true,
        authorization: { status: "authorized", signatures: [] },
      }),
    ).toThrow("production epic dependencies");
  });

  test("accepts a complete GO record signed by the configured release authority", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const decision = goDecision();
    addSignature(decision, "release-authority-1", privateKey);

    expect(() =>
      assertA23ProgramStartAuthorized(decision, {
        requiredSignatureCount: 1,
        trustedSignerPublicKeys: {
          "release-authority-1": publicKey.export({ type: "spki", format: "pem" }).toString(),
        },
      }),
    ).not.toThrow();
  });

  test("rejects an unknown signer, a changed decision, and an unmet quorum", () => {
    const authority = generateKeyPairSync("ed25519");
    const otherAuthority = generateKeyPairSync("ed25519");
    const decision = goDecision();
    addSignature(decision, "release-authority-1", authority.privateKey);
    const verification: A23ReleaseAuthorizationVerification = {
      requiredSignatureCount: 1,
      trustedSignerPublicKeys: {
        "release-authority-2": otherAuthority.publicKey.export({ type: "spki", format: "pem" }).toString(),
      },
    };

    expect(() => assertA23ProgramStartAuthorized(decision, verification)).toThrow(
      "does not satisfy the configured signature quorum",
    );

    verification.trustedSignerPublicKeys["release-authority-1"] = authority.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
    decision.decisionReason = "changed after signature";
    expect(() => assertA23ProgramStartAuthorized(decision, verification)).toThrow(
      "does not satisfy the configured signature quorum",
    );

    decision.decisionReason = "All mandatory Wave 0 evidence is complete.";
    verification.requiredSignatureCount = 2;
    expect(() => assertA23ProgramStartAuthorized(decision, verification)).toThrow(
      "does not satisfy the configured signature quorum",
    );
  });

  test("rejects duplicate signer identities and duplicate trusted key aliases", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const decision = goDecision();
    addSignature(decision, "release-authority-1", privateKey);
    decision.authorization.signatures.push({ ...decision.authorization.signatures[0] });

    expect(() =>
      assertA23ProgramStartAuthorized(decision, {
        requiredSignatureCount: 1,
        trustedSignerPublicKeys: { "release-authority-1": publicKeyPem },
      }),
    ).toThrow("contains a duplicate signer identity");

    const distinctIds = goDecision();
    addSignature(distinctIds, "release-authority-1", privateKey);
    expect(() =>
      assertA23ProgramStartAuthorized(distinctIds, {
        requiredSignatureCount: 2,
        trustedSignerPublicKeys: {
          "release-authority-1": publicKeyPem,
          "release-authority-alias": publicKeyPem,
        },
      }),
    ).toThrow("duplicate trusted public-key material");
  });

  test("rejects malformed verification policies", () => {
    expect(() =>
      assertA23ProgramStartAuthorized(goDecision(), {
        requiredSignatureCount: 0,
        trustedSignerPublicKeys: {},
      }),
    ).toThrow("requires a positive signature quorum");

    expect(() =>
      assertA23ProgramStartAuthorized(goDecision(), {
        requiredSignatureCount: 1,
        trustedSignerPublicKeys: { authority: "not-a-key" },
      }),
    ).toThrow("invalid Ed25519 public key");
  });

  test("rejects missing signed GO sections and unresolved evidence", () => {
    const cases: Array<[string, (decision: ReturnType<typeof goDecision>) => void]> = [
      ["production ticket dependency matrix", (decision) => delete decision.productionTicketDependencyMatrix],
      ["complete Wave 0 projection", (decision) => decision.wave0.pop()],
      ["frozen evidence inputs", (decision) => delete decision.frozenAndCandidateInputs.authorityInventory],
      [
        "release-ready evidence",
        (decision) => (decision.frozenAndCandidateInputs.authorityInventory.releaseReady = false),
      ],
      [
        "required proof identity",
        (decision) => delete decision.frozenAndCandidateInputs.mmrPlanProof.verificationKeyHash,
      ],
      ["failed nested status", (decision) => (decision.frozenAndCandidateInputs.mmrPlanProof.status = "failed")],
      [
        "non-empty mandatory blocker list",
        (decision) => Object.assign(decision.frozenAndCandidateInputs.mmrPlanProof, { mandatoryBlockers: ["missing"] }),
      ],
      [
        "unavailable mandatory campaigns",
        (decision) => decision.performanceEvidence.unavailableMandatoryCampaigns.push("A13"),
      ],
      ["proof-size campaign", (decision) => (decision.performanceEvidence.a13.proofBytes = 0)],
      ["A17 per-transaction headroom", (decision) => (decision.performanceEvidence.a17.atomicAppendSteps = 20_000_001)],
      ["A17 safe numeric bounds", (decision) => (decision.performanceEvidence.a17.ciCeiling = Number.MAX_VALUE)],
      ["staffing", (decision) => (decision.backlogRebaseline.staffing.status = "unavailable")],
      ["staffing lane plan", (decision) => decision.backlogRebaseline.staffing.namedLaneOwners.pop()],
      ["complete D5-D9 estimates", (decision) => decision.backlogRebaseline.d5ThroughD9.estimates.pop()],
      ["ticket DRI", (decision) => decision.authorization.namedTicketDris.pop()],
      [
        "independent reviewer",
        (decision) => (decision.authorization.namedIndependentReviewers[0].individual = "dri-A1"),
      ],
      ["audit owner", (decision) => decision.authorization.namedAuditOwners.pop()],
    ];

    for (const [label, mutate] of cases) {
      const decision = goDecision();
      mutate(decision);
      expect(() => buildA23ProgramAuthorizationMessage(decision), label).toThrow();
    }
  });

  test("rejects today's blocked evidence when copied into an otherwise complete GO", () => {
    const currentStop = JSON.parse(
      readFileSync(
        new URL("../../../../packages/settlement-codec/schema/wave0-a23-stop-decision-v1.json", import.meta.url),
        "utf8",
      ),
    ) as { frozenAndCandidateInputs: unknown; performanceEvidence: unknown };

    for (const blockedEvidence of [currentStop.frozenAndCandidateInputs, currentStop.performanceEvidence]) {
      const decision = goDecision();
      if (blockedEvidence === currentStop.frozenAndCandidateInputs) {
        Object.assign(decision, { frozenAndCandidateInputs: blockedEvidence });
      } else {
        Object.assign(decision, { performanceEvidence: blockedEvidence });
      }
      expect(() => buildA23ProgramAuthorizationMessage(decision)).toThrow();
    }
  });

  test("keeps production activation blocked after a signed A23 program-start GO", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const decision = goDecision();
    addSignature(decision, "release-authority-1", privateKey);

    expect(() =>
      assertProductionReleaseAuthorized(decision, {
        requiredSignatureCount: 1,
        trustedSignerPublicKeys: {
          "release-authority-1": publicKey.export({ type: "spki", format: "pem" }).toString(),
        },
      }),
    ).toThrow("Production activation remains blocked until B-F completion");
  });
});

function addSignature(decision: ReturnType<typeof goDecision>, signerId: string, privateKey: KeyObject): void {
  decision.authorization.signatures.push({
    signerId,
    scheme: "ed25519",
    signatureBase64: sign(null, buildA23ProgramAuthorizationMessage(decision), privateKey).toString("base64"),
  });
}

function goDecision() {
  const evidence = (name: string, status = "production-ready") => ({
    status,
    releaseReady: true as const,
    evidenceSha256: sha256(`${name}:evidence`),
  });
  const proof = (name: string, status = "production-ready") => ({
    ...evidence(name, status),
    programId: felt(`${name}:program`),
    verificationKeyHash: felt(`${name}:vk`),
    receiptSha256: sha256(`${name}:receipt`),
    journalHash: felt(`${name}:journal`),
  });
  return {
    schemaVersion: 1 as const,
    ticket: "A23" as const,
    recordedAt: "2026-07-23",
    decision: "GO" as const,
    decisionReason: "All mandatory Wave 0 evidence is complete.",
    releaseReady: false as const,
    productionStartAuthorized: false as const,
    productionProgramStartAuthorized: true as const,
    productionEpics: Object.fromEntries(
      ["B", "C", "D", "E", "F"].map((epic) => [epic, { dependsOn: ["A23"], status: "ready" }]),
    ),
    productionTicketDependencyMatrix: {
      status: "ready",
      appliesToEachTicket: true,
      dependsOn: ["A23"],
      ticketIds: [...A23_PRODUCTION_TICKET_IDS],
    },
    wave0: A23_WAVE0_TICKET_IDS.map((ticket) => ({ ticket, status: "complete" })),
    frozenAndCandidateInputs: {
      authorityInventory: {
        ...evidence("authority"),
        candidateAuthoritySchemaHash: felt("authority:schema"),
        approvalRecordHash: felt("authority:approval"),
        onchainObservationSha256: sha256("authority:observation"),
        evidenceComplete: true,
        externalAuthorizationStatus: "authorized",
        unresolvedMutationCandidates: 0,
        cleanBuildCount: 2,
      },
      economicWriteClassificationPolicySha256: {
        ...evidence("economic-policy"),
        policySha256: sha256("economic-policy:identity"),
      },
      economicWriteInventorySha256: {
        ...evidence("economic-inventory"),
        inventorySha256: sha256("economic-inventory:identity"),
      },
      emergencySealedProof: proof("a15"),
      exitFamilyInventory: {
        ...evidence("exit-families"),
        inventoryHash: felt("exit-families:inventory"),
        sourceProjectionHash: felt("exit-families:source"),
        reviewedBoundsHash: felt("exit-families:bounds"),
        reviewFindingCount: 0,
        implementationIssueCount: 0,
        familiesWithoutDiscoveredWrites: 0,
      },
      frozenPositionProof: proof("a5"),
      frozenRecoveryMaterializationProofs: {
        ...evidence("a21"),
        programSetHash: felt("a21:programs"),
        verificationKeySetHash: felt("a21:vks"),
        receiptSetHash: felt("a21:receipts"),
      },
      hardenedInboxProof: {
        ...evidence("a16"),
        recursiveFinalityProgramId: felt("a16:program"),
        recursiveFinalityVerificationKeyHash: felt("a16:vk"),
        recursiveFinalityReceiptSha256: sha256("a16:receipt"),
        cancelledMarkerProofHash: felt("a16:cancelled-marker"),
        stateRoot: felt("a16:state-root"),
        productionRecursiveFinalityVerified: true,
        mandatoryBlockerCount: 0,
      },
      legacyMmrDerivationProof: {
        ...evidence("a19"),
        sourceInventoryProgramId: felt("a19:inventory-program"),
        typedDerivationProgramId: felt("a19:derivation-program"),
        verificationKeySetHash: felt("a19:vks"),
        sourceInventoryReceiptSha256: sha256("a19:inventory-receipt"),
        typedDerivationReceiptSha256: sha256("a19:derivation-receipt"),
      },
      mmrPlanProof: {
        ...proof("a13"),
        elfSha256: sha256("a13:elf"),
      },
      onchainObservationSha256: {
        ...evidence("onchain-observation"),
        observationSha256: sha256("onchain-observation:identity"),
        stateRoot: felt("onchain-observation:state-root"),
      },
      protocolSchema: {
        ...evidence("protocol-schema", "frozen-production-v1"),
        registryHash: felt("protocol-schema:registry"),
        fileSha256: sha256("protocol-schema:file"),
      },
    },
    performanceEvidence: {
      a5: performanceEvidence("a5"),
      a8: performanceEvidence("a8"),
      a13: performanceEvidence("a13"),
      a15: performanceEvidence("a15"),
      a16: performanceEvidence("a16"),
      a17: performanceEvidence("a17"),
      a19: performanceEvidence("a19"),
      a21: performanceEvidence("a21"),
      unavailableMandatoryCampaigns: [] as string[],
    },
    topologyDecision: evidence("topology", "frozen-hub-owned-v1"),
    backlogRebaseline: {
      c16FactoryFamilies: {
        status: "estimated",
        issues: [
          {
            issueId: "C16-factory-family",
            disposition: "planned",
            rangeWeeks: [1, 2],
            evidenceSha256: sha256("c16:factory-family"),
          },
        ],
        rangeWeeks: [2, 3],
        evidenceSha256: sha256("c16"),
      },
      c17WorldMmrFamilies: {
        status: "estimated",
        issues: [
          {
            issueId: "C17-world-mmr-family",
            disposition: "planned",
            rangeWeeks: [1, 3],
            evidenceSha256: sha256("c17:world-mmr-family"),
          },
        ],
        rangeWeeks: [2, 4],
        evidenceSha256: sha256("c17"),
      },
      d5ThroughD9: {
        status: "estimated",
        evidenceSha256: sha256("d5-d9"),
        estimates: ["D5", "D6", "D7", "D8", "D9"].map((ticket) => ({
          ticket,
          rangeWeeks: [1, 2],
          evidenceSha256: sha256(ticket),
        })),
      },
      staffing: {
        status: "assigned",
        rangeFte: [8, 12],
        evidenceSha256: sha256("staffing"),
        parallelismPlanSha256: sha256("staffing:parallelism"),
        parallelLanes: 3,
        namedLaneOwners: ["protocol", "proofs", "runtime"].map((lane) => ({
          lane,
          individual: `${lane}-owner`,
        })),
      },
      criticalPath: {
        status: "evidence-backed",
        rangeWeeks: [20, 24],
        evidenceSha256: sha256("critical-path"),
      },
      riskReserve: { status: "evidence-backed", rangeWeeks: [4, 8], evidenceSha256: sha256("risk-reserve") },
    },
    stopOutcomes: [],
    authorization: {
      status: "authorized",
      namedTicketDris: A23_PROGRAM_TICKET_IDS.map((ticket) => ({ ticket, individual: `dri-${ticket}` })),
      namedIndependentReviewers: A23_PROGRAM_TICKET_IDS.map((ticket) => ({
        ticket,
        individual: `reviewer-${ticket}`,
      })),
      namedAuditOwners: ["cairo", "accounting", "tee-transport", "sp1", "release-process"].map((audit) => ({
        audit,
        individual: `${audit}-owner`,
      })),
      signatures: [] as Array<{ signerId: string; scheme: "ed25519"; signatureBase64: string }>,
    },
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function felt(value: string): string {
  return `0x${sha256(value).slice(0, 63)}`;
}

function performanceEvidence(ticket: "a5" | "a8" | "a13" | "a15" | "a16" | "a17" | "a19" | "a21") {
  const common = {
    status: "complete",
    releaseReady: true,
    evidenceSha256: sha256(`${ticket}:performance:evidence`),
    artifact: `evidence/${ticket}.json`,
    maximumBoundStatus: "passed",
  };
  switch (ticket) {
    case "a5":
    case "a15":
      return {
        ...common,
        programId: felt(`${ticket}:program`),
        verificationKeyHash: felt(`${ticket}:vk`),
        receiptSha256: sha256(`${ticket}:receipt`),
        proveDurationMs: 1,
        verifyDurationMs: 1,
        maximumBoundDurationMs: 1,
        proofBytes: 1,
        cairoVerifierL2Gas: 1,
      };
    case "a8":
      return {
        ...common,
        exactFamilyBoundsHash: felt("a8:bounds"),
        awsRunArtifactSha256: sha256("a8:aws-run"),
        budgetUsd: 1,
        maximumCardinalityDurationMs: 1,
      };
    case "a13":
      return {
        ...common,
        programId: felt("a13:program"),
        verificationKeyHash: felt("a13:vk"),
        receiptSha256: sha256("a13:receipt"),
        elfSha256: sha256("a13:elf"),
        proveDurationMs: 1,
        verifyDurationMs: 1,
        maximumBoundDurationMs: 1,
        proofBytes: 1,
        cairoVerifierL2Gas: 1,
      };
    case "a16":
      return {
        ...common,
        recursiveFinalityProgramId: felt("a16:program"),
        recursiveFinalityVerificationKeyHash: felt("a16:vk"),
        cancelledMarkerProofHash: felt("a16:cancelled-marker"),
        recursiveFinalityVerifyL2Gas: 1,
        maximumStorageProofL2Gas: 1,
        recursiveFinalityProofBytes: 1,
      };
    case "a17":
      return {
        ...common,
        benchmarkArtifactSha256: sha256("a17:benchmark"),
        katanaStepLimit: 25_000_000,
        ciCeiling: 20_000_000,
        atomicAppendSteps: 1_862_864,
        rolloverSteps: 2_868_066,
        thirtyTwoWorldClosureSteps: 89_622,
        worstDistributionSteps: 8_987_742,
        mixedMaximumJourneySteps: 17_567_923,
        result: "pass",
        overBoundWorldRejectStatus: "passed",
      };
    case "a19":
      return {
        ...common,
        sourceInventoryProgramId: felt("a19:inventory-program"),
        typedDerivationProgramId: felt("a19:derivation-program"),
        verificationKeySetHash: felt("a19:vks"),
        receiptSetHash: felt("a19:receipts"),
        sourceInventoryProveDurationMs: 1,
        typedDerivationProveDurationMs: 1,
        typedDerivationVerifyDurationMs: 1,
        sourceInventoryProofBytes: 1,
        typedDerivationProofBytes: 1,
        sourceInventoryVerifyL2Gas: 1,
        typedDerivationVerifyL2Gas: 1,
      };
    case "a21":
      return {
        ...common,
        programSetHash: felt("a21:programs"),
        verificationKeySetHash: felt("a21:vks"),
        receiptSetHash: felt("a21:receipts"),
        maximumBoundProveDurationMs: 1,
        maximumBoundVerifyDurationMs: 1,
        segmentedProofBytes: 1,
        recursiveProofBytes: 1,
        materializationProofBytes: 1,
        cairoVerifierL2Gas: 1,
      };
  }
}
