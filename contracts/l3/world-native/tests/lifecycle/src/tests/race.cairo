use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::{FIXTURE_SEASON_SECONDS, FIXTURE_START};
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::deep::DeepShare;
use crate::logic::race::DeepRaceTrait;
use crate::race::{AspectKey, IRaceDispatcherTrait, IRaceLibraryDispatcher, RaceMember, TriumphKey};
use crate::resources::ResourceKey;
use crate::rules::{DEEP_ALTAR, DEEP_FOUNDATION, RESOURCE_PRECISION};
use super::army_activity::{found, player};

fn stage() -> u32 {
    crate::balance::race::RACE_RULES.stage_height
}

fn setup() -> (Deployment, u32) {
    super::aspects::setup_aspects(5)
}

fn race(game_id: u32) -> IRaceLibraryDispatcher {
    IRaceLibraryDispatcher { class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY) }
}

fn pay(d: Deployment, game_id: u32, kind: u8, aspect: u8, shares: Span<DeepShare>, amount: u32, boundary: u64) {
    interact_with_state(
        d.games,
        || {
            let mut race = DeepRaceTrait::load(game_id, boundary);
            let (glory, contribution) = race.pay(kind, aspect, shares, amount, boundary);
            for index in 0..shares.len() {
                race.credit(*shares.at(index).home, *glory.at(index), *contribution.at(index));
            }
            race.flush();
        },
    );
}

fn member(d: Deployment, key: ResourceKey) -> RaceMember {
    interact_with_state(d.games, || race(key.game_id).race_member(key))
}

fn height(d: Deployment, game_id: u32, aspect: u8) -> u32 {
    interact_with_state(d.games, || race(game_id).aspect_hyperstructure(AspectKey { game_id, aspect }).height)
}

#[test]
fn recorded_second_wind_multiplies_mist_tide_and_changes_real_exploration_refills() {
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let maximum: u64 = stamina.stamina_knight_max.into();
    let cost: u64 = stamina.stamina_explore_stamina_cost.into();
    let span = 2 * crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds;
    let full: u64 = 2 * stamina.stamina_gain_per_tick.into();
    let (d, game_id) = setup();
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    super::banes::train(d, home, FIXTURE_START);
    let shares = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, stage(), FIXTURE_START + 120);
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, stage(), FIXTURE_START + 240);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    super::banes::given_world_bane(d, game_id, 1, crate::banes::MIST_TIDE);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'wind proof' }),
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
            200,
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
                    full
                } else {
                    full + 2 * full
                };
                assert_eq!(bar.amount, maximum - cost * (step + 1) + gained);
            },
        );
    }
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                race(game_id).triumph_day(TriumphKey { game_id, aspect: 1, stage: crate::race::SECOND_WIND_STAGE }),
                Some(1),
            );
            let mut bar = crate::troops::Stamina { amount: 0, settled_at: tomorrow.try_into().unwrap(), remainder: 0 };
            let mut boosts = Default::default();
            let rules = crate::logic::game::rules(game_id);
            crate::logic::stamina_effects::refill(
                home,
                crate::deep::center(crate::logic::settlement::spacing()),
                ref bar,
                ref boosts,
                maximum,
                10000,
                0,
                crate::troops::StaminaRefill {
                    stamina_config: rules.troop_stamina_config,
                    armies_tick_in_seconds: crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds,
                    timestamp: tomorrow + span,
                },
            );
            assert_eq!(bar.amount, full);
        },
    );
}

#[test]
fn factory_initializes_four_height_counters_without_map_structures() {
    let (d, game_id) = setup();
    interact_with_state(
        d.games,
        || {
            let before = crate::state::read().games.next_entity.read(game_id);
            for aspect in 1_u8..5 {
                assert_eq!(race(game_id).aspect_hyperstructure(AspectKey { game_id, aspect }).height, 0);
            }
            for entity_id in 1_u64..before.into() {
                if let Some(structure) = crate::logic::structures::structure(ResourceKey { game_id, entity_id }) {
                    assert!(structure.base.category != crate::taxonomy::HYPERSTRUCTURE_CATEGORY);
                }
            }
            race(game_id).initialize_race(game_id);
            assert_eq!(crate::state::read().games.next_entity.read(game_id), before);
            for aspect in 1_u8..5 {
                assert_eq!(race(game_id).aspect_hyperstructure(AspectKey { game_id, aspect }).height, 0);
            }
        },
    );
}

#[test]
fn foundation_splits_raw_glory_and_height_by_troops_while_altar_pays_only_glory() {
    let (d, game_id) = setup();
    let first = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    let mate = player(d, 11001);
    let second = ResourceKey { game_id, entity_id: found(mate, game_id, 1) };
    let shares = array![DeepShare { home: first.entity_id, troops: 1 }, DeepShare { home: second.entity_id, troops: 3 }]
        .span();
    let mut events = spy_events();
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, 5, FIXTURE_START + 120);
    let quarter = 5 * RESOURCE_PRECISION / 4;
    let emitted = events.get_events();
    assert_eq!(emitted.events.len(), 3);
    let (_, first_credit) = emitted.events.at(1);
    assert_eq!(first_credit.keys.span(), array![selector!("RaceEvent"), selector!("RowSet"), 1, 'RaceMember'].span());
    assert_eq!(
        first_credit.data.span(),
        array![2, game_id.into(), first.entity_id.into(), 2, quarter.into(), quarter.into()].span(),
    );
    assert_eq!(member(d, first), RaceMember { glory: quarter, contribution: quarter });
    assert_eq!(member(d, second), RaceMember { glory: quarter * 3, contribution: quarter * 3 });
    assert_eq!(height(d, game_id, 1), 5);
    pay(d, game_id, DEEP_ALTAR, 1, shares, 5, FIXTURE_START + 120);
    assert_eq!(member(d, first), RaceMember { glory: quarter * 2, contribution: quarter });
    assert_eq!(member(d, second), RaceMember { glory: quarter * 6, contribution: quarter * 3 });
    assert_eq!(height(d, game_id, 1), 5);
    assert_eq!(member(d, first).glory + member(d, second).glory, 10 * RESOURCE_PRECISION);
}

#[test]
fn a_real_team_bane_blocks_height_but_not_glory_until_its_quest_is_completed() {
    let (d, game_id) = setup();
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 2) };
    super::banes::train(d, home, FIXTURE_START);
    let shares = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    pay(d, game_id, DEEP_FOUNDATION, 2, shares, 5, FIXTURE_START + 120);
    super::banes::altar(d, game_id, 1, FIXTURE_START + 240);
    super::banes::altar(d, game_id, 1, FIXTURE_START + 360);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    pay(d, game_id, DEEP_FOUNDATION, 2, shares, 5, tomorrow + 120);
    assert_eq!(height(d, game_id, 2), 5);
    assert_eq!(member(d, home), RaceMember { glory: 10 * RESOURCE_PRECISION, contribution: 5 * RESOURCE_PRECISION });
    super::banes::complete(d, home, 1, tomorrow + 240);
    pay(d, game_id, DEEP_FOUNDATION, 2, shares, 5, tomorrow + 360);
    assert_eq!(height(d, game_id, 2), 10);
    assert_eq!(member(d, home), RaceMember { glory: 15 * RESOURCE_PRECISION, contribution: 10 * RESOURCE_PRECISION });
}

#[test]
fn four_stages_schedule_triumphs_and_the_fifth_finishes_at_a_tick_inside_the_next_day() {
    let (d, game_id) = setup();
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    let shares = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    let step = stage() / 4;
    let paid: u128 = step.into() * RESOURCE_PRECISION;
    for tick in 1_u64..20 {
        pay(d, game_id, DEEP_FOUNDATION, 1, shares, step, FIXTURE_START + tick * 120);
    }
    assert_eq!(height(d, game_id, 1), 19 * step);
    interact_with_state(
        d.games,
        || {
            for stage in 1_u8..crate::race::STAGE_COUNT {
                assert_eq!(race(game_id).triumph_day(TriumphKey { game_id, aspect: 1, stage }), Some(1));
            }
            assert_eq!(race(game_id).race_result(game_id), None);
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    let finish = tomorrow + 120;
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, step, finish);
    pay(d, game_id, DEEP_ALTAR, 1, shares, step, finish);
    assert_eq!(height(d, game_id, 1), 20 * step);
    assert_eq!(member(d, home), RaceMember { glory: 21 * paid, contribution: 20 * paid });
    interact_with_state(
        d.games,
        || {
            let game = crate::logic::game::game(game_id);
            assert_eq!(game.end_at, finish);
            assert_eq!(game.scheduled_end_at, FIXTURE_START + FIXTURE_SEASON_SECONDS);
            assert_eq!(
                race(game_id).race_result(game_id),
                Some(
                    crate::race::RaceResult {
                        winner: Some(1), ended_at: finish, scheduled_end_at: game.scheduled_end_at,
                    },
                ),
            );
            let day = crate::days::day_of(game, crate::logic::game::rules(game_id).day_unit_seconds, finish - 1);
            assert_eq!((day.index, day.start, day.end), (1, tomorrow, finish));
            assert_eq!(
                crate::days::day_of(game, crate::logic::game::rules(game_id).day_unit_seconds, tomorrow - 1).index, 0,
            );
            assert!(crate::state::read().season.triumph_days.read((game_id, 1, crate::race::STAGE_COUNT)).is_none());
        },
    );
    assert_eq!(member(d, home).glory, 21 * paid);
}

#[test]
fn a_stage_on_the_last_tick_does_not_schedule_a_triumph_outside_the_season() {
    let (d, game_id) = setup();
    let home = found(d, game_id, 1);
    pay(
        d,
        game_id,
        DEEP_FOUNDATION,
        1,
        array![DeepShare { home, troops: 1 }].span(),
        stage(),
        FIXTURE_START + FIXTURE_SEASON_SECONDS,
    );
    assert_eq!(height(d, game_id, 1), stage());
    interact_with_state(
        d.games, || {
            assert_eq!(race(game_id).triumph_day(TriumphKey { game_id, aspect: 1, stage: 1 }), None);
        },
    );
}

#[test]
fn recorded_clear_mist_changes_real_reveals_only_on_its_day() {
    for spires in array![false, true] {
        let (d, game_id) = setup();
        let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
        super::banes::train(d, home, FIXTURE_START);
        if spires {
            world_test_support::tests::registrar::learn_spire_lore(d, home, FIXTURE_START);
        }
        pay(
            d,
            game_id,
            DEEP_FOUNDATION,
            1,
            array![DeepShare { home: home.entity_id, troops: 1 }].span(),
            stage(),
            FIXTURE_START + 120,
        );
        let (root, misted_site) = clear_mist_root(game_id, home_discovery(d, home), spires);
        for day in 0_u64..3 {
            let now = if day == 0 {
                FIXTURE_START + 240
            } else {
                world_test_support::tests::registrar::day_start(d, game_id, day)
            };
            if day > 0 {
                assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 10), now));
            }
            let explorer_id = super::army_activity::slot_army(
                d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: day, slot: 0 },
            );
            let key = crate::troops::ExplorerKey { game_id, explorer_id };
            let origin = super::army_activity::army(d, key).coord;
            let destination = crate::geometry::neighbor(origin, 0);
            assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, explorer_id, root, now));
            interact_with_state(
                d.games,
                || {
                    let counter = crate::logic::expeditions::discovery(
                        crate::expeditions::ExpeditionDiscoveryKey {
                            game_id, structure_id: home.entity_id, epoch: day,
                        },
                    )
                        .unwrap();
                    assert_eq!(counter.empty_reveals, if day == 1 && !spires {
                        0
                    } else {
                        1
                    });
                    assert_eq!(
                        crate::logic::triumphs::effects(home, now).find_percent, if day == 1 {
                            200
                        } else {
                            100
                        },
                    );
                    if spires {
                        let spire = crate::logic::spires::read(
                            crate::spires::ExpeditionSpireKey {
                                game_id, structure_id: home.entity_id, epoch: day, depth: 0,
                            },
                        )
                            .unwrap();
                        assert_eq!(spire, crate::spires::ExpeditionSpire { reveals: 1, location: None });
                    } else if day == 1 {
                        let tile = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination))
                            .unwrap();
                        assert!(tile.is_structure);
                        assert_eq!(tile.category, misted_site);
                    }
                },
            );
        }
    }
}

fn clear_mist_root(game_id: u32, rules: crate::expeditions::FrontierDiscoveryRules, spires: bool) -> (u256, u8) {
    for value in 0_u64..10000 {
        let raw: u256 = value.into();
        let mut root = raw;
        let seed = crate::random::game_root(ref root, game_id);
        let relic = Some(world_test_support::tests::registrar::any_relic());
        let misted = crate::discovery::frontier(rules, 200, 0, relic, seed);
        let plain = crate::discovery::frontier(rules, 100, 0, relic, seed);
        let spire = crate::random::range(seed, 0x5350495245, 10000);
        let empty_without_mist = plain == crate::discovery::Discovery::None;
        if !spires && empty_without_mist && misted == crate::discovery::Discovery::Camp {
            return (raw, crate::taxonomy::CAMP_OCCUPIER);
        }
        if !spires && empty_without_mist && misted == crate::discovery::Discovery::Rift {
            return (raw, crate::taxonomy::RIFT_OCCUPIER);
        }
        if spires && misted == crate::discovery::Discovery::None && spire >= 1000 && spire < 2000 {
            return (raw, crate::taxonomy::NONE_OCCUPIER);
        }
    }
    panic!("missing Clear Mist reveal root")
}

fn moons_project_each_battle_and_preserve_base_losses(blood: bool, pale: bool) {
    let (d, game_id) = setup();
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    super::banes::train(d, home, FIXTURE_START);
    if pale {
        for tick in 1_u64..4 {
            pay(
                d,
                game_id,
                DEEP_FOUNDATION,
                1,
                array![DeepShare { home: home.entity_id, troops: 1 }].span(),
                stage(),
                FIXTURE_START + tick * 120,
            );
        }
    }
    let now = world_test_support::tests::registrar::day_start(d, game_id, 1);
    world_test_support::tests::resource_commands::grant(d, home, crate::resources::WHEAT, 10000 * RESOURCE_PRECISION);
    if blood {
        super::banes::given_world_bane(d, game_id, 1, crate::banes::BLOOD_MOON);
    }
    assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 40), now));
    let key = crate::troops::ExplorerKey {
        game_id,
        explorer_id: super::army_activity::slot_army(
            d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
        ),
    };
    let discovery = home_discovery(d, home);
    let destination = crate::geometry::neighbor(super::army_activity::army(d, key).coord, 0);
    let root = world_test_support::tests::registrar::discovery_root(
        game_id,
        discovery,
        if pale {
            200
        } else {
            100
        },
        0,
        Some(world_test_support::tests::registrar::any_relic()),
        crate::discovery::Discovery::Beasts,
    );
    assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, key.explorer_id, root, now));
    let site = interact_with_state(
        d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination)).unwrap().entity_id,
    );
    let guard = crate::guards::GuardKey { game_id, structure_id: site, slot: 0 };
    world_test_support::tests::registrar::strong_frontier_army(d, game_id, key);
    let bps: u128 = if pale {
        if blood {
            7500
        } else {
            5000
        }
    } else {
        15000
    };
    for attempt in 0_u64..2 {
        let base = interact_with_state(d.games, || crate::logic::guards::guard(guard).troops.count);
        assert!(base > 0);
        let mut events = spy_events();
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site }),
                now + 60 + attempt * 120,
            ),
        );
        let battle = recorded_site_battle(ref events, d, site);
        assert_eq!(battle.defender.before, (base * bps + 9999) / 10000);
        assert!(battle.defender.after < battle.defender.before);
        let stored = interact_with_state(d.games, || crate::logic::guards::guard(guard).troops.count);
        assert_eq!(stored, (battle.defender.after * 10000 + bps - 1) / bps);
        assert!(stored < base);
        if battle.attacker.after == 0 || stored == 0 {
            break;
        }
    }
    let retained = interact_with_state(d.games, || crate::logic::guards::guard(guard).troops.count);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 2);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'after moons' }),
            tomorrow,
        ),
    );
    assert_eq!(interact_with_state(d.games, || crate::logic::guards::guard(guard).troops.count), retained);
    assert_eq!(interact_with_state(d.games, || crate::logic::triumphs::effects(home, tomorrow).beast_bps), 10000);
}

#[test]
fn a_blood_moon_projects_each_battle_and_preserves_base_losses() {
    moons_project_each_battle_and_preserve_base_losses(true, false);
}

#[test]
fn a_pale_moon_projects_each_battle_and_preserves_base_losses() {
    moons_project_each_battle_and_preserve_base_losses(false, true);
}

#[test]
fn blood_and_pale_moons_together_project_each_battle_and_preserve_base_losses() {
    moons_project_each_battle_and_preserve_base_losses(true, true);
}

fn recorded_site_battle(ref events: snforge_std::EventSpy, d: Deployment, site: u64) -> crate::troops::BattleEvent {
    for (_, event) in events.get_events().emitted_by(d.games).events {
        let keys = event.keys.span();
        for prefix in 0..keys.len() {
            if *keys.at(prefix) != selector!("BattleEvent") {
                continue;
            }
            let mut fields = keys.slice(prefix + 1, keys.len() - prefix - 1);
            let mut data = event.data.span();
            let battle: crate::troops::BattleEvent = starknet::Event::deserialize(ref fields, ref data).unwrap();
            if battle.defender_id == site {
                return battle;
            }
        }
    }
    panic!("missing site battle")
}

fn spoils_clear(category: u8) {
    let (d, game_id) = setup();
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    super::banes::train(d, home, FIXTURE_START);
    for tick in 1_u64..5 {
        pay(
            d,
            game_id,
            DEEP_FOUNDATION,
            1,
            array![DeepShare { home: home.entity_id, troops: 1 }].span(),
            stage(),
            FIXTURE_START + tick * 120,
        );
    }
    let now = world_test_support::tests::registrar::day_start(d, game_id, 1);
    world_test_support::tests::resource_commands::grant(d, home, crate::resources::WHEAT, 10000 * RESOURCE_PRECISION);
    world_test_support::tests::resource_commands::grant(
        d, home, crate::troops::troop_resource(crate::troops::TroopType::Knight, 0), 3000 * RESOURCE_PRECISION,
    );
    assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 3000), now));
    let key = crate::troops::ExplorerKey {
        game_id,
        explorer_id: super::army_activity::slot_army(
            d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
        ),
    };
    let units = super::army_activity::army(d, key).troops.count / RESOURCE_PRECISION;
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
    assert_eq!(stamina.stamina_explore_fish_cost, 0);
    world_test_support::tests::resource_commands::grant(
        d, home, crate::resources::WHEAT, units * stamina.stamina_explore_wheat_cost.into(),
    );
    let relic = crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::Blade, rank: 1 };
    let expected = if category == crate::taxonomy::BEASTS_CATEGORY {
        crate::discovery::Discovery::Beasts
    } else if category == crate::taxonomy::CAMP_CATEGORY {
        crate::discovery::Discovery::Camp
    } else if category == crate::taxonomy::RIFT_CATEGORY {
        crate::discovery::Discovery::Rift
    } else {
        crate::discovery::Discovery::Ruin(relic)
    };
    let destination = crate::geometry::neighbor(super::army_activity::army(d, key).coord, 0);
    let root = world_test_support::tests::registrar::discovery_root(
        game_id, home_discovery(d, home), 200, 0, Some(relic), expected,
    );
    assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, key.explorer_id, root, now));
    let site_key = interact_with_state(
        d.games,
        || ResourceKey {
            game_id,
            entity_id: crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination)).unwrap().entity_id,
        },
    );
    let site = interact_with_state(d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap());
    let discovered_relic = interact_with_state(d.games, || crate::logic::army_relics::ruin(site_key));
    world_test_support::tests::frontier_economy::settle(d, home, crate::resources::LABOR, now + 60);
    let held_labor = interact_with_state(d.games, || crate::logic::resources::balance(home, crate::resources::LABOR));
    if held_labor > 0 {
        world_test_support::tests::frontier_economy::spend(d, home, crate::resources::LABOR, held_labor, now + 60);
    }
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site_key.entity_id },
            ),
            now + 60,
        ),
    );
    interact_with_state(
        d.games,
        || {
            let receipt = crate::logic::expeditions::expedition_site(site_key).unwrap().clear.unwrap();
            let rules = crate::logic::expeditions::depth_rules(0);
            let band = crate::expeditions::is_band(site, rules);
            assert_eq!(crate::logic::progression::require(key).oath_pick != 0, band);
            if category == crate::taxonomy::RUIN_CATEGORY {
                assert_eq!(receipt.reward, None);
                let found = discovered_relic.unwrap();
                assert_eq!(crate::army_relics::rank_of(crate::logic::army_relics::read(key), found.kind), found.rank);
            } else {
                let base = crate::expeditions::site_reward(category, site, 0, band, rules);
                assert_eq!(
                    receipt.reward,
                    base.map(|reward| crate::resources::ResourceAmount { amount: reward.amount * 2, ..reward }),
                );
            }
            assert_eq!(crate::logic::triumphs::effects(home, now - 1).spoils_percent, 100);
            assert_eq!(crate::logic::triumphs::effects(home, now).spoils_percent, 200);
        },
    );
}

#[test]
fn spoils_doubles_a_beasts_clear() {
    spoils_clear(crate::taxonomy::BEASTS_CATEGORY);
}

#[test]
fn spoils_doubles_a_camp_clear() {
    spoils_clear(crate::taxonomy::CAMP_CATEGORY);
}

#[test]
fn spoils_doubles_a_rift_clear() {
    spoils_clear(crate::taxonomy::RIFT_CATEGORY);
}

#[test]
fn spoils_keeps_a_ruin_relic() {
    spoils_clear(crate::taxonomy::RUIN_CATEGORY);
}

fn home_discovery(d: Deployment, home: ResourceKey) -> crate::expeditions::FrontierDiscoveryRules {
    interact_with_state(d.games, || crate::logic::discovery::lore_rules(crate::logic::research::require(home).learned))
}
