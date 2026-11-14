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

fn settle(d: Deployment, game_id: u32, held: bool, timestamp: u64) -> bool {
    execute_in_game(
        d,
        game_id,
        Command::SettleSeason(SettleSeason { selected_realm: None, aspect: if held {
            None
        } else {
            Some(1)
        } }),
        timestamp,
    )
}

#[test]
#[feature("safe_dispatcher")]
fn free_and_held_homes_start_with_two_full_armies_before_or_during_the_season() {
    for timestamp in array![350_u64, 360, 86400] {
        for held in array![false, true] {
            let (d, game_id) = super::aspects::setup_aspects(42);
            if held {
                attach_realm(d, game_id);
            }
            assert!(settle(d, game_id, held, timestamp));
            let armies = assert_start(d, game_id, timestamp);
            assert!(!settle(d, game_id, held, timestamp));
            assert_eq!(assert_start(d, game_id, timestamp), armies);
            attach_realm(d, game_id);
            attach_realm(d, game_id);
            assert_eq!(assert_start(d, game_id, timestamp), armies);
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

fn assert_start(d: Deployment, game_id: u32, timestamp: u64) -> Span<u64> {
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
            assert_eq!(armies.len(), 2);
            let weight = crate::logic::resources::weight(key);
            let capacity: u128 = core::num::traits::Bounded::MAX;
            assert_eq!(weight.capacity, capacity);
            assert_eq!(weight.weight, 0);
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, day)), 1);
            assert_eq!(crate::logic::resources::balance(key, crate::troops::troop_resource(TroopType::Knight, 0)), 0);
            assert_eq!(crate::logic::resources::balance(key, crate::resources::WHEAT), 6000 * RESOURCE_PRECISION);
            assert_eq!(crate::logic::resources::balance(key, crate::resources::LABOR), 2000 * RESOURCE_PRECISION);
            assert_eq!(crate::logic::resources::balance(key, crate::resources::ESSENCE), 0);
            for slot in 0_u8..2 {
                let id = *armies.at(slot.into());
                let explorer = ExplorerKey { game_id, explorer_id: id };
                let army = crate::logic::troops::explorer(explorer).unwrap();
                let bar = crate::logic::army_slot_storage::read(
                    ArmySlotKey { game_id, structure_id: home, epoch: day, slot },
                )
                    .unwrap();
                assert_eq!(army.owner, home);
                assert_eq!(army.troops.category, TroopType::Knight);
                assert_eq!(army.troops.tier, TroopTier::T1);
                assert_eq!(army.troops.count, 1500 * RESOURCE_PRECISION);
                assert_eq!(army.troops.stamina, StaminaSource::Slot(slot));
                assert_eq!(crate::logic::army_days::require(explorer), day);
                assert_eq!(army.coord, crate::geometry::neighbor(origin, slot));
                assert_eq!(bar.explorer_id, id);
                assert_eq!(
                    bar.stamina.amount,
                    crate::progression::stamina_max(
                        crate::progression::initial(), TroopType::Knight, rules.troop_stamina_config,
                    ),
                );
            }
            armies
        },
    )
}
