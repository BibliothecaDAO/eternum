use core::poseidon::poseidon_hash_span;
use crate::types::RankingCommitment;

const MMR_PLAN_JOURNAL_V1: felt252 = 0x22dedcea7e70cde4581d621978097cde734a67da0c17348e3c62d62e7b8755;

#[derive(Drop, Serde)]
pub struct MmrPlanJournal {
    pub sequence: u64,
    pub ranking: RankingCommitment,
    pub snapshot_commitment: felt252,
    pub plan_root: felt252,
    pub median: u128,
    pub module_aux_hash: felt252,
}

pub fn verify_mmr_plan_journal(journal: @MmrPlanJournal, verified_journal_hash: felt252) -> bool {
    hash_mmr_plan_journal(journal) == verified_journal_hash
}

pub fn hash_mmr_plan_journal(journal: @MmrPlanJournal) -> felt252 {
    let mut preimage = array![MMR_PLAN_JOURNAL_V1, (*journal.sequence).into()];
    journal.ranking.serialize(ref preimage);
    preimage.append(*journal.snapshot_commitment);
    preimage.append(*journal.plan_root);
    preimage.append((*journal.median).into());
    preimage.append(*journal.module_aux_hash);
    poseidon_hash_span(preimage.span())
}
