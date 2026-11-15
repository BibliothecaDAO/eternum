use snforge_std::{interact_with_state, spy_events};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;
use crate::troops::ExplorerKey;
use super::army_activity::{army, player};
use super::deep_sites::{applied, beside, deployed, fight, held, join, site};

fn race_preset(stage_height: u32) -> crate::presets::PresetDefinition {
    let mut preset = super::banes::deep_definition();
    preset.rules.command_mask = preset.rules.command_mask | 4;
    preset.economy.race = Some(crate::race::RaceRules {
        stage_height, ..world_test_support::tests::preset_projection::optional_race_rules()
    });
    preset.season_win_points = 0;
    preset
}

fn move_guard(key: ExplorerKey) -> Command {
    Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() })
}

#[test]
fn a_late_rejected_move_pays_all_sites_at_the_win_then_stops_before_later_ticks() {
    let (d, game_id) = super::aspects::setup_aspect_preset(98, race_preset(5));
    let mut guards = array![];
    let mut homes = array![];
    for kind in 0..crate::rules::DEEP_SITE_COUNT {
        let member = player(d, 9800 + kind.into());
        let key = deployed(member, game_id, 1, 11);
        let target = site(d, game_id, kind);
        beside(d, key, target, 0);
        applied(member, game_id, fight(key, target), 360);
        guards.append(key);
        homes.append(ResourceKey { game_id, entity_id: army(d, key).owner });
    }
    let quarry = *homes.at(crate::rules::DEEP_QUARRY.into());
    let before = balance(d, quarry, crate::resources::LABOR);
    let essence_before = balance(d, quarry, crate::resources::ESSENCE);
    let context = crate::tests::context(d.games, game_id);
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    let finish = (360 / interval + 5) * interval;
    let key = *guards.at(0);
    for now in array![finish + interval * 3, finish + interval * 4] {
        let mut events = spy_events();
        assert!(!execute_in_game(player(d, 9800), game_id, move_guard(key), now));
        assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, "game ended");
        assert_eq!(balance(d, quarry, crate::resources::LABOR) - before, 5 * RESOURCE_PRECISION);
        assert_eq!(balance(d, quarry, crate::resources::ESSENCE) - essence_before, 5 * RESOURCE_PRECISION);
        for guard in guards.span() {
            assert_eq!(army(d, *guard).troops.count, 5 * RESOURCE_PRECISION);
        }
        interact_with_state(d.games, || {
            assert_eq!(crate::logic::game::game(game_id).end_at, finish);
            assert_eq!(crate::logic::game::game(game_id).scheduled_end_at, context.game.unbox().scheduled_end_at);
            assert_eq!(crate::state::read().deep.paid_tick.read(game_id), Some(finish / interval));
            assert_eq!(crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height, 25);
            for kind in array![crate::rules::DEEP_FOUNDATION, crate::rules::DEEP_ALTAR] {
                assert_eq!(crate::logic::race::member(*homes.at(kind.into())).glory, 25 * RESOURCE_PRECISION);
            }
            assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 5);
        });
    }
}

#[test]
fn delayed_altar_ticks_preserve_the_prepared_world_day_and_issue_for_the_following_day() {
    let (d, game_id) = super::aspects::setup_aspect_preset(5, race_preset(2000));
    let key = deployed(d, game_id, 1, 3);
    let home = ResourceKey { game_id, entity_id: army(d, key).owner };
    let target = site(d, game_id, crate::rules::DEEP_ALTAR);
    beside(d, key, target, 0);
    applied(d, game_id, fight(key, target), 360);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(world_test_support::tests::play_fixture::play(
        d.games,
        world_test_support::tests::play_fixture::TestAction {
            game_id, actor: d.actor,
            command: Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'late altar' }),
        },
        super::banes::root_for(game_id, 1, 20, crate::banes::ASH_FALL),
        tomorrow,
    ));
    interact_with_state(d.games, || {
        assert_eq!(crate::logic::race::member(home).glory, 10 * RESOURCE_PRECISION);
        assert_eq!(crate::state::read().banes.first_team_day.read(game_id), Some(1));
        assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
        assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
        assert_eq!(crate::logic::banes::read_effects(home, tomorrow, tomorrow + 1).windows,
            array![crate::banes::BaneWindow { kind: crate::banes::ASH_FALL, start: tomorrow, end: tomorrow + 1 }].span());
        assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).is_none());
        let bane = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 2 }).unwrap();
        assert_eq!((bane.source, bane.issued_day), (1, 1));
        assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 0);
    });
    let next = world_test_support::tests::registrar::day_start(d, game_id, 2);
    applied(d, game_id, Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'after altar' }), next);
    interact_with_state(d.games, || {
        assert_eq!(crate::state::read().banes.world_days.read((game_id, 2)), Some(0));
        assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
        assert_eq!(crate::logic::race::member(home).glory, 10 * RESOURCE_PRECISION);
    });
}

fn setup(seed: felt252) -> (Deployment, u32) {
    let mut preset = super::deep_sites::preset();
    preset.economy.labor = None;
    super::aspects::setup_aspect_preset(seed, preset)
}

fn balance(d: Deployment, home: ResourceKey, resource: u8) -> u128 {
    interact_with_state(d.games, || crate::logic::resources::balance(home, resource))
}

fn advance(d: Deployment, key: ExplorerKey, direction: u8, now: u64) {
    applied(d, key.game_id, Command::Move(crate::commands::Move {
        explorer_id: key.explorer_id, directions: array![direction].span(),
    }), now);
}

#[test]
fn quarry_pays_four_pre_loss_shares_and_repeated_commands_do_not_pay_again() {
    let (d, game_id) = setup(95);
    let target = site(d, game_id, crate::rules::DEEP_QUARRY);
    let mut guards = array![];
    let mut homes = array![];
    let mut balances = array![];
    for (index, count) in array![(0_u8, 11_u128), (1, 20), (2, 30), (3, 40)] {
        let member = player(d, 9500 + index.into());
        let key = deployed(member, game_id, 1, count);
        let home = ResourceKey { game_id, entity_id: army(d, key).owner };
        beside(d, key, target, index);
        applied(member, game_id, if index == 0 { fight(key, target) } else { join(d, key, target) }, 360);
        assert_eq!(army(d, key).troops.count, (Into::<u8, u128>::into(index) + 1) * 10 * RESOURCE_PRECISION);
        balances.append((balance(d, home, crate::resources::LABOR), balance(d, home, crate::resources::ESSENCE)));
        guards.append(key);
        homes.append(home);
    }
    let visitor = player(d, 9599);
    let mover = deployed(visitor, game_id, 2, 1000);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 1) * interval;
    advance(visitor, mover, 0, boundary);
    advance(visitor, mover, 3, boundary + 1);
    for index in 0_u32..4 {
        for resource in array![crate::resources::LABOR, crate::resources::ESSENCE] {
            let (labor, essence) = *balances.at(index);
            let before = if resource == crate::resources::LABOR { labor } else { essence };
            assert_eq!(balance(d, *homes.at(index), resource) - before, (Into::<u32, u128>::into(index) + 1) * RESOURCE_PRECISION / 10);
        }
        assert_eq!(army(d, *guards.at(index)).troops.count, ((Into::<u32, u128>::into(index) + 1) * 10 - 1) * RESOURCE_PRECISION);
    }
    assert_eq!(interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)), Some(boundary / interval));
}

#[test]
fn a_late_move_pays_every_living_tick_including_the_last_then_skips_the_empty_interval() {
    let (d, game_id) = setup(96);
    let target = site(d, game_id, crate::rules::DEEP_QUARRY);
    let guard = deployed(d, game_id, 1, 11);
    let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
    beside(d, guard, target, 0);
    applied(d, game_id, fight(guard, target), 360);
    assert_eq!(army(d, guard).troops.count, 10 * RESOURCE_PRECISION);
    let labor_before = balance(d, home, crate::resources::LABOR);
    let essence_before = balance(d, home, crate::resources::ESSENCE);
    let visitor = player(d, 9699);
    let mover = deployed(visitor, game_id, 2, 1000);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 12) * interval;
    advance(visitor, mover, 0, boundary);
    assert!(held(d, guard).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(guard)).is_none());
    for resource in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        let before = if resource == crate::resources::LABOR { labor_before } else { essence_before };
        assert_eq!(balance(d, home, resource) - before, 10 * RESOURCE_PRECISION);
    }
    advance(visitor, mover, 3, boundary + interval);
    for resource in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        let before = if resource == crate::resources::LABOR { labor_before } else { essence_before };
        assert_eq!(balance(d, home, resource) - before, 10 * RESOURCE_PRECISION);
    }
    assert_eq!(interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)), Some(boundary / interval + 1));
}


#[test]
fn a_refused_guard_move_keeps_the_tick_paid_and_cannot_pay_it_twice() {
    let (d, game_id) = setup(97);
    let target = site(d, game_id, crate::rules::DEEP_QUARRY);
    let guard = deployed(d, game_id, 1, 11);
    let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
    beside(d, guard, target, 0);
    applied(d, game_id, fight(guard, target), 360);
    assert_eq!(army(d, guard).troops.count, 10 * RESOURCE_PRECISION);
    let labor_before = balance(d, home, crate::resources::LABOR);
    let essence_before = balance(d, home, crate::resources::ESSENCE);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 1) * interval;
    for now in array![boundary, boundary + 1] {
        let mut events = spy_events();
        assert!(!execute_in_game(d, game_id, Command::Move(crate::commands::Move {
            explorer_id: guard.explorer_id, directions: array![0].span(),
        }), now));
        assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, "army is guarding a Deep site");
        assert!(held(d, guard).is_some());
        assert_eq!(army(d, guard).troops.count, 9 * RESOURCE_PRECISION);
        for resource in array![crate::resources::LABOR, crate::resources::ESSENCE] {
            let before = if resource == crate::resources::LABOR { labor_before } else { essence_before };
            assert_eq!(balance(d, home, resource) - before, RESOURCE_PRECISION);
        }
        assert_eq!(interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)), Some(boundary / interval));
    }
}
