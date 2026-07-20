import { hash } from "starknet";
import { encodeSchema, type SchemaValue } from "./codec";
import type { ClaimLeg, ExitClaim } from "./generated-types";

export interface FrozenPositionJournal {
  readonly programHash: bigint;
  readonly stateRoot: bigint;
  readonly finalOutboxCursor: bigint;
  readonly claimHash: bigint;
  readonly payoutLegsHash: bigint;
}

export function hashClaimLegs(legs: readonly ClaimLeg[]): bigint {
  return poseidon([
    domain("CLAIM_LEGS_V1"),
    BigInt(legs.length),
    ...legs.flatMap((leg) => encodeSchema("ClaimLeg", leg as unknown as SchemaValue)),
  ]);
}

export function hashExitClaim(claim: ExitClaim): bigint {
  return poseidon([domain("EXIT_CLAIM_V1"), ...encodeSchema("ExitClaim", claim as unknown as SchemaValue)]);
}

export function hashFrozenPositionJournal(journal: FrozenPositionJournal): bigint {
  return poseidon([
    domain("FROZEN_POSITION_JOURNAL_V1"),
    journal.programHash,
    journal.stateRoot,
    journal.finalOutboxCursor,
    journal.claimHash,
    journal.payoutLegsHash,
  ]);
}

export function verifyFrozenPositionJournal(
  claim: ExitClaim,
  legs: readonly ClaimLeg[],
  journal: FrozenPositionJournal,
  verifiedJournalHash: bigint,
): boolean {
  if (legs.length === 0 || legs.length > 8) return false;
  const legsHash = hashClaimLegs(legs);
  return (
    claim.payout_legs_hash === legsHash &&
    journal.claimHash === hashExitClaim(claim) &&
    journal.payoutLegsHash === legsHash &&
    hashFrozenPositionJournal(journal) === verifiedJournalHash
  );
}

function domain(name: string): bigint {
  return BigInt(hash.getSelectorFromName(name));
}

function poseidon(values: readonly bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(values.map(String)));
}
