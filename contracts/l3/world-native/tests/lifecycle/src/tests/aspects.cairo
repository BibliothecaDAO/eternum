use snforge_std::{interact_with_state, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::entry::{EntryEntitlement, EntryKey, ISettlementEntrySafeDispatcherTrait, ledger};
use world_test_support::tests::play_fixture::{
    FIXTURE_REALM_TRAITS, FIXTURE_SEASON_SECONDS, FIXTURE_START, create_game, fixture_params,
};
use world_test_support::tests::registrar::{CreateGameParams, setup};
use world_test_support::tests::{Deployment, authority};
use crate::commands::Command;
use crate::realms::SettleSeason;
use crate::resources::ResourceKey;

pub fn setup_aspects(seed: felt252) -> (Deployment, u32) {
    setup_aspects_lasting(seed, FIXTURE_SEASON_SECONDS)
}

pub fn setup_aspects_lasting(seed: felt252, duration_seconds: u64) -> (Deployment, u32) {
    let d = setup();
    world_test_support::tests::entry::set_operator(d, authority());
    let game_id = create_game(d.games, CreateGameParams { seed, duration_seconds, ..fixture_params('aspects') });
    let mut traits = array![];
    for index in 0_u32..crate::realms::CANONICAL_REALM_COUNT {
        traits.append(FIXTURE_REALM_TRAITS + (index % 16) * 0x400000);
    }
    world_test_support::tests::realms::seed_catalogue(d, traits.span());
    (d, game_id)
}

fn settle(d: Deployment, game_id: u32, order: Option<u8>) -> bool {
    world_test_support::tests::resource_commands::execute_in_game(
        d, game_id, Command::SettleSeason(SettleSeason { selected_realm: None, order }), FIXTURE_START,
    )
}

fn new_player(d: Deployment, index: u8) -> Deployment {
    let (actor, account_class) = world_test_support::tests::deploy_player(
        1000 + Into::<u8, felt252>::into(index), world_test_support::tests::GUARDIAN,
    );
    Deployment { actor, account_class, ..d }
}

#[test]
fn every_free_home_founds_a_realm_of_the_order_it_chose_and_joins_that_orders_aspect_once() {
    let (d, game_id) = setup_aspects(42);
    let orders = crate::logic::aspects::rules();
    for order in 1_u8..17 {
        let player = new_player(d, order);
        assert!(settle(player, game_id, Some(order)));
        interact_with_state(
            d.games,
            || {
                let home = crate::entity_ids::home_for_actor(game_id, player.actor);
                let key = ResourceKey { game_id, entity_id: home };
                let record = crate::logic::structures::record(key);
                assert_eq!(record.metadata.order, order);
                assert_eq!((record.metadata.realm_id - 1) % 16 + 1, order.into());
                assert_eq!(crate::logic::aspects::home_aspect(key), crate::aspects::order_aspect(orders, order));
            },
        );
        assert!(!settle(player, game_id, Some(order)));
        assert!(!settle(player, game_id, Some(order % 16 + 1)));
    }
    interact_with_state(
        d.games,
        || {
            for aspect in 1_u8..5 {
                assert_eq!(crate::state::read().settlements.aspect_members.read((game_id, aspect)), 4);
            }
        },
    );
}

#[test]
fn free_home_requires_a_valid_order_and_a_failed_choice_reserves_nothing() {
    let (d, game_id) = setup_aspects(42);
    let order = world_test_support::tests::registrar::aspect_order(2);
    assert!(!settle(d, game_id, None));
    assert!(!settle(d, game_id, Some(0)));
    assert!(!settle(d, game_id, Some(17)));
    assert!(settle(d, game_id, Some(order)));
    interact_with_state(
        d.games,
        || {
            let home = crate::entity_ids::home_for_actor(game_id, d.actor);
            assert_eq!(
                crate::logic::structures::record(ResourceKey { game_id, entity_id: home }).metadata.order, order,
            );
            assert_eq!(crate::state::read().settlements.aspect_members.read((game_id, 2)), 1);
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn held_realm_plays_its_own_order_and_refuses_a_chosen_one() {
    let (d, game_id) = setup_aspects(42);
    start_cheat_caller_address(d.games, authority());
    ledger(d)
        .register_entitlement(
            EntryKey { game_id, owner: d.actor },
            EntryEntitlement {
                realm_id: 1, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: crate::settlement::HELD_REALM_KIND,
            },
        )
        .unwrap();
    stop_cheat_caller_address(d.games);
    assert!(!settle(d, game_id, Some(1)));
    assert!(settle(d, game_id, None));
    interact_with_state(
        d.games,
        || {
            let home = crate::entity_ids::home_for_actor(game_id, d.actor);
            let key = ResourceKey { game_id, entity_id: home };
            assert_eq!(crate::logic::structures::record(key).metadata.realm_id, 1);
            assert_eq!(crate::logic::aspects::home_aspect(key), 1);
        },
    );
}

#[test]
fn orders_round_trip_without_loot_suffix_order() {
    let order_aspects = crate::balance::settlement::ORDER_ASPECTS.span();
    let packed = crate::aspects::pack(order_aspects);
    for index in 0_u32..16 {
        assert_eq!(crate::aspects::order_aspect(packed, (index + 1).try_into().unwrap()), *order_aspects.at(index));
    }
    assert_eq!(crate::aspects::order_aspect(packed, 12), 1);
    assert_eq!(crate::aspects::order_aspect(packed, 16), 2);
    assert_eq!(crate::aspects::order_aspect(packed, 14), 3);
    assert_eq!(crate::aspects::order_aspect(packed, 4), 4);
}

#[test]
#[feature("safe_dispatcher")]
fn a_founded_home_attaches_only_a_realm_of_its_aspect() {
    let (d, game_id) = setup_aspects(43);
    assert!(settle(d, game_id, Some(world_test_support::tests::registrar::aspect_order(2))));
    start_cheat_caller_address(d.games, authority());
    let key = EntryKey { game_id, owner: d.actor };
    let entitlement = EntryEntitlement {
        realm_id: 1, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: crate::settlement::HELD_REALM_KIND,
    };
    assert!(ledger(d).register_entitlement(key, entitlement).is_err());
    ledger(d).register_entitlement(key, EntryEntitlement { realm_id: 2, ..entitlement }).unwrap();
    stop_cheat_caller_address(d.games);
    interact_with_state(
        d.games,
        || {
            let home = crate::entity_ids::home_for_actor(game_id, d.actor);
            let state = crate::state::read();
            assert_eq!(state.settlements.home_aspects.read((game_id, home)), 2);
            assert_eq!(state.settlements.aspect_members.read((game_id, 2)), 1);
            assert_eq!(state.settlements.held_realm_homes.read((game_id, 1)), 0);
            assert_eq!(state.settlements.held_realm_homes.read((game_id, 2)), home);
        },
    );
}
