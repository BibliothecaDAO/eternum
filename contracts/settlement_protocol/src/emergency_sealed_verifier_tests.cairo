use crate::emergency_sealed_verifier_spike::{
    EmergencySealedJournal, hash_claim_leaf, hash_claim_legs, hash_emergency_sealed_claim,
    hash_emergency_sealed_journal, verify_emergency_sealed_journal,
};
use crate::types::{ClaimLeaf, ClaimLeg, EmergencySealedClaim};

const EXPECTED_LEAF_HASH: felt252 = 0x556b800ade71aa2435161409a39f1c96c9e4ca6ea5da04457568db7a1303e9b;
const EXPECTED_LEGS_HASH: felt252 = 0x629899a61f730d376f3132c3d96052f782439f569ed5368b58ac3a4dbb50003;
const EXPECTED_CLAIM_HASH: felt252 = 0x1373c23a74a4ba9cefdc862253704bc800077476bfe663669eefdcb2029ae9f;
const EXPECTED_JOURNAL_HASH: felt252 = 0x37890799d1a1ec66e4425bfffa52747bcfb6fdb984b80d39420f451b01b343f;

#[test]
fn cairo_matches_the_rust_and_typescript_emergency_sealed_journal() {
    let legs = array![reference_leg()];
    let leaf = reference_leaf();
    let claim = reference_claim(1);
    let journal = reference_journal(EXPECTED_CLAIM_HASH);

    assert!(hash_claim_leaf(@leaf) == EXPECTED_LEAF_HASH);
    assert!(hash_claim_legs(legs.span()) == EXPECTED_LEGS_HASH);
    assert!(hash_emergency_sealed_claim(@claim) == EXPECTED_CLAIM_HASH);
    assert!(hash_emergency_sealed_journal(journal) == EXPECTED_JOURNAL_HASH);
    assert!(verify_emergency_sealed_journal(@claim, @leaf, legs.span(), legs.span(), journal, EXPECTED_JOURNAL_HASH));
}

#[test]
fn cairo_rejects_leaf_leg_disposition_and_receipt_substitution() {
    let legs = array![reference_leg()];
    let wrong_legs = array![ClaimLeg { amount_or_token_id: 751, ..reference_leg() }];
    let leaf = reference_leaf();
    let journal = reference_journal(EXPECTED_CLAIM_HASH);

    assert!(
        !verify_emergency_sealed_journal(
            @reference_claim(1),
            @ClaimLeaf { leaf_index: 8, ..reference_leaf() },
            legs.span(),
            legs.span(),
            journal,
            EXPECTED_JOURNAL_HASH,
        ),
    );
    assert!(
        !verify_emergency_sealed_journal(
            @reference_claim(1), @leaf, wrong_legs.span(), legs.span(), journal, EXPECTED_JOURNAL_HASH,
        ),
    );
    assert!(
        !verify_emergency_sealed_journal(
            @reference_claim(2), @leaf, legs.span(), legs.span(), journal, EXPECTED_JOURNAL_HASH,
        ),
    );
    assert!(
        !verify_emergency_sealed_journal(
            @reference_claim(1), @leaf, legs.span(), legs.span(), journal, EXPECTED_JOURNAL_HASH + 1,
        ),
    );
}

fn reference_leg() -> ClaimLeg {
    ClaimLeg {
        asset_mode: 1,
        asset_id: 37,
        backing_pool_id: 500,
        recipient: 88.try_into().unwrap(),
        amount_or_token_id: 750,
        policy_key: 601,
    }
}

fn reference_leaf() -> ClaimLeaf {
    ClaimLeaf {
        version: 1,
        deployment_id: 11,
        season_id: 13,
        game_id: 12,
        batch_id: 4,
        leaf_index: 7,
        claim_kind: 0x1020,
        liability_id: 9001,
        claimant_l2: 77.try_into().unwrap(),
        recipient_l1: 88.try_into().unwrap(),
        legs_hash: EXPECTED_LEGS_HASH,
        aux_hash: 777,
    }
}

fn reference_claim(disposition_kind: u16) -> EmergencySealedClaim {
    EmergencySealedClaim {
        deployment_id: 11,
        frozen_checkpoint_hash: 300,
        game_id: 12,
        batch_id: 4,
        leaf_index: 7,
        original_leaf_hash: EXPECTED_LEAF_HASH,
        liability_id: 9001,
        disposition_kind,
        enabling_outbox_fact_hash: 4001,
        original_legs_hash: EXPECTED_LEGS_HASH,
        settlement_legs_hash: EXPECTED_LEGS_HASH,
    }
}

fn reference_journal(claim_hash: felt252) -> EmergencySealedJournal {
    EmergencySealedJournal {
        program_hash: 3001,
        frozen_checkpoint_hash: 300,
        accepted_interval_hash: 3002,
        registered_root: 3003,
        claim_hash,
        original_leaf_hash: EXPECTED_LEAF_HASH,
        original_legs_hash: EXPECTED_LEGS_HASH,
        settlement_legs_hash: EXPECTED_LEGS_HASH,
        parent_dispositions_hash: 3004,
        exact_reservations_hash: 3005,
    }
}
