use snforge_std::{interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::{FIXTURE_START, TestAction, play};
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;

fn found(d: Deployment, game_id: u32, timestamp: u64) -> ResourceKey {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(
                crate::realms::SettleSeason {
                    selected_realm: None, order: Some(world_test_support::tests::registrar::aspect_order(1)),
                },
            ),
            timestamp,
        ),
    );
    world_test_support::tests::play_fixture::deploy_home_troops(d, game_id, timestamp)
}

pub fn root_for(game_id: u32, day: u64, chance: u16, kind: u8) -> u256 {
    for value in 0_u32..10000 {
        let root: u256 = value.into();
        if crate::logic::bane_calendar::draw(game_id, day, root, chance) == kind {
            return root;
        }
    }
    panic!("no fixture root for world bane")
}

#[test]
fn exploration_settles_mist_tide_until_the_exact_lights_quorum_second() {
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let maximum: u64 = stamina.stamina_knight_max.into();
    let cost: u64 = stamina.stamina_explore_stamina_cost.into();
    let span = 2 * crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds;
    let full: u64 = 2 * stamina.stamina_gain_per_tick.into();
    let (d, game_id) = super::aspects::setup_aspects(5);
    let home = found(d, game_id, FIXTURE_START);
    train(d, home, FIXTURE_START);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::MIST_TIDE),
            tomorrow,
        ),
    );
    assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 10), tomorrow));
    let lights = interact_with_state(d.games, || crate::logic::banes::target(crate::quests::LIGHTS, 1));
    interact_with_state(
        d.games, || crate::logic::quest_progress::record(home, crate::quests::LIGHTS, lights - 2, tomorrow),
    );
    let slot = crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 };
    let explorer_id = super::army_activity::slot_army(d, slot);
    let discovery = crate::balance::expeditions::FRONTIER_DISCOVERY;
    for step in 0_u64..3 {
        let root = world_test_support::tests::registrar::discovery_root(
            game_id,
            crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..discovery },
            100,
            step.try_into().unwrap(),
            Some(crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::Blade, rank: 1 }),
            crate::discovery::Discovery::None,
        );
        assert!(
            world_test_support::tests::registrar::explore_with_root(
                d, game_id, explorer_id, root, tomorrow + step * span,
            ),
        );
        interact_with_state(
            d.games,
            || {
                let bar = crate::logic::army_slot_storage::read(slot).unwrap().stamina;
                let gained = if step == 0 {
                    0
                } else if step == 1 {
                    full / 2
                } else {
                    full / 2 + full
                };
                assert_eq!(bar.amount, maximum - cost * (step + 1) + gained);
                assert_eq!(bar.settled_at, (tomorrow + step * span).try_into().unwrap());
                assert_eq!(bar.remainder, 0);
            },
        );
    }
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::banes::progress(game_id, 1, 1);
            assert_eq!(progress.ended_at, tomorrow + span);
        },
    );
}

fn labor_reward() -> u128 {
    crate::balance::quests::LABOR_AMOUNT * RESOURCE_PRECISION
}

fn essence_reward() -> u128 {
    crate::balance::quests::ESSENCE_AMOUNT * RESOURCE_PRECISION
}

fn rename(home: ResourceKey) -> Command {
    Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'bane proof' })
}

fn settled_supplies(d: Deployment, home: ResourceKey, timestamp: u64) -> (u128, u128) {
    for resource_type in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        world_test_support::tests::frontier_economy::settle(d, home, resource_type, timestamp);
    }
    interact_with_state(
        d.games,
        || (
            crate::logic::resources::balance(home, crate::resources::LABOR),
            crate::logic::resources::balance(home, crate::resources::ESSENCE),
        ),
    )
}

fn claim(d: Deployment, home: ResourceKey, day: u64, timestamp: u64) -> bool {
    execute_in_game(
        d,
        home.game_id,
        Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day }),
        timestamp,
    )
}

fn build(d: Deployment, home: ResourceKey, category: u8, direction: u8, timestamp: u64) {
    let command = Command::CreateBuilding(
        crate::buildings::CreateBuilding {
            structure_id: home.entity_id, directions: array![direction].span(), category, use_simple: true,
        },
    );
    let mut events = spy_events();
    if !execute_in_game(d, home.game_id, command, timestamp) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

pub fn train(d: Deployment, home: ResourceKey, timestamp: u64) {
    build(d, home, crate::research::BARRACKS, 1, timestamp);
}

pub fn complete(d: Deployment, home: ResourceKey, day: u64, timestamp: u64) {
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::quests::read(home, day);
            if progress.completed_level == 0 {
                let kind = crate::logic::banes::quest_kind(home, day);
                let level = crate::logic::structures::record(home).base.level + 1;
                let remaining = crate::logic::banes::target(kind, level) - progress.progress;
                crate::logic::quest_progress::record(home, kind, remaining, timestamp);
            }
            assert_eq!(crate::logic::quests::read(home, day).completed_level, 1);
        },
    );
}

#[test]
fn a_rejected_action_records_the_world_roll_and_a_different_root_cannot_replace_it() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let home = found(d, game_id, FIXTURE_START);
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 0)), Some(0));
            assert_eq!(crate::state::read().banes.next_chance.read(game_id), 20);
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    let ash = root_for(game_id, 1, 20, crate::banes::ASH_FALL);
    let normal = root_for(game_id, 1, 20, 0);
    assert!(
        !play(
            d.games,
            TestAction {
                game_id,
                actor: d.actor,
                command: Command::SetEntityName(crate::names::SetEntityName { entity_id: 999999, name: 'refused' }),
            },
            ash,
            tomorrow,
        ),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 1)), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::state::read().banes.next_chance.read(game_id), 0);
        },
    );
    assert!(play(d.games, TestAction { game_id, actor: d.actor, command: rename(home) }, normal, tomorrow + 1));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
        },
    );
    let next = world_test_support::tests::registrar::day_start(d, game_id, 2);
    assert!(play(d.games, TestAction { game_id, actor: d.actor, command: rename(home) }, ash, next));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 2)), Some(0));
            assert_eq!(crate::state::read().banes.next_chance.read(game_id), 20);
        },
    );
}

#[test]
fn quorum_ends_the_effect_once_and_collection_pays_the_second_reward_once() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let mut members = array![];
    let mut homes = array![];
    for index in 0_u32..5 {
        let (actor, account_class) = world_test_support::tests::deploy_player(
            9000 + index.into(), world_test_support::tests::GUARDIAN,
        );
        let member = Deployment { actor, account_class, ..d };
        members.append(member);
        let home = found(member, game_id, FIXTURE_START);
        train(member, home, FIXTURE_START);
        homes.append(home);
    }
    let first = *members.at(0);
    let home = *homes.at(0);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: first.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    assert_eq!(
        interact_with_state(d.games, || crate::logic::banes::required(game_id, 1, 1)),
        crate::banes::required(5, crate::balance::banes::QUORUM_PERCENT),
    );
    complete(first, home, 1, tomorrow + 60);
    assert!(claim(first, home, 1, tomorrow + 60));
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::banes::progress(game_id, 1, 1), crate::banes::BaneProgress { completed: 1, ended_at: 0 },
            );
            assert!(crate::state::read().banes.bonus_grants.read((game_id, home.entity_id, 1)).is_none());
        },
    );
    complete(*members.at(1), *homes.at(1), 1, tomorrow + 120);
    complete(*members.at(1), *homes.at(1), 1, tomorrow + 121);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::banes::progress(game_id, 1, 1),
                crate::banes::BaneProgress { completed: 2, ended_at: tomorrow + 120 },
            );
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
            let effects = crate::logic::banes::read_effects(home, tomorrow, tomorrow + 180);
            assert_eq!(
                effects.windows,
                array![crate::banes::BaneWindow { kind: crate::banes::ASH_FALL, start: tomorrow, end: tomorrow + 120 }]
                    .span(),
            );
        },
    );
    let first_before = settled_supplies(d, home, tomorrow + 180);
    assert!(claim(first, home, 1, tomorrow + 180));
    assert!(claim(first, home, 1, tomorrow + 181));
    let third = *members.at(2);
    let third_home = *homes.at(2);
    assert!(!claim(third, third_home, 1, tomorrow + 180));
    complete(third, third_home, 1, tomorrow + 181);
    let third_before = settled_supplies(d, third_home, tomorrow + 182);
    assert!(claim(third, third_home, 1, tomorrow + 182));
    for (target, (labor_before, essence_before), rewards) in array![
        (home, first_before, 1_u128), (third_home, third_before, 2),
    ] {
        interact_with_state(
            d.games,
            || {
                assert_eq!(
                    crate::state::read().banes.bonus_grants.read((game_id, target.entity_id, 1)),
                    Some((labor_reward(), essence_reward())),
                );
                assert_eq!(
                    crate::logic::resources::balance(target, crate::resources::LABOR),
                    labor_before + rewards * labor_reward(),
                );
                assert_eq!(
                    crate::logic::resources::balance(target, crate::resources::ESSENCE),
                    essence_before + rewards * essence_reward(),
                );
            },
        );
    }
}

#[test]
fn real_production_splits_at_the_bane_start_and_quorum_end_and_army_stores_still_work() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let home = found(d, game_id, FIXTURE_START);
    build(d, home, crate::research::WORKSHOP, 0, FIXTURE_START);
    let rate: u128 = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::resources::balance(home, crate::resources::LABOR), 1000 * RESOURCE_PRECISION);
            crate::logic::resources::production(home, crate::resources::LABOR).production_rate
        },
    )
        .into();
    assert!(rate > 0);
    train(d, home, FIXTURE_START + 6000);
    interact_with_state(
        d.games,
        || {
            let armies = crate::logic::troops::home_armies(home);
            let army = ResourceKey { game_id, entity_id: *armies.at(0) };
            let context = crate::entry::IResourceContextDispatcherTrait::resource_context(
                crate::entry::IResourceContextLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
            );
            let credited = crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
                crate::resources::IResourceOperationsLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::RESOURCES),
                },
                army,
                crate::resources::ESSENCE,
                RESOURCE_PRECISION,
                FIXTURE_START,
                context,
            );
            assert_eq!(credited, RESOURCE_PRECISION);
            assert_eq!(crate::logic::resources::balance(army, crate::resources::ESSENCE), RESOURCE_PRECISION);
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    complete(d, home, 1, tomorrow + 600);
    let now = tomorrow + 1000;
    build(d, home, crate::research::FARM, 2, now);
    let ordinary_seconds: u128 = (tomorrow - FIXTURE_START + 400).into();
    let expected = rate * ordinary_seconds
        + rate * 600 * Into::<u16, u128>::into(crate::balance::banes::PRODUCTION_PERCENT) / 100;
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::resources::balance(home, crate::resources::LABOR), expected);
            assert_eq!(
                crate::logic::resources::production(home, crate::resources::LABOR).last_settled_at,
                now.try_into().unwrap(),
            );
        },
    );
}

pub fn altar(d: Deployment, game_id: u32, source: u8, boundary: u64) {
    interact_with_state(
        d.games,
        || {
            let state = crate::state::read();
            let threshold = crate::logic::deep_sites::rules().altar_threshold;
            let charge = crate::deep::altar_charge(
                state.banes.altar_bars.read((game_id, source)), threshold / 2, threshold,
            );
            let mut heights = array![];
            for aspect in 1_u8..5 {
                heights.append(state.season.aspect_heights.read((game_id, aspect)));
            }
            crate::deep::IDeepBanesDispatcherTrait::settle_altar(
                crate::deep::IDeepBanesLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                source,
                charge,
                boundary,
                heights.span(),
            );
        },
    );
}

fn blocked(d: Deployment, game_id: u32, aspect: u8, timestamp: u64) -> bool {
    interact_with_state(d.games, || crate::logic::deep_banes::height_blocked(game_id, aspect, timestamp))
}

#[test]
fn altar_reserves_distinct_rivals_and_a_completed_team_quest_restores_height_without_a_bonus() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let mut members = array![];
    let mut homes = array![];
    for aspect in 1_u8..5 {
        let (actor, account_class) = world_test_support::tests::deploy_player(
            9500 + Into::<u8, felt252>::into(aspect), world_test_support::tests::GUARDIAN,
        );
        let member = Deployment { actor, account_class, ..d };
        assert!(
            execute_in_game(
                member,
                game_id,
                Command::SettleSeason(
                    crate::realms::SettleSeason {
                        selected_realm: None, order: Some(world_test_support::tests::registrar::aspect_order(aspect)),
                    },
                ),
                FIXTURE_START,
            ),
        );
        homes.append(world_test_support::tests::play_fixture::deploy_home_troops(member, game_id, FIXTURE_START));
        train(member, *homes.at((aspect - 1).into()), FIXTURE_START);
        members.append(member);
    }
    altar(d, game_id, 1, FIXTURE_START + 120);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::state::read().banes.altar_bars.read((game_id, 1)),
                crate::logic::deep_sites::rules().altar_threshold / 2,
            );
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).is_none());
        },
    );
    for step in 2_u64..9 {
        altar(d, game_id, 1, FIXTURE_START + step * 120);
    }
    let first_quest = interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::state::read().banes.altar_bars.read((game_id, 1)),
                crate::logic::deep_sites::rules().altar_threshold,
            );
            assert_eq!(crate::state::read().banes.first_team_day.read(game_id), Some(0));
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 1, day: 1 }).is_none());
            for aspect in 2_u8..5 {
                let bane = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect, day: 1 })
                    .unwrap();
                assert_eq!(bane.source, 1);
                assert_eq!(bane.issued_day, 0);
            }
            crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).unwrap().quest
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    let member = *members.at(1);
    let home = *homes.at(1);
    assert!(play(d.games, TestAction { game_id, actor: member.actor, command: rename(home) }, 1, tomorrow));
    assert!(blocked(d, game_id, 2, tomorrow));
    complete(member, home, 1, tomorrow + 60);
    assert!(blocked(d, game_id, 2, tomorrow + 59));
    assert!(!blocked(d, game_id, 2, tomorrow + 60));
    assert!(claim(member, home, 1, tomorrow + 60));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::kind(game_id, 1), None);
            assert_eq!(crate::logic::banes::quest_kind(home, 1), first_quest);
            assert!(crate::state::read().banes.bonus_grants.read((game_id, home.entity_id, 1)).is_none());
            assert_eq!(
                crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 1)),
                Some((member.actor, labor_reward(), essence_reward())),
            );
        },
    );
    altar(d, game_id, 1, tomorrow + 120);
    interact_with_state(
        d.games,
        || {
            let next = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 2 }).unwrap();
            assert_ne!(next.quest, first_quest);
            assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 0);
        },
    );
}

#[test]
fn issuing_a_team_bane_keeps_todays_world_quest_and_stops_future_rolls() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let home = found(d, game_id, FIXTURE_START);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    altar(d, game_id, 1, tomorrow + 120);
    altar(d, game_id, 1, tomorrow + 240);
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
            assert_eq!(
                crate::logic::banes::read_effects(home, tomorrow, tomorrow + 300).windows,
                array![crate::banes::BaneWindow { kind: crate::banes::ASH_FALL, start: tomorrow, end: tomorrow + 300 }]
                    .span(),
            );
        },
    );
    let next = world_test_support::tests::registrar::day_start(d, game_id, 2);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 2, 100, crate::banes::ASH_FALL),
            next,
        ),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 2)), Some(0));
            assert_eq!(crate::logic::banes::kind(game_id, 2), None);
        },
    );
}

#[test]
fn mist_tide_counts_each_real_reveal_once_and_keeps_the_rolled_day() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let home = found(d, game_id, FIXTURE_START);
    assert!(
        execute_in_game(
            d,
            game_id,
            world_test_support::tests::building_commands::create(home, crate::research::BARRACKS),
            FIXTURE_START,
        ),
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::MIST_TIDE),
            tomorrow,
        ),
    );
    assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 10), tomorrow));
    let explorer_id = super::army_activity::slot_army(
        d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
    );
    let rules = crate::balance::expeditions::FRONTIER_DISCOVERY;
    let root = world_test_support::tests::registrar::discovery_root(
        game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..rules },
        100,
        0,
        Some(crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::Blade, rank: 1 }),
        crate::discovery::Discovery::None,
    );
    assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, explorer_id, root, tomorrow));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::LIGHTS);
            assert_eq!(
                crate::logic::quests::read(home, 1), crate::quests::QuestProgress { progress: 1, completed_level: 0 },
            );
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 1)), Some(crate::banes::MIST_TIDE));
        },
    );
    assert!(
        execute_in_game(d, game_id, Command::Explore(crate::commands::Explore { explorer_id, direction: 3 }), tomorrow),
    );
    assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, 1).progress), 1);
}

#[test]
fn missed_world_rolls_stop_at_the_fiftieth_day_and_never_roll_past_the_season() {
    let (d, game_id) = super::aspects::setup_aspects_lasting(
        5, crate::balance::race::RACE_RULES.season_days / crate::days::DAYS_PER_BAG * super::registrar::bag_seconds(),
    );
    let home = found(d, game_id, FIXTURE_START);
    let end = interact_with_state(d.games, || crate::logic::game::game(game_id).end_at);
    assert!(execute_in_game(d, game_id, rename(home), end - 1));
    interact_with_state(
        d.games,
        || {
            let state = crate::state::read();
            for day in 0_u64..50 {
                assert!(state.banes.world_days.read((game_id, day)).is_some());
            }
            assert!(state.banes.world_days.read((game_id, 50)).is_none());
            assert_eq!(state.banes.next_roll_at.read(game_id), end);
        },
    );
    assert!(!execute_in_game(d, game_id, rename(home), end));
    interact_with_state(
        d.games,
        || {
            assert!(crate::state::read().banes.world_days.read((game_id, 50)).is_none());
            assert_eq!(crate::state::read().banes.next_roll_at.read(game_id), end);
        },
    );
}
