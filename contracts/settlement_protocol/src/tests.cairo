use crate::economic_state_spike::{
    CallerClass, EconomicSpikeError, EconomicStateSpikeTrait, backing_is_conserved, new_economic_spike_state,
};
use crate::registry::{get_action_schema, get_claim_kind, validate_emitter_count};
use crate::reservation_spike::{
    ReservationError, ReservationRoute, ScarceReservationTrait, global_nullifier, new_scarce_reservation,
};
use crate::schema_vector::{SCHEMA_REGISTRY_HASH, action_vectors, claim_kind_vectors, compute_schema_registry_hash};
use crate::types::{ClaimLeg, SettlementRootMessage};

#[test]
fn representative_economic_paths_share_the_capability_boundary() {
    let state = new_economic_spike_state(100)
        .transfer_resource(CallerClass::ResourceSystem)
        .unwrap()
        .create_arrival(CallerClass::ArrivalSystem)
        .unwrap()
        .swap_bank_reserves(CallerClass::BankSystem)
        .unwrap()
        .resolve_combat_loss(CallerClass::CombatSystem, 10)
        .unwrap()
        .promote_sealed_batch(CallerClass::SeasonSettlementHub, 25)
        .unwrap();

    assert!(state.mutation_count == 5);
    assert!(state.resource_version == 1);
    assert!(state.arrival_high_watermark == 1);
    assert!(state.bank_version == 1);
    assert!(state.military_version == 1);
    assert!(state.sealed_batch_count == 1);
    assert!(backing_is_conserved(state));
}

#[test]
fn caller_classes_cannot_cross_capability_families() {
    let state = new_economic_spike_state(100);

    assert!(state.transfer_resource(CallerClass::CombatSystem) == Err(EconomicSpikeError::UnauthorizedCaller));
    assert!(state.create_arrival(CallerClass::BankSystem) == Err(EconomicSpikeError::UnauthorizedCaller));
    assert!(
        state
            .promote_sealed_batch(CallerClass::GameForcedExitAdapter, 1) == Err(EconomicSpikeError::UnauthorizedCaller),
    );
    assert!(state.mutation_count == 0);
    assert!(backing_is_conserved(state));
}

#[test]
fn rejected_backing_mutations_leave_the_retry_state_unchanged() {
    let state = new_economic_spike_state(10);

    assert!(
        state.resolve_combat_loss(CallerClass::CombatSystem, 11) == Err(EconomicSpikeError::InsufficientActiveBacking),
    );
    assert!(
        state
            .promote_sealed_batch(
                CallerClass::SeasonSettlementHub, 11,
            ) == Err(EconomicSpikeError::InsufficientActiveBacking),
    );
    assert!(state.active_backing == 10);
    assert!(state.cumulative_outbox == 0);
    assert!(state.released_backing == 0);
    assert!(state.mutation_count == 0);
}

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

#[test]
fn fixed_depth_roots_match_all_reference_vectors() {
    let roots = crate::tree_vectors::expected_roots();
    let mut index = 0;
    for (_, depth, empty_leaf_domain, node_domain, leaves) in crate::tree_vectors::tree_vectors() {
        let root = crate::tree::fixed_depth_root(leaves.span(), depth, empty_leaf_domain, node_domain).unwrap();
        assert!(root == *roots.at(index));
        index += 1;
    }
    for (_, depth, node_domain, leaf_index, leaf_hash, root, siblings) in crate::tree_vectors::proof_vectors() {
        assert!(
            crate::tree::verify_fixed_depth_proof(leaf_hash, leaf_index, siblings.span(), root, depth, node_domain)
                .unwrap(),
        );
    }
}

#[test]
fn fixed_depth_tree_rejects_overflow_and_malformed_proofs() {
    use crate::tree::TreeError;

    assert!(
        crate::tree::fixed_depth_root(array![].span(), 0, 'EMPTY_LEAF_V1', 'NODE_V1') == Err(TreeError::InvalidDepth),
    );
    let mut leaves: Array<felt252> = array![];
    for index in 0_usize..65_usize {
        leaves.append(index.into());
    }
    assert!(
        crate::tree::fixed_depth_root(leaves.span(), 6, 'EMPTY_LEAF_V1', 'NODE_V1') == Err(TreeError::CapacityExceeded),
    );

    let mut proofs = crate::tree_vectors::proof_vectors();
    let (_, depth, node_domain, leaf_index, leaf_hash, root, siblings) = proofs.pop_front().unwrap();
    assert!(
        crate::tree::verify_fixed_depth_proof(
            leaf_hash, leaf_index, array![].span(), root, depth, node_domain,
        ) == Err(TreeError::WrongProofLength),
    );
    assert!(
        crate::tree::verify_fixed_depth_proof(
            leaf_hash, 64, siblings.span(), root, depth, node_domain,
        ) == Err(TreeError::IndexOutsideCapacity),
    );
    let mut wrong_siblings = array![*siblings.at(0) + 1];
    for index in 1..siblings.len() {
        wrong_siblings.append(*siblings.at(index));
    }
    assert!(
        !crate::tree::verify_fixed_depth_proof(leaf_hash, leaf_index, wrong_siblings.span(), root, depth, node_domain)
            .unwrap(),
    );
}

#[test]
fn one_scarce_custody_unit_cannot_pay_normal_and_emergency_routes() {
    let nullifier = global_nullifier(11, 22);

    let normal = new_scarce_reservation(1, 11, 22)
        .reserve(1, ReservationRoute::Root)
        .unwrap()
        .settle(nullifier, 1, ReservationRoute::Root)
        .unwrap();
    assert!(normal.settle(nullifier, 1, ReservationRoute::FrozenExit) == Err(ReservationError::NullifierConsumed));

    let emergency = new_scarce_reservation(1, 11, 22)
        .reserve(1, ReservationRoute::Root)
        .unwrap()
        .retag(ReservationRoute::Root, ReservationRoute::FrozenExit)
        .unwrap()
        .settle(nullifier, 1, ReservationRoute::FrozenExit)
        .unwrap();
    assert!(emergency.settle(nullifier, 1, ReservationRoute::Root) == Err(ReservationError::NullifierConsumed));
    assert!(emergency.paid_units == 1);
    assert!(emergency.reserved_units == 0);
}

#[test]
fn global_nullifier_matches_the_frozen_cross_language_vector() {
    assert!(
        crate::reservation_spike::global_nullifier(
            11, 22,
        ) == 0x3d214dcc435c784d5582c850984ac2d6b7660b19e587598834749d1b6db8f74,
    );
}

#[test]
fn scarce_reservation_retag_moves_capacity_without_duplicating_it() {
    let root = new_scarce_reservation(7, 11, 22).reserve(5, ReservationRoute::Root).unwrap();
    assert!(root.reserve(1, ReservationRoute::FrozenExit) == Err(ReservationError::ReservationExists));

    let frozen = root.retag(ReservationRoute::Root, ReservationRoute::FrozenExit).unwrap();
    assert!(frozen.custody_units == 7);
    assert!(frozen.reserved_units == 5);
    assert!(frozen.paid_units == 0);
    assert!(frozen.route == Option::Some(ReservationRoute::FrozenExit));
    assert!(frozen.retag(ReservationRoute::Root, ReservationRoute::FrozenExit) == Err(ReservationError::RouteMismatch));
}

#[test]
fn rejected_scarce_settlement_preserves_the_atomic_retry_state() {
    let reserved = new_scarce_reservation(5, 1, 2).reserve(5, ReservationRoute::Root).unwrap();
    assert!(reserved.settle(0, 5, ReservationRoute::Root) == Err(ReservationError::InvalidNullifier));
    assert!(reserved.settle(99, 5, ReservationRoute::Root) == Err(ReservationError::InvalidNullifier));
    assert!(
        reserved.settle(global_nullifier(1, 2), 4, ReservationRoute::Root) == Err(ReservationError::AmountMismatch),
    );
    assert!(
        reserved
            .settle(global_nullifier(1, 2), 5, ReservationRoute::FrozenExit) == Err(ReservationError::RouteMismatch),
    );

    let settled = reserved.settle(global_nullifier(1, 2), 5, ReservationRoute::Root).unwrap();
    assert!(settled.paid_units == 5);
    assert!(settled.reserved_units == 0);
}

#[test]
fn scarce_reservation_rejects_zero_and_unbacked_capacity() {
    assert!(new_scarce_reservation(1, 1, 2).reserve(0, ReservationRoute::Root) == Err(ReservationError::ZeroAmount));
    assert!(
        new_scarce_reservation(1, 1, 2)
            .reserve(2, ReservationRoute::Root) == Err(ReservationError::InsufficientCustody),
    );
    assert!(
        new_scarce_reservation(1, 1, 2)
            .retag(ReservationRoute::Root, ReservationRoute::FrozenExit) == Err(ReservationError::ReservationMissing),
    );
}
