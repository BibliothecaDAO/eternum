use core::poseidon::poseidon_hash_span;
use crate::types::{ClaimLeaf, ClaimLeg, EmergencySealedClaim};

const CLAIM_LEAF_V1: felt252 = 0x3df9991be65b2b9b174fb1d6d93a912906726d47489ae2d75ff3422a94d821a;
const CLAIM_LEGS_V1: felt252 = 0x1f083c151414edaaf1d13f783fc191e97013cf56bfea29783a0f94b7f7ead75;
const EMERGENCY_SEALED_CLAIM_V1: felt252 = 0xd6f3acfe47a39a80372e6ae00ba81f8909ad04b80b8bfaca1e7e9201659193;
const EMERGENCY_SEALED_JOURNAL_V1: felt252 = 0x36d3b42ca705c164d5031c81953bd0ebc7486635bc5f2c00692e23564ea8a2b;

#[derive(Copy, Drop, Debug, PartialEq, Serde)]
pub struct EmergencySealedJournal {
    pub program_hash: felt252,
    pub frozen_checkpoint_hash: felt252,
    pub accepted_interval_hash: felt252,
    pub registered_root: felt252,
    pub claim_hash: felt252,
    pub original_leaf_hash: felt252,
    pub original_legs_hash: felt252,
    pub settlement_legs_hash: felt252,
    pub parent_dispositions_hash: felt252,
    pub exact_reservations_hash: felt252,
}

pub fn verify_emergency_sealed_journal(
    claim: @EmergencySealedClaim,
    original_leaf: @ClaimLeaf,
    original_legs: Span<ClaimLeg>,
    settlement_legs: Span<ClaimLeg>,
    journal: EmergencySealedJournal,
    verified_journal_hash: felt252,
) -> bool {
    if original_legs.is_empty() || original_legs.len() > 8 || settlement_legs.len() > 8 {
        return false;
    }
    let original_leaf_hash = hash_claim_leaf(original_leaf);
    let original_legs_hash = hash_claim_legs(original_legs);
    let settlement_legs_hash = hash_claim_legs(settlement_legs);
    journal.claim_hash == hash_emergency_sealed_claim(claim)
        && journal.original_leaf_hash == original_leaf_hash
        && journal.original_legs_hash == original_legs_hash
        && journal.settlement_legs_hash == settlement_legs_hash
        && *claim.original_leaf_hash == original_leaf_hash
        && *claim.original_legs_hash == original_legs_hash
        && *claim.settlement_legs_hash == settlement_legs_hash
        && *original_leaf.liability_id == *claim.liability_id
        && hash_emergency_sealed_journal(journal) == verified_journal_hash
}

pub fn hash_claim_leaf(leaf: @ClaimLeaf) -> felt252 {
    let mut preimage = array![CLAIM_LEAF_V1];
    leaf.serialize(ref preimage);
    poseidon_hash_span(preimage.span())
}

pub fn hash_claim_legs(legs: Span<ClaimLeg>) -> felt252 {
    let mut preimage = array![CLAIM_LEGS_V1, legs.len().into()];
    for leg in legs {
        leg.serialize(ref preimage);
    }
    poseidon_hash_span(preimage.span())
}

pub fn hash_emergency_sealed_claim(claim: @EmergencySealedClaim) -> felt252 {
    let mut preimage = array![EMERGENCY_SEALED_CLAIM_V1];
    claim.serialize(ref preimage);
    poseidon_hash_span(preimage.span())
}

pub fn hash_emergency_sealed_journal(journal: EmergencySealedJournal) -> felt252 {
    poseidon_hash_span(
        array![
            EMERGENCY_SEALED_JOURNAL_V1, journal.program_hash, journal.frozen_checkpoint_hash,
            journal.accepted_interval_hash, journal.registered_root, journal.claim_hash, journal.original_leaf_hash,
            journal.original_legs_hash, journal.settlement_legs_hash, journal.parent_dispositions_hash,
            journal.exact_reservations_hash,
        ]
            .span(),
    )
}
