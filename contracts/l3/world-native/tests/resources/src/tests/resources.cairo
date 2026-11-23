pub use world_test_support::tests::resources::*;
use crate::resources::{IResourceOperationsSafeDispatcher, IResourceOperationsSafeDispatcherTrait};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{Deployment, stock};
use super::unlimited_production::{
    IResourceOperationsDispatcherTrait, KNIGHT, ResourceObservationTrait, context, resources, slot,
    start_cheat_caller_address, stop_cheat_caller_address,
};
#[test]
fn sparse_resources_emit_typed_rows_and_skip_unchanged_values() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    let mut spy = spy_events();
    resources.initialize(key, 100);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 1);
    let (_, weight) = events.events.at(0);
    assert_eq!(weight.keys.span(), array![selector!("RowSet"), 1, 'ResourceWeight'].span());
    assert_eq!(weight.data.span(), array![2, 1, 7, 2, 100, 0].span());
    resources.start(key);
    let mut spy = spy_events();
    resources.settle(key);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 0);
    resources.grant(key, 10);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 2);
    let (_, balance) = events.events.at(0);
    assert_eq!(balance.keys.span(), array![selector!("RowSet"), 1, 'ResourceBalance'].span());
    assert_eq!(balance.data.span(), array![3, 1, 7, 23, 1, 10].span());
    let mut spy = spy_events();
    resources.spend(key, 10);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 2);
    let (_, balance) = events.events.at(0);
    assert_eq!(balance.keys.span(), array![selector!("RowDeleted"), 1, 'ResourceBalance'].span());
    assert_eq!(balance.data.span(), array![3, 1, 7, 23].span());
    assert_eq!(resources.balance(key), 0);
    assert_eq!(resources.weight(key).weight, 0);
}

#[test]
fn resource_deletion_clears_balances_and_weight_without_affecting_another_game() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    let other = ResourceKey { game_id: 2, ..key };
    resources.initialize(key, 100);
    resources.initialize(other, 200);
    resources.grant(key, 10);
    resources.grant(other, 20);
    let mut spy = spy_events();
    resources.destroy(key);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 2);
    for index in 0_u32..2 {
        let (_, event) = events.events.at(index);
        assert_eq!(*event.keys.at(0), selector!("RowDeleted"));
    }
    resources.initialize(key, 50);
    assert_eq!(resources.balance(key), 0);
    assert_eq!(resources.weight(key), Weight { capacity: 50, weight: 0 });
    assert_eq!(resources.balance(other), 20);
    assert_eq!(resources.weight(other), Weight { capacity: 200, weight: 20 });
}

#[test]
fn production_storage_round_trips_empty_and_maximum_values() {
    assert_eq!(ProductionPacking::unpack(ProductionPacking::pack(Default::default())), Default::default());
    let maximum = Production {
        remainder: 0,
        building_count: 0xff,
        production_rate: 0xffffffffffffffff,
        output_amount_left: 0xffffffffffffffffffffffffffffffff,
        last_settled_at: 0xffffffff,
    };
    assert_eq!(ProductionPacking::unpack(ProductionPacking::pack(maximum)), maximum);
}

#[test]
#[fuzzer(runs: 256)]
fn packed_production_fields_do_not_overlap(buildings: u8, rate: u64, cap: u128, time: u32) {
    let production = Production {
        remainder: 0, building_count: buildings, production_rate: rate, output_amount_left: cap, last_settled_at: time,
    };
    assert_eq!(ProductionPacking::unpack(ProductionPacking::pack(production)), production);
}

#[test]
#[feature("safe_dispatcher")]
fn relic_balances_keep_precision_without_production_rows() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    resources.initialize(key, 10 * RESOURCE_PRECISION);
    for resource_type in 39_u8..57 {
        let mut spy = spy_events();
        assert_eq!(resources.grant_at(key, resource_type, 2 * RESOURCE_PRECISION, 1, 100), 2 * RESOURCE_PRECISION);
        assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 2);
        let before = resources.read_slot(key, resource_type);
        let (_, production, _) = before;
        assert_eq!(production, Default::default());
        let rejected = IResourceFixtureSafeDispatcher { contract_address: resources.contract_address };
        let mut spy = spy_events();
        assert!(rejected.spend_at(key, resource_type, 1, 1, 101).is_err());
        assert_eq!(resources.read_slot(key, resource_type), before);
        assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 0);
        resources.spend_at(key, resource_type, 2 * RESOURCE_PRECISION, 1, 102);
        assert_eq!(
            resources.read_slot(key, resource_type),
            (0, Default::default(), Weight { capacity: 10 * RESOURCE_PRECISION, weight: 0 }),
        );
    }
}

#[test]
fn elapsed_seconds_pay_exactly_however_often_production_settles() {
    // The exact Frontier farm rate pays for every second, including between armies ticks.
    let rate = 84000000_u64;
    let mut production = Production {
        remainder: 0, building_count: 1, production_rate: rate, output_amount_left: 0, last_settled_at: 0,
    };
    let mut balance = 0_u128;
    let mut weight = Weight { capacity: core::num::traits::Bounded::MAX, weight: 0 };
    let mut now = 0_u32;
    let mut seed = 7_u128;
    for _ in 0..10000_u32 {
        seed = (seed * 6364136223846793005 + 1442695040888963407) % 0x10000000000000000;
        now += (seed % 300).try_into().unwrap();
        crate::resources::settle(crate::resources::WHEAT, ref balance, ref production, ref weight, 1, None, now);
        assert_eq!(balance, Into::<u32, u128>::into(now) * Into::<u64, u128>::into(rate));
    }
}

#[test]
fn frontier_rates_keep_the_same_total_at_every_output_tier() {
    for (resource, rate, base_cents) in array![
        (crate::resources::WHEAT, 84_000_000_u64, 1008_u128), (crate::resources::LABOR, 56_000_000, 672),
        (26, 28_000_000, 336), (crate::resources::LABOR, 28_000_000, 336),
    ] {
        for picks in 0_u128..5 {
            let tier_rate = Into::<u64, u128>::into(rate) * (10000 + picks * 2500) / 10000;
            let mut production = Production {
                remainder: 0,
                building_count: 1,
                production_rate: tier_rate.try_into().unwrap(),
                output_amount_left: crate::resources::UNLIMITED_OUTPUT,
                last_settled_at: 0,
            };
            let mut balance = 0;
            let mut weight = Weight { capacity: core::num::traits::Bounded::MAX, weight: 0 };
            crate::resources::settle(resource, ref balance, ref production, ref weight, 0, None, 10000 * 120);
            let cents = base_cents * (4 + picks) / 4;
            assert_eq!(balance, cents * crate::rules::RESOURCE_PRECISION / 100 * 10000);
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn spending_settles_once_and_emits_only_the_final_resource_facts() {
    let (d, home, _) = super::resource_commands::setup();
    start_producing(d, home, KNIGHT, 2, 100, FIXTURE_START + 10);
    let before = held(d, home, KNIGHT);
    let mut spy = spy_events();
    spend_at(d, home, KNIGHT, 5, FIXTURE_START + 20);
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 2);
    let (_, balance) = events.events.at(0);
    assert_eq!(
        balance.keys.span(), array![selector!("ResourceEvent"), selector!("RowSet"), 1, 'ResourceBalance'].span(),
    );
    assert_eq!(balance.data.span(), balance_row(home, KNIGHT, before + 15));
    assert_eq!(
        resources(d).resource_production(slot(home, KNIGHT)),
        Production {
            remainder: 0,
            building_count: 1,
            production_rate: 2,
            output_amount_left: 80,
            last_settled_at: (FIXTURE_START + 20).try_into().unwrap(),
        },
    );
    let mut spy = spy_events();
    grant_at(d, home, KNIGHT, 10, FIXTURE_START + 25);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 2);
    assert_eq!(held(d, home, KNIGHT), before + 35);
    let expected = resources(d).resource_production(slot(home, KNIGHT));
    assert_eq!(expected.output_amount_left, 70);
    let mut spy = spy_events();
    let rejected = IResourceOperationsSafeDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    assert!(rejected.spend_resource(home, KNIGHT, before + 100, FIXTURE_START + 30, context(d, home)).is_err());
    stop_cheat_caller_address(d.games);
    assert_eq!(held(d, home, KNIGHT), before + 35);
    assert_eq!(resources(d).resource_production(slot(home, KNIGHT)), expected);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
}

#[test]
fn production_spends_its_cap_before_the_store_limit_truncates_and_food_is_uncapped() {
    let (d, home, _) = super::resource_commands::setup();
    let limit = snforge_std::interact_with_state(d.games, || crate::logic::resources::store_limit(home, KNIGHT))
        .unwrap();
    stock(d, home, KNIGHT, limit - 10 - held(d, home, KNIGHT));
    start_producing(d, home, KNIGHT, 2, 50, FIXTURE_START + 10);
    assert_eq!(grant_at(d, home, KNIGHT, 4, FIXTURE_START + 20), 0);
    assert_eq!(held(d, home, KNIGHT), limit);
    assert_eq!(resources(d).resource_production(slot(home, KNIGHT)).output_amount_left, 30);
    let wheat = held(d, home, crate::resources::WHEAT);
    spend_at(d, home, crate::resources::WHEAT, 100, FIXTURE_START + 20);
    start_producing(d, home, crate::resources::WHEAT, 2, 0, FIXTURE_START + 20);
    spend_at(d, home, crate::resources::WHEAT, 3, FIXTURE_START + 25);
    assert_eq!(held(d, home, crate::resources::WHEAT), wheat - 93);
    assert_eq!(resources(d).resource_production(slot(home, crate::resources::WHEAT)).output_amount_left, 0);
}

#[test]
fn inactive_resources_have_no_clock_and_activation_starts_at_block_time() {
    let (d, home, _) = super::resource_commands::setup();
    let before = held(d, home, 1);
    let mut spy = spy_events();
    grant_at(d, home, 1, 10, FIXTURE_START + 50);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 1);
    assert_eq!(resources(d).resource_production(slot(home, 1)), Default::default());
    let mut spy = spy_events();
    spend_at(d, home, 1, 2, FIXTURE_START + 100);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 1);
    start_producing(d, home, 1, 2, 100, FIXTURE_START + 200);
    assert_eq!(held(d, home, 1), before + 8);
    assert_eq!(
        resources(d).resource_production(slot(home, 1)),
        Production {
            remainder: 0,
            building_count: 1,
            production_rate: 2,
            output_amount_left: 100,
            last_settled_at: (FIXTURE_START + 200).try_into().unwrap(),
        },
    );
    spend_at(d, home, 1, 0, FIXTURE_START + 205);
    assert_eq!(held(d, home, 1), before + 18);
    let production = resources(d).resource_production(slot(home, 1));
    assert_eq!(production.output_amount_left, 90);
    assert_eq!(production.last_settled_at.into(), FIXTURE_START + 205);
}

#[test]
fn consecutive_seconds_pay_one_second_and_match_a_single_settlement() {
    let (d, repeated, once) = super::resource_commands::setup();
    let repeated_start = held(d, repeated, 1);
    let once_start = held(d, once, 1);
    for home in array![repeated, once] {
        start_producing(d, home, 1, 7, 1000, FIXTURE_START + 40);
    }
    for now in FIXTURE_START + 41..FIXTURE_START + 101 {
        let before = held(d, repeated, 1);
        spend_at(d, repeated, 1, 0, now);
        assert_eq!(held(d, repeated, 1) - before, 7);
    }
    spend_at(d, once, 1, 0, FIXTURE_START + 100);
    assert_eq!(held(d, once, 1) - once_start, 420);
    assert_eq!(held(d, repeated, 1) - repeated_start, 420);
}

#[test]
fn stopping_the_last_producer_settles_it_and_clears_its_clock() {
    let (d, home, _) = super::resource_commands::setup();
    let before = held(d, home, 2);
    start_producing(d, home, 2, 2, 20, FIXTURE_START + 10);
    let mut spy = spy_events();
    stop_producing(d, home, 2, 2, FIXTURE_START + 20);
    assert_eq!(held(d, home, 2), before + 20);
    assert_eq!(resources(d).resource_production(slot(home, 2)), Default::default());
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 2);
    let (_, balance) = events.events.at(0);
    assert_eq!(
        balance.keys.span(), array![selector!("ResourceEvent"), selector!("RowSet"), 1, 'ResourceBalance'].span(),
    );
    assert_eq!(balance.data.span(), balance_row(home, 2, before + 20));
    let (_, production) = events.events.at(1);
    assert_eq!(
        production.keys.span(),
        array![selector!("ResourceEvent"), selector!("RowDeleted"), 1, 'ResourceProduction'].span(),
    );
    assert_eq!(production.data.span(), array![3, home.game_id.into(), home.entity_id.into(), 2].span());
    let mut spy = spy_events();
    spend_at(d, home, 2, 0, FIXTURE_START + 30);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
    assert_eq!(held(d, home, 2), before + 20);
    assert_eq!(resources(d).resource_production(slot(home, 2)), Default::default());
}

fn held(d: Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    resources(d).resource_balance(slot(home, resource_type))
}

fn balance_row(home: ResourceKey, resource_type: u8, balance: u128) -> Span<felt252> {
    array![3, home.game_id.into(), home.entity_id.into(), resource_type.into(), 1, balance.into()].span()
}

fn start_producing(d: Deployment, home: ResourceKey, resource_type: u8, rate: u64, output: u128, at: u64) {
    start_cheat_caller_address(d.games, d.games);
    resources(d).start_production(home, resource_type, rate, output, at, context(d, home));
    stop_cheat_caller_address(d.games);
}

fn stop_producing(d: Deployment, home: ResourceKey, resource_type: u8, rate: u64, at: u64) {
    start_cheat_caller_address(d.games, d.games);
    resources(d).stop_production(home, resource_type, rate, at, context(d, home));
    stop_cheat_caller_address(d.games);
}

fn spend_at(d: Deployment, home: ResourceKey, resource_type: u8, amount: u128, at: u64) {
    start_cheat_caller_address(d.games, d.games);
    resources(d).spend_resource(home, resource_type, amount, at, context(d, home));
    stop_cheat_caller_address(d.games);
}

fn grant_at(d: Deployment, home: ResourceKey, resource_type: u8, amount: u128, at: u64) -> u128 {
    start_cheat_caller_address(d.games, d.games);
    let stored = resources(d).grant_resource(home, resource_type, amount, at, context(d, home));
    stop_cheat_caller_address(d.games);
    stored
}
