use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::troops::ExplorerKey;
use super::army_activity::player;
use super::deep_sites::{applied, beside, deployed, fight, join, wound_beast};

const TICK: u64 = 120;
const START: u64 = world_test_support::tests::play_fixture::FIXTURE_START;
const ONE_TICK_OF_POISON: u128 = 200;
const RINGS_OPEN: u32 = 240;
const MAX_EVENTS: u32 = 1000;
const EXECUTE_MAX_SIERRA_GAS: u128 = 1100000000;
const CEILING_EVENTS: u32 = 900;
const CEILING_GAS: u128 = 880000000;
const TURN_TICKS: u64 = 30;

#[derive(Copy, Drop)]
struct Shape {
    sites: u8,
    guards_per_site: u8,
    troops: u128,
    vitriol: bool,
    slotted: bool,
}

#[derive(Drop)]
struct Cost {
    gas: u128,
    events: u32,
    paid_ticks: u64,
    refusal: ByteArray,
}

fn empire_cap() -> u128 {
    crate::balance::rules::TROOP_LIMIT_CONFIG.empire_deployment_cap.into()
}

fn settlement_cap() -> u128 {
    crate::balance::rules::TROOP_LIMIT_CONFIG.settlement_deployment_cap.into()
}

fn full_race() -> u32 {
    crate::balance::race::RACE_RULES.stage_height * crate::race::STAGE_COUNT.into()
}

fn every_site_at_the_empire_cap() -> Shape {
    Shape {
        sites: 24, guards_per_site: crate::rules::DEEP_GUARD_SLOTS, troops: empire_cap(), vitriol: true, slotted: true,
    }
}

fn every_site_held_by_two_settlement_armies() -> Shape {
    Shape { sites: 24, guards_per_site: 2, troops: settlement_cap(), vitriol: false, slotted: true }
}

fn one_guard_on_every_site() -> Shape {
    Shape { sites: 24, guards_per_site: 1, troops: empire_cap(), vitriol: true, slotted: false }
}

fn guards_dying_on_tick(tick: u128) -> Shape {
    Shape { troops: tick * crate::oaths::VITRIOL_LOSS_PER_TICK.into(), ..one_guard_on_every_site() }
}

fn the_rehearsal_guard() -> Shape {
    Shape { sites: 1, guards_per_site: 1, troops: settlement_cap(), vitriol: false, slotted: false }
}

fn held_deep(
    seed: felt252, height_left: u32, shape: Shape,
) -> (Deployment, u32, Span<ExplorerKey>, Deployment, Span<u64>) {
    let held = held_deep_in(long_first_day(seed), shape);
    let (d, game_id, _, _, _) = held;
    interact_with_state(
        d.games, || crate::state::write().season.aspect_heights.write((game_id, 1), full_race() - height_left),
    );
    let unit = crate::tests::context(d.games, game_id).rules.unbox().day_unit_seconds;
    let day = interact_with_state(d.games, || crate::days::day_at_index(crate::logic::game::game(game_id), unit, 0));
    assert!(day.end >= START + 600 * TICK, "the first day must hold the longest catch-up");
    held
}

fn long_first_day(seed: felt252) -> felt252 {
    let mut seed = seed;
    while first_day_end(seed) <= START + 610 * TICK {
        seed += 1;
    }
    seed
}

fn first_day_end(seed: felt252) -> u64 {
    let end = START + world_test_support::tests::play_fixture::FIXTURE_SEASON_SECONDS;
    let game = crate::game::GameRegistry {
        name: 0,
        family: crate::game::FRONTIER,
        settled: false,
        dev_mode_on: false,
        start_settling_at: START,
        start_main_at: START,
        end_at: end,
        seed,
        scheduled_end_at: end,
    };
    crate::days::day_at_index(game, crate::balance::rules::SWITCHES.day_unit_seconds, 0).end
}

fn held_deep_with_a_day_turn(
    seed: felt252, shape: Shape,
) -> (Deployment, u32, Span<ExplorerKey>, Deployment, Span<u64>) {
    held_deep_in(seed, shape)
}

fn held_deep_in(seed: felt252, shape: Shape) -> (Deployment, u32, Span<ExplorerKey>, Deployment, Span<u64>) {
    let (d, game_id) = super::aspects::setup_aspects(seed);
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
            wound_beast(d, first, 0);
        }
        applied(member, game_id, join(d, key, first), START);
        holders.append(key);
        members.append(member);
        homes.append(super::army_activity::army(d, key).owner);
    }
    let holders = holders.span();
    let homes = homes.span();
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
            seat_guard(d, source, key, site, slot, shape, *homes.at(slot.into()));
            guards.append(key);
        }
    }
    interact_with_state(d.games, || crate::state::write().deep.realms_entered.write((game_id, 0), RINGS_OPEN));
    (d, game_id, guards.span(), *members.at(0), homes)
}

fn site_count(d: Deployment, game_id: u32) -> u8 {
    interact_with_state(d.games, || crate::logic::deep_sites::site_count())
}

fn site_at(d: Deployment, game_id: u32, index: u8) -> ResourceKey {
    let entity_id = interact_with_state(d.games, || crate::logic::deep_sites::site_id(game_id, index));
    ResourceKey { game_id, entity_id }
}

fn seat_guard(
    d: Deployment, source: ExplorerKey, key: ExplorerKey, site: ResourceKey, slot: u8, shape: Shape, owner: u64,
) {
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
            let stamina = if key == source || !shape.slotted {
                army.troops.stamina
            } else {
                slotted_stamina(game_id, key, owner, read.troops.army_days.read(from).unwrap(), army.troops.stamina)
            };
            write
                .troops
                .explorers
                .write(
                    to,
                    crate::troops::ExplorerRecordTrait::into_record(
                        crate::troops::ExplorerTroops {
                            owner, troops: crate::troops::Troops { count, stamina, ..army.troops }, ..army,
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
                let armies = read.troops.home_counts.read((game_id, owner));
                write.troops.home_armies.write((game_id, owner, armies), key.explorer_id);
                write.troops.home_counts.write((game_id, owner), armies + 1);
            }
        },
    );
}

fn slotted_stamina(
    game_id: u32, key: ExplorerKey, home: u64, day: u64, source: crate::troops::StaminaSource,
) -> crate::troops::StaminaSource {
    let crate::troops::StaminaSource::Inline(stamina) = source else {
        panic!("a resolved army holds its stamina inline")
    };
    let slot: u8 = (2 + key.explorer_id % 1000).try_into().unwrap();
    crate::state::write()
        .troops
        .slots
        .write(
            (game_id, home, day, slot),
            crate::troops::ArmySlotRecord {
                initialized: true, value: crate::troops::ArmySlot { explorer_id: key.explorer_id, stamina },
            },
        );
    crate::troops::StaminaSource::Slot(slot)
}

#[inline(never)]
fn measured(d: Deployment, game_id: u32, command: Command, now: u64) -> Cost {
    let mut events = spy_events();
    let before = core::testing::get_available_gas();
    let accepted = execute_in_game(d, game_id, command, now);
    let gas = before - core::testing::get_available_gas();
    let refusal = if accepted {
        ""
    } else {
        world_test_support::tests::play_fixture::rejection(ref events, d.games).reason
    };
    let paid_ticks = interact_with_state(d.games, || crate::state::read().deep.paid_tick.read(game_id).unwrap());
    Cost { gas, events: events.get_events().emitted_by(d.games).events.len(), paid_ticks, refusal }
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
    let (_, game_id, _, owner, homes) = held_deep(seed, full_race(), shape);
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
    seed: felt252, shape: Shape, height_left: u32, boundaries: u64, cuts: u64,
) -> (felt252, Option<crate::race::RaceResult>) {
    let (d, game_id, guards, owner, homes) = held_deep(seed, height_left, shape);
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

const CUT_GAP_STATE: felt252 = 1673731733158721546613794772649270542849283164678128925706615378988613616369;
const CAPPED_GAP_STATE: felt252 = 2376911865723451719479719704514318580604827670827512065391711585911566667029;
const DEATH_GAP_STATE: felt252 = 2440879224849652595673558022242804693394882308903186369631140244771463531365;
const TURNED_STATE: felt252 = 505830386639354082581926203778591038233508464900890755066067638461591003639;
const WON_GAP_STATE: felt252 = 1897419826473698187294239919237326959646005435595192003963819847202845662719;

fn cap(guards: u64) -> u64 {
    crate::rules::DEEP_CATCH_UP_GUARD_TICKS / guards
}

fn guard_count(shape: Shape) -> u64 {
    shape.sites.into() * shape.guards_per_site.into()
}

fn first_play(seed: felt252, shape: Shape, boundaries: u64) -> Plays {
    let (_, game_id, guards, owner, homes) = held_deep(seed, full_race(), shape);
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
fn every_settlement_guard_dying_in_a_gap_fits_every_play() {
    assert_within_one_transaction(catch_up(10, every_site_held_by_two_settlement_armies(), 30));
}

fn to_the_day_turn(d: Deployment, game_id: u32, guards: Span<ExplorerKey>, ticks_before: u64) -> u64 {
    let unit = crate::tests::context(d.games, game_id).rules.unbox().day_unit_seconds;
    let end = interact_with_state(
        d.games, || crate::days::day_at_index(crate::logic::game::game(game_id), unit, 0).end,
    );
    let tick = end / TICK - ticks_before;
    interact_with_state(
        d.games,
        || {
            let write = crate::state::write();
            write.deep.paid_tick.write(game_id, Some(tick));
            write.deep.realms_entered.write((game_id, 1), RINGS_OPEN);
            for key in guards {
                write.deep.army_ticks.write((game_id, *key.explorer_id), Some(tick));
            }
        },
    );
    end
}

fn rolled_rings(d: Deployment, game_id: u32) -> u8 {
    interact_with_state(
        d.games,
        || {
            let mut rolled = 0;
            for index in 0..crate::logic::deep_sites::site_count() {
                let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
                if index % crate::rules::DEEP_RING_SITES == 0 && crate::logic::deep_sites::site(key).unwrap().day == 1 {
                    rolled += 1;
                }
            }
            rolled
        },
    )
}

fn fresh_army(d: Deployment, source: ExplorerKey, explorer_id: u64, end: u64, target: ResourceKey) -> ExplorerKey {
    let key = ExplorerKey { game_id: source.game_id, explorer_id };
    interact_with_state(
        d.games,
        || {
            let read = crate::state::read();
            let write = crate::state::write();
            let from = (source.game_id, source.explorer_id);
            let to = (source.game_id, explorer_id);
            write.troops.army_days.write(to, Some(1));
            write.troops.combat.write(to, read.troops.combat.read(from));
            write.troops.progress.write(to, read.troops.progress.read(from));
            write.resources.resource_exists.write(to, true);
            write.resources.weights.write(to, read.resources.weights.read(from));
            write.deep.army_ticks.write(to, Some(end / TICK));
            let coord = crate::geometry::neighbor(crate::logic::map::entity_coord(target).unwrap(), 3);
            let army = crate::logic::army_slots::resolve(source, crate::logic::troops::explorer(source).unwrap(), None);
            crate::logic::map::MapState::relocate_fixture(
                ResourceKey { game_id: source.game_id, entity_id: explorer_id },
                coord,
                crate::troops::troop_occupier(army.troops),
                false,
            );
            write
                .troops
                .explorers
                .write(
                    to,
                    crate::troops::ExplorerRecordTrait::into_record(crate::troops::ExplorerTroops { coord, ..army }),
                );
        },
    );
    key
}

fn turn_digest(d: Deployment, game_id: u32, guards: Span<ExplorerKey>, homes: Span<u64>) -> felt252 {
    let guarded = digest(d, game_id, guards, homes);
    let values = interact_with_state(
        d.games,
        || {
            let mut values = array![guarded];
            for index in 0..crate::logic::deep_sites::site_count() {
                let entity_id = crate::logic::deep_sites::site_id(game_id, index);
                let row = crate::logic::deep_sites::site(ResourceKey { game_id, entity_id }).unwrap();
                values.append(row.kind.into());
                values.append(row.day.into());
                let beast = crate::guards::GuardKey { game_id, structure_id: entity_id, slot: 0 };
                values.append(crate::logic::guards::guard(beast).troops.count.into());
            }
            values
        },
    );
    core::poseidon::poseidon_hash_span(values.span())
}

fn assert_under_the_ceiling(cost: Cost) {
    assert!(cost.events <= CEILING_EVENTS, "the play exceeds its event ceiling");
    assert!(cost.gas <= CEILING_GAS, "the play exceeds its gas ceiling");
}

#[test]
fn the_day_turn_play_pays_its_last_tick_and_rolls_nothing() {
    let shape = every_site_at_the_empire_cap();
    let (d, game_id, guards, owner, homes) = held_deep_with_a_day_turn(15, shape);
    let end = to_the_day_turn(d, game_id, guards, 1);
    let cost = measured(owner, game_id, nudge(*homes.at(0)), end + TICK);
    report(2, shape, Plays { count: 1, gas: cost.gas, events: cost.events });
    assert_eq!(rolled_rings(d, game_id), 0);
    assert_eq!(cost.paid_ticks, end / TICK);
    assert_under_the_ceiling(cost);
}

#[test]
fn a_play_after_the_turn_rolls_one_full_ring_under_the_ceiling() {
    let shape = every_site_at_the_empire_cap();
    let (d, game_id, guards, owner, homes) = held_deep_with_a_day_turn(17, shape);
    let end = to_the_day_turn(d, game_id, guards, 0);
    let cost = measured(owner, game_id, nudge(*homes.at(0)), end + TICK);
    report(1, shape, Plays { count: 1, gas: cost.gas, events: cost.events });
    assert_eq!(rolled_rings(d, game_id), 1);
    assert_eq!(cost.paid_ticks, end / TICK);
    assert_under_the_ceiling(cost);
}

#[test]
fn an_attack_on_a_ring_not_yet_rolled_is_refused_until_the_play_that_rolls_it() {
    let (d, game_id, guards, owner, _) = held_deep_with_a_day_turn(18, one_guard_on_every_site());
    let end = to_the_day_turn(d, game_id, guards, TURN_TICKS);
    let last_ring = site_at(d, game_id, 3 * crate::rules::DEEP_RING_SITES);
    let attacker = fresh_army(d, *guards.at(0), 9910001, end, last_ring);
    let refused = measured(owner, game_id, fight(attacker, last_ring), end + TICK);
    assert_eq!(refused.refusal, "Deep is settling, try again");
    assert_eq!(rolled_rings(d, game_id), 0);
    let still_refused = measured(owner, game_id, fight(attacker, last_ring), end + TICK + 1);
    assert_eq!(still_refused.refusal, "Deep is settling, try again");
    assert_eq!(rolled_rings(d, game_id), 2);
    let landed = measured(owner, game_id, fight(attacker, last_ring), end + TICK + 2);
    assert_eq!(landed.refusal, "");
    assert_eq!(rolled_rings(d, game_id), 4);
    assert_eq!(landed.paid_ticks, (end + TICK + 2) / TICK);
}

#[test]
fn an_attack_on_a_rolled_ring_waits_while_later_rings_roll_and_keeps_the_ring_it_rolled() {
    let (d, game_id, guards, owner, _) = held_deep_with_a_day_turn(19, every_site_at_the_empire_cap());
    let end = to_the_day_turn(d, game_id, guards, 0);
    let first_ring = site_at(d, game_id, 1);
    let attacker = fresh_army(d, *guards.at(0), 9910002, end, first_ring);
    let waited = measured(owner, game_id, fight(attacker, first_ring), end + TICK);
    assert_eq!(waited.refusal, "The Deep is catching up, try again in a moment");
    assert_eq!(rolled_rings(d, game_id), 1);
}

fn roll_the_turn(d: Deployment, game_id: u32, owner: Deployment, home: u64, end: u64) {
    measured(owner, game_id, nudge(home), end + TICK);
    assert_eq!(rolled_rings(d, game_id), 0);
    measured(owner, game_id, nudge(home), end + TICK + 1);
    assert_eq!(rolled_rings(d, game_id), 2);
    measured(owner, game_id, nudge(home), end + TICK + 2);
    assert_eq!(rolled_rings(d, game_id), 4);
}

#[test]
fn a_turn_rolled_over_two_plays_ends_in_the_turned_state() {
    let (d, game_id, guards, owner, homes) = held_deep_with_a_day_turn(20, one_guard_on_every_site());
    let end = to_the_day_turn(d, game_id, guards, TURN_TICKS);
    roll_the_turn(d, game_id, owner, *homes.at(0), end);
    assert_eq!(turn_digest(d, game_id, guards, homes), TURNED_STATE);
}

#[test]
fn a_turn_paid_over_three_plays_ends_in_the_turned_state() {
    let (d, game_id, guards, owner, homes) = held_deep_with_a_day_turn(20, one_guard_on_every_site());
    let end = to_the_day_turn(d, game_id, guards, TURN_TICKS);
    measured(owner, game_id, nudge(*homes.at(0)), end - 20 * TICK);
    measured(owner, game_id, nudge(*homes.at(0)), end - 10 * TICK);
    roll_the_turn(d, game_id, owner, *homes.at(0), end);
    assert_eq!(turn_digest(d, game_id, guards, homes), TURNED_STATE);
}

#[test]
fn a_day_of_missed_ticks_with_the_rehearsal_guard_fits_one_play() {
    assert_within_one_transaction(catch_up(11, the_rehearsal_guard(), 599));
}

#[test]
fn a_win_early_in_the_gap_stops_the_catch_up_with_every_site_full() {
    let shape = every_site_at_the_empire_cap();
    let (d, game_id, _, owner, homes) = held_deep(5, 30, shape);
    let cost = measured(owner, game_id, nudge(*homes.at(0)), START + 30 * TICK);
    report(30, shape, Plays { count: 1, gas: cost.gas, events: cost.events });
    assert!(interact_with_state(d.games, || crate::logic::race::result(game_id)).is_some());
    assert!(cost.paid_ticks < (START + 30 * TICK) / TICK);
    assert_within_one_transaction(Plays { count: 1, gas: cost.gas, events: cost.events });
}

#[test]
fn an_oath_answered_by_a_guard_while_the_deep_catches_up_is_refused_and_still_advances_the_cursor() {
    let shape = every_site_at_the_empire_cap();
    let (_, game_id, guards, owner, _) = held_deep(6, full_race(), shape);
    let guard = *guards.at(0);
    let cost = measured(
        owner,
        game_id,
        Command::ChooseOath(
            crate::oaths::ChooseOath { explorer_id: guard.explorer_id, expected_pick: 0, oath: None, replace: None },
        ),
        START + 100 * TICK,
    );
    assert_eq!(cost.paid_ticks, START / TICK + cap(guard_count(every_site_at_the_empire_cap())));
    assert_within_one_transaction(Plays { count: 1, gas: cost.gas, events: cost.events });
    assert_eq!(cost.refusal, "The Deep is catching up, try again in a moment");
}

#[test]
fn a_command_by_a_player_outside_the_deep_advances_its_cursor() {
    let (d, game_id, _, _, _) = held_deep(12, full_race(), every_site_at_the_empire_cap());
    let stranger = player(d, 1299);
    let home = super::army_activity::found(stranger, game_id, 2);
    measured(stranger, game_id, nudge(home), START + 100 * TICK);
    assert_eq!(paid(d, game_id), START / TICK + cap(guard_count(every_site_at_the_empire_cap())));
}

#[test]
fn a_join_refused_while_the_deep_catches_up_still_advances_its_cursor() {
    let (d, game_id, _, _, _) = held_deep(13, full_race(), every_site_at_the_empire_cap());
    let stranger = player(d, 1399);
    let army = deployed(stranger, game_id, 1, 10);
    let target = site_at(d, game_id, 0);
    beside(d, army, target, 4);
    let mut events = spy_events();
    assert!(!execute_in_game(stranger, game_id, join(d, army, target), START + 450 * TICK));
    let refusal = world_test_support::tests::play_fixture::rejection(ref events, d.games);
    assert_eq!(refusal.reason, "The Deep is catching up, try again in a moment");
    assert_eq!(paid(d, game_id), START / TICK + cap(guard_count(every_site_at_the_empire_cap())));
}

#[test]
fn a_gap_walked_in_one_play_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), full_race(), 150, 1), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_cut_into_two_plays_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), full_race(), 150, 2), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_cut_into_three_plays_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), full_race(), 150, 3), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_cut_into_seven_plays_ends_in_the_cut_gap_state() {
    assert_eq!(walked(21, one_guard_on_every_site(), full_race(), 150, 7), (CUT_GAP_STATE, None));
}

#[test]
fn a_gap_the_cap_cuts_ends_in_the_capped_gap_state() {
    assert!(120 > cap(guard_count(one_guard_on_every_site())));
    assert_eq!(walked(24, one_guard_on_every_site(), full_race(), 120, 1), (CAPPED_GAP_STATE, None));
}

#[test]
fn the_capped_gap_cut_into_seven_timed_plays_ends_in_the_same_state() {
    assert_eq!(walked(24, one_guard_on_every_site(), full_race(), 120, 7), (CAPPED_GAP_STATE, None));
}

#[test]
fn the_rehearsal_guard_ends_in_one_state_however_its_gap_is_cut() {
    let shape = the_rehearsal_guard();
    let whole = walked(31, shape, full_race(), 12, 1);
    assert_eq!(whole, walked(31, shape, full_race(), 12, 2));
    assert_eq!(whole, walked(31, shape, full_race(), 12, 3));
    assert_eq!(whole, walked(31, shape, full_race(), 12, 7));
}

fn won(cuts: u64) -> felt252 {
    let (state, result) = walked(51, one_guard_on_every_site(), 200, 40, cuts);
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

fn realistic_homes(d: Deployment, game_id: u32, real: u64) -> Span<u64> {
    let mut homes = array![real];
    for index in 1_u64..20 {
        let home = 8000000 + index;
        interact_with_state(
            d.games,
            || {
                let state = crate::state::write();
                state.settlements.home_aspects.write((game_id, home), 1);
                state.resources.resource_exists.write((game_id, home), true);
                state.resources.weights.write((game_id, home), state.resources.weights.read((game_id, real)));
            },
        );
        homes.append(home);
    }
    homes.span()
}

#[test]
fn every_guard_dying_on_the_first_tick_fits_one_play() {
    let shape = Shape { sites: 1, guards_per_site: 1, troops: ONE_TICK_OF_POISON, vitriol: false, slotted: true };
    let (d, game_id, guards, owner, holder_homes) = held_deep(14, full_race(), shape);
    let homes = realistic_homes(d, game_id, *holder_homes.at(0));
    let source = *guards.at(0);
    let mut seated = array![];
    let sites = site_count(d, game_id);
    for index in 0..sites {
        let site = site_at(d, game_id, index);
        for slot in 0..crate::rules::DEEP_GUARD_SLOTS {
            let key = if index == 0 && slot == 0 {
                source
            } else {
                ExplorerKey { game_id, explorer_id: 9500000 + index.into() * 10 + slot.into() }
            };
            let home: u32 = (index.into() + 20 - 5 * Into::<u8, u32>::into(slot)) % 20;
            seat_guard(d, source, key, site, slot, shape, *homes.at(home));
            seated.append(key);
        }
    }
    let cost = measured(owner, game_id, nudge(*holder_homes.at(0)), START + 30 * TICK);
    let full = Shape { sites, guards_per_site: crate::rules::DEEP_GUARD_SLOTS, ..shape };
    report(30, full, Plays { count: 1, gas: cost.gas, events: cost.events });
    assert_eq!(cost.paid_ticks, (START + 30 * TICK) / TICK);
    for key in seated.span() {
        assert!(interact_with_state(d.games, || crate::logic::troops::explorer(*key)).is_none());
    }
    assert_under_the_ceiling(cost);
}

#[test]
fn a_death_the_budget_cannot_fit_waits_for_the_next_play() {
    let shape = guards_dying_on_tick(20);
    let death = guard_count(shape) * (1 + crate::rules::DEEP_CATCH_UP_DEATH_TICKS);
    assert!(death > crate::rules::DEEP_CATCH_UP_GUARD_TICKS);
    let (d, game_id, guards, owner, homes) = held_deep(61, full_race(), shape);
    let plays = play_until_caught_up(owner, game_id, *homes.at(0), START + 30 * TICK);
    report(30, shape, plays);
    assert_eq!(plays.count, 2);
    assert_eq!(paid(owner, game_id), (START + 30 * TICK) / TICK);
    for key in guards {
        assert!(interact_with_state(d.games, || crate::logic::troops::explorer(*key)).is_none());
    }
    assert_within_one_transaction(plays);
}

#[test]
fn a_gap_with_deaths_the_budget_cuts_ends_in_the_death_gap_state() {
    assert_eq!(walked(61, guards_dying_on_tick(20), full_race(), 30, 1), (DEATH_GAP_STATE, None));
}

#[test]
fn a_gap_with_deaths_cut_into_three_timed_plays_ends_in_the_same_state() {
    assert_eq!(walked(61, guards_dying_on_tick(20), full_race(), 30, 3), (DEATH_GAP_STATE, None));
}
