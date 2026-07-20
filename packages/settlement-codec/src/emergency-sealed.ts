import { hash } from "starknet";
import { encodeSchema, type SchemaValue } from "./codec";
import { hashClaimLegs } from "./frozen-position";
import type { ClaimLeaf, ClaimLeg, EmergencySealedClaim } from "./generated-types";

export interface EmergencySealedJournal {
  readonly programHash: bigint;
  readonly frozenCheckpointHash: bigint;
  readonly acceptedIntervalHash: bigint;
  readonly registeredRoot: bigint;
  readonly claimHash: bigint;
  readonly originalLeafHash: bigint;
  readonly originalLegsHash: bigint;
  readonly settlementLegsHash: bigint;
  readonly parentDispositionsHash: bigint;
  readonly exactReservationsHash: bigint;
}

export function hashClaimLeaf(leaf: ClaimLeaf): bigint {
  return poseidon([domain("CLAIM_LEAF_V1"), ...encodeSchema("ClaimLeaf", leaf as unknown as SchemaValue)]);
}

export function hashEmergencySealedClaim(claim: EmergencySealedClaim): bigint {
  return poseidon([
    domain("EMERGENCY_SEALED_CLAIM_V1"),
    ...encodeSchema("EmergencySealedClaim", claim as unknown as SchemaValue),
  ]);
}

export function hashEmergencySealedJournal(journal: EmergencySealedJournal): bigint {
  return poseidon([
    domain("EMERGENCY_SEALED_JOURNAL_V1"),
    journal.programHash,
    journal.frozenCheckpointHash,
    journal.acceptedIntervalHash,
    journal.registeredRoot,
    journal.claimHash,
    journal.originalLeafHash,
    journal.originalLegsHash,
    journal.settlementLegsHash,
    journal.parentDispositionsHash,
    journal.exactReservationsHash,
  ]);
}

export function verifyEmergencySealedJournal(
  claim: EmergencySealedClaim,
  originalLeaf: ClaimLeaf,
  originalLegs: readonly ClaimLeg[],
  settlementLegs: readonly ClaimLeg[],
  journal: EmergencySealedJournal,
  verifiedJournalHash: bigint,
): boolean {
  if (originalLegs.length === 0 || originalLegs.length > 8 || settlementLegs.length > 8) return false;
  const originalLeafHash = hashClaimLeaf(originalLeaf);
  const originalLegsHash = hashClaimLegs(originalLegs);
  const settlementLegsHash = hashClaimLegs(settlementLegs);
  return (
    journal.claimHash === hashEmergencySealedClaim(claim) &&
    journal.originalLeafHash === originalLeafHash &&
    journal.originalLegsHash === originalLegsHash &&
    journal.settlementLegsHash === settlementLegsHash &&
    claim.original_leaf_hash === originalLeafHash &&
    claim.original_legs_hash === originalLegsHash &&
    claim.settlement_legs_hash === settlementLegsHash &&
    originalLeaf.liability_id === claim.liability_id &&
    hashEmergencySealedJournal(journal) === verifiedJournalHash
  );
}

function domain(name: string): bigint {
  return BigInt(hash.getSelectorFromName(name));
}

function poseidon(values: readonly bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(values.map(String)));
}
