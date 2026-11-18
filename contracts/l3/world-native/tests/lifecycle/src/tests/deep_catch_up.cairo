use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
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

fn every_site_at_the_settlement_cap() -> Shape {
    Shape { sites: 20, guards_per_site: crate::rules::DEEP_GUARD_SLOTS, troops: SETTLEMENT_CAP, vitriol: false }
}

fn the_rehearsal_guard() -> Shape {
    Shape { sites: 1, guards_per_site: 1, troops: SETTLEMENT_CAP, vitriol: false }
}

fn held_deep(seed: felt252, stage_height: u32, shape: Shape) -> (Deployment, u32, Span<ExplorerKey>, Deployment) {
    let (d, game_id) = super::aspects::setup_aspect_preset(seed, season_one_catch_up_preset(stage_height));
    let unit = crate::tests::context(d.games, game_id).rules.unbox().day_unit_seconds;
    let day = interact_with_state(d.games, || crate::days::day_at_index(crate::logic::game::game(game_id), unit, 0));
    assert!(day.end >= START + 600 * TICK, "the first day must hold the longest catch-up");
    assert!(shape.sites <= site_count(d, game_id), "more sites than the Deep holds");
    let first = site_at(d, game_id, 0);
    let mut holders = array![];
    let mut members = array![];
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
    (d, game_id, guards.span(), *members.at(0))
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

fn catch_up(seed: felt252, shape: Shape, boundaries: u64) -> Cost {
    let (d, game_id, guards, owner) = held_deep(seed, 2000, shape);
    let home = super::army_activity::army(d, *guards.at(0)).owner;
    let cost = measured(owner, game_id, nudge(home), START + boundaries * TICK);
    report(boundaries, shape, cost);
    assert_eq!(cost.paid_ticks, (START + boundaries * TICK) / TICK);
    cost
}

fn report(boundaries: u64, shape: Shape, cost: Cost) {
    println!(
        "deep catch-up: {} boundaries, {} sites x {} guards of {} troops, vitriol {}: {} gas, {} events",
        boundaries,
        shape.sites,
        shape.guards_per_site,
        shape.troops,
        shape.vitriol,
        cost.gas,
        cost.events,
    );
}

fn assert_within_one_transaction(cost: Cost) {
    assert!(cost.gas < EXECUTE_MAX_SIERRA_GAS, "catch-up exceeds the execution gas limit");
    assert!(cost.events <= MAX_EVENTS, "catch-up exceeds the transaction event limit");
}

#[test]
fn one_tick_with_every_site_full_fits_one_play() {
    assert_within_one_transaction(catch_up(1, every_site_at_the_empire_cap(), 1));
}

#[test]
fn two_missed_ticks_with_every_site_full_fit_one_play() {
    assert_within_one_transaction(catch_up(7, every_site_at_the_empire_cap(), 2));
}

#[test]
fn three_missed_ticks_with_every_site_full_fit_one_play() {
    assert_within_one_transaction(catch_up(8, every_site_at_the_empire_cap(), 3));
}

#[test]
fn five_missed_ticks_with_every_site_full_fit_one_play() {
    assert_within_one_transaction(catch_up(9, every_site_at_the_empire_cap(), 5));
}

#[test]
fn an_hour_of_missed_ticks_with_every_site_full_fits_one_play() {
    assert_within_one_transaction(catch_up(2, every_site_at_the_empire_cap(), 30));
}

#[test]
fn six_hours_of_missed_ticks_with_every_site_full_fits_one_play() {
    assert_within_one_transaction(catch_up(3, every_site_at_the_empire_cap(), 180));
}

#[test]
fn the_longest_day_of_missed_ticks_with_every_site_full_fits_one_play() {
    assert_within_one_transaction(catch_up(4, every_site_at_the_empire_cap(), 599));
}

#[test]
fn an_hour_of_missed_ticks_with_every_site_held_by_settlement_armies_fits_one_play() {
    assert_within_one_transaction(catch_up(10, every_site_at_the_settlement_cap(), 30));
}

#[test]
fn a_day_of_missed_ticks_with_the_rehearsal_guard_fits_one_play() {
    assert_within_one_transaction(catch_up(11, the_rehearsal_guard(), 599));
}

#[test]
fn a_win_at_the_first_missed_tick_stops_the_catch_up_with_every_site_full() {
    let shape = every_site_at_the_empire_cap();
    let (d, game_id, guards, owner) = held_deep(5, 6, shape);
    let home = super::army_activity::army(d, *guards.at(0)).owner;
    let cost = measured(owner, game_id, nudge(home), START + 30 * TICK);
    report(30, shape, cost);
    assert!(
        interact_with_state(
            d.games,
            || crate::race::IRaceDispatcherTrait::race_result(
                crate::race::IRaceLibraryDispatcher {
                    class_hash: crate::logic::release::classes(game_id).economy.read(),
                },
                game_id,
            ),
        )
            .is_some(),
    );
    assert!(cost.paid_ticks < (START + 30 * TICK) / TICK);
    assert_within_one_transaction(cost);
}

#[test]
fn a_refused_guard_move_after_an_hour_pays_the_same_catch_up_with_every_site_full() {
    let shape = every_site_at_the_empire_cap();
    let (_, game_id, guards, owner) = held_deep(6, 2000, shape);
    let guard = *guards.at(0);
    let cost = measured(
        owner,
        game_id,
        Command::Move(crate::commands::Move { explorer_id: guard.explorer_id, directions: array![0].span() }),
        START + 30 * TICK,
    );
    report(30, shape, cost);
    assert_eq!(cost.paid_ticks, (START + 30 * TICK) / TICK);
    assert_within_one_transaction(cost);
}
