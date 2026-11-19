use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::troops::ExplorerKey;
use super::army_activity::player;
use super::deep_sites::{applied, beside, deployed, fight, join};

const TICK: u64 = 120;
const START: u64 = 360;
const EMPIRE_CAP: u128 = 60000;
const SETTLEMENT_CAP: u128 = 3000;
const RINGS_OPEN: u32 = 240;
const MAX_EVENTS: u32 = 1000;
const EXECUTE_MAX_SIERRA_GAS: u128 = 1100000000;

#[derive(Copy, Drop)]
struct Shape {
    sites: u8,
    guards_per_site: u8,
    troops: u128,
    vitriol: bool,
}

#[derive(Copy, Drop)]
struct Cost {
    gas: u128,
    events: u32,
    paid_ticks: u64,
}

fn season_one_catch_up_preset(stage_height: u32) -> crate::presets::PresetDefinition {
    let (_, season) = world_test_support::tests::preset_projection::current_definition("frontier");
    let mut preset = super::deep_sites::preset();
    let rules = season.economy.deep.unwrap();
    preset
        .economy
        .deep =
            Some(
                crate::deep::DeepRules {
                    loss_per_tick: rules.loss_per_tick,
                    core_per_tick: rules.core_per_tick,
                    mine_per_tick: rules.mine_per_tick,
                    building_pay: rules.building_pay,
                    altar_threshold: rules.altar_threshold,
                    ..preset.economy.deep.unwrap(),
                },
            );
    preset.economy.race = Some(crate::race::RaceRules { stage_height, ..season.economy.race.unwrap() });
    preset.rules.day_unit_seconds = 43200;
    preset
}

fn every_site_at_the_empire_cap() -> Shape {
    Shape { sites: 20, guards_per_site: crate::rules::DEEP_GUARD_SLOTS, troops: EMPIRE_CAP, vitriol: true }
}

fn every_site_held_by_two_settlement_armies() -> Shape {
    Shape { sites: 20, guards_per_site: 2, troops: SETTLEMENT_CAP, vitriol: false }
}

fn one_guard_on_every_site() -> Shape {
    Shape { sites: 20, guards_per_site: 1, troops: EMPIRE_CAP, vitriol: true }
}

fn the_rehearsal_guard() -> Shape {
    Shape { sites: 1, guards_per_site: 1, troops: SETTLEMENT_CAP, vitriol: false }
}

fn held_deep(
    seed: felt252, stage_height: u32, shape: Shape,
) -> (Deployment, u32, Span<ExplorerKey>, Deployment, Span<u64>) {
    let (d, game_id) = super::aspects::setup_aspect_preset(seed, season_one_catch_up_preset(stage_height));
    let unit = crate::tests::context(d.games, game_id).rules.unbox().day_unit_seconds;
    let day = interact_with_state(d.games, || crate::days::day_at_index(crate::logic::game::game(game_id), unit, 0));
    assert!(day.end >= START + 600 * TICK, "the first day must hold the longest catch-up");
    assert!(shape.sites <= site_count(d, game_id), "more sites than the Deep holds");
    let first = site_at(d, game_id, 0);
    let mut holders = array![];
    let mut members = array![];
    let mut homes = array![];
    for slot in 0_u8..shape.guards_per_site {
        let member = player(d, seed * 100 + slot.into());
        let key = deployed(member, game_id, 1, 10);
        beside(d, key, first, slot);
        if slot == 0 {
            applied(member, game_id, fight(key, first), START);
        } else {
            applied(member, game_id, join(d, key, first), START);
        }
        holders.append(key);
        members.append(member);
        homes.append(super::army_activity::army(d, key).owner);
    }
    let holders = holders.span();
    let mut guards = array![];
    for index in 0..shape.sites {
        let site = site_at(d, game_id, index);
        for slot in 0_u8..shape.guards_per_site {
            let source = *holders.at(slot.into());
            let key = if index == 0 {
                source
            } else {
                ExplorerKey { game_id, explorer_id: 9000000 + index.into() * 10 + slot.into() }
            };
            seat_guard(d, source, key, site, slot, shape);
            guards.append(key);
        }
    }
    interact_with_state(d.games, || crate::state::write().deep.realms_entered.write((game_id, 0), RINGS_OPEN));
    (d, game_id, guards.span(), *members.at(0), homes.span())
}

fn site_count(d: Deployment, game_id: u32) -> u8 {
    interact_with_state(d.games, || crate::logic::deep_sites::site_count(game_id))
}

fn site_at(d: Deployment, game_id: u32, index: u8) -> ResourceKey {
    let entity_id = interact_with_state(d.games, || crate::logic::deep_sites::site_id(game_id, index));
    ResourceKey { game_id, entity_id }
}

fn seat_guard(d: Deployment, source: ExplorerKey, key: ExplorerKey, site: ResourceKey, slot: u8, shape: Shape) {
    interact_with_state(
        d.games,
        || {
            let read = crate::state::read();
            let game_id = source.game_id;
            let from = (game_id, source.explorer_id);
            let to = (game_id, key.explorer_id);
            let army = crate::logic::troops::explorer(source).unwrap();
            let army = if key == source {
                army
            } else {
                crate::logic::army_slots::resolve(source, army, None)
            };
            let weight = read.resources.weights.read(from);
            let count = shape.troops * crate::rules::RESOURCE_PRECISION;
            let capacity = weight.capacity / army.troops.count * count;
            let progress = crate::logic::progression::require(source);
            let oaths = if shape.vitriol {
                progress.oaths | crate::oaths::bit(crate::oaths::VITRIOL)
            } else {
                progress.oaths
            };
            let write = crate::state::write();
            write
                .troops
                .explorers
                .write(
                    to,
                    crate::troops::ExplorerRecordTrait::into_record(
                        crate::troops::ExplorerTroops {
                            troops: crate::troops::Troops { count, ..army.troops }, ..army,
                        },
                    ),
                );
            write.troops.army_days.write(to, read.troops.army_days.read(from));
            write.troops.combat.write(to, read.troops.combat.read(from));
            write.troops.progress.write(to, Some(crate::progression::ArmyProgress { oaths, ..progress }));
            write.resources.resource_exists.write(to, true);
            write.resources.weights.write(to, crate::resources::Weight { capacity, ..weight });
            write.deep.army_ticks.write(to, read.deep.army_ticks.read(from));
            write.deep.guards.write(to, Some(crate::deep::DeepGuard { site_id: site.entity_id, slot }));
            write.deep.slots.write((game_id, site.entity_id, slot), key.explorer_id);
            if key != source {
                let armies = read.troops.home_counts.read((game_id, army.owner));
                write.troops.home_armies.write((game_id, army.owner, armies), key.explorer_id);
                write.troops.home_counts.write((game_id, army.owner), armies + 1);
            }
        },
    );
}

#[inline(never)]
fn measured(d: Deployment, game_id: u32, command: Command, now: u64) -> Cost {
    let mut events = spy_events();
    let before = core::testing::get_available_gas();
    let accepted = execute_in_game(d, game_id, command, now);
    let gas = before - core::testing::get_available_gas();
    if !accepted {
        let refusal = world_test_support::tests::play_fixture::rejection(ref events, d.games);
        println!("deep catch-up refused: {}", refusal.reason);
    }
    let paid_ticks = interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id).unwrap());
    Cost { gas, events: events.get_events().emitted_by(d.games).events.len(), paid_ticks }
}

fn nudge(home: u64) -> Command {
    Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'nudge' })
}

#[derive(Copy, Drop)]
struct Plays {
    count: u32,
    gas: u128,
    events: u32,
}

fn paid(d: Deployment, game_id: u32) -> u64 {
    interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id).unwrap())
}

fn play_until_caught_up(owner: Deployment, game_id: u32, home: u64, now: u64) -> Plays {
    let mut plays = Plays { count: 0, gas: 0, events: 0 };
    loop {
        let before = paid(owner, game_id);
        let cost = measured(owner, game_id, nudge(home), now);
        plays =
            Plays {
                count: plays.count + 1,
                gas: core::cmp::max(plays.gas, cost.gas),
                events: core::cmp::max(plays.events, cost.events),
            };
        if cost.paid_ticks == before || cost.paid_ticks >= now / TICK {
            break;
        }
    }
    plays
}

fn catch_up(seed: felt252, shape: Shape, boundaries: u64) -> Plays {
    let (_, game_id, _, owner, homes) = held_deep(seed, 2000, shape);
    let now = START + boundaries * TICK;
    let plays = play_until_caught_up(owner, game_id, *homes.at(0), now);
    report(boundaries, shape, plays);
    assert_eq!(paid(owner, game_id), now / TICK);
    plays
}

fn report(boundaries: u64, shape: Shape, plays: Plays) {
    println!(
        "deep catch-up: {} boundaries, {} sites x {} guards of {} troops, vitriol {}: {} plays, at most {} gas and {} events a play",
        boundaries,
        shape.sites,
        shape.guards_per_site,
        shape.troops,
        shape.vitriol,
        plays.count,
        plays.gas,
        plays.events,
    );
}

fn assert_within_one_transaction(plays: Plays) {
    assert!(plays.gas < EXECUTE_MAX_SIERRA_GAS, "catch-up exceeds the execution gas limit");
    assert!(plays.events <= MAX_EVENTS, "catch-up exceeds the transaction event limit");
}

fn walked(
    seed: felt252, shape: Shape, stage_height: u32, boundaries: u64, cuts: u64,
) -> (felt252, Option<crate::race::RaceResult>) {
    let (d, game_id, guards, owner, homes) = held_deep(seed, stage_height, shape);
    for cut in 1..cuts + 1 {
        play_until_caught_up(owner, game_id, *homes.at(0), START + boundaries * cut / cuts * TICK);
    }
    (digest(d, game_id, guards, homes), interact_with_state(d.games, || crate::logic::race::result(game_id)))
}

fn digest(d: Deployment, game_id: u32, guards: Span<ExplorerKey>, homes: Span<u64>) -> felt252 {
    interact_with_state(
        d.games,
        || {
            let state = crate::state::read();
            let mut values: Array<felt252> = array![];
            for key in guards {
                let troops = crate::logic::troops::explorer(*key).map(|army| army.troops.count).unwrap_or(0);
                values.append(troops.into());
                values.append(state.deep.army_ticks.read((game_id, *key.explorer_id)).unwrap_or(0).into());
            }
            for home in homes {
                let key = ResourceKey { game_id, entity_id: *home };
                values.append(crate::logic::resources::balance(key, crate::resources::ESSENCE).into());
                values.append(crate::logic::resources::balance(key, crate::resources::LABOR).into());
                let member = crate::logic::race::member(key);
                values.append(member.glory.into());
                values.append(member.contribution.into());
            }
            for aspect in 1_u8..5 {
                values.append(state.season.aspect_heights.read((game_id, aspect)).into());
                values.append(state.banes.altar_bars.read((game_id, aspect)).into());
                for stage in 1_u8..crate::race::STAGE_COUNT {
                    values.append(state.season.triumph_days.read((game_id, aspect, stage)).unwrap_or(0).into());
                }
            }
            values.append(state.deep.paid_tick.read(game_id).unwrap().into());
            core::poseidon::poseidon_hash_span(values.span())
        },
    )
}

const CUT_GAP_STATE: felt252 = 2201666708671788439942562037886358868599889262474332853498685711847389098056;
const CAPPED_GAP_STATE: felt252 = 2393950206496095975162452152983202277702917956294588994799307791720544233047;
const WON_GAP_STATE: felt252 = 3113419462940742519254292401532952590995027095539763891224908379179215505061;

fn cap(guards: u64) -> u64 {
    crate::rules::DEEP_CATCH_UP_GUARD_TICKS / guards
}

fn first_play(seed: felt252, shape: Shape, boundaries: u64) -> Plays {
    let (_, game_id, guards, owner, homes) = held_deep(seed, 2000, shape);
    let cost = measured(owner, game_id, nudge(*homes.at(0)), START + boundaries * TICK);
    let plays = Plays { count: 1, gas: cost.gas, events: cost.events };
    report(boundaries, shape, plays);
    let walked = core::cmp::min(boundaries, cap(guards.len().into()));
    assert_eq!(cost.paid_ticks, START / TICK + walked);
    plays
}

#[test]
fn one_tick_with_every_site_full_fits_one_play() {
    assert_within_one_transaction(catch_up(1, every_site_at_the_empire_cap(), 1));
}

#[test]
fn five_missed_ticks_with_every_site_full_fit_one_play() {
    assert_within_one_transaction(catch_up(9, every_site_at_the_empire_cap(), 5));
}

#[test]
fn the_capped_play_of_a_long_gap_with_every_site_full_fits() {
    assert_within_one_transaction(first_play(4, every_site_at_the_empire_cap(), 599));
}

#[test]
fn every_settlement_guard_dying_in_one_play_fits() {
    assert_within_one_transaction(first_play(10, every_site_held_by_two_settlement_armies(), 30));
}

#[test]
fn a_day_of_missed_ticks_with_the_rehearsal_guard_fits_one_play() {
    assert_within_one_transaction(catch_up(11, the_rehearsal_guard(), 599));
}

#[test]
fn a_win_early_in_the_gap_stops_the_catch_up_with_every_site_full() {
    let shape = every_site_at_the_empire_cap();
    let (d, game_id, _, owner, homes) = held_deep(5, 6, shape);
    let cost = measured(owner, game_id, nudge(*homes.at(0)), START + 30 * TICK);
    report(30, shape, Plays { count: 1, gas: cost.gas, events: cost.events });
    assert!(interact_with_state(d.games, || crate::logic::race::result(game_id)).is_some());
    assert!(cost.paid_ticks < (START + 30 * TICK) / TICK);
    assert_within_one_transaction(Plays { count: 1, gas: cost.gas, events: cost.events });
}

#[test]
fn a_refused_guard_move_after_the_cap_pays_the_same_catch_up_with_every_site_full() {
    let shape = every_site_at_the_empire_cap();
    let (_, game_id, guards, owner, _) = held_deep(6, 2000, shape);
    let guard = *guards.at(0);
    let cost = measured(
        owner,
        game_id,
        Command::Move(crate::commands::Move { explorer_id: guard.explorer_id, directions: array![0].span() }),
        START + 100 * TICK,
    );
    assert_eq!(cost.paid_ticks, START / TICK + cap(80));
    assert_within_one_transaction(Plays { count: 1, gas: cost.gas, events: cost.events });
}

#[test]
fn a_command_by_a_player_outside_the_deep_advances_its_cursor() {
    let (d, game_id, _, _, _) = held_deep(12, 2000, every_site_at_the_empire_cap());
    let stranger = player(d, 1299);
    let home = super::army_activity::found(stranger, game_id, 2);
    measured(stranger, game_id, nudge(home), START + 100 * TICK);
    assert_eq!(paid(d, game_id), START / TICK + cap(80));
}

#[test]
fn a_join_refused_while_the_deep_catches_up_still_advances_its_cursor() {
    let (d, game_id, _, _, _) = held_deep(13, 2000, every_site_at_the_empire_cap());
    let stranger = player(d, 1399);
    let army = deployed(stranger, game_id, 1, 10);
    let target = site_at(d, game_id, 0);
    beside(d, army, target, 4);
    let mut events = spy_events();
    assert!(!execute_in_game(stranger, game_id, join(d, army, target), START + 450 * TICK));
    let refusal = world_test_support::tests::play_fixture::rejection(ref events, d.games);
    assert_eq!(refusal.reason, "the Deep is catching up");
    assert_eq!(paid(d, game_id), START / TICK + cap(80));
}

#[test]
fn a_gap_walked_in_one_play_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), 2000, 150, 1), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_cut_into_two_plays_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), 2000, 150, 2), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_cut_into_three_plays_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), 2000, 150, 3), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_cut_into_seven_plays_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), 2000, 150, 7), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_the_cap_cuts_ends_in_the_capped_gap_state() {
    assert!(450 > cap(20));
    assert_eq!(walked(24, one_guard_on_every_site(), 2000, 450, 1), (CAPPED_GAP_STATE, None));
}

#[test]
fn the_capped_gap_cut_into_seven_timed_plays_ends_in_the_same_state() {
    assert_eq!(walked(24, one_guard_on_every_site(), 2000, 450, 7), (CAPPED_GAP_STATE, None));
}

#[test]
fn the_rehearsal_guard_ends_in_one_state_however_its_gap_is_cut() {
    let shape = the_rehearsal_guard();
    let whole = walked(31, shape, 2000, 12, 1);
    assert_eq!(whole, walked(31, shape, 2000, 12, 2));
    assert_eq!(whole, walked(31, shape, 2000, 12, 3));
    assert_eq!(whole, walked(31, shape, 2000, 12, 7));
}

fn won(cuts: u64) -> felt252 {
    let (state, result) = walked(51, one_guard_on_every_site(), 40, 40, cuts);
    let result = result.expect('the race must finish in the gap');
    assert!(result.ended_at > START && result.ended_at < START + 40 * TICK);
    assert_eq!(result.winner, Some(1));
    println!("deep catch-up win: ended at {}", result.ended_at);
    state
}

#[test]
fn a_win_walked_in_one_play_ends_in_the_won_gap_state() {
    assert_eq!(won(1), WON_GAP_STATE);
}

#[test]
fn a_win_cut_into_three_plays_ends_in_the_won_gap_state() {
    assert_eq!(won(3), WON_GAP_STATE);
}

#[test]
fn a_win_cut_into_seven_plays_ends_in_the_won_gap_state() {
    assert_eq!(won(7), WON_GAP_STATE);
}
