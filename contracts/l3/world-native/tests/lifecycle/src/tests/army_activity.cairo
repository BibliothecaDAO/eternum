use snforge_std::{interact_with_state, spy_events};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::play_fixture::{FIXTURE_START, create_game, fixture_params};
use world_test_support::tests::registrar::CreateGameParams;
use world_test_support::tests::resource_commands::{execute_in_game, set_explorer_fixture};
use world_test_support::tests::{Deployment, GUARDIAN, deploy_player};
use crate::commands::{Command, CreateExplorer};
use crate::troops::{ArmySlotKey, ExplorerKey, ExplorerTroops};

pub fn found(d: Deployment, game_id: u32, aspect: u8) -> u64 {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(
                crate::realms::SettleSeason {
                    selected_realm: None, order: Some(world_test_support::tests::registrar::aspect_order(aspect)),
                },
            ),
            FIXTURE_START,
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
            FIXTURE_START,
        ),
    );
    assert!(execute_in_game(d, game_id, muster(home, 2, 2, 1), FIXTURE_START + 120));
    let key = ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 2 };
    let first = slot_army(d, key);
    assert_eq!(active(d, game_id, 1, 0), 1);
    assert!(!execute_in_game(d, game_id, muster(home, 2, 3, 1), FIXTURE_START + 121));
    assert_eq!(slot_army(d, key), first);
    assert_eq!(active(d, game_id, 1, 0), 1);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(first)),
            FIXTURE_START + 122,
        ),
    );
    assert!(execute_in_game(d, game_id, muster(home, 2, 2, 1), FIXTURE_START + 123));
    let replacement = slot_army(d, key);
    assert_ne!(replacement, first);
    let starting = slot_army(d, ArmySlotKey { slot: 0, ..key });
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(starting)),
            FIXTURE_START + 124,
        ),
    );
    assert!(execute_in_game(d, game_id, muster(home, 0, 0, 1), FIXTURE_START + 124));
    assert_eq!(active(d, game_id, 1, 0), 1);

    let tomorrow = interact_with_state(
        d.games,
        || {
            let context = crate::tests::context(d.games, game_id);
            crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, FIXTURE_START).end
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
    let other_game = create_game(d.games, CreateGameParams { seed: 73, ..fixture_params('activity other') });
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
    assert!(!execute_in_game(d, game_id, command, FIXTURE_START + 5));
    assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, reason);
}

#[test]
fn frontier_attacks_refuse_allies_and_personal_maps_but_allow_rivals_in_the_deep() {
    let (d, game_id) = super::aspects::setup_aspects(74);
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
            FIXTURE_START,
        ),
    );
    refused(d, game_id, attack(attacker.explorer_id, enemy.explorer_id), "army combat requires Deep");
    super::deep_sites::descend(d, attacker, FIXTURE_START);
    super::deep_sites::descend(ally, friend, FIXTURE_START);
    super::deep_sites::descend(rival, enemy, FIXTURE_START);
    let center = crate::deep::center(crate::balance::settlement::SETTLEMENT_SPACING_STEPS);
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
    assert!(execute_in_game(d, game_id, attack(attacker.explorer_id, enemy.explorer_id), FIXTURE_START + 5));
    assert!(army(d, attacker).troops.count > 0);
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(enemy)).is_none());
}


fn combat_at(d: Deployment, key: ExplorerKey) -> crate::combat::ArmyCombat {
    interact_with_state(d.games, || crate::logic::army_combat::read(key).unwrap())
}


#[test]
fn successful_attacks_record_their_target_and_refusals_preserve_it() {
    let (d, game_id) = super::aspects::setup_aspects(82);
    let rival = player(d, 8201);
    let home = crate::resources::ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    let rival_home = found(rival, game_id, 2);
    super::deep_sites::applied(
        d,
        game_id,
        world_test_support::tests::building_commands::create(home, crate::research::BARRACKS),
        FIXTURE_START,
    );
    world_test_support::tests::resource_commands::grant(d, home, 26, 1000 * crate::rules::RESOURCE_PRECISION);
    super::deep_sites::applied(d, game_id, muster(home.entity_id, 2, 5, 1000), FIXTURE_START);
    let attacker = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 0, slot: 2 }),
    };
    let enemy = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: rival_home, epoch: 0, slot: 0 }),
    };
    let other = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: rival_home, epoch: 0, slot: 1 }),
    };
    super::deep_sites::applied(
        rival,
        game_id,
        Command::ManageTroops(
            crate::troop_management::ManageTroops::Transfer(
                crate::troop_management::TransferTroops {
                    source: crate::troop_management::Army::Explorer(enemy.explorer_id),
                    target: crate::troop_management::Army::Explorer(other.explorer_id),
                    amount: 500 * crate::rules::RESOURCE_PRECISION,
                },
            ),
        ),
        FIXTURE_START,
    );
    super::deep_sites::descend(d, attacker, FIXTURE_START);
    super::deep_sites::descend(rival, enemy, FIXTURE_START);
    super::deep_sites::descend(rival, other, FIXTURE_START);
    let center = crate::deep::center(crate::balance::settlement::SETTLEMENT_SPACING_STEPS);
    let center = crate::troops::Coord { y: center.y - 2, ..center };
    set_explorer_fixture(d.games, attacker, ExplorerTroops { coord: center, ..army(d, attacker) });
    set_explorer_fixture(
        d.games, enemy, ExplorerTroops { coord: crate::geometry::neighbor(center, 0), ..army(d, enemy) },
    );
    set_explorer_fixture(
        d.games, other, ExplorerTroops { coord: crate::troops::Coord { x: center.x + 2, ..center }, ..army(d, other) },
    );
    super::deep_sites::applied(d, game_id, attack(attacker.explorer_id, enemy.explorer_id), FIXTURE_START + 5);
    assert_eq!(combat_at(d, attacker), crate::combat::ArmyCombat { last_target: enemy.explorer_id });
    assert_eq!(army(d, attacker).troops.count, 563 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(army(d, enemy).troops.count, 563 * crate::rules::RESOURCE_PRECISION);
    let before = army(d, attacker);
    assert!(!execute_in_game(d, game_id, attack(attacker.explorer_id, other.explorer_id), FIXTURE_START + 5));
    assert_eq!(army(d, attacker), before);
    assert_eq!(combat_at(d, attacker).last_target, enemy.explorer_id);
    super::deep_sites::applied(d, game_id, attack(attacker.explorer_id, enemy.explorer_id), FIXTURE_START + 5);
    assert_eq!(combat_at(d, attacker).last_target, enemy.explorer_id);
    assert_eq!(army(d, attacker).troops.count, 287 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(army(d, enemy).troops.count, 287 * crate::rules::RESOURCE_PRECISION);
    set_explorer_fixture(
        d.games, other, ExplorerTroops { coord: crate::geometry::neighbor(center, 1), ..army(d, other) },
    );
    let rested = interact_with_state(
        d.games,
        || crate::logic::army_slot_storage::read(
            ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 0, slot: 2 },
        )
            .unwrap()
            .stamina,
    );
    let before = army(d, attacker);
    set_explorer_fixture(
        d.games,
        attacker,
        ExplorerTroops {
            troops: crate::troops::Troops {
                stamina: crate::troops::Stamina {
                    amount: 0, settled_at: (FIXTURE_START + 5).try_into().unwrap(), remainder: 0,
                }
                    .into(),
                ..before.troops,
            },
            ..before,
        },
    );
    assert!(!execute_in_game(d, game_id, attack(attacker.explorer_id, other.explorer_id), FIXTURE_START + 5));
    assert_eq!(combat_at(d, attacker).last_target, enemy.explorer_id);
    assert_eq!(army(d, attacker).troops.count, before.troops.count);
    set_explorer_fixture(
        d.games,
        attacker,
        ExplorerTroops { troops: crate::troops::Troops { stamina: rested.into(), ..before.troops }, ..before },
    );
    super::deep_sites::applied(d, game_id, attack(attacker.explorer_id, other.explorer_id), FIXTURE_START + 5);
    assert!(interact_with_state(d.games, || crate::logic::army_combat::read(attacker)).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(attacker)).is_none());
}

#[test]
fn a_dying_army_leaves_its_home_producing_and_its_other_armies_in_order() {
    let (d, game_id) = super::aspects::setup_aspects(76);
    let home = found(d, game_id, 1);
    let structure = crate::resources::ResourceKey { game_id, entity_id: home };
    let barracks = world_test_support::tests::building_commands::create(structure, crate::research::BARRACKS);
    assert!(execute_in_game(d, game_id, barracks, FIXTURE_START));
    let farm = crate::buildings::CreateBuilding {
        structure_id: home, directions: array![1_u8].span(), category: crate::research::FARM, use_simple: true,
    };
    assert!(execute_in_game(d, game_id, Command::CreateBuilding(farm), FIXTURE_START));
    assert!(execute_in_game(d, game_id, muster(home, 2, 2, 1), FIXTURE_START + 120));
    let armies = interact_with_state(d.games, || crate::logic::troops::home_armies(structure));
    assert_eq!(armies.len(), 3);
    let producing = productions(d, structure);
    let mut buildings: u8 = 0;
    for production in producing {
        buildings += *production.building_count;
    }
    assert!(buildings != 0, "the farm produces");
    let dying = ExplorerKey { game_id, explorer_id: *armies.at(1) };
    kill(d, game_id, dying);
    let survivors = interact_with_state(d.games, || crate::logic::troops::home_armies(structure));
    assert_eq!(survivors, array![*armies.at(0), *armies.at(2)].span());
    assert_eq!(productions(d, structure), producing);
    let left = interact_with_state(
        d.games,
        || {
            let state = crate::state::read();
            let mut left = array![];
            for resource_type in 1_u8..59 {
                left.append(state.resources.productions.read((game_id, dying.explorer_id, resource_type)));
            }
            left
        },
    );
    for production in left.span() {
        assert_eq!(*production, Default::default());
    }
}

fn kill(d: Deployment, game_id: u32, key: ExplorerKey) {
    let context = world_test_support::tests::context(d.games, game_id);
    interact_with_state(
        d.games,
        || {
            let army = crate::logic::army_slots::resolve(key, crate::logic::troops::explorer(key).unwrap(), None);
            let dead = ExplorerTroops { troops: crate::troops::Troops { count: 0, ..army.troops }, ..army };
            crate::troops::IBattleResolutionDispatcherTrait::finish_battle(
                crate::logic::combat::combat_troops(game_id),
                key,
                dead,
                army.troops.count,
                crate::commands::action_context(context),
            );
        },
    );
}

fn productions(d: Deployment, key: crate::resources::ResourceKey) -> Span<crate::resources::Production> {
    interact_with_state(
        d.games,
        || {
            let mut rows = array![];
            for resource_type in 1_u8..59 {
                if crate::resources::has_production(resource_type) {
                    rows.append(crate::logic::resources::production(key, resource_type));
                }
            }
            rows.span()
        },
    )
}
