use settlement_protocol::appchain_spike_interfaces::{
    BatchCapacitySnapshot, IEconomicCallbackMetricsSpikeDispatcher, IEconomicCallbackMetricsSpikeDispatcherTrait,
    IPendingLiabilitySourceAdminSpikeDispatcher, IPendingLiabilitySourceAdminSpikeDispatcherTrait,
    IPendingLiabilitySourceAdminSpikeSafeDispatcher, IPendingLiabilitySourceAdminSpikeSafeDispatcherTrait,
    IPendingLiabilitySourceSpikeDispatcher, IPendingLiabilitySourceSpikeDispatcherTrait,
    ISeasonSettlementCapacitySpikeDispatcher, ISeasonSettlementCapacitySpikeDispatcherTrait,
    ISeasonSettlementCapacitySpikeSafeDispatcher, ISeasonSettlementCapacitySpikeSafeDispatcherTrait,
};
use settlement_protocol::interfaces::{
    ISeasonSettlementHubAggregateViewDispatcher, ISeasonSettlementHubAggregateViewDispatcherTrait,
};
use settlement_protocol::types::{BackingKey, BackingTotal, HubBatchSealState, LotSharePromotion};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use crate::season_hub_capacity::{backing_key_hash, felt_precedes};

const DEPLOYMENT_ID: felt252 = 9001;
const GAME_A: felt252 = 101;
const GAME_B: felt252 = 202;

#[derive(Copy, Drop)]
struct CapacityFixture {
    hub: ISeasonSettlementCapacitySpikeDispatcher,
    callback: IEconomicCallbackMetricsSpikeDispatcher,
}

#[test]
fn one_atomic_append_accepts_sixteen_parents_and_two_hundred_fifty_six_lot_shares() {
    let fixture = setup();
    let (parents, shares) = maximum_game_vectors(GAME_A);
    stage_source(fixture.hub, GAME_A, 7001, 8001, parents.span(), shares.span());

    let assignment = fixture.hub.append_pending_liability(7001, 0, 8001);

    assert!(assignment == (0, 0));
    assert!(fixture.hub.source_snapshot(7001).source_generation == 1);
    assert!(
        fixture
            .hub
            .batch_capacity(
                0,
            ) == BatchCapacitySnapshot {
                batch_id: 0,
                liability_count: 1,
                activation_count: 0,
                parent_count: 16,
                lot_share_count: 256,
                sealed: false,
            },
    );
    assert!(fixture.callback.assignment_count() == 1);
}

#[test]
#[feature("safe_dispatcher")]
fn two_hundred_fifty_seven_lot_shares_reject_before_source_mutation() {
    let fixture = setup();
    let (parents, mut shares) = maximum_game_vectors(GAME_A);
    shares.append(LotSharePromotion { game_id: GAME_A, parent_key_hash: 999999, lot_index: 0, amount: 1_u256 });

    let source_address = deploy(
        "PendingLiabilitySourceMock", array![fixture.hub.contract_address.into(), GAME_A, 7001],
    );
    let source = IPendingLiabilitySourceSpikeDispatcher { contract_address: source_address };
    let safe_source = IPendingLiabilitySourceAdminSpikeSafeDispatcher { contract_address: source_address };

    assert!(safe_source.create_pending_liability(8001, parents.span(), shares.span()).is_err());
    assert!(source.snapshot().source_generation == 0);
    assert!(source.snapshot().pending_liability_id == 0);
    assert!(source.snapshot().parent_count == 0);
    assert!(source.snapshot().lot_share_count == 0);
    assert!(fixture.hub.batch_capacity(0).liability_count == 0);
    assert!(fixture.callback.assignment_count() == 0);
}

#[test]
fn mixed_game_and_global_seal_promotes_sixteen_parents_and_two_hundred_fifty_six_rows() {
    let fixture = setup();
    let (first_game_parents, first_game_shares) = build_vectors(GAME_A, 0, 4);
    let (global_parents, global_shares) = half_vectors(0, 4);
    let (second_game_parents, second_game_shares) = build_vectors(GAME_A, 12, 4);

    stage_source(fixture.hub, GAME_A, 7001, 8001, first_game_parents.span(), first_game_shares.span());
    stage_source(fixture.hub, 0, 7002, 8002, global_parents.span(), global_shares.span());
    stage_source(fixture.hub, GAME_A, 7003, 8003, second_game_parents.span(), second_game_shares.span());
    fixture.hub.append_pending_liability(7001, 0, 8001);
    fixture.hub.append_pending_liability(7002, 0, 8002);
    fixture.hub.append_pending_liability(7003, 0, 8003);
    let summary = fixture.hub.seal_open_batch();

    assert!(summary.parent_count == 16);
    assert!(summary.lot_share_count == 256);
    assert!(summary.game_group_count == 1);
    assert!(summary.global_parent_count == 8);
    assert!(summary.global_lot_share_count == 128);
    assert!(summary.post_state_hash != 0);
    assert!(fixture.hub.batch_capacity(0).sealed);
    assert!(fixture.callback.promotion_count() == 0);
    assert!(fixture.hub.game_active_total(GAME_A) == 0_u256);
    assert!(fixture.hub.game_cumulative_total(GAME_A) == 128_u256);
    assert!(fixture.hub.is_game_batch_sealed(GAME_A, 0));
    assert!(fixture.hub.global_active_total() == 0_u256);
    assert!(fixture.hub.global_cumulative_total() == 128_u256);
}

#[test]
fn frozen_aggregate_view_exposes_the_central_batch_bit_and_hub_owned_totals() {
    let fixture = setup();
    let aggregate_view = ISeasonSettlementHubAggregateViewDispatcher { contract_address: fixture.hub.contract_address };
    let (parents, shares) = build_shape_vectors(GAME_A, 0, 1, 1);
    let parent_hash = backing_key_hash(parents.at(0).key);

    assert!(matches_batch_state(aggregate_view.get_batch_seal_state(0), 0));
    stage_source(fixture.hub, GAME_A, 7101, 8101, parents.span(), shares.span());
    fixture.hub.append_pending_liability(7101, 0, 8101);

    assert!(matches_batch_state(aggregate_view.get_batch_seal_state(0), 1));
    let open_parent = aggregate_view.get_backing_aggregate(GAME_A, parent_hash);
    let open_lot = aggregate_view.get_lot_aggregate(GAME_A, parent_hash, 0);
    assert!(open_parent.active_committed_total == 1_u256);
    assert!(open_parent.cumulative_outbox_total == 0_u256);
    assert!(open_lot.active_committed_total == 1_u256);
    assert!(open_lot.cumulative_outbox_total == 0_u256);
    assert!(aggregate_view.get_game_aggregate_totals(GAME_A) == (1_u256, 0_u256));

    fixture.hub.seal_open_batch();

    assert!(matches_batch_state(aggregate_view.get_batch_seal_state(0), 2));
    let sealed_parent = aggregate_view.get_backing_aggregate(GAME_A, parent_hash);
    let sealed_lot = aggregate_view.get_lot_aggregate(GAME_A, parent_hash, 0);
    assert!(sealed_parent.active_committed_total == 0_u256);
    assert!(sealed_parent.cumulative_outbox_total == 1_u256);
    assert!(sealed_lot.active_committed_total == 0_u256);
    assert!(sealed_lot.cumulative_outbox_total == 1_u256);
    assert!(aggregate_view.get_game_aggregate_totals(GAME_A) == (0_u256, 1_u256));
}

fn matches_batch_state(state: HubBatchSealState, expected: u8) -> bool {
    match state {
        HubBatchSealState::Unknown => expected == 0,
        HubBatchSealState::Open => expected == 1,
        HubBatchSealState::Sealed => expected == 2,
    }
}

#[test]
#[feature("safe_dispatcher")]
fn seal_performs_no_world_callback_after_assignment() {
    let fixture = setup();
    let (global_parents, global_shares) = half_vectors(0, 0);
    let (game_parents, game_shares) = half_vectors(GAME_A, 8);

    stage_source(fixture.hub, 0, 7001, 8001, global_parents.span(), global_shares.span());
    stage_source(fixture.hub, GAME_A, 7002, 8002, game_parents.span(), game_shares.span());
    fixture.hub.append_pending_liability(7001, 0, 8001);
    fixture.hub.append_pending_liability(7002, 0, 8002);
    assert!(fixture.hub.global_active_total() == 128_u256, "PRESEAL_GLOBAL_ACTIVE_MISMATCH");
    let summary = fixture.hub.seal_open_batch();

    assert!(summary.game_group_count == 1);
    assert!(fixture.hub.batch_capacity(0).sealed);
    assert!(fixture.hub.global_active_total() == 0_u256);
    assert!(fixture.hub.global_cumulative_total() == 128_u256);
    assert!(fixture.hub.game_active_total(GAME_A) == 0_u256);
    assert!(fixture.hub.game_cumulative_total(GAME_A) == 128_u256);
    assert!(fixture.callback.promotion_count() == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn assignment_rejection_happens_before_hub_vector_mutation() {
    let hub_address = deploy("SeasonSettlementCapacitySpike", array![admin().into()]);
    let callback_address = deploy("EconomicSettlementCallbackMock", array![hub_address.into(), true.into()]);
    let hub = ISeasonSettlementCapacitySpikeDispatcher { contract_address: hub_address };
    let callback = IEconomicCallbackMetricsSpikeDispatcher { contract_address: callback_address };
    start_cheat_caller_address(hub_address, admin());
    hub.register_game(GAME_A, callback_address);
    stop_cheat_caller_address(hub_address);
    let (parents, shares) = build_vectors(GAME_A, 0, 1);
    let source = stage_source(hub, GAME_A, 7401, 8401, parents.span(), shares.span());
    let safe_hub = ISeasonSettlementCapacitySpikeSafeDispatcher { contract_address: hub_address };

    assert!(safe_hub.append_pending_liability(7401, 0, 8401).is_err());
    assert!(hub.batch_capacity(0).liability_count == 0);
    assert!(hub.batch_capacity(0).parent_count == 0);
    assert!(hub.batch_capacity(0).lot_share_count == 0);
    assert!(!source.snapshot().assigned);
    assert!(callback.assignment_count() == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn multi_game_seal_has_no_late_callback_boundary() {
    let hub_address = deploy("SeasonSettlementCapacitySpike", array![admin().into()]);
    let hub = ISeasonSettlementCapacitySpikeDispatcher { contract_address: hub_address };
    let callback_a = deploy("EconomicSettlementCallbackMock", array![hub_address.into(), false.into()]);
    let callback_b = deploy("EconomicSettlementCallbackMock", array![hub_address.into(), false.into()]);
    let metrics_a = IEconomicCallbackMetricsSpikeDispatcher { contract_address: callback_a };
    let metrics_b = IEconomicCallbackMetricsSpikeDispatcher { contract_address: callback_b };
    start_cheat_caller_address(hub_address, admin());
    hub.register_game(GAME_A, callback_a);
    hub.register_game(GAME_B, callback_b);
    stop_cheat_caller_address(hub_address);
    let (parents_a, shares_a) = build_vectors(GAME_A, 0, 1);
    let (parents_b, shares_b) = build_vectors(GAME_B, 1, 1);
    let (global_parents, global_shares) = build_vectors(0, 2, 1);
    stage_source(hub, 0, 7500, 8500, global_parents.span(), global_shares.span());
    stage_source(hub, GAME_A, 7501, 8501, parents_a.span(), shares_a.span());
    stage_source(hub, GAME_B, 7502, 8502, parents_b.span(), shares_b.span());
    hub.append_pending_liability(7500, 0, 8500);
    hub.append_pending_liability(7501, 0, 8501);
    hub.append_pending_liability(7502, 0, 8502);
    let summary = hub.seal_open_batch();

    assert!(summary.game_group_count == 2);
    assert!(hub.batch_capacity(0).sealed);
    assert!(hub.global_active_total() == 0_u256);
    assert!(hub.global_cumulative_total() == 16_u256);
    assert!(hub.game_active_total(GAME_A) == 0_u256);
    assert!(hub.game_cumulative_total(GAME_A) == 16_u256);
    assert!(hub.game_active_total(GAME_B) == 0_u256);
    assert!(hub.game_cumulative_total(GAME_B) == 16_u256);
    assert!(metrics_a.promotion_count() == 0);
    assert!(metrics_b.promotion_count() == 0);
}

#[test]
fn worst_distribution_seals_fifteen_games_and_one_global_parent_with_full_storage_work() {
    let hub_address = deploy("SeasonSettlementCapacitySpike", array![admin().into()]);
    let hub = ISeasonSettlementCapacitySpikeDispatcher { contract_address: hub_address };
    let mut callbacks = array![];
    let mut game_cursor: u32 = 0;
    loop {
        if game_cursor == 15 {
            break;
        }
        let game_id = GAME_A + game_cursor.into();
        let callback_address = deploy("EconomicSettlementCallbackMock", array![hub_address.into(), false.into()]);
        let callback = IEconomicCallbackMetricsSpikeDispatcher { contract_address: callback_address };
        let (parents, shares) = build_vectors(game_id, game_cursor, 1);
        start_cheat_caller_address(hub_address, admin());
        hub.register_game(game_id, callback_address);
        stop_cheat_caller_address(hub_address);
        let source_id = 7100 + game_cursor.into();
        let liability_id = 8100 + game_cursor.into();
        stage_source(hub, game_id, source_id, liability_id, parents.span(), shares.span());
        hub.append_pending_liability(source_id, 0, liability_id);
        callbacks.append(callback);
        game_cursor += 1;
    }
    let (global_parents, global_shares) = build_vectors(0, 15, 1);
    stage_source(hub, 0, 7200, 8200, global_parents.span(), global_shares.span());
    hub.append_pending_liability(7200, 0, 8200);

    let summary = hub.seal_open_batch();

    assert!(summary.parent_count == 16);
    assert!(summary.lot_share_count == 256);
    assert!(summary.game_group_count == 15);
    assert!(summary.global_parent_count == 1);
    assert!(summary.global_lot_share_count == 16);
    assert!(hub.global_active_total() == 0_u256);
    assert!(hub.global_cumulative_total() == 16_u256);
    for callback in callbacks {
        assert!(callback.promotion_count() == 0);
    }
}

#[test]
fn existing_full_batch_seals_before_a_valid_next_source_is_appended() {
    let fixture = setup();
    let (full_parents, full_shares) = build_vectors(0, 0, 16);
    let (next_parents, next_shares) = build_vectors(0, 16, 1);
    stage_source(fixture.hub, 0, 7301, 8301, full_parents.span(), full_shares.span());
    stage_source(fixture.hub, 0, 7302, 8302, next_parents.span(), next_shares.span());
    fixture.hub.append_pending_liability(7301, 0, 8301);

    let assignment = fixture.hub.append_pending_liability(7302, 0, 8302);

    assert!(assignment == (1, 0));
    assert!(fixture.hub.batch_capacity(0).sealed);
    assert!(fixture.hub.batch_capacity(0).parent_count == 16);
    assert!(fixture.hub.batch_capacity(0).lot_share_count == 256);
    assert!(!fixture.hub.batch_capacity(1).sealed);
    assert!(fixture.hub.batch_capacity(1).parent_count == 1);
    assert!(fixture.hub.batch_capacity(1).lot_share_count == 16);
}

#[test]
#[feature("safe_dispatcher")]
fn thirty_two_world_global_factory_finalization_reads_only_staged_commitments() {
    let fixture = setup();

    start_cheat_caller_address(fixture.hub.contract_address, admin());
    let mut world_cursor = 1;
    loop {
        if world_cursor == 33 {
            break;
        }
        fixture.hub.register_global_factory_world(world_cursor, 1000 + world_cursor, 2000 + world_cursor);
        world_cursor += 1;
    }
    stop_cheat_caller_address(fixture.hub.contract_address);
    start_cheat_caller_address(fixture.hub.contract_address, admin());
    let seal_hash = fixture.hub.finalize_global_factory_seal();
    stop_cheat_caller_address(fixture.hub.contract_address);
    let safe_hub = ISeasonSettlementCapacitySpikeSafeDispatcher { contract_address: fixture.hub.contract_address };

    assert!(seal_hash != 0);
    assert!(fixture.hub.global_factory_seal_hash() == seal_hash);
    start_cheat_caller_address(fixture.hub.contract_address, admin());
    assert!(safe_hub.register_global_factory_world(33, 1033, 2033).is_err());
    stop_cheat_caller_address(fixture.hub.contract_address);
    assert!(fixture.hub.global_factory_seal_hash() == seal_hash);
    assert!(fixture.callback.assignment_count() == 0);
    assert!(fixture.callback.promotion_count() == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn global_factory_seal_rejects_unauthorized_and_premature_closure() {
    let fixture = setup();
    let safe_hub = ISeasonSettlementCapacitySpikeSafeDispatcher { contract_address: fixture.hub.contract_address };

    start_cheat_caller_address(fixture.hub.contract_address, admin());
    fixture.hub.register_global_factory_world(1, 1001, 2001);
    assert!(safe_hub.finalize_global_factory_seal().is_err());
    stop_cheat_caller_address(fixture.hub.contract_address);
    assert!(safe_hub.finalize_global_factory_seal().is_err());
    assert!(fixture.hub.global_factory_seal_hash() == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn administrative_registration_rejects_unauthorized_calls_without_reserving_identity() {
    let fixture = setup();
    let safe_hub = ISeasonSettlementCapacitySpikeSafeDispatcher { contract_address: fixture.hub.contract_address };
    let source_address = deploy(
        "PendingLiabilitySourceMock", array![fixture.hub.contract_address.into(), GAME_B, 9801],
    );

    assert!(safe_hub.register_game(GAME_B, fixture.callback.contract_address).is_err());
    assert!(safe_hub.register_source(9801, GAME_B, source_address).is_err());
    assert!(safe_hub.register_global_factory_world(1, 1001, 2001).is_err());

    start_cheat_caller_address(fixture.hub.contract_address, admin());
    fixture.hub.register_game(GAME_B, fixture.callback.contract_address);
    fixture.hub.register_source(9801, GAME_B, source_address);
    fixture.hub.register_global_factory_world(1, 1001, 2001);
    assert!(safe_hub.register_game(GAME_B, fixture.callback.contract_address).is_err());
    assert!(safe_hub.register_source(9801, GAME_B, source_address).is_err());
    assert!(safe_hub.register_global_factory_world(1, 1001, 2001).is_err());
    stop_cheat_caller_address(fixture.hub.contract_address);

    assert!(fixture.hub.source_snapshot(9801).source_generation == 0);
    assert!(fixture.hub.global_factory_seal_hash() == 0);
}

#[test]
fn sixty_fourth_liability_seals_immediately_and_sixty_fifth_starts_next_batch() {
    let fixture = setup();
    let (parents, shares) = build_vectors(GAME_A, 0, 1);
    let mut cursor: u32 = 0;
    loop {
        if cursor == 64 {
            break;
        }
        let source_id = 9000 + cursor.into();
        let liability_id = 10000 + cursor.into();
        stage_source(fixture.hub, GAME_A, source_id, liability_id, parents.span(), shares.span());
        assert!(fixture.hub.append_pending_liability(source_id, 0, liability_id) == (0, cursor.try_into().unwrap()));
        cursor += 1;
    }

    assert!(fixture.hub.batch_capacity(0).sealed);
    assert!(fixture.hub.batch_capacity(0).liability_count == 64);
    assert!(fixture.callback.promotion_count() == 0);
    assert!(fixture.hub.game_active_total(GAME_A) == 0_u256);
    assert!(fixture.hub.game_cumulative_total(GAME_A) == 1024_u256);
    let next_source = stage_source(fixture.hub, GAME_A, 9064, 10064, parents.span(), shares.span());
    let next_assignment = fixture.hub.append_pending_liability(9064, 0, 10064);

    assert!(next_assignment == (1, 0));
    assert!(next_source.snapshot().assigned_batch_id == 1);
    assert!(fixture.hub.batch_capacity(1).liability_count == 1);
    assert!(!fixture.hub.batch_capacity(1).sealed);
}

#[test]
#[feature("safe_dispatcher")]
fn source_rejects_duplicate_vectors_before_mutation() {
    let fixture = setup();
    let (mut parents, shares) = build_vectors(GAME_A, 0, 2);
    parents.append(copy_parent(parents.at(0)));
    let source_address = deploy(
        "PendingLiabilitySourceMock", array![fixture.hub.contract_address.into(), GAME_A, 9101],
    );
    let source = IPendingLiabilitySourceSpikeDispatcher { contract_address: source_address };
    let safe_source = IPendingLiabilitySourceAdminSpikeSafeDispatcher { contract_address: source_address };

    assert!(safe_source.create_pending_liability(10101, parents.span(), shares.span()).is_err());
    assert!(source.snapshot().source_generation == 0);
    assert!(source.snapshot().pending_liability_id == 0);
}

#[test]
#[feature("safe_dispatcher")]
fn source_rejects_unsorted_unique_parents_before_mutation() {
    let fixture = setup();
    let (parents, shares) = build_vectors(GAME_A, 0, 2);
    let reversed = array![copy_parent(parents.at(1)), copy_parent(parents.at(0))];
    let source_address = deploy(
        "PendingLiabilitySourceMock", array![fixture.hub.contract_address.into(), GAME_A, 9102],
    );
    let source = IPendingLiabilitySourceSpikeDispatcher { contract_address: source_address };
    let safe_source = IPendingLiabilitySourceAdminSpikeSafeDispatcher { contract_address: source_address };

    assert!(safe_source.create_pending_liability(10102, reversed.span(), shares.span()).is_err());
    assert!(source.snapshot().source_generation == 0);
    assert!(source.snapshot().pending_liability_id == 0);
}

#[test]
fn canonical_batch_hash_is_independent_of_source_append_order() {
    let first = setup();
    let second = setup();
    let (parents_a, shares_a) = build_vectors(GAME_A, 0, 1);
    let (parents_b, shares_b) = build_vectors(GAME_A, 1, 1);
    stage_source(first.hub, GAME_A, 9201, 10201, parents_b.span(), shares_b.span());
    stage_source(first.hub, GAME_A, 9202, 10202, parents_a.span(), shares_a.span());
    stage_source(second.hub, GAME_A, 9301, 10301, parents_a.span(), shares_a.span());
    stage_source(second.hub, GAME_A, 9302, 10302, parents_b.span(), shares_b.span());
    first.hub.append_pending_liability(9201, 0, 10201);
    first.hub.append_pending_liability(9202, 0, 10202);
    second.hub.append_pending_liability(9301, 0, 10301);
    second.hub.append_pending_liability(9302, 0, 10302);

    assert!(first.hub.seal_open_batch().post_state_hash == second.hub.seal_open_batch().post_state_hash);
}

#[test]
fn post_state_hash_binds_exact_promoted_record_identities() {
    let first = setup();
    let second = setup();
    let (parents_a, shares_a) = build_vectors(GAME_A, 0, 1);
    let (parents_b, shares_b) = build_vectors(GAME_A, 1, 1);
    stage_source(first.hub, GAME_A, 9401, 10401, parents_a.span(), shares_a.span());
    stage_source(second.hub, GAME_A, 9501, 10501, parents_b.span(), shares_b.span());
    first.hub.append_pending_liability(9401, 0, 10401);
    second.hub.append_pending_liability(9501, 0, 10501);

    assert!(first.hub.seal_open_batch().post_state_hash != second.hub.seal_open_batch().post_state_hash);
}

#[test]
fn global_post_state_hash_binds_exact_promoted_record_identities() {
    let first = setup();
    let second = setup();
    let (parents_a, shares_a) = build_vectors(0, 0, 1);
    let (parents_b, shares_b) = build_vectors(0, 1, 1);
    stage_source(first.hub, 0, 9601, 10601, parents_a.span(), shares_a.span());
    stage_source(second.hub, 0, 9701, 10701, parents_b.span(), shares_b.span());
    first.hub.append_pending_liability(9601, 0, 10601);
    second.hub.append_pending_liability(9701, 0, 10701);

    assert!(first.hub.seal_open_batch().post_state_hash != second.hub.seal_open_batch().post_state_hash);
}

#[test]
fn activation_only_shape_seals_with_zero_parent_and_lot_rows() {
    let fixture = setup();

    assert!(fixture.hub.append_activation_only(11001) == (0, 0));
    let summary = fixture.hub.seal_open_batch();

    assert!(summary.parent_count == 0);
    assert!(summary.lot_share_count == 0);
    assert!(fixture.hub.batch_capacity(0).activation_count == 1);
    assert!(fixture.hub.batch_capacity(0).sealed);
}

#[test]
fn one_parent_one_lot_shape_seals() {
    assert_shape_seals(1, 1, 11100);
}

#[test]
fn fifteen_parent_two_hundred_fifty_five_lot_shape_seals() {
    assert_shape_seals(15, 255, 11200);
}

#[test]
fn fifteen_parent_two_hundred_fifty_six_lot_shape_seals() {
    assert_shape_seals(15, 256, 11300);
}

#[test]
fn sixteen_parent_two_hundred_fifty_five_lot_shape_seals() {
    assert_shape_seals(16, 255, 11400);
}

#[test]
fn sixteen_parent_two_hundred_fifty_six_lot_shape_seals() {
    assert_shape_seals(16, 256, 11500);
}

#[test]
#[feature("safe_dispatcher")]
fn structurally_impossible_parent_lot_cross_product_shapes_reject_before_source_mutation() {
    let fixture = setup();
    assert_orphan_shape_rejects(fixture.hub, 1, 11601);
    assert_orphan_shape_rejects(fixture.hub, 255, 11602);
    assert_orphan_shape_rejects(fixture.hub, 256, 11603);
    assert_shape_source_rejects(fixture.hub, 1, 0, 11604);
    assert_shape_source_rejects(fixture.hub, 1, 255, 11605);
    assert_shape_source_rejects(fixture.hub, 1, 256, 11606);
    assert_shape_source_rejects(fixture.hub, 15, 0, 11607);
    assert_shape_source_rejects(fixture.hub, 15, 1, 11608);
    assert_shape_source_rejects(fixture.hub, 16, 0, 11609);
    assert_shape_source_rejects(fixture.hub, 16, 1, 11610);
    assert!(fixture.hub.batch_capacity(0).liability_count == 0);
}

fn setup() -> CapacityFixture {
    let hub_address = deploy("SeasonSettlementCapacitySpike", array![admin().into()]);
    let callback_address = deploy("EconomicSettlementCallbackMock", array![hub_address.into(), false.into()]);
    let hub = ISeasonSettlementCapacitySpikeDispatcher { contract_address: hub_address };
    start_cheat_caller_address(hub_address, admin());
    hub.register_game(GAME_A, callback_address);
    stop_cheat_caller_address(hub_address);
    CapacityFixture { hub, callback: IEconomicCallbackMetricsSpikeDispatcher { contract_address: callback_address } }
}

fn stage_source(
    hub: ISeasonSettlementCapacitySpikeDispatcher,
    game_id: felt252,
    source_id: felt252,
    liability_id: felt252,
    parents: Span<BackingTotal>,
    shares: Span<LotSharePromotion>,
) -> IPendingLiabilitySourceSpikeDispatcher {
    let source_address = deploy("PendingLiabilitySourceMock", array![hub.contract_address.into(), game_id, source_id]);
    IPendingLiabilitySourceAdminSpikeDispatcher { contract_address: source_address }
        .create_pending_liability(liability_id, parents, shares);
    start_cheat_caller_address(hub.contract_address, admin());
    hub.register_source(source_id, game_id, source_address);
    stop_cheat_caller_address(hub.contract_address);
    IPendingLiabilitySourceSpikeDispatcher { contract_address: source_address }
}

fn assert_shape_seals(parent_count: u32, share_count: u32, seed: felt252) {
    let fixture = setup();
    let (parents, shares) = build_shape_vectors(GAME_A, 0, parent_count, share_count);
    stage_source(fixture.hub, GAME_A, seed, seed + 100000, parents.span(), shares.span());
    fixture.hub.append_pending_liability(seed, 0, seed + 100000);

    let summary = fixture.hub.seal_open_batch();

    assert!(summary.parent_count == parent_count.try_into().unwrap());
    assert!(summary.lot_share_count == share_count.try_into().unwrap());
    assert!(summary.game_group_count == 1);
    assert!(fixture.hub.game_active_total(GAME_A) == 0_u256);
    assert!(fixture.hub.game_cumulative_total(GAME_A) == share_count.into());
}

#[feature("safe_dispatcher")]
fn assert_shape_source_rejects(
    hub: ISeasonSettlementCapacitySpikeDispatcher, parent_count: u32, share_count: u32, seed: felt252,
) {
    let (parents, shares) = build_shape_vectors(GAME_A, 0, parent_count, share_count);
    let source_address = deploy("PendingLiabilitySourceMock", array![hub.contract_address.into(), GAME_A, seed]);
    let safe_source = IPendingLiabilitySourceAdminSpikeSafeDispatcher { contract_address: source_address };
    let source = IPendingLiabilitySourceSpikeDispatcher { contract_address: source_address };

    assert!(safe_source.create_pending_liability(seed + 100000, parents.span(), shares.span()).is_err());
    assert!(source.snapshot().source_generation == 0);
    assert!(source.snapshot().pending_liability_id == 0);
}

#[feature("safe_dispatcher")]
fn assert_orphan_shape_rejects(hub: ISeasonSettlementCapacitySpikeDispatcher, share_count: u32, seed: felt252) {
    let parents = array![];
    let mut shares = array![];
    let mut cursor = 0;
    loop {
        if cursor == share_count {
            break;
        }
        shares
            .append(
                LotSharePromotion {
                    game_id: GAME_A, parent_key_hash: 999999, lot_index: cursor.try_into().unwrap(), amount: 1_u256,
                },
            );
        cursor += 1;
    }
    let source_address = deploy("PendingLiabilitySourceMock", array![hub.contract_address.into(), GAME_A, seed]);
    let safe_source = IPendingLiabilitySourceAdminSpikeSafeDispatcher { contract_address: source_address };
    let source = IPendingLiabilitySourceSpikeDispatcher { contract_address: source_address };

    assert!(safe_source.create_pending_liability(seed + 100000, parents.span(), shares.span()).is_err());
    assert!(source.snapshot().source_generation == 0);
}

fn copy_parent(parent: @BackingTotal) -> BackingTotal {
    BackingTotal {
        key: BackingKey {
            deployment_id: *parent.key.deployment_id,
            game_id: *parent.key.game_id,
            asset_mode: *parent.key.asset_mode,
            asset_id: *parent.key.asset_id,
            backing_pool_id: *parent.key.backing_pool_id,
        },
        amount_or_quota: *parent.amount_or_quota,
    }
}

fn maximum_game_vectors(game_id: felt252) -> (Array<BackingTotal>, Array<LotSharePromotion>) {
    build_vectors(game_id, 0, 16)
}

fn half_vectors(game_id: felt252, parent_offset: u32) -> (Array<BackingTotal>, Array<LotSharePromotion>) {
    build_vectors(game_id, parent_offset, 8)
}

fn build_vectors(
    game_id: felt252, parent_offset: u32, parent_count: u32,
) -> (Array<BackingTotal>, Array<LotSharePromotion>) {
    build_shape_vectors(game_id, parent_offset, parent_count, parent_count * 16)
}

fn build_shape_vectors(
    game_id: felt252, parent_offset: u32, parent_count: u32, share_count: u32,
) -> (Array<BackingTotal>, Array<LotSharePromotion>) {
    let mut parents = array![];
    let mut parent_hashes = array![];
    let mut parent_share_counts = array![];
    let mut shares = array![];
    if parent_count == 0 {
        assert!(share_count == 0, "ORPHAN_SHAPE_REQUIRES_NEGATIVE_FIXTURE");
        return (parents, shares);
    }
    let base_share_count = share_count / parent_count;
    let extra_share_count = share_count % parent_count;
    let mut parent_cursor = 0;
    loop {
        if parent_cursor == parent_count {
            break;
        }
        let asset_id = parent_offset + parent_cursor + 1;
        let shares_for_parent = base_share_count + if parent_cursor < extra_share_count {
            1
        } else {
            0
        };
        let parent = BackingTotal {
            key: BackingKey { deployment_id: DEPLOYMENT_ID, game_id, asset_mode: 1, asset_id, backing_pool_id: 5001 },
            amount_or_quota: shares_for_parent.into(),
        };
        let parent_hash = backing_key_hash(@parent.key);
        parents.append(parent);
        parent_hashes.append(parent_hash);
        parent_share_counts.append(shares_for_parent);
        parent_cursor += 1;
    }
    let mut previous_hash = 0;
    let mut selected_count = 0;
    loop {
        if selected_count == parent_count {
            break;
        }
        let mut selected_hash = 0;
        let mut selected_share_count = 0;
        let mut found = false;
        let mut hash_cursor = 0;
        loop {
            if hash_cursor == parent_count {
                break;
            }
            let candidate = *parent_hashes.at(hash_cursor.try_into().unwrap());
            if felt_precedes(previous_hash, candidate) && (!found || felt_precedes(candidate, selected_hash)) {
                selected_hash = candidate;
                selected_share_count = *parent_share_counts.at(hash_cursor.try_into().unwrap());
                found = true;
            }
            hash_cursor += 1;
        }
        assert!(found, "PARENT_HASH_ORDERING_FAILED");
        let mut lot_cursor = 0;
        loop {
            if lot_cursor == selected_share_count {
                break;
            }
            shares
                .append(
                    LotSharePromotion {
                        game_id,
                        parent_key_hash: selected_hash,
                        lot_index: lot_cursor.try_into().unwrap(),
                        amount: 1_u256,
                    },
                );
            lot_cursor += 1;
        }
        previous_hash = selected_hash;
        selected_count += 1;
    }
    (parents, shares)
}

fn deploy(name: ByteArray, calldata: Array<felt252>) -> ContractAddress {
    let contract = declare(name).unwrap().contract_class();
    let (address, _) = contract.deploy(@calldata).unwrap();
    address
}

fn admin() -> ContractAddress {
    'admin'.try_into().unwrap()
}
