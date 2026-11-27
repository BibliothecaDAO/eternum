use snforge_std::{interact_with_state, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::entry::{EntryEntitlement, EntryKey, ISettlementEntrySafeDispatcherTrait, ledger};
use world_test_support::tests::resource_commands::execute_in_game;
use world_test_support::tests::{Deployment, authority};
use crate::commands::Command;
use crate::realms::SettleSeason;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;
use crate::troops::{ArmySlotKey, ExplorerKey, StaminaSource, TroopTier, TroopType};

fn realm_grant(resource_type: u8) -> u128 {
    let mut amount = 0_u128;
    for grant in crate::balance::settlement::REALM_GRANTS.span() {
        if *grant.resource_type == resource_type {
            amount = *grant.amount;
        }
    }
    amount
}

fn simple_input_cost(resource_type: u8, input_type: u8) -> u128 {
    let recipe = *crate::balance::resources::RECIPES.span().at(resource_type.into() - 1);
    let mut amount = 0_u128;
    for input in crate::balance::resources::RECIPE_INPUTS.span().slice(recipe.first_input, recipe.simple_count) {
        if *input.resource_type == input_type {
            amount = *input.amount;
        }
    }
    amount
}

fn settle(d: Deployment, game_id: u32, held: bool, timestamp: u64) -> bool {
    execute_in_game(
        d,
        game_id,
        Command::SettleSeason(
            SettleSeason {
                selected_realm: None,
                order: if held {
                    None
                } else {
                    Some(world_test_support::tests::registrar::aspect_order(1))
                },
            },
        ),
        timestamp,
    )
}

#[test]
#[feature("safe_dispatcher")]
fn free_and_held_homes_start_with_their_knights_at_home_and_no_army_then_deploy_them_by_the_normal_path() {
    let start = world_test_support::tests::play_fixture::FIXTURE_START;
    for timestamp in array![start, start + 86040] {
        for held in array![false, true] {
            let (d, game_id) = super::aspects::setup_aspects(42);
            if held {
                attach_realm(d, game_id);
            }
            assert!(settle(d, game_id, held, timestamp));
            assert_start(d, game_id);
            assert!(!settle(d, game_id, held, timestamp));
            assert_start(d, game_id);
            attach_realm(d, game_id);
            attach_realm(d, game_id);
            assert_start(d, game_id);
            let home = interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
            let knights = realm_grant(crate::troops::troop_resource(TroopType::Knight, 0)) / RESOURCE_PRECISION;
            assert!(execute_in_game(d, game_id, super::army_activity::muster(home, 0, 0, knights), timestamp));
            assert_deployed(d, game_id, timestamp);
        }
    }
}

#[feature("safe_dispatcher")]
fn attach_realm(d: Deployment, game_id: u32) {
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
}

fn assert_start(d: Deployment, game_id: u32) {
    interact_with_state(
        d.games,
        || {
            let key = ResourceKey { game_id, entity_id: crate::entity_ids::home_for_actor(game_id, d.actor) };
            assert_eq!(crate::logic::troops::home_armies(key).len(), 0);
            let weight = crate::logic::resources::weight(key);
            let capacity: u128 = core::num::traits::Bounded::MAX;
            assert_eq!(weight.capacity, capacity);
            let knights = crate::troops::troop_resource(TroopType::Knight, 0);
            assert_eq!(crate::logic::resources::balance(key, knights), realm_grant(knights));
            assert_eq!(
                crate::logic::resources::balance(key, crate::resources::WHEAT), realm_grant(crate::resources::WHEAT),
            );
            assert_eq!(
                crate::logic::resources::balance(key, crate::resources::LABOR), realm_grant(crate::resources::LABOR),
            );
            assert_eq!(crate::logic::resources::balance(key, crate::resources::ESSENCE), 0);
        },
    )
}

fn assert_deployed(d: Deployment, game_id: u32, timestamp: u64) {
    interact_with_state(
        d.games,
        || {
            let home = crate::entity_ids::home_for_actor(game_id, d.actor);
            let key = ResourceKey { game_id, entity_id: home };
            let rules = crate::logic::game::rules(game_id);
            let game = crate::logic::game::game(game_id);
            let at = core::cmp::max(timestamp, game.start_main_at);
            let day = crate::days::day_of(game, rules.day_unit_seconds, at).index;
            let origin = crate::expeditions::site(
                crate::logic::settlement::rules(game_id).spacing, crate::entity_ids::namespace(home), day, 0,
            );
            let armies = crate::logic::troops::home_armies(key);
            assert_eq!(armies.len(), 1);
            let knights = crate::troops::troop_resource(TroopType::Knight, 0);
            let starting_knights = realm_grant(knights);
            let deploy_wheat = (starting_knights / RESOURCE_PRECISION)
                * simple_input_cost(knights, crate::resources::WHEAT);
            assert_eq!(crate::logic::resources::balance(key, knights), 0);
            assert_eq!(
                crate::logic::resources::balance(key, crate::resources::WHEAT),
                realm_grant(crate::resources::WHEAT) - deploy_wheat,
            );
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, day)), 1);
            let explorer = ExplorerKey { game_id, explorer_id: *armies.at(0) };
            let army = crate::logic::troops::explorer(explorer).unwrap();
            let bar = crate::logic::army_slot_storage::read(
                ArmySlotKey { game_id, structure_id: home, epoch: day, slot: 0 },
            )
                .unwrap();
            assert_eq!(army.owner, home);
            assert_eq!(army.troops.category, TroopType::Knight);
            assert_eq!(army.troops.tier, TroopTier::T1);
            assert_eq!(army.troops.count, starting_knights);
            assert_eq!(army.troops.stamina, StaminaSource::Slot(0));
            assert_eq!(crate::logic::army_days::require(explorer), day);
            assert_eq!(army.coord, crate::geometry::neighbor(origin, 0));
            assert_eq!(bar.explorer_id, *armies.at(0));
            assert_eq!(
                bar.stamina.amount,
                crate::progression::stamina_max(Default::default(), TroopType::Knight, rules.troop_stamina_config),
            );
        },
    )
}
