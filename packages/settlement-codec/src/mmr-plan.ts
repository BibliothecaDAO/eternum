import { hash } from "starknet";
import { encodeSchema, type SchemaValue } from "./codec";
import type { RankingCommitment } from "./generated-types";

export interface MmrPlanJournal {
  readonly sequence: bigint;
  readonly ranking: RankingCommitment;
  readonly snapshotCommitment: bigint;
  readonly planRoot: bigint;
  readonly median: bigint;
  readonly moduleAuxHash: bigint;
}

export function hashMmrPlanJournal(journal: MmrPlanJournal): bigint {
  return BigInt(
    hash.computePoseidonHashOnElements(
      [
        hash.getSelectorFromName("MMR_PLAN_JOURNAL_V1"),
        journal.sequence,
        ...encodeSchema("RankingCommitment", journal.ranking as unknown as SchemaValue),
        journal.snapshotCommitment,
        journal.planRoot,
        journal.median,
        journal.moduleAuxHash,
      ].map(String),
    ),
  );
}

export function verifyMmrPlanJournal(journal: MmrPlanJournal, verifiedJournalHash: bigint): boolean {
  return hashMmrPlanJournal(journal) === verifiedJournalHash;
}
