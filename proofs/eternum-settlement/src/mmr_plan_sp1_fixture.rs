//! Fixed Wave 0 inputs for proving that the A13 core executes inside SP1.
//!
//! This is deliberately not the production witness codec. A13 remains blocked until that codec,
//! a reproducible ELF, a real receipt, and a Cairo proof verifier are frozen.

use starknet_crypto::Felt;

use crate::mmr_plan::{
    MedianSource, MmrFormulaPolicy, MmrPlanClaim, MmrPlanError, MmrPlanJournal, MmrPlanWitness,
    execute_mmr_update_plan, hash_formula_inputs, hash_ranking_entry, verify_mmr_plan_journal,
};
use crate::types::{
    MmrCurrentFormulaAux, MmrFormulaInput, MmrSnapshotEntry, RankingCommitment, RankingEntry, U256,
};

const FIXTURE_SEQUENCE: u64 = 8;
const MMR_SCALE: u128 = 1_000_000_000_000_000_000;
const PLAYER_MMRS: [u128; 6] = [1_200, 900, 1_300, 1_000, 1_100, 1_000];
const PLAYER_RANKS: [u16; 6] = [1, 1, 3, 4, 5, 6];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MmrPlanSp1FixtureError {
    InvalidPlan(MmrPlanError),
    SubstitutedPlanRoot,
}

pub fn execute_valid_mmr_plan_sp1_fixture() -> Result<[u8; 32], MmrPlanSp1FixtureError> {
    execute_mmr_update_plan(FIXTURE_SEQUENCE, &valid_witness())
        .map(|output| journal_hash(&output.journal))
        .map_err(MmrPlanSp1FixtureError::InvalidPlan)
}

pub fn assert_bad_snapshot_mmr_plan_fixture() -> Result<[u8; 32], MmrPlanSp1FixtureError> {
    let mut witness = valid_witness();
    witness.snapshots[3].starting_mmr_logical += 1;

    execute_mmr_update_plan(FIXTURE_SEQUENCE, &witness)
        .map(|output| journal_hash(&output.journal))
        .map_err(MmrPlanSp1FixtureError::InvalidPlan)
}

pub fn assert_substituted_plan_root_mmr_plan_fixture() -> Result<[u8; 32], MmrPlanSp1FixtureError> {
    let journal = execute_mmr_update_plan(FIXTURE_SEQUENCE, &valid_witness())
        .map(|output| output.journal)
        .map_err(MmrPlanSp1FixtureError::InvalidPlan)?;
    let substituted_claim = MmrPlanClaim {
        sequence: journal.sequence,
        ranking: journal.ranking.clone(),
        snapshot_commitment: journal.snapshot_commitment,
        plan_root: journal.plan_root + Felt::ONE,
        median: journal.median,
        module_aux_hash: journal.module_aux_hash,
    };
    if verify_mmr_plan_journal(&substituted_claim, &journal) {
        return Ok(journal_hash(&journal));
    }

    Err(MmrPlanSp1FixtureError::SubstitutedPlanRoot)
}

fn journal_hash(journal: &MmrPlanJournal) -> [u8; 32] {
    crate::mmr_plan::hash_mmr_plan_journal(journal).to_bytes_be()
}

fn valid_witness() -> MmrPlanWitness {
    let ranking_entries = build_ranking_entries();
    let ranking_hashes = ranking_entries
        .iter()
        .map(hash_ranking_entry)
        .collect::<Vec<_>>();
    let formula_inputs = build_formula_inputs(&ranking_hashes);
    let snapshots = build_snapshots(&ranking_hashes);
    let ranking = build_ranking_commitment(&ranking_entries, &ranking_hashes);
    let policy = MmrFormulaPolicy::default_blitz();
    let aux = build_formula_aux(&formula_inputs, &policy);

    MmrPlanWitness {
        ranking,
        ranking_entries,
        formula_inputs,
        snapshots,
        aux,
        policy,
    }
}

fn build_ranking_entries() -> Vec<RankingEntry> {
    PLAYER_RANKS
        .into_iter()
        .enumerate()
        .map(|(index, rank)| RankingEntry {
            game_id: Felt::from(11_u8),
            player_l2: Felt::from((index + 1) as u64),
            recipient_l1: Felt::from((index + 11) as u64),
            participation_id: Felt::from((index + 21) as u64),
            rank,
            score: U256 {
                low: (PLAYER_RANKS.len() - index) as u128,
                high: 0,
            },
            result_hash: Felt::from(31_u8),
        })
        .collect()
}

fn build_formula_inputs(ranking_hashes: &[Felt]) -> Vec<MmrFormulaInput> {
    ranking_hashes
        .iter()
        .enumerate()
        .map(|(index, ranking_entry_hash)| MmrFormulaInput {
            ordinal_index: (index + 1) as u16,
            ranking_entry_hash: *ranking_entry_hash,
            formula_rank: PLAYER_RANKS[index],
        })
        .collect()
}

fn build_snapshots(ranking_hashes: &[Felt]) -> Vec<MmrSnapshotEntry> {
    PLAYER_MMRS
        .into_iter()
        .enumerate()
        .map(|(index, logical)| MmrSnapshotEntry {
            ranking_entry_hash: ranking_hashes[index],
            mmr_identity: Felt::from((index + 11) as u64),
            starting_mmr_scaled: U256 {
                low: logical * MMR_SCALE,
                high: 0,
            },
            starting_mmr_logical: logical,
        })
        .collect()
}

fn build_ranking_commitment(
    ranking_entries: &[RankingEntry],
    ranking_hashes: &[Felt],
) -> RankingCommitment {
    let ranking_root = crate::tree::FixedDepthTree::new(
        32,
        domain("RANKING_EMPTY_LEAF_V1"),
        domain("RANKING_NODE_V1"),
    )
    .expect("valid ranking tree")
    .root(ranking_hashes)
    .expect("bounded ranking fixture");
    RankingCommitment {
        game_id: Felt::from(11_u8),
        root: ranking_root,
        participant_count: ranking_entries.len() as u16,
        result_hash: Felt::from(31_u8),
        first_rank: PLAYER_RANKS[0],
        last_rank: PLAYER_RANKS[PLAYER_RANKS.len() - 1],
        tie_break_policy_hash: Felt::from(41_u8),
    }
}

fn build_formula_aux(
    formula_inputs: &[MmrFormulaInput],
    policy: &MmrFormulaPolicy,
) -> MmrCurrentFormulaAux {
    MmrCurrentFormulaAux {
        median_source: MedianSource::LockedSnapshot as u8,
        game_median: 0,
        participant_count: PLAYER_RANKS.len() as u16,
        formula_inputs_root: hash_formula_inputs(MedianSource::LockedSnapshot, formula_inputs),
        formula_policy_hash: policy.hash(),
    }
}

fn domain(name: &str) -> Felt {
    let selector =
        crate::schema_vector::hash_domain_selector(name).expect("registered fixture domain");
    Felt::from_hex(selector).expect("valid fixture domain")
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPECTED_JOURNAL_HASH: [u8; 32] = [
        1, 245, 17, 231, 105, 197, 12, 242, 79, 170, 181, 156, 114, 53, 247, 14, 150, 142, 157, 68,
        136, 166, 145, 186, 192, 43, 158, 190, 119, 202, 206, 252,
    ];

    #[test]
    fn valid_fixture_returns_only_the_normative_journal_hash() {
        assert_eq!(
            execute_valid_mmr_plan_sp1_fixture(),
            Ok(EXPECTED_JOURNAL_HASH)
        );
    }

    #[test]
    fn bad_snapshot_is_an_exact_native_negative() {
        assert_eq!(
            assert_bad_snapshot_mmr_plan_fixture(),
            Err(MmrPlanSp1FixtureError::InvalidPlan(MmrPlanError::Snapshot))
        );
    }

    #[test]
    fn substituted_plan_root_is_an_exact_native_negative() {
        assert_eq!(
            assert_substituted_plan_root_mmr_plan_fixture(),
            Err(MmrPlanSp1FixtureError::SubstitutedPlanRoot)
        );
    }
}
