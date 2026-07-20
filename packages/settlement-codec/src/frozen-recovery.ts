import { hash } from "starknet";

export interface FrozenRecoveryJournal {
  readonly programHash: bigint;
  readonly stateRoot: bigint;
  readonly summaryHash: bigint;
  readonly sourcesHash: bigint;
  readonly dispositionsHash: bigint;
  readonly gameReturnsHash: bigint;
  readonly routesHash: bigint;
}

export interface DeploymentRefundMaterializationJournal {
  readonly programHash: bigint;
  readonly terminalRefundSourceHash: bigint;
  readonly recoveryJournalHash: bigint;
  readonly verifiedOutputHash: bigint;
  readonly chunkRoot: bigint;
  readonly livePreimagesHash: bigint;
  readonly liveTotalsHash: bigint;
}

export interface PositionMaterializationJournal {
  readonly programHash: bigint;
  readonly verifiedOutputHash: bigint;
  readonly chunkRoot: bigint;
  readonly livePreimagesHash: bigint;
  readonly liveTotalsHash: bigint;
}

export function hashFrozenRecoveryJournal(journal: FrozenRecoveryJournal): bigint {
  return poseidon([
    domain("FROZEN_RECOVERY_JOURNAL_V1"),
    journal.programHash,
    journal.stateRoot,
    journal.summaryHash,
    journal.sourcesHash,
    journal.dispositionsHash,
    journal.gameReturnsHash,
    journal.routesHash,
  ]);
}

export function hashDeploymentRefundMaterializationJournal(journal: DeploymentRefundMaterializationJournal): bigint {
  return poseidon([
    domain("DEPLOYMENT_REFUND_MATERIALIZATION_JOURNAL_V1"),
    journal.programHash,
    journal.terminalRefundSourceHash,
    journal.recoveryJournalHash,
    journal.verifiedOutputHash,
    journal.chunkRoot,
    journal.livePreimagesHash,
    journal.liveTotalsHash,
  ]);
}

export function hashPositionMaterializationJournal(journal: PositionMaterializationJournal): bigint {
  return poseidon([
    domain("POSITION_MATERIALIZATION_JOURNAL_V1"),
    journal.programHash,
    journal.verifiedOutputHash,
    journal.chunkRoot,
    journal.livePreimagesHash,
    journal.liveTotalsHash,
  ]);
}

export function verifyFrozenRecoveryJournal(journal: FrozenRecoveryJournal, verifiedJournalHash: bigint): boolean {
  return hashFrozenRecoveryJournal(journal) === verifiedJournalHash;
}

export function verifyDeploymentRefundMaterializationJournal(
  journal: DeploymentRefundMaterializationJournal,
  verifiedJournalHash: bigint,
): boolean {
  return hashDeploymentRefundMaterializationJournal(journal) === verifiedJournalHash;
}

export function verifyPositionMaterializationJournal(
  journal: PositionMaterializationJournal,
  verifiedJournalHash: bigint,
): boolean {
  return hashPositionMaterializationJournal(journal) === verifiedJournalHash;
}

function domain(name: string): bigint {
  return BigInt(hash.getSelectorFromName(name));
}

function poseidon(values: readonly bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(values.map(String)));
}
