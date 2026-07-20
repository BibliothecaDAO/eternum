use crate::mmr_plan_verifier_spike::{MmrPlanJournal, hash_mmr_plan_journal, verify_mmr_plan_journal};
use crate::types::RankingCommitment;

const EXPECTED_JOURNAL_HASH: felt252 = 0x2e8193d2764077811fe44d826af2d7a6c0c8afdc31ced2d5f106530fb639f6a;

#[test]
fn cairo_matches_the_rust_and_typescript_mmr_plan_journal() {
    let journal = reference_journal(23, 1000, 13);

    assert!(hash_mmr_plan_journal(@journal) == EXPECTED_JOURNAL_HASH);
    assert!(verify_mmr_plan_journal(@journal, EXPECTED_JOURNAL_HASH));
}

#[test]
fn cairo_rejects_plan_median_ranking_and_receipt_substitution() {
    assert!(!verify_mmr_plan_journal(@reference_journal(25, 1000, 13), EXPECTED_JOURNAL_HASH));
    assert!(!verify_mmr_plan_journal(@reference_journal(23, 1001, 13), EXPECTED_JOURNAL_HASH));
    assert!(!verify_mmr_plan_journal(@reference_journal(23, 1000, 14), EXPECTED_JOURNAL_HASH));
    assert!(!verify_mmr_plan_journal(@reference_journal(23, 1000, 13), EXPECTED_JOURNAL_HASH + 1));
}

fn reference_journal(plan_root: felt252, median: u128, ranking_root: felt252) -> MmrPlanJournal {
    MmrPlanJournal {
        sequence: 7,
        ranking: RankingCommitment {
            game_id: 11,
            root: ranking_root,
            participant_count: 6,
            result_hash: 31,
            first_rank: 1,
            last_rank: 6,
            tie_break_policy_hash: 41,
        },
        snapshot_commitment: 21,
        plan_root,
        median,
        module_aux_hash: 29,
    }
}
