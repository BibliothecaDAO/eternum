use crate::registry::{get_action_schema, get_claim_kind, validate_emitter_count};
use crate::schema_vector::{SCHEMA_REGISTRY_HASH, action_vectors, claim_kind_vectors, compute_schema_registry_hash};
use crate::types::{ClaimLeg, SettlementRootMessage};

#[test]
fn resolves_registered_action_and_dense_claim_kind() {
    let action = get_action_schema(1, 0x0110).unwrap();
    assert!(action.code == 0x0110);
    assert!(action.body_schema == 'ResourceDepositMessage');

    let claim_kind = get_claim_kind(0x1030).unwrap();
    assert!(claim_kind.index == 9);
}

#[test]
fn every_action_and_claim_kind_matches_the_frozen_registry() {
    for (code, name, body, direction, scope) in action_vectors() {
        let action = get_action_schema(1, code).unwrap();
        assert!(action.name == name);
        assert!(action.body_schema == body);
        assert!(action.direction == direction);
        assert!(action.game_id_scope == scope);
    }
    for (code, index, name, auxiliary_body) in claim_kind_vectors() {
        let claim_kind = get_claim_kind(code).unwrap();
        assert!(claim_kind.index == index);
        assert!(claim_kind.name == name);
        assert!(claim_kind.auxiliary_body_schema == auxiliary_body);
    }
}

#[test]
fn emitter_count_accepts_one_and_eight() {
    assert!(validate_emitter_count(1).unwrap() == 1);
    assert!(validate_emitter_count(8).unwrap() == 8);
}

#[test]
fn emitter_count_rejects_zero_and_nine() {
    assert!(validate_emitter_count(0).is_err());
    assert!(validate_emitter_count(9).is_err());
}

#[test]
fn recomputes_the_frozen_full_registry_hash() {
    assert!(compute_schema_registry_hash() == SCHEMA_REGISTRY_HASH);
}

#[test]
fn encodes_u256_as_explicit_low_and_high_limbs() {
    let leg = ClaimLeg {
        asset_mode: 1,
        asset_id: 37,
        backing_pool_id: 2,
        recipient: 3.try_into().unwrap(),
        amount_or_token_id: u256 { low: 5, high: 1 },
        policy_key: 4,
    };
    let mut encoded = array![];
    leg.serialize(ref encoded);

    assert!(encoded == array![1, 37, 2, 3, 5, 1, 4]);
}

#[test]
fn pins_the_full_settlement_root_count_before_hash_order() {
    let message = SettlementRootMessage {
        batch_id: 1,
        previous_batch_hash: 2,
        leaf_count: 3,
        root: 4,
        asset_totals_hash: 5,
        ingress_activation_count: 6,
        ingress_activations_hash: 7,
        nft_reservation_count: 8,
        nft_reservations_hash: 9,
        deployment_refund_count: 10,
        deployment_refunds_hash: 11,
        lot_share_promotion_count: 12,
        lot_share_promotions_hash: 13,
    };
    let mut encoded = array![];
    message.serialize(ref encoded);

    assert!(encoded == array![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
}

#[test]
fn every_declared_struct_and_empty_tree_matches_the_golden_vectors() {
    crate::golden_vectors::assert_all_golden_vectors();
}
