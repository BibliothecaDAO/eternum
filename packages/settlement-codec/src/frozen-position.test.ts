import { describe, expect, it } from "vitest";
import type { ClaimLeg, ExitClaim } from "./generated-types";
import {
  hashClaimLegs,
  hashExitClaim,
  hashFrozenPositionJournal,
  verifyFrozenPositionJournal,
} from "./frozen-position";

describe("frozen-position public journal", () => {
  it("binds the exact claim and ordered payout legs", () => {
    const legs = activeLegs();
    const claim = activeClaim(hashClaimLegs(legs));
    const journal = {
      programHash: 3001n,
      stateRoot: 3002n,
      finalOutboxCursor: 19n,
      claimHash: hashExitClaim(claim),
      payoutLegsHash: claim.payout_legs_hash,
    };
    const verifiedJournalHash = hashFrozenPositionJournal(journal);

    expect(verifyFrozenPositionJournal(claim, legs, journal, verifiedJournalHash)).toBe(true);
  });

  it("rejects claim, leg, cursor, and receipt substitutions", () => {
    const legs = activeLegs();
    const claim = activeClaim(hashClaimLegs(legs));
    const journal = {
      programHash: 3001n,
      stateRoot: 3002n,
      finalOutboxCursor: 19n,
      claimHash: hashExitClaim(claim),
      payoutLegsHash: claim.payout_legs_hash,
    };
    const verifiedJournalHash = hashFrozenPositionJournal(journal);

    expect(verifyFrozenPositionJournal({ ...claim, owner_l2: 78n }, legs, journal, verifiedJournalHash)).toBe(false);
    expect(
      verifyFrozenPositionJournal(
        claim,
        [{ ...legs[0], amount_or_token_id: 9_699n }, ...legs.slice(1)],
        journal,
        verifiedJournalHash,
      ),
    ).toBe(false);
    expect(verifyFrozenPositionJournal(claim, legs, { ...journal, finalOutboxCursor: 20n }, verifiedJournalHash)).toBe(
      false,
    );
    expect(verifyFrozenPositionJournal(claim, legs, journal, verifiedJournalHash + 1n)).toBe(false);
    expect(verifyFrozenPositionJournal(claim, [], journal, verifiedJournalHash)).toBe(false);
    expect(verifyFrozenPositionJournal(claim, [...legs, ...legs, legs[0]], journal, verifiedJournalHash)).toBe(false);
  });
});

function activeClaim(payoutLegsHash: bigint): ExitClaim {
  return {
    deployment_id: 11n,
    game_id: 12n,
    frozen_block_number: 700n,
    world: 10n,
    class_hash: 201n,
    schema_hash: 202n,
    position_family: 7n,
    position_id: 42n,
    position_generation: 3n,
    source_state: 1n,
    liability_id: 7001n,
    owner_l2: 77n,
    recipient_l1: 88n,
    recovery_policy_hash: 501n,
    payout_legs_hash: payoutLegsHash,
  };
}

function activeLegs(): ClaimLeg[] {
  return [leg(88n, 9_700n, 601n), leg(92n, 100n, 602n), leg(93n, 150n, 603n), leg(92n, 50n, 604n)];
}

function leg(recipient: bigint, amount: bigint, policyKey: bigint): ClaimLeg {
  return {
    asset_mode: 1n,
    asset_id: 37n,
    backing_pool_id: 500n,
    recipient,
    amount_or_token_id: amount,
    policy_key: policyKey,
  };
}
