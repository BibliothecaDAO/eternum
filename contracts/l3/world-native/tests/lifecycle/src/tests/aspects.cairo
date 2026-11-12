use snforge_std::{interact_with_state, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::registrar::{CreateGameParams, IRegistrarDispatcherTrait, params, registry, setup};
use world_test_support::tests::{Deployment, authority};
use crate::commands::Command;
use crate::realms::{ISeasonRealmsDispatcher, ISeasonRealmsDispatcherTrait, SettleSeason};
use crate::resources::ResourceKey;
use crate::stamina::StaminaSourceTrait;

fn setup_aspects() -> (Deployment, u32) {
    let d = setup();
    world_test_support::tests::entry::set_operator(d, authority());
    let (_, preset) = world_test_support::tests::preset_projection::current_definition("season-one");
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams { start_main_at: 360, duration_seconds: 288000, end_grace_seconds: 0, ..params(false) },
        );
    let mut traits = array![];
    for index in 0_u32..8000 {
        traits.append(0x4000001 + (index % 16) * 0x400000);
    }
    start_cheat_caller_address(d.games, authority());
    ISeasonRealmsDispatcher { contract_address: d.games }.initialize_realm_traits(1, traits.span());
    stop_cheat_caller_address(d.games);
    (d, game_id)
}

fn settle(d: Deployment, game_id: u32, aspect: Option<u8>) -> bool {
    world_test_support::tests::resource_commands::execute_in_game(
        d, game_id, Command::SettleSeason(SettleSeason { selected_realm: None, aspect }), 360,
    )
}

#[test]
fn all_four_free_choices_draw_their_orders_and_join_once() {
    let (d, game_id) = setup_aspects();
    for aspect in 1_u8..5 {
        let player = Deployment { actor: (1000 + Into::<u8, felt252>::into(aspect)).try_into().unwrap(), ..d };
        assert!(settle(player, game_id, Some(aspect)));
        interact_with_state(
            d.games,
            || {
                let home = crate::entity_ids::home_for_actor(game_id, player.actor);
                let key = ResourceKey { game_id, entity_id: home };
                let record = crate::logic::structures::record(key);
                let orders = crate::logic::aspects::rules(game_id).unwrap();
                assert_eq!(crate::aspects::order_aspect(orders, record.metadata.order), aspect);
                assert_eq!(crate::logic::aspects::home_aspect(key), aspect);
                assert_eq!(crate::state::read().settlements.aspect_members.read((game_id, aspect)), 1);
                assert_eq!((record.metadata.realm_id - 1) % 16 + 1, record.metadata.order.into());
            },
        );
        assert!(!settle(player, game_id, Some(aspect)));
        assert!(!settle(player, game_id, Some(if aspect == 4 {
            1
        } else {
            aspect + 1
        })));
        interact_with_state(
            d.games, || {
                assert_eq!(crate::state::read().settlements.aspect_members.read((game_id, aspect)), 1);
            },
        );
    }
}

#[test]
fn free_home_requires_a_valid_choice_and_a_failed_choice_reserves_nothing() {
    let (d, game_id) = setup_aspects();
    assert!(!settle(d, game_id, None));
    assert!(!settle(d, game_id, Some(0)));
    assert!(!settle(d, game_id, Some(5)));
    assert!(settle(d, game_id, Some(2)));
    interact_with_state(
        d.games, || {
            assert_eq!(crate::state::read().settlements.aspect_members.read((game_id, 2)), 1);
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn held_realm_inherits_its_order_and_refuses_a_different_aspect() {
    use world_test_support::tests::entry::{EntryEntitlement, EntryKey, ISettlementEntrySafeDispatcherTrait, ledger};
    let (d, game_id) = setup_aspects();
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
    assert!(!settle(d, game_id, Some(2)));
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
    let (_, preset) = world_test_support::tests::preset_projection::current_definition("season-one");
    let packed = crate::aspects::pack(preset.settlement.order_aspects).unwrap();
    for index in 0..16 {
        assert_eq!(
            crate::aspects::order_aspect(packed, (index + 1).try_into().unwrap()),
            *preset.settlement.order_aspects.at(index),
        );
    }
    assert_eq!(crate::aspects::order_aspect(packed, 12), 1);
    assert_eq!(crate::aspects::order_aspect(packed, 16), 2);
    assert_eq!(crate::aspects::order_aspect(packed, 14), 3);
    assert_eq!(crate::aspects::order_aspect(packed, 4), 4);
}

#[test]
fn settlement_fields_two_knight_armies_without_spending_the_starting_wheat() {
    let (d, game_id) = setup_aspects();
    assert!(settle(d, game_id, Some(1)));
    assert!(!settle(d, game_id, Some(1)));
    interact_with_state(
        d.games,
        || {
            let home = ResourceKey { game_id, entity_id: crate::entity_ids::home_for_actor(game_id, d.actor) };
            let armies = crate::logic::troops::home_armies(home);
            assert_eq!(armies.len(), 2);
            let first = crate::logic::troops::explorer(
                crate::troops::ExplorerKey { game_id, explorer_id: *armies.at(0) },
            )
                .unwrap();
            let second = crate::logic::troops::explorer(
                crate::troops::ExplorerKey { game_id, explorer_id: *armies.at(1) },
            )
                .unwrap();
            assert_eq!(first.owner, home.entity_id);
            assert_eq!(second.owner, home.entity_id);
            assert!(first.coord != second.coord);
            for id in armies {
                let army = crate::logic::troops::explorer(crate::troops::ExplorerKey { game_id, explorer_id: *id })
                    .unwrap();
                assert_eq!(army.troops.category, crate::troops::TroopType::Knight);
                assert_eq!(army.troops.tier, crate::troops::TroopTier::T1);
                assert_eq!(army.troops.count, 1500 * crate::rules::RESOURCE_PRECISION);
            }
            assert_eq!(first.troops.stamina, crate::troops::StaminaSource::Slot(0));
            assert_eq!(second.troops.stamina, crate::troops::StaminaSource::Slot(1));
            assert_eq!(
                crate::logic::resources::balance(home, crate::resources::WHEAT),
                6000 * crate::rules::RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(home, crate::resources::LABOR),
                2000 * crate::rules::RESOURCE_PRECISION,
            );
            assert_eq!(crate::logic::resources::balance(home, crate::resources::ESSENCE), 0);
            assert_eq!(
                crate::logic::resources::balance(
                    home, crate::troops::stock_resource(crate::troops::TroopType::Knight, crate::troops::TroopTier::T1),
                ),
                0,
            );
        },
    );
}

#[test]
fn a_home_settled_before_opening_has_both_armies_on_the_first_day() {
    let (d, game_id) = setup_aspects();
    assert!(
        world_test_support::tests::resource_commands::execute_in_game(
            d, game_id, Command::SettleSeason(SettleSeason { selected_realm: None, aspect: Some(1) }), 200,
        ),
    );
    interact_with_state(
        d.games,
        || {
            let home = ResourceKey { game_id, entity_id: crate::entity_ids::home_for_actor(game_id, d.actor) };
            let armies = crate::logic::troops::home_armies(home);
            assert_eq!(armies.len(), 2);
            let context = crate::commands::load_context(game_id, 0, 360);
            for id in armies {
                let army = crate::logic::troops::active_explorer(
                    crate::troops::ExplorerKey { game_id, explorer_id: *id }, 360, context,
                );
                assert_eq!(army.troops.count, 1500 * crate::rules::RESOURCE_PRECISION);
                assert_eq!(army.troops.stamina.inline().amount, 120);
            }
        },
    );
}
