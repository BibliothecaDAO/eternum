use snforge_std::{interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
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
    preset.economy.race = Some(crate::race::RaceRules { stage_height, ..preset.economy.race.unwrap() });
    preset
}

fn stop_passive_labor(d: Deployment, home: ResourceKey) {
    interact_with_state(
        d.games,
        || {
            let productions = crate::state::write().resources.productions;
            let key = (home.game_id, home.entity_id, crate::resources::LABOR);
            productions.write(key, crate::resources::Production { production_rate: 0, ..productions.read(key) });
        },
    );
}

fn move_guard(key: ExplorerKey) -> Command {
    Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() })
}

#[test]
fn a_late_rejected_move_pays_all_sites_at_the_win_then_stops_before_later_ticks() {
    let (d, game_id) = super::aspects::setup_aspect_preset(98, race_preset(5));
    let mut guards = array![];
    let mut homes = array![];
    let mut counts = array![];
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let member = player(d, 9800 + kind.into());
        let key = deployed(member, game_id, 1, 11);
        let target = site(d, game_id, kind);
        beside(d, key, target, 0);
        applied(member, game_id, fight(key, target), 360);
        guards.append(key);
        counts.append(army(d, key).troops.count);
        homes.append(ResourceKey { game_id, entity_id: army(d, key).owner });
    }
    let homes = homes.span();
    let mine = *homes.at(crate::rules::DEEP_MINE.into());
    let core = *homes.at(crate::rules::DEEP_CORE.into());
    stop_passive_labor(d, mine);
    let before = balance(d, mine, crate::resources::LABOR);
    let essence_before = balance(d, core, crate::resources::ESSENCE);
    let context = crate::tests::context(d.games, game_id);
    let interval = context.rules.unbox().tick_config.armies_tick_in_seconds;
    let finish = (360 / interval + 5) * interval;
    let key = *guards.at(0);
    for now in array![finish + interval * 3, finish + interval * 4] {
        let mut events = spy_events();
        assert!(!execute_in_game(player(d, 9800), game_id, move_guard(key), now));
        assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, "game ended");
        assert_eq!(balance(d, mine, crate::resources::LABOR) - before, 5 * RESOURCE_PRECISION);
        assert_eq!(balance(d, core, crate::resources::ESSENCE) - essence_before, 5 * RESOURCE_PRECISION);
        for index in 0..guards.len() {
            assert_eq!(army(d, *guards.at(index)).troops.count, *counts.at(index) - 5 * RESOURCE_PRECISION);
        }
        interact_with_state(
            d.games,
            || {
                assert_eq!(crate::logic::game::game(game_id).end_at, finish);
                assert_eq!(crate::logic::game::game(game_id).scheduled_end_at, context.game.unbox().scheduled_end_at);
                assert_eq!(crate::state::read().deep.paid_tick.read(game_id), Some(finish / interval));
                assert_eq!(
                    crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height,
                    5 * held_pay(game_id, crate::rules::DEEP_FOUNDATION, 1),
                );
                for kind in array![crate::rules::DEEP_FOUNDATION, crate::rules::DEEP_ALTAR] {
                    let paid: u128 = (5 * held_pay(game_id, kind, 1)).into();
                    assert_eq!(crate::logic::race::member(*homes.at(kind.into())).glory, paid * RESOURCE_PRECISION);
                }
                let threshold = crate::logic::deep_sites::rules_entry(game_id).unwrap().altar_threshold.read();
                let mut bar = 0_u32;
                for _ in 0..5_u8 {
                    bar = core::cmp::min(bar + held_pay(game_id, crate::rules::DEEP_ALTAR, 1), threshold);
                    if bar == threshold {
                        bar = 0;
                    }
                }
                assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), bar);
            },
        );
    }
}

fn held_pay(game_id: u32, kind: u8, rings_open: u8) -> u32 {
    let mut open = 0_u8;
    for index in 0..crate::logic::deep_sites::site_count(game_id) {
        let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
        let row = crate::logic::deep_sites::site(key).unwrap();
        if row.kind == kind && row.ring < rings_open {
            open += 1;
        }
    }
    let pay = crate::logic::deep_sites::rules_entry(game_id).unwrap().building_pay.read();
    if open == 1 {
        pay.alone
    } else if open == 2 {
        pay.pair
    } else {
        pay.crowd
    }
}

#[test]
fn a_held_foundation_pays_alone_pair_or_crowd_by_the_foundations_open_that_day() {
    for (realms, rings_open) in array![(array![0_u32, 3, 4], 1_u8), (array![0, 2, 3], 2), (array![0, 1, 2], 3)] {
        let mut preset = race_preset(2000);
        let deep = preset.economy.deep.unwrap();
        let mut rings = array![];
        for index in 0..realms.len() {
            rings.append(crate::deep::DeepRing { realms: *realms.at(index), ..*deep.rings.at(index) });
        }
        preset.economy.deep = Some(crate::deep::DeepRules { rings: rings.span(), ..deep });
        let (d, game_id) = super::aspects::setup_aspect_preset(99, preset);
        let guard = deployed(d, game_id, 1, 11);
        let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
        beside(d, guard, target, 0);
        applied(d, game_id, fight(guard, target), 360);
        deployed(player(d, 9900), game_id, 2, 11);
        let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
        let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
        let boundary = (360 / interval + 1) * interval;
        applied(
            d,
            game_id,
            Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'tick' }),
            boundary,
        );
        interact_with_state(
            d.games,
            || {
                let expected = held_pay(game_id, crate::rules::DEEP_FOUNDATION, rings_open);
                assert_eq!(
                    crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height, expected,
                );
                assert_eq!(
                    crate::logic::race::member(home).glory, Into::<u32, u128>::into(expected) * RESOURCE_PRECISION,
                );
            },
        );
    }
}

#[test]
fn delayed_altar_ticks_preserve_the_prepared_world_day_and_issue_for_the_following_day() {
    let mut preset = race_preset(2000);
    preset.economy.deep = Some(crate::deep::DeepRules { altar_threshold: 5, ..preset.economy.deep.unwrap() });
    let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
    let key = deployed(d, game_id, 1, 3);
    let home = ResourceKey { game_id, entity_id: army(d, key).owner };
    let target = site(d, game_id, crate::rules::DEEP_ALTAR);
    beside(d, key, target, 0);
    applied(d, game_id, fight(key, target), 360);
    assert_eq!(army(d, key).troops.count, 2 * RESOURCE_PRECISION);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        world_test_support::tests::play_fixture::play(
            d.games,
            world_test_support::tests::play_fixture::TestAction {
                game_id,
                actor: d.actor,
                command: Command::SetEntityName(
                    crate::names::SetEntityName { entity_id: home.entity_id, name: 'late altar' },
                ),
            },
            super::banes::root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::race::member(home).glory, 5 * RESOURCE_PRECISION);
            assert_eq!(crate::state::read().banes.first_team_day.read(game_id), Some(1));
            assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
            assert_eq!(
                crate::logic::banes::read_effects(home, tomorrow, tomorrow + 1).windows,
                array![crate::banes::BaneWindow { kind: crate::banes::ASH_FALL, start: tomorrow, end: tomorrow + 1 }]
                    .span(),
            );
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).is_none());
            let bane = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 2 }).unwrap();
            assert_eq!((bane.source, bane.issued_day), (1, 1));
            assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 0);
        },
    );
    let next = world_test_support::tests::registrar::day_start(d, game_id, 2);
    applied(
        d,
        game_id,
        Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'after altar' }),
        next,
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 2)), Some(0));
            assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::logic::race::member(home).glory, 5 * RESOURCE_PRECISION);
        },
    );
}

fn setup(seed: felt252) -> (Deployment, u32) {
    let preset = super::deep_sites::preset();
    super::aspects::setup_aspect_preset(seed, preset)
}

fn balance(d: Deployment, home: ResourceKey, resource: u8) -> u128 {
    interact_with_state(d.games, || crate::logic::resources::balance(home, resource))
}

fn advance(d: Deployment, key: ExplorerKey, direction: u8, now: u64) {
    applied(
        d,
        key.game_id,
        Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![direction].span() }),
        now,
    );
}

#[test]
fn the_mine_pays_four_post_loss_shares_and_repeated_commands_do_not_pay_again() {
    let (d, game_id) = setup(95);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let mut guards = array![];
    let mut homes = array![];
    let mut balances = array![];
    for (index, count) in array![(0_u8, 11_u128), (1, 19), (2, 28), (3, 37)] {
        let member = player(d, 9500 + index.into());
        let key = deployed(member, game_id, 1, count);
        let home = ResourceKey { game_id, entity_id: army(d, key).owner };
        beside(d, key, target, index);
        applied(member, game_id, if index == 0 {
            fight(key, target)
        } else {
            join(d, key, target)
        }, 360);
        assert_eq!(army(d, key).troops.count, (Into::<u8, u128>::into(index) * 9 + 10) * RESOURCE_PRECISION);
        stop_passive_labor(d, home);
        balances.append(balance(d, home, crate::resources::LABOR));
        guards.append(key);
        homes.append(home);
    }
    let visitor = player(d, 9599);
    let mover = deployed(visitor, game_id, 2, 1000);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 1) * interval;
    advance(visitor, mover, 3, boundary);
    advance(visitor, mover, 0, boundary + 1);
    for index in 0_u32..4 {
        assert_eq!(
            balance(d, *homes.at(index), crate::resources::LABOR) - *balances.at(index),
            (Into::<u32, u128>::into(index) + 1) * RESOURCE_PRECISION / 10,
        );
        assert_eq!(
            army(d, *guards.at(index)).troops.count, (Into::<u32, u128>::into(index) + 1) * 9 * RESOURCE_PRECISION,
        );
    }
    assert_eq!(
        interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)), Some(boundary / interval),
    );
}

#[test]
fn a_late_move_pays_every_tick_the_guard_survives_but_not_the_one_that_kills_it() {
    let (d, game_id) = setup(96);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let guard = deployed(d, game_id, 1, 11);
    let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
    beside(d, guard, target, 0);
    applied(d, game_id, fight(guard, target), 360);
    assert_eq!(army(d, guard).troops.count, 10 * RESOURCE_PRECISION);
    stop_passive_labor(d, home);
    let labor_before = balance(d, home, crate::resources::LABOR);
    let visitor = player(d, 9699);
    let mover = deployed(visitor, game_id, 2, 1000);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 12) * interval;
    advance(visitor, mover, 3, boundary);
    assert!(held(d, guard).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(guard)).is_none());
    assert_eq!(balance(d, home, crate::resources::LABOR) - labor_before, 9 * RESOURCE_PRECISION);
    advance(visitor, mover, 0, boundary + interval);
    assert_eq!(balance(d, home, crate::resources::LABOR) - labor_before, 9 * RESOURCE_PRECISION);
    assert_eq!(
        interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)),
        Some(boundary / interval + 1),
    );
}


#[test]
fn a_refused_guard_move_keeps_the_tick_paid_and_cannot_pay_it_twice() {
    let (d, game_id) = setup(97);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let guard = deployed(d, game_id, 1, 11);
    let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
    beside(d, guard, target, 0);
    applied(d, game_id, fight(guard, target), 360);
    assert_eq!(army(d, guard).troops.count, 10 * RESOURCE_PRECISION);
    stop_passive_labor(d, home);
    let labor_before = balance(d, home, crate::resources::LABOR);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 1) * interval;
    for now in array![boundary, boundary + 1] {
        let mut events = spy_events();
        assert!(
            !execute_in_game(
                d,
                game_id,
                Command::Move(crate::commands::Move { explorer_id: guard.explorer_id, directions: array![0].span() }),
                now,
            ),
        );
        assert_eq!(
            world_test_support::tests::play_fixture::rejection(ref events, d.games).reason,
            "army is guarding a Deep site",
        );
        assert!(held(d, guard).is_some());
        assert_eq!(army(d, guard).troops.count, 9 * RESOURCE_PRECISION);
        assert_eq!(balance(d, home, crate::resources::LABOR) - labor_before, RESOURCE_PRECISION);
        assert_eq!(
            interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)),
            Some(boundary / interval),
        );
    }
}

fn vitriol_setup(seed: felt252) -> (Deployment, u32) {
    let mut preset = super::deep_sites::preset();
    let (_, current) = world_test_support::tests::preset_projection::current_definition("frontier");
    preset
        .economy
        .deep =
            Some(
                crate::deep::DeepRules {
                    loss_per_tick: current.economy.deep.unwrap().loss_per_tick, ..preset.economy.deep.unwrap(),
                },
            );
    super::aspects::setup_aspect_preset(seed, preset)
}

fn waiting_oath(d: Deployment, key: ExplorerKey, offered: u8) -> crate::oaths::ChooseOath {
    let pick = Into::<u8, u16>::into(offered)
        - 1
        + (Into::<u8, u16>::into(crate::oaths::FOX) - 1) * 16
        + (Into::<u8, u16>::into(crate::oaths::RAGE) - 1) * 256;
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::progression::require(key);
            crate::logic::progression::write(key, crate::progression::ArmyProgress { oath_pick: pick, ..progress });
        },
    );
    crate::oaths::ChooseOath { explorer_id: key.explorer_id, expected_pick: pick, oath: Some(offered), replace: None }
}

#[test]
fn choosing_and_replacing_vitriol_settles_field_ticks_under_the_previous_oath() {
    let (d, game_id) = vitriol_setup(103);
    let (_, current) = world_test_support::tests::preset_projection::current_definition("frontier");
    let base = current.economy.deep.unwrap().loss_per_tick;
    let loss: u128 = crate::oaths::VITRIOL_LOSS_PER_TICK.into();
    let loss = loss * RESOURCE_PRECISION;
    let initial = 1500 * RESOURCE_PRECISION;
    let key = deployed(d, game_id, 1, 1500);
    let choice = waiting_oath(d, key, crate::oaths::VITRIOL);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 1) * interval;
    applied(d, game_id, Command::ChooseOath(choice), boundary);
    assert_eq!(army(d, key).troops.count, initial - base);
    advance(d, key, 0, boundary + interval);
    assert_eq!(army(d, key).troops.count, initial - base - loss);
    advance(d, key, 3, boundary + interval);
    assert_eq!(army(d, key).troops.count, initial - base - loss);
    applied(d, game_id, Command::ChooseOath(waiting_oath(d, key, crate::oaths::GIANTS)), boundary + interval);
    assert_eq!(army(d, key).troops.count, initial - base - loss);
    let replacement = waiting_oath(d, key, crate::oaths::POWER);
    applied(
        d,
        game_id,
        Command::ChooseOath(
            crate::oaths::ChooseOath {
                oath: Some(crate::oaths::FOX), replace: Some(crate::oaths::VITRIOL), ..replacement,
            },
        ),
        boundary + 2 * interval,
    );
    assert_eq!(army(d, key).troops.count, initial - base - 2 * loss);
    advance(d, key, 0, boundary + 3 * interval);
    assert_eq!(army(d, key).troops.count, initial - 2 * base - 2 * loss);
}

#[test]
fn vitriol_guards_lose_the_rule_amount_per_tick_while_the_beast_is_unchanged() {
    let (d, game_id) = vitriol_setup(104);
    let loss: u128 = crate::oaths::VITRIOL_LOSS_PER_TICK.into();
    let loss = loss * RESOURCE_PRECISION;
    let key = deployed(d, game_id, 1, 1000);
    let choice = waiting_oath(d, key, crate::oaths::VITRIOL);
    applied(d, game_id, Command::ChooseOath(choice), 360);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    beside(d, key, target, 0);
    applied(d, game_id, fight(key, target), 360);
    let before = army(d, key).troops.count;
    assert!(held(d, key).is_some());
    let home = army(d, key).owner;
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (360 / interval + 2) * interval;
    let touch = Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'Vitriol' });
    applied(d, game_id, touch, boundary);
    assert_eq!(army(d, key).troops.count, before - 2 * loss);
    applied(d, game_id, touch, boundary);
    assert_eq!(army(d, key).troops.count, before - 2 * loss);
    let beast = site(d, game_id, crate::rules::DEEP_ALTAR);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::guards::guard(crate::guards::GuardKey { game_id, structure_id: beast.entity_id, slot: 0 })
                    .troops
                    .count,
                RESOURCE_PRECISION,
            );
        },
    );
}
