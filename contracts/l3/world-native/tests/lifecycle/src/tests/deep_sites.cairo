use snforge_std::{interact_with_state, spy_events};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::{execute_in_game, grant, set_explorer_fixture};
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::troops::{ArmySlotKey, ExplorerKey, ExplorerTroops};
use super::army_activity::{army, found, muster, player, slot_army};

fn setup(seed: felt252) -> (Deployment, u32) {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("frontier");
    preset.rules.command_mask = preset.rules.command_mask | 4;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    preset
        .economy
        .deep =
            Some(
                crate::deep::DeepRules {
                    foundation: crate::troops::Coord { alt: false, x: 10, y: 25 },
                    quarry: crate::troops::Coord { alt: false, x: 25, y: 25 },
                    altar: crate::troops::Coord { alt: false, x: 40, y: 25 },
                    beast_count: crate::rules::RESOURCE_PRECISION,
                    loss_per_tick: crate::rules::RESOURCE_PRECISION,
                    quarry_per_tick: crate::rules::RESOURCE_PRECISION,
                    altar_per_tick: 1,
                    altar_threshold: 10,
                },
            );
    super::aspects::setup_aspect_preset(seed, preset)
}

fn deployed(d: Deployment, game_id: u32, aspect: u8, count: u128) -> ExplorerKey {
    let home = found(d, game_id, aspect);
    grant(d, ResourceKey { game_id, entity_id: home }, 38, 100000 * crate::rules::RESOURCE_PRECISION);
    for _ in 0_u8..3 {
        applied(
            d,
            game_id,
            Command::Research(
                crate::research::Research { structure_id: home, row: crate::research::ROW_DEPTH, choice: 0 },
            ),
            360,
        );
    }
    applied(d, game_id, muster(home, 0, 0, count), 360);
    let key = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 }),
    };
    applied(
        d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: 3 }), 360,
    );
    key
}

fn applied(d: Deployment, game_id: u32, command: Command, now: u64) {
    let mut events = spy_events();
    if !execute_in_game(d, game_id, command, now) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

fn refused(d: Deployment, game_id: u32, command: Command, now: u64, reason: ByteArray) {
    let mut events = spy_events();
    assert!(!execute_in_game(d, game_id, command, now));
    assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, reason);
}

fn site(d: Deployment, game_id: u32, kind: u8) -> ResourceKey {
    ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::state::read().deep.site_ids.read((game_id, kind))),
    }
}

fn beside(d: Deployment, key: ExplorerKey, target: ResourceKey, direction: u8) {
    let coord = interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap());
    set_explorer_fixture(
        d.games, key, ExplorerTroops { coord: crate::geometry::neighbor(coord, direction), ..army(d, key) },
    );
}

fn fight(key: ExplorerKey, target: ResourceKey) -> Command {
    Command::BattleGuard(
        crate::commands::Battle { attacker_id: key.explorer_id, defender_id: target.entity_id, relic_slot: None },
    )
}

fn join(d: Deployment, key: ExplorerKey, target: ResourceKey) -> Command {
    Command::InteractSite(
        crate::relics::InteractSite {
            explorer_id: key.explorer_id,
            coord: interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap()),
        },
    )
}

fn held(d: Deployment, key: ExplorerKey) -> Option<crate::deep::DeepGuard> {
    interact_with_state(d.games, || crate::state::read().deep.guards.read((key.game_id, key.explorer_id)))
}

#[test]
fn distinct_homes_enter_one_deep_and_move_on_its_fixed_terrain() {
    let (d, game_id) = setup(81);
    let first = deployed(d, game_id, 1, 10);
    let second = deployed(player(d, 8101), game_id, 2, 10);
    let a = army(d, first).coord;
    let b = army(d, second).coord;
    assert_ne!(a, b);
    assert!(crate::geometry::distance(a, b) <= 1);
    let spacing = interact_with_state(d.games, || crate::logic::settlement::rules(game_id).spacing);
    assert_eq!(a, crate::deep::arrival(spacing));
    assert!(crate::deep::contains(b, spacing));
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let target = site(d, game_id, kind);
        assert!(target.entity_id != 0);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(target).unwrap().day), 0);
    }
    let mut direction = 0_u8;
    while crate::geometry::neighbor(a, direction) == b {
        direction += 1;
    }
    applied(
        d,
        game_id,
        Command::Move(crate::commands::Move { explorer_id: first.explorer_id, directions: array![direction].span() }),
        360,
    );
    assert_eq!(army(d, first).coord, crate::geometry::neighbor(a, direction));
    assert_eq!(army(d, first).troops.count, 10 * crate::rules::RESOURCE_PRECISION);
}

#[test]
fn four_allies_guard_one_site_and_a_rival_fights_exactly_one_slot_per_attack() {
    let (d, game_id) = setup(82);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let mut guards = array![];
    for slot in 0_u8..crate::rules::DEEP_GUARD_SLOTS {
        let member = player(d, 8200 + slot.into());
        let key = deployed(member, game_id, 1, 10);
        beside(d, key, target, slot);
        if slot == 0 {
            refused(member, game_id, join(d, key, target), 360, "Deep beast still guards site");
            applied(member, game_id, fight(key, target), 360);
        } else {
            applied(member, game_id, join(d, key, target), 360);
        }
        assert_eq!(held(d, key), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot }));
        let field = crate::geometry::tile_key(
            game_id,
            crate::geometry::neighbor(
                interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap()), slot,
            ),
        );
        assert!(interact_with_state(d.games, || crate::logic::map::occupancy(field)).is_none());
        refused(
            member,
            game_id,
            Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() }),
            360,
            "army is guarding a Deep site",
        );
        guards.append(key);
    }
    let fifth = player(d, 8204);
    let waiting = deployed(fifth, game_id, 1, 10);
    beside(d, waiting, target, 4);
    refused(fifth, game_id, join(d, waiting, target), 360, "Deep site has four guards");
    refused(fifth, game_id, fight(waiting, target), 360, "cannot attack an allied army");
    let rival = player(d, 8205);
    let attacker = deployed(rival, game_id, 2, 1000);
    beside(d, attacker, target, 5);
    refused(rival, game_id, join(d, attacker, target), 360, "Deep site belongs to another Aspect");
    for remaining in 0_u8..crate::rules::DEEP_GUARD_SLOTS {
        let slot = crate::rules::DEEP_GUARD_SLOTS - 1 - remaining;
        let before = army(d, *guards.at(0));
        applied(rival, game_id, fight(attacker, target), 360);
        assert!(held(d, *guards.at(slot.into())).is_none());
        for lower in 0..slot {
            assert_eq!(held(d, *guards.at(lower.into())).unwrap().slot, lower);
        }
        if slot != 0 {
            assert_eq!(army(d, *guards.at(0)), before);
            assert!(held(d, attacker).is_none());
        }
    }
    assert_eq!(held(d, attacker), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    assert!(army(d, attacker).troops.count > 0);
}

#[test]
fn exhausted_guards_release_slots_before_a_new_holder_joins() {
    let (d, game_id) = setup(83);
    let target = site(d, game_id, crate::rules::DEEP_QUARRY);
    let first = deployed(d, game_id, 1, 10);
    beside(d, first, target, 0);
    applied(d, game_id, fight(first, target), 360);
    let rival = player(d, 8301);
    let next = deployed(rival, game_id, 2, 1000);
    beside(d, next, target, 1);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let now = 360 + 10 * interval;
    applied(rival, game_id, join(d, next, target), now);
    assert!(held(d, first).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(first)).is_none());
    assert_eq!(held(d, next), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    let expected = crate::deep::troops_after_ticks(
        1000 * crate::rules::RESOURCE_PRECISION, 360 / interval, now / interval, crate::rules::RESOURCE_PRECISION,
    );
    assert_eq!(army(d, next).troops.count, expected);
}

#[test]
fn one_player_cannot_fill_two_slots_and_day_rollover_restores_every_beast() {
    let (d, game_id) = setup(84);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let first = deployed(d, game_id, 1, 10);
    let home = army(d, first).owner;
    beside(d, first, target, 0);
    applied(d, game_id, fight(first, target), 360);
    applied(d, game_id, muster(home, 1, 1, 10), 360);
    let second = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 1 }),
    };
    applied(
        d, game_id, Command::EnterDepth(crate::commands::EnterDepth { explorer_id: second.explorer_id, depth: 3 }), 360,
    );
    beside(d, second, target, 1);
    refused(d, game_id, join(d, second, target), 360, "player already guards site");
    assert!(held(d, second).is_none());

    let context = crate::tests::context(d.games, game_id);
    let tomorrow = crate::days::day_at_index(context.game.unbox(), context.rules.unbox().day_unit_seconds, 0).end;
    applied(d, game_id, muster(home, 0, 0, 100), tomorrow);
    let fresh = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 1, slot: 0 }),
    };
    applied(
        d,
        game_id,
        Command::EnterDepth(crate::commands::EnterDepth { explorer_id: fresh.explorer_id, depth: 3 }),
        tomorrow,
    );
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let current = site(d, game_id, kind);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(current).unwrap().day), 1);
        let count = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: current.entity_id, slot: 0 },
            )
                .troops
                .count,
        );
        assert_eq!(count, crate::rules::RESOURCE_PRECISION);
    }
    beside(d, fresh, target, 0);
    applied(d, game_id, fight(fresh, target), tomorrow);
    assert!(held(d, first).is_none());
    assert!(held(d, second).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(first)).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(second)).is_none());
    assert_eq!(held(d, fresh), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let current = site(d, game_id, kind);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(current).unwrap().day), 1);
        let count = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: current.entity_id, slot: 0 },
            )
                .troops
                .count,
        );
        assert_eq!(count, if kind == crate::rules::DEEP_FOUNDATION {
            0
        } else {
            crate::rules::RESOURCE_PRECISION
        });
    }
}
