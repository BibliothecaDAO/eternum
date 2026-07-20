use core::poseidon::poseidon_hash_span;
use crate::types::{ClaimLeg, ExitClaim};

// Selectors are generated from the same names committed by schema-registry-v1.json.
const CLAIM_LEGS_V1: felt252 = 0x1f083c151414edaaf1d13f783fc191e97013cf56bfea29783a0f94b7f7ead75;
const EXIT_CLAIM_V1: felt252 = 0x1dc7d1ab6b8af8885525c4211c9aa06728b32faac3d9d04123fb47cf5c73a2f;
const FROZEN_POSITION_JOURNAL_V1: felt252 = 0x34a94da74654bb2426b2b30ba44c902d5c704df7fe3d288fcee3eb351bd660e;

#[derive(Copy, Drop, Debug, PartialEq, Serde)]
pub struct FrozenPositionJournal {
    pub program_hash: felt252,
    pub state_root: felt252,
    pub final_outbox_cursor: u64,
    pub claim_hash: felt252,
    pub payout_legs_hash: felt252,
}

pub fn verify_frozen_position_journal(
    claim: @ExitClaim, legs: Span<ClaimLeg>, journal: FrozenPositionJournal, verified_journal_hash: felt252,
) -> bool {
    if legs.is_empty() || legs.len() > 8 {
        return false;
    }
    let legs_hash = hash_claim_legs(legs);
    *claim.payout_legs_hash == legs_hash
        && journal.claim_hash == hash_exit_claim(claim)
        && journal.payout_legs_hash == legs_hash
        && hash_journal(journal) == verified_journal_hash
}

pub fn hash_claim_legs(legs: Span<ClaimLeg>) -> felt252 {
    let mut preimage = array![CLAIM_LEGS_V1, legs.len().into()];
    for leg in legs {
        leg.serialize(ref preimage);
    }
    poseidon_hash_span(preimage.span())
}

pub fn hash_exit_claim(claim: @ExitClaim) -> felt252 {
    let mut preimage = array![EXIT_CLAIM_V1];
    claim.serialize(ref preimage);
    poseidon_hash_span(preimage.span())
}

pub fn hash_journal(journal: FrozenPositionJournal) -> felt252 {
    poseidon_hash_span(
        array![
            FROZEN_POSITION_JOURNAL_V1, journal.program_hash, journal.state_root, journal.final_outbox_cursor.into(),
            journal.claim_hash, journal.payout_legs_hash,
        ]
            .span(),
    )
}
