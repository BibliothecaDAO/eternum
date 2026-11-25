use snforge_std::{interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::FIXTURE_START;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;
use crate::troops::ExplorerKey;
use super::army_activity::{army, player};
use super::deep_sites::{applied, deployed, held, seize, site};

fn finish_height() -> u32 {
    crate::balance::race::RACE_RULES.stage_height * crate::race::STAGE_COUNT.into()
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
    let (d, game_id) = setup(98);
    let rules = crate::logic::deep_sites::rules();
    let mut guards = array![];
    let mut homes = array![];
    let mut counts = array![];
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let member = player(d, 9800 + kind.into());
        let key = deployed(member, game_id, 1, 1500);
        seize(member, key, site(d, game_id, kind), 0);
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
    let finish = (FIXTURE_START / interval + 5) * interval;
    interact_with_state(
        d.games,
        || crate::state::write()
            .season
            .aspect_heights
            .write((game_id, 1), finish_height() - 5 * held_pay(game_id, crate::rules::DEEP_FOUNDATION, 1)),
    );
    let key = *guards.at(0);
    for now in array![finish + interval * 3, finish + interval * 4] {
        let mut events = spy_events();
        assert!(!execute_in_game(player(d, 9800), game_id, move_guard(key), now));
        assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, "game ended");
        assert_eq!(balance(d, mine, crate::resources::LABOR) - before, 5 * rules.mine_per_tick);
        assert_eq!(balance(d, core, crate::resources::ESSENCE) - essence_before, 5 * rules.core_per_tick);
        for index in 0..guards.len() {
            assert_eq!(army(d, *guards.at(index)).troops.count, *counts.at(index) - 5 * rules.loss_per_tick);
        }
        interact_with_state(
            d.games,
            || {
                assert_eq!(crate::logic::game::game(game_id).end_at, finish);
                assert_eq!(crate::logic::game::game(game_id).scheduled_end_at, context.game.unbox().scheduled_end_at);
                assert_eq!(crate::state::read().deep.paid_tick.read(game_id), Some(finish / interval));
                assert_eq!(
                    crate::logic::race::hyperstructure(crate::race::AspectKey { game_id, aspect: 1 }).height,
                    finish_height(),
                );
                for kind in array![crate::rules::DEEP_FOUNDATION, crate::rules::DEEP_ALTAR] {
                    let paid: u128 = (5 * held_pay(game_id, kind, 1)).into();
                    assert_eq!(crate::logic::race::member(*homes.at(kind.into())).glory, paid * RESOURCE_PRECISION);
                }
                assert_eq!(
                    crate::state::read().banes.altar_bars.read((game_id, 1)),
                    5 * held_pay(game_id, crate::rules::DEEP_ALTAR, 1),
                );
            },
        );
    }
}

fn held_pay(game_id: u32, kind: u8, rings_open: u8) -> u32 {
    let mut open = 0_u8;
    for index in 0..crate::logic::deep_sites::site_count() {
        let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
        let row = crate::logic::deep_sites::site(key).unwrap();
        if row.kind == kind && row.ring < rings_open {
            open += 1;
        }
    }
    let pay = crate::logic::deep_sites::rules().building_pay;
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
    for rings_open in 1_u8..crate::logic::deep_sites::rules().ring_count + 1 {
        let (d, game_id) = setup(99);
        let guard = deployed(d, game_id, 1, 1500);
        seize(d, guard, site(d, game_id, crate::rules::DEEP_FOUNDATION), 0);
        let realms = core::cmp::max(1, crate::logic::deep_sites::ring(rings_open - 1).realms);
        interact_with_state(d.games, || crate::state::write().deep.realms_entered.write((game_id, 0), realms));
        let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
        let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
        let boundary = (FIXTURE_START / interval + 1) * interval;
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
    let (d, game_id) = setup(5);
    let key = deployed(d, game_id, 1, 300);
    let home = ResourceKey { game_id, entity_id: army(d, key).owner };
    seize(d, key, site(d, game_id, crate::rules::DEEP_ALTAR), 0);
    let pay = interact_with_state(
        d.games,
        || {
            let pay = held_pay(game_id, crate::rules::DEEP_ALTAR, 1);
            let threshold = crate::logic::deep_sites::rules().altar_threshold;
            crate::state::write().banes.altar_bars.write((game_id, 1), threshold - pay);
            pay
        },
    );
    let glory: u128 = pay.into() * RESOURCE_PRECISION;
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    super::banes::given_world_bane(d, game_id, 1, crate::banes::ASH_FALL);
    applied(
        d,
        game_id,
        Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'late altar' }),
        tomorrow,
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::race::member(home).glory, glory);
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
            assert_eq!(crate::logic::race::member(home).glory, glory);
        },
    );
}

fn setup(seed: felt252) -> (Deployment, u32) {
    super::aspects::setup_aspects(seed)
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
    let rules = crate::logic::deep_sites::rules();
    for index in 0_u8..4 {
        let member = player(d, 9500 + index.into());
        let key = deployed(member, game_id, 1, (Into::<u8, u128>::into(index) + 2) * 200);
        let home = ResourceKey { game_id, entity_id: army(d, key).owner };
        seize(member, key, target, index);
        stop_passive_labor(d, home);
        balances.append(balance(d, home, crate::resources::LABOR));
        guards.append(key);
        homes.append(home);
    }
    let visitor = player(d, 9599);
    let mover = deployed(visitor, game_id, 2, 1000);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (FIXTURE_START / interval + 1) * interval;
    advance(visitor, mover, 3, boundary);
    advance(visitor, mover, 0, boundary + 1);
    for index in 0_u32..4 {
        assert_eq!(
            balance(d, *homes.at(index), crate::resources::LABOR) - *balances.at(index),
            (Into::<u32, u128>::into(index) + 1) * rules.mine_per_tick / 10,
        );
        assert_eq!(
            army(d, *guards.at(index)).troops.count,
            (Into::<u32, u128>::into(index) + 2) * 200 * RESOURCE_PRECISION - rules.loss_per_tick,
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
    let rules = crate::logic::deep_sites::rules();
    let guard = deployed(d, game_id, 1, 500);
    let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
    seize(d, guard, target, 0);
    stop_passive_labor(d, home);
    let labor_before = balance(d, home, crate::resources::LABOR);
    let visitor = player(d, 9699);
    let mover = deployed(visitor, game_id, 2, 1000);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (FIXTURE_START / interval + 3) * interval;
    advance(visitor, mover, 3, boundary);
    assert!(held(d, guard).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(guard)).is_none());
    assert_eq!(balance(d, home, crate::resources::LABOR) - labor_before, 2 * rules.mine_per_tick);
    advance(visitor, mover, 0, boundary + interval);
    assert_eq!(balance(d, home, crate::resources::LABOR) - labor_before, 2 * rules.mine_per_tick);
    assert_eq!(
        interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)),
        Some(boundary / interval + 1),
    );
}


#[test]
fn a_refused_guard_move_keeps_the_tick_paid_and_cannot_pay_it_twice() {
    let (d, game_id) = setup(97);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let rules = crate::logic::deep_sites::rules();
    let guard = deployed(d, game_id, 1, 1500);
    let home = ResourceKey { game_id, entity_id: army(d, guard).owner };
    seize(d, guard, target, 0);
    stop_passive_labor(d, home);
    let labor_before = balance(d, home, crate::resources::LABOR);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (FIXTURE_START / interval + 1) * interval;
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
        assert_eq!(army(d, guard).troops.count, 1500 * RESOURCE_PRECISION - rules.loss_per_tick);
        assert_eq!(balance(d, home, crate::resources::LABOR) - labor_before, rules.mine_per_tick);
        assert_eq!(
            interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id)),
            Some(boundary / interval),
        );
    }
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
    let (d, game_id) = setup(103);
    let base = crate::logic::deep_sites::rules().loss_per_tick;
    let loss: u128 = crate::oaths::VITRIOL_LOSS_PER_TICK.into();
    let loss = loss * RESOURCE_PRECISION;
    let initial = 1500 * RESOURCE_PRECISION;
    let key = deployed(d, game_id, 1, 1500);
    let choice = waiting_oath(d, key, crate::oaths::VITRIOL);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (FIXTURE_START / interval + 1) * interval;
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
    let (d, game_id) = setup(104);
    let loss: u128 = crate::oaths::VITRIOL_LOSS_PER_TICK.into();
    let loss = loss * RESOURCE_PRECISION;
    let key = deployed(d, game_id, 1, 1000);
    let choice = waiting_oath(d, key, crate::oaths::VITRIOL);
    applied(d, game_id, Command::ChooseOath(choice), FIXTURE_START);
    seize(d, key, site(d, game_id, crate::rules::DEEP_MINE), 0);
    let before = army(d, key).troops.count;
    assert!(held(d, key).is_some());
    let home = army(d, key).owner;
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (FIXTURE_START / interval + 2) * interval;
    let touch = Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'Vitriol' });
    applied(d, game_id, touch, boundary);
    assert_eq!(army(d, key).troops.count, before - 2 * loss);
    applied(d, game_id, touch, boundary);
    assert_eq!(army(d, key).troops.count, before - 2 * loss);
    assert_eq!(
        super::deep_sites::beast(d, site(d, game_id, crate::rules::DEEP_ALTAR)),
        crate::logic::deep_sites::beast(crate::rules::DEEP_ALTAR).count,
    );
}
