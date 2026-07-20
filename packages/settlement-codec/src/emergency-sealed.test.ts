import { describe, expect, it } from "vitest";
import type { ClaimLeaf, ClaimLeg, EmergencySealedClaim } from "./generated-types";
import {
  hashClaimLeaf,
  hashEmergencySealedClaim,
  hashEmergencySealedJournal,
  verifyEmergencySealedJournal,
} from "./emergency-sealed";
import { hashClaimLegs } from "./frozen-position";

const EXPECTED_LEAF_HASH = 0x556b800ade71aa2435161409a39f1c96c9e4ca6ea5da04457568db7a1303e9bn;
const EXPECTED_LEGS_HASH = 0x629899a61f730d376f3132c3d96052f782439f569ed5368b58ac3a4dbb50003n;
const EXPECTED_CLAIM_HASH = 0x1373c23a74a4ba9cefdc862253704bc800077476bfe663669eefdcb2029ae9fn;
const EXPECTED_JOURNAL_HASH = 0x37890799d1a1ec66e4425bfffa52747bcfb6fdb984b80d39420f451b01b343fn;

describe("emergency-sealed public journal", () => {
  it("matches the Rust and Cairo claim, leg, and journal hashes", () => {
    const { claim, journal, leaf, legs } = referenceVector();

    expect(hashClaimLeaf(leaf)).toBe(EXPECTED_LEAF_HASH);
    expect(hashClaimLegs(legs)).toBe(EXPECTED_LEGS_HASH);
    expect(hashEmergencySealedClaim(claim)).toBe(EXPECTED_CLAIM_HASH);
    expect(hashEmergencySealedJournal(journal)).toBe(EXPECTED_JOURNAL_HASH);
    expect(verifyEmergencySealedJournal(claim, leaf, legs, legs, journal, EXPECTED_JOURNAL_HASH)).toBe(true);
  });

  it("rejects substituted leaf, legs, liability, disposition, and receipt", () => {
    const { claim, journal, leaf, legs } = referenceVector();

    expect(
      verifyEmergencySealedJournal(claim, { ...leaf, leaf_index: 8n }, legs, legs, journal, EXPECTED_JOURNAL_HASH),
    ).toBe(false);
    expect(
      verifyEmergencySealedJournal(
        claim,
        leaf,
        [{ ...legs[0], amount_or_token_id: 751n }],
        legs,
        journal,
        EXPECTED_JOURNAL_HASH,
      ),
    ).toBe(false);
    expect(
      verifyEmergencySealedJournal({ ...claim, liability_id: 9002n }, leaf, legs, legs, journal, EXPECTED_JOURNAL_HASH),
    ).toBe(false);
    expect(
      verifyEmergencySealedJournal(
        { ...claim, disposition_kind: 2n },
        leaf,
        legs,
        legs,
        journal,
        EXPECTED_JOURNAL_HASH,
      ),
    ).toBe(false);
    expect(verifyEmergencySealedJournal(claim, leaf, legs, legs, journal, EXPECTED_JOURNAL_HASH + 1n)).toBe(false);
  });
});

function referenceVector(): {
  claim: EmergencySealedClaim;
  journal: ReturnType<typeof referenceJournal>;
  leaf: ClaimLeaf;
  legs: ClaimLeg[];
} {
  const legs = [fungibleLeg()];
  const leaf: ClaimLeaf = {
    version: 1n,
    deployment_id: 11n,
    season_id: 13n,
    game_id: 12n,
    batch_id: 4n,
    leaf_index: 7n,
    claim_kind: 0x1020n,
    liability_id: 9001n,
    claimant_l2: 77n,
    recipient_l1: 88n,
    legs_hash: EXPECTED_LEGS_HASH,
    aux_hash: 777n,
  };
  const claim: EmergencySealedClaim = {
    deployment_id: 11n,
    frozen_checkpoint_hash: 300n,
    game_id: 12n,
    batch_id: 4n,
    leaf_index: 7n,
    original_leaf_hash: EXPECTED_LEAF_HASH,
    liability_id: 9001n,
    disposition_kind: 1n,
    enabling_outbox_fact_hash: 4001n,
    original_legs_hash: EXPECTED_LEGS_HASH,
    settlement_legs_hash: EXPECTED_LEGS_HASH,
  };
  return { claim, journal: referenceJournal(claim), leaf, legs };
}

function referenceJournal(claim: EmergencySealedClaim) {
  return {
    programHash: 3001n,
    frozenCheckpointHash: 300n,
    acceptedIntervalHash: 3002n,
    registeredRoot: 3003n,
    claimHash: EXPECTED_CLAIM_HASH,
    originalLeafHash: claim.original_leaf_hash,
    originalLegsHash: claim.original_legs_hash,
    settlementLegsHash: claim.settlement_legs_hash,
    parentDispositionsHash: 3004n,
    exactReservationsHash: 3005n,
  };
}

function fungibleLeg(): ClaimLeg {
  return {
    asset_mode: 1n,
    asset_id: 37n,
    backing_pool_id: 500n,
    recipient: 88n,
    amount_or_token_id: 750n,
    policy_key: 601n,
  };
}
