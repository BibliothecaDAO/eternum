use snforge_std::{interact_with_state, spy_events};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::registrar::{CreateGameParams, IRegistrarDispatcherTrait, params, registry};
use world_test_support::tests::resource_commands::{execute_in_game, set_explorer_fixture};
use world_test_support::tests::{Deployment, GUARDIAN, deploy_player};
use crate::commands::{Command, CreateExplorer};
use crate::troops::{ArmySlotKey, ExplorerKey, ExplorerTroops};

pub fn found(d: Deployment, game_id: u32, aspect: u8) -> u64 {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(aspect) }),
            360,
        ),
    );
    interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor))
}

pub fn player(d: Deployment, salt: felt252) -> Deployment {
    let (actor, account_class) = deploy_player(salt, GUARDIAN);
    Deployment { actor, account_class, ..d }
}

pub fn muster(home: u64, slot: u8, direction: u8, count: u128) -> Command {
    Command::CreateExplorer(
        CreateExplorer {
            structure_id: home, slot, direction, category: 0, tier: 0, amount: count * crate::rules::RESOURCE_PRECISION,
        },
    )
}

fn active(d: Deployment, game_id: u32, aspect: u8, day: u64) -> u32 {
    interact_with_state(d.games, || crate::state::read().troops.aspect_activity.read((game_id, aspect, day)))
}

pub fn slot_army(d: Deployment, key: ArmySlotKey) -> u64 {
    interact_with_state(d.games, || crate::logic::army_slot_storage::read(key).unwrap().explorer_id)
}

#[test]
fn activity_counts_a_home_once_across_slot_choice_refusal_removal_and_reuse() {
    let (d, game_id) = super::aspects::setup_aspects(71);
    let home = found(d, game_id, 1);
    assert_eq!(active(d, game_id, 1, 0), 1);
    assert!(
        execute_in_game(
            d,
            game_id,
            world_test_support::tests::building_commands::create(
                crate::resources::ResourceKey { game_id, entity_id: home }, crate::research::BARRACKS,
            ),
            360,
        ),
    );
    assert!(execute_in_game(d, game_id, muster(home, 2, 2, 1), 480));
    let key = ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 2 };
    let first = slot_army(d, key);
    assert_eq!(active(d, game_id, 1, 0), 1);
    assert!(!execute_in_game(d, game_id, muster(home, 2, 3, 1), 481));
    assert_eq!(slot_army(d, key), first);
    assert_eq!(active(d, game_id, 1, 0), 1);
    assert!(
        execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(first)), 482,
        ),
    );
    assert!(execute_in_game(d, game_id, muster(home, 2, 2, 1), 483));
    let replacement = slot_army(d, key);
    assert_ne!(replacement, first);
    let starting = slot_army(d, ArmySlotKey { slot: 0, ..key });
    assert!(
        execute_in_game(
            d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(starting)), 484,
        ),
    );
    assert!(execute_in_game(d, game_id, muster(home, 0, 0, 1), 484));
    assert_eq!(active(d, game_id, 1, 0), 1);

    let tomorrow = interact_with_state(
        d.games,
        || {
            let context = crate::tests::context(d.games, game_id);
            crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, 360).end
        },
    );
    assert!(execute_in_game(d, game_id, muster(home, 0, 0, 1), tomorrow));
    assert_eq!(active(d, game_id, 1, 0), 1);
    assert_eq!(active(d, game_id, 1, 1), 1);
    assert!(
        interact_with_state(
            d.games, || {
                crate::logic::troops::explorer(ExplorerKey { game_id, explorer_id: replacement })
            },
        )
            .is_none(),
    );
}

#[test]
fn activity_separates_homes_aspects_and_games() {
    let (d, game_id) = super::aspects::setup_aspects(72);
    for (salt, aspect, expected) in array![(7201, 1_u8, 1_u32), (7202, 1, 2), (7203, 2, 1)] {
        let member = player(d, salt);
        found(member, game_id, aspect);
        assert_eq!(active(d, game_id, aspect, 0), expected);
    }
    assert_eq!(active(d, game_id, 1, 0), 2);
    assert_eq!(active(d, game_id, 2, 0), 1);
    assert_eq!(active(d, game_id, 3, 0), 0);
    snforge_std::start_cheat_caller_address(d.games, world_test_support::tests::authority());
    let other_game = registry(d)
        .create_game(
            CreateGameParams {
                name: 'activity other',
                start_main_at: 360,
                duration_seconds: 288000,
                end_grace_seconds: 0,
                seed: 73,
                ..params(false),
            },
        );
    snforge_std::stop_cheat_caller_address(d.games);
    found(d, other_game, 1);
    assert_eq!(active(d, other_game, 1, 0), 1);
    assert_eq!(active(d, game_id, 1, 0), 2);
}

pub fn army(d: Deployment, key: ExplorerKey) -> ExplorerTroops {
    interact_with_state(d.games, || crate::logic::troops::explorer(key).unwrap())
}

fn attack(attacker: u64, defender: u64) -> Command {
    Command::Battle(
        crate::combat_actions::AttackExplorer {
            attacker_id: attacker, defender_id: defender, steal_resources: array![].span(),
        },
    )
}

pub fn refused(d: Deployment, game_id: u32, command: Command, reason: ByteArray) {
    let mut events = spy_events();
    assert!(!execute_in_game(d, game_id, command, 365));
    assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, reason);
}

#[test]
fn frontier_attacks_refuse_allies_and_personal_maps_but_allow_rivals_in_the_deep() {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("frontier");
    preset.rules.command_mask = preset.rules.command_mask | 4;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    let (d, game_id) = super::aspects::setup_aspect_preset(74, preset);
    let ally = player(d, 7401);
    let rival = player(d, 7402);
    let home = found(d, game_id, 1);
    let ally_home = found(ally, game_id, 1);
    let rival_home = found(rival, game_id, 2);
    let attacker = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 }),
    };
    let friend = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: ally_home, epoch: 0, slot: 0 }),
    };
    let enemy = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: rival_home, epoch: 0, slot: 0 }),
    };
    let reserve = slot_army(d, ArmySlotKey { game_id, structure_id: rival_home, epoch: 0, slot: 1 });
    assert!(
        execute_in_game(
            rival,
            game_id,
            Command::ManageTroops(
                crate::troop_management::ManageTroops::Transfer(
                    crate::troop_management::TransferTroops {
                        source: crate::troop_management::Army::Explorer(enemy.explorer_id),
                        target: crate::troop_management::Army::Explorer(reserve),
                        amount: 1499 * crate::rules::RESOURCE_PRECISION,
                    },
                ),
            ),
            360,
        ),
    );
    refused(d, game_id, attack(attacker.explorer_id, enemy.explorer_id), "army combat requires Deep");
    let center = crate::deep::center(preset.settlement.spacing);
    set_explorer_fixture(d.games, attacker, ExplorerTroops { coord: center, ..army(d, attacker) });
    set_explorer_fixture(
        d.games, friend, ExplorerTroops { coord: crate::geometry::neighbor(center, 0), ..army(d, friend) },
    );
    set_explorer_fixture(
        d.games, enemy, ExplorerTroops { coord: crate::geometry::neighbor(center, 1), ..army(d, enemy) },
    );
    let before_attacker = army(d, attacker);
    let before_friend = army(d, friend);
    refused(d, game_id, attack(attacker.explorer_id, friend.explorer_id), "cannot attack an allied army");
    assert_eq!(army(d, attacker), before_attacker);
    assert_eq!(army(d, friend), before_friend);
    assert!(execute_in_game(d, game_id, attack(attacker.explorer_id, enemy.explorer_id), 365));
    assert!(army(d, attacker).troops.count > 0);
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(enemy)).is_none());
}
