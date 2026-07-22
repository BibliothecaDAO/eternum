import { describe, expect, test } from "vitest";
import { getHardenedInboxEvidence, validateHardenedInboxEvidence } from "./hardened-inbox-evidence";

describe("A16 hardened-inbox evidence", () => {
  test("separates the ACCEPTED_ON_L1 RPC observation from production recursive finality", () => {
    const evidence = getHardenedInboxEvidence();

    expect(() => validateHardenedInboxEvidence(evidence)).not.toThrow();
    expect(evidence.publicPatriciaEvidence.finalityStatus).toBe("ACCEPTED_ON_L1");
    expect(evidence.publicPatriciaEvidence.rpcObservation).toMatchObject({
      kind: "rpc-block-status-only",
      productionRecursiveFinalityVerified: false,
    });
    expect(evidence.releaseReady).toBe(false);
  });

  test("pins the inspected Starknet specification and public Piltover sources", () => {
    const evidence = getHardenedInboxEvidence();

    expect(evidence.externalSourcePins.starknetRpcSpec).toMatchObject({
      commit: "95acf0cb23f0967903c559d151a19ef5c3fac0fb",
      fileSha256: "5cf55377416b1a578ca139ecedcaf3d8f5f22db1f7f18c20c85b78c9fb517a34",
    });
    expect(evidence.externalSourcePins.publicPiltover).toMatchObject({
      commit: "563f6a10184d97c1168ea0f892c4f132ae4d927c",
      fileSha256: "43387750bf8fdeee47cdf218e1e238e0a9fce3f408c5d1cb376fea1961f48dda",
      cancellationIdentity: "message-hash-status",
      containsCancelledInboxMarker: false,
      containsInboxCancelledV1: false,
    });
  });

  test("records historical storage-proof retention failure without claiming a durable archive", () => {
    const evidence = getHardenedInboxEvidence();

    expect(evidence.publicPatriciaEvidence.historicalStorageProofReplay).toEqual({
      method: "starknet_getStorageProof",
      result: "error",
      errorCode: 42,
      errorMessage: "The node doesn't support storage proofs for blocks that are too far in the past",
      durableArchiveAvailable: false,
    });
    expect(evidence.publicPatriciaEvidence.containsCancelledMarkerStorageProof).toBe(false);
  });

  test("rejects attempts to promote observation-only evidence or remove blockers", () => {
    const promoted = getHardenedInboxEvidence();
    promoted.publicPatriciaEvidence.rpcObservation.productionRecursiveFinalityVerified = true;
    expect(() => validateHardenedInboxEvidence(promoted)).toThrow(/RPC observation/);

    const released = getHardenedInboxEvidence();
    released.releaseReady = true;
    expect(() => validateHardenedInboxEvidence(released)).toThrow(/releaseReady/);

    const missingBlocker = getHardenedInboxEvidence();
    missingBlocker.mandatoryBlockers.pop();
    expect(() => validateHardenedInboxEvidence(missingBlocker)).toThrow(/mandatory blocker IDs/);

    const inventedCost = getHardenedInboxEvidence();
    inventedCost.testEvidence.productionRecursiveFinalityVerifyL2Gas = 1;
    expect(() => validateHardenedInboxEvidence(inventedCost)).toThrow(/test evidence/);

    const substitutedBlock = getHardenedInboxEvidence();
    substitutedBlock.publicPatriciaEvidence.blockHash = "0x1";
    expect(() => validateHardenedInboxEvidence(substitutedBlock)).toThrow(/public fixture block hash/);
  });

  test("rejects schema, runtime, proof, observation, and reproducibility substitutions", () => {
    const wrongVersion = getHardenedInboxEvidence();
    wrongVersion.version = 999;
    expect(() => validateHardenedInboxEvidence(wrongVersion)).toThrow(/version/);

    const wrongRegistry = getHardenedInboxEvidence();
    wrongRegistry.protocolRegistryHash = "0x1";
    expect(() => validateHardenedInboxEvidence(wrongRegistry)).toThrow(/protocol registry hash/);

    const wrongRuntime = getHardenedInboxEvidence();
    (wrongRuntime.runtime as { upgradeable: boolean }).upgradeable = true;
    expect(() => validateHardenedInboxEvidence(wrongRuntime)).toThrow(/runtime contract/);

    const wrongProofModel = getHardenedInboxEvidence();
    (wrongProofModel.proofModel as { trieHeight: number }).trieHeight = 250;
    expect(() => validateHardenedInboxEvidence(wrongProofModel)).toThrow(/proof model/);

    const wrongRpc = getHardenedInboxEvidence();
    wrongRpc.publicPatriciaEvidence.rpcObservation.rpcUrl = "https://attacker.invalid";
    expect(() => validateHardenedInboxEvidence(wrongRpc)).toThrow(/RPC observation/);

    const wrongManifest = getHardenedInboxEvidence();
    wrongManifest.reproducibilityInputs.manifestSha256 = "0".repeat(64);
    expect(() => validateHardenedInboxEvidence(wrongManifest)).toThrow(/reproducibility inputs/);
  });

  test("rejects a substituted public contract leaf", () => {
    const substitutedLeaf = getHardenedInboxEvidence();
    substitutedLeaf.publicPatriciaEvidence.contractLeaf = "0x1";

    expect(() => validateHardenedInboxEvidence(substitutedLeaf)).toThrow(/public fixture contract leaf/);
  });

  test("rejects a substituted public contracts root", () => {
    const substitutedRoot = getHardenedInboxEvidence();
    substitutedRoot.publicPatriciaEvidence.contractsRoot = "0x1";

    expect(() => validateHardenedInboxEvidence(substitutedRoot)).toThrow(/public fixture contracts root/);
  });

  test("rejects a substituted public classes root", () => {
    const substitutedRoot = getHardenedInboxEvidence();
    substitutedRoot.publicPatriciaEvidence.classesRoot = "0x1";

    expect(() => validateHardenedInboxEvidence(substitutedRoot)).toThrow(/public fixture classes root/);
  });

  test("returns an isolated copy of the canonical evidence", () => {
    const mutated = getHardenedInboxEvidence();
    mutated.externalSourcePins.publicPiltover.containsCancelledInboxMarker = true;

    expect(() => validateHardenedInboxEvidence(mutated)).toThrow(/external source pins/);
    expect(getHardenedInboxEvidence().externalSourcePins.publicPiltover.containsCancelledInboxMarker).toBe(false);
  });
});
