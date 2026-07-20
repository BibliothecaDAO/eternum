import { describe, expect, it } from "vitest";
import { hashMmrPlanJournal, verifyMmrPlanJournal } from "./mmr-plan";

describe("MMR-plan public journal", () => {
  it("binds sequence, complete ranking, snapshot, plan, median, and module auxiliary data", () => {
    const journal = referenceJournal();
    const journalHash = hashMmrPlanJournal(journal);

    expect(verifyMmrPlanJournal(journal, journalHash)).toBe(true);
    expect(verifyMmrPlanJournal({ ...journal, planRoot: 25n }, journalHash)).toBe(false);
    expect(verifyMmrPlanJournal({ ...journal, median: 1_001n }, journalHash)).toBe(false);
    expect(verifyMmrPlanJournal({ ...journal, ranking: { ...journal.ranking, root: 14n } }, journalHash)).toBe(false);
  });
});

function referenceJournal() {
  return {
    sequence: 7n,
    ranking: {
      game_id: 11n,
      root: 13n,
      participant_count: 6n,
      result_hash: 31n,
      first_rank: 1n,
      last_rank: 6n,
      tie_break_policy_hash: 41n,
    },
    snapshotCommitment: 21n,
    planRoot: 23n,
    median: 1_000n,
    moduleAuxHash: 29n,
  };
}
