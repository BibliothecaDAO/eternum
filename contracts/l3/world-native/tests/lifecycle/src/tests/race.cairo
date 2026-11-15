use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::preset_projection::optional_race_rules;
use world_test_support::tests::registrar::{
    CreateGameParams, IRegistrarDispatcherTrait, IRegistrarSafeDispatcherTrait, params, registry, safe,
};
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::deep::{
    DeepShare, IDeepRewardsDispatcherTrait, IDeepRewardsLibraryDispatcher, IDeepRewardsSafeDispatcherTrait,
    IDeepRewardsSafeLibraryDispatcher,
};
use crate::race::{AspectKey, IRaceDispatcherTrait, IRaceLibraryDispatcher, RaceMember, TriumphKey};
use crate::resources::ResourceKey;
use crate::rules::{DEEP_ALTAR, DEEP_FOUNDATION, RESOURCE_PRECISION};
use super::army_activity::{found, player};

fn definition(stage_height: u32) -> crate::presets::PresetDefinition {
    let mut preset = super::banes::deep_definition();
    preset.economy.race = Some(crate::race::RaceRules { stage_height, ..optional_race_rules() });
    preset.season_win_points = 0;
    preset
}

fn setup(stage_height: u32) -> (Deployment, u32) {
    super::aspects::setup_aspect_preset(5, definition(stage_height))
}

fn race(game_id: u32) -> IRaceLibraryDispatcher {
    IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).economy.read() }
}

fn pay(d: Deployment, game_id: u32, kind: u8, aspect: u8, shares: Span<DeepShare>, boundary: u64) {
    interact_with_state(
        d.games,
        || {
            IDeepRewardsLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).economy.read() }
                .pay_deep_tick(game_id, kind, aspect, shares, boundary);
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
    let mut preset = definition(5);
    preset.rules.tick_config.armies_tick_in_seconds = 60;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = 2;
    let maximum: u64 = preset.rules.troop_stamina_config.stamina_knight_max.into();
    let cost: u64 = preset.rules.troop_stamina_config.stamina_explore_stamina_cost.into();
    let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    super::banes::train(d, home, 360);
    let shares = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, 480);
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, 600);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        world_test_support::tests::play_fixture::play(
            d.games,
            world_test_support::tests::play_fixture::TestAction {
                game_id,
                actor: d.actor,
                command: Command::SetEntityName(
                    crate::names::SetEntityName { entity_id: home.entity_id, name: 'wind proof' },
                ),
            },
            super::banes::root_for(game_id, 1, 20, crate::banes::MIST_TIDE),
            tomorrow,
        ),
    );
    assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 10), tomorrow));
    let slot = crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 };
    let explorer_id = super::army_activity::slot_army(d, slot);
    let discovery = interact_with_state(
        d.games, || crate::logic::preset_record::for_game(game_id).discovery_rules.read().unwrap(),
    );
    for step in 0_u64..3 {
        let root = world_test_support::tests::registrar::discovery_root(
            game_id,
            crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..discovery },
            200,
            step.try_into().unwrap(),
            Some(crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::FarEye, rank: 1 }),
            crate::discovery::Discovery::None,
        );
        assert!(
            world_test_support::tests::registrar::explore_with_root(
                d, game_id, explorer_id, root, tomorrow + step * 60,
            ),
        );
        interact_with_state(
            d.games,
            || {
                let bar = crate::logic::army_slot_storage::read(slot).unwrap().stamina;
                let gained = if step == 0 {
                    0
                } else if step == 1 {
                    2
                } else {
                    6
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
                crate::deep::center(crate::logic::preset_record::for_game(game_id).settlement_spacing.read()),
                ref bar,
                ref boosts,
                maximum,
                crate::troops::StaminaRefill {
                    stamina_config: rules.troop_stamina_config, armies_tick_in_seconds: 60, timestamp: tomorrow + 60,
                },
            );
            assert_eq!(bar.amount, 2);
        },
    );
}

#[test]
fn factory_creates_four_fixed_monuments_once_and_disabled_games_have_none() {
    let (d, game_id) = setup(2000);
    interact_with_state(
        d.games,
        || {
            let rules = race(game_id).race_rules(game_id).unwrap();
            let spacing = crate::logic::preset_record::for_game(game_id).settlement_spacing.read();
            let before = crate::state::read().games.next_entity.read(game_id);
            for aspect in 1_u8..5 {
                let monument = race(game_id).aspect_hyperstructure(AspectKey { game_id, aspect });
                assert_eq!(monument.height, 0);
                let local = crate::race::local_coord(rules, aspect);
                let coord = crate::deep::site_position(local.x, local.y, spacing);
                let key = ResourceKey { game_id, entity_id: monument.entity_id };
                assert_eq!(crate::logic::map::entity_coord(key), Some(coord));
                assert!(crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)).unwrap().is_structure);
                let structure = crate::logic::structures::structure(key).unwrap();
                assert_eq!(structure.base.category, crate::taxonomy::HYPERSTRUCTURE_CATEGORY);
                assert_eq!(structure.owner, 0.try_into().unwrap());
            }
            let mut repeated = spy_events();
            race(game_id).initialize_race(game_id);
            assert_eq!(crate::state::read().games.next_entity.read(game_id), before);
            assert!(repeated.get_events().events.is_empty());
        },
    );
    let (ordinary, ordinary_game) = super::aspects::setup_aspects(5);
    interact_with_state(
        ordinary.games,
        || {
            assert_eq!(race(ordinary_game).race_rules(ordinary_game), None);
            assert_eq!(race(ordinary_game).race_result(ordinary_game), None);
            for aspect in 1_u8..5 {
                assert_eq!(crate::state::read().season.aspect_hyperstructures.read((ordinary_game, aspect)), 0);
            }
        },
    );
}

#[test]
fn foundation_splits_raw_glory_and_height_by_troops_while_altar_pays_only_glory() {
    let (d, game_id) = setup(2000);
    let first = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    let mate = player(d, 11001);
    let second = ResourceKey { game_id, entity_id: found(mate, game_id, 1) };
    let shares = array![DeepShare { home: first.entity_id, troops: 1 }, DeepShare { home: second.entity_id, troops: 3 }]
        .span();
    let mut events = spy_events();
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, 480);
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
    pay(d, game_id, DEEP_ALTAR, 1, shares, 480);
    assert_eq!(member(d, first), RaceMember { glory: quarter * 2, contribution: quarter });
    assert_eq!(member(d, second), RaceMember { glory: quarter * 6, contribution: quarter * 3 });
    assert_eq!(height(d, game_id, 1), 5);
    assert_eq!(member(d, first).glory + member(d, second).glory, 10 * RESOURCE_PRECISION);
}

#[test]
#[feature("safe_dispatcher")]
fn rejected_payments_leave_height_and_both_member_totals_unchanged() {
    let (d, game_id) = setup(2000);
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    let valid = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    for invalid in 0_u8..8 {
        let shares = if invalid == 0 {
            array![].span()
        } else if invalid == 1 {
            array![DeepShare { home: home.entity_id, troops: 0 }].span()
        } else if invalid == 2 {
            array![*valid.at(0), *valid.at(0)].span()
        } else {
            valid
        };
        let aspect = if invalid == 3 {
            2
        } else {
            1
        };
        let kind = if invalid == 4 {
            crate::rules::DEEP_QUARRY
        } else {
            DEEP_FOUNDATION
        };
        let boundary = if invalid == 5 {
            360
        } else if invalid == 6 {
            481
        } else if invalid == 7 {
            288480
        } else {
            480
        };
        interact_with_state(
            d.games,
            || {
                let dispatcher = IDeepRewardsSafeLibraryDispatcher {
                    class_hash: crate::logic::release::classes(game_id).economy.read(),
                };
                assert!(dispatcher.pay_deep_tick(game_id, kind, aspect, shares, boundary).is_err());
            },
        );
        assert_eq!(member(d, home), RaceMember { glory: 0, contribution: 0 });
        assert_eq!(height(d, game_id, 1), 0);
        assert_eq!(height(d, game_id, 2), 0);
    }
    pay(d, game_id, DEEP_FOUNDATION, 1, valid, 480);
    assert_eq!(member(d, home), RaceMember { glory: 5 * RESOURCE_PRECISION, contribution: 5 * RESOURCE_PRECISION });
}

#[test]
fn a_real_team_bane_blocks_height_but_not_glory_until_its_quest_is_completed() {
    let (d, game_id) = setup(2000);
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 2) };
    super::banes::train(d, home, 360);
    let shares = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    pay(d, game_id, DEEP_FOUNDATION, 2, shares, 480);
    super::banes::altar(d, game_id, 1, 600);
    super::banes::altar(d, game_id, 1, 720);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    pay(d, game_id, DEEP_FOUNDATION, 2, shares, tomorrow + 120);
    assert_eq!(height(d, game_id, 2), 5);
    assert_eq!(member(d, home), RaceMember { glory: 10 * RESOURCE_PRECISION, contribution: 5 * RESOURCE_PRECISION });
    super::banes::complete(d, home, 1, tomorrow + 240);
    pay(d, game_id, DEEP_FOUNDATION, 2, shares, tomorrow + 360);
    assert_eq!(height(d, game_id, 2), 10);
    assert_eq!(member(d, home), RaceMember { glory: 15 * RESOURCE_PRECISION, contribution: 10 * RESOURCE_PRECISION });
}

#[test]
#[feature("safe_dispatcher")]
fn four_stages_schedule_triumphs_and_the_fifth_finishes_at_a_tick_inside_the_next_day() {
    let (d, game_id) = setup(20);
    let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
    let shares = array![DeepShare { home: home.entity_id, troops: 1 }].span();
    for tick in 1_u64..20 {
        pay(d, game_id, DEEP_FOUNDATION, 1, shares, 360 + tick * 120);
    }
    assert_eq!(height(d, game_id, 1), 95);
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
    pay(d, game_id, DEEP_FOUNDATION, 1, shares, finish);
    pay(d, game_id, DEEP_ALTAR, 1, shares, finish);
    assert_eq!(height(d, game_id, 1), 100);
    assert_eq!(member(d, home), RaceMember { glory: 105 * RESOURCE_PRECISION, contribution: 100 * RESOURCE_PRECISION });
    interact_with_state(
        d.games,
        || {
            let game = crate::logic::game::game(game_id);
            assert_eq!(game.end_at, finish);
            assert_eq!(game.scheduled_end_at, 288360);
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
            let dispatcher = IDeepRewardsSafeLibraryDispatcher {
                class_hash: crate::logic::release::classes(game_id).economy.read(),
            };
            assert!(dispatcher.pay_deep_tick(game_id, DEEP_ALTAR, 1, shares, finish + 120).is_err());
        },
    );
    assert_eq!(member(d, home).glory, 105 * RESOURCE_PRECISION);
}

#[test]
fn a_stage_on_the_last_tick_does_not_schedule_a_triumph_outside_the_season() {
    let (d, game_id) = setup(5);
    let home = found(d, game_id, 1);
    pay(d, game_id, DEEP_FOUNDATION, 1, array![DeepShare { home, troops: 1 }].span(), 288360);
    assert_eq!(height(d, game_id, 1), 5);
    interact_with_state(
        d.games, || {
            assert_eq!(race(game_id).triumph_day(TriumphKey { game_id, aspect: 1, stage: 1 }), None);
        },
    );
}

#[test]
fn monument_attack_is_rejected_by_the_race_rule_before_any_capture_work() {
    let (d, game_id) = setup(2000);
    let home = found(d, game_id, 1);
    let army = super::army_activity::slot_army(
        d, crate::troops::ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 },
    );
    let monument = interact_with_state(
        d.games, || race(game_id).aspect_hyperstructure(AspectKey { game_id, aspect: 2 }),
    );
    let mut events = spy_events();
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: army, defender_id: monument.entity_id, relic_slot: None },
            ),
            480,
        ),
    );
    assert_eq!(
        world_test_support::tests::play_fixture::rejection(ref events, d.games).reason,
        "race monuments cannot be attacked",
    );
    assert_eq!(height(d, game_id, 2), 0);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::structures::record(ResourceKey { game_id, entity_id: monument.entity_id }).owner,
                0.try_into().unwrap(),
            );
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn a_single_valid_payment_cannot_register_a_season_whose_total_would_overflow() {
    let d = world_test_support::tests::registrar::setup();
    let mut preset = definition(2000);
    let max: u128 = core::num::traits::Bounded::MAX;
    preset
        .economy
        .race = Some(crate::race::RaceRules { glory_per_tick: max / RESOURCE_PRECISION, ..optional_race_rules() });
    registry(d).register_preset(1, preset);
    let created = safe(d, world_test_support::tests::authority())
        .create_game(
            CreateGameParams {
                start_main_at: 360, duration_seconds: 288000, end_grace_seconds: 0, seed: 5, ..params(false),
            },
        );
    assert!(created.is_err());
    interact_with_state(d.games, || assert!(!crate::logic::game::game_exists(1)));
}

#[test]
fn recorded_clear_mist_changes_real_reveals_only_on_its_day() {
    for spires in array![false, true] {
        let mut preset = definition(5);
        preset
            .economy
            .discovery =
                Some(
                    crate::expeditions::FrontierDiscoveryRules {
                        beasts_bps: 1000,
                        camp_bps: 0,
                        rift_bps: 0,
                        ruin_bps: 0,
                        shrine_bps: 0,
                        well_bps: 0,
                        empty_reveal_limit: 7,
                    },
                );
        if spires {
            preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DISCOVER_SPIRES;
        }
        let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
        let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
        super::banes::train(d, home, 360);
        if spires {
            let price = interact_with_state(
                d.games, || crate::logic::research::price(game_id, crate::research::ROW_DEPTH, 1),
            );
            world_test_support::tests::resource_commands::grant(d, home, crate::resources::ESSENCE, price.essence);
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::Research(
                        crate::research::Research {
                            structure_id: home.entity_id, row: crate::research::ROW_DEPTH, choice: 0,
                        },
                    ),
                    360,
                ),
            );
        }
        pay(d, game_id, DEEP_FOUNDATION, 1, array![DeepShare { home: home.entity_id, troops: 1 }].span(), 480);
        let root = clear_mist_root(game_id, spires);
        for day in 0_u64..3 {
            let now = if day == 0 {
                600
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
                    assert_eq!(counter.empty_reveals, if day == 1 {
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
                        assert_eq!(spire.reveals, 1);
                        assert_eq!(spire.location, if day == 1 {
                            Some(destination)
                        } else {
                            None
                        });
                    } else if day == 1 {
                        let tile = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination))
                            .unwrap();
                        assert!(tile.is_structure);
                        assert_eq!(tile.category, crate::taxonomy::BEASTS_OCCUPIER);
                    }
                },
            );
        }
    }
}

fn clear_mist_root(game_id: u32, spires: bool) -> u256 {
    for value in 0_u64..10000 {
        let raw: u256 = value.into();
        let mut root = raw;
        let seed = crate::random::game_root(ref root, game_id);
        let draw = crate::random::range(seed, 29, 10000);
        let spire = crate::random::range(seed, 0x5350495245, 10000);
        if (!spires && draw >= 1000 && draw < 2000) || (spires && draw >= 2000 && spire >= 1000 && spire < 2000) {
            return raw;
        }
    }
    panic!("missing Clear Mist reveal root")
}

#[test]
fn blood_and_pale_moons_project_each_battle_and_preserve_base_losses() {
    for (blood, pale) in array![(true, false), (false, true), (true, true)] {
        let mut preset = definition(5);
        let mut depths = array![];
        for depth in preset.settlement.depths {
            depths
                .append(
                    crate::expeditions::DepthRules {
                        beast_weak_lower: 20,
                        beast_weak_upper: 20,
                        beast_strong_lower: 21,
                        beast_strong_upper: 21,
                        guard_step: 1,
                        ..*depth,
                    },
                );
        }
        preset.settlement.depths = depths.span();
        let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
        let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
        super::banes::train(d, home, 360);
        if pale {
            for tick in 1_u64..4 {
                pay(
                    d,
                    game_id,
                    DEEP_FOUNDATION,
                    1,
                    array![DeepShare { home: home.entity_id, troops: 1 }].span(),
                    360 + tick * 120,
                );
            }
        }
        let now = world_test_support::tests::registrar::day_start(d, game_id, 1);
        world_test_support::tests::resource_commands::grant(
            d, home, crate::resources::WHEAT, 10000 * RESOURCE_PRECISION,
        );
        assert!(
            world_test_support::tests::play_fixture::play(
                d.games,
                world_test_support::tests::play_fixture::TestAction {
                    game_id, actor: d.actor, command: super::army_activity::muster(home.entity_id, 0, 0, 10),
                },
                super::banes::root_for(game_id, 1, 20, if blood {
                    crate::banes::BLOOD_MOON
                } else {
                    0
                }),
                now,
            ),
        );
        let key = crate::troops::ExplorerKey {
            game_id,
            explorer_id: super::army_activity::slot_army(
                d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
            ),
        };
        let discovery = preset.economy.discovery.unwrap();
        let destination = crate::geometry::neighbor(super::army_activity::army(d, key).coord, 0);
        let root = world_test_support::tests::registrar::discovery_root(
            game_id, discovery, if pale {
                200
            } else {
                100
            }, 0, None, crate::discovery::Discovery::Beasts,
        );
        assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, key.explorer_id, root, now));
        let site = interact_with_state(
            d.games,
            || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination)).unwrap().entity_id,
        );
        let guard = crate::guards::GuardKey { game_id, structure_id: site, slot: 0 };
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
                    Command::BattleGuard(
                        crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site, relic_slot: None },
                    ),
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
            world_test_support::tests::play_fixture::play(
                d.games,
                world_test_support::tests::play_fixture::TestAction {
                    game_id,
                    actor: d.actor,
                    command: Command::SetEntityName(
                        crate::names::SetEntityName { entity_id: home.entity_id, name: 'after moons' },
                    ),
                },
                super::banes::root_for(game_id, 2, if blood {
                    0
                } else {
                    40
                }, 0),
                tomorrow,
            ),
        );
        assert_eq!(interact_with_state(d.games, || crate::logic::guards::guard(guard).troops.count), retained);
        assert_eq!(interact_with_state(d.games, || crate::logic::triumphs::effects(home, tomorrow).beast_bps), 10000);
    }
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

#[test]
fn spoils_doubles_numeric_clears_and_records_xp_but_keeps_ruin_relics() {
    for category in array![
        crate::taxonomy::BEASTS_CATEGORY, crate::taxonomy::CAMP_CATEGORY, crate::taxonomy::RIFT_CATEGORY,
        crate::taxonomy::RUIN_CATEGORY,
    ] {
        let mut preset = definition(5);
        let mut depths = array![];
        for depth in preset.settlement.depths {
            depths
                .append(
                    crate::expeditions::DepthRules {
                        site_guard_lower: 3,
                        site_guard_upper: 3,
                        beast_weak_lower: 1,
                        beast_weak_upper: 1,
                        beast_strong_lower: 2,
                        beast_strong_upper: 2,
                        guard_step: 1,
                        ..*depth,
                    },
                );
        }
        preset.settlement.depths = depths.span();
        let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
        let home = ResourceKey { game_id, entity_id: found(d, game_id, 1) };
        super::banes::train(d, home, 360);
        for tick in 1_u64..5 {
            pay(
                d,
                game_id,
                DEEP_FOUNDATION,
                1,
                array![DeepShare { home: home.entity_id, troops: 1 }].span(),
                360 + tick * 120,
            );
        }
        let now = world_test_support::tests::registrar::day_start(d, game_id, 1);
        world_test_support::tests::resource_commands::grant(
            d, home, crate::resources::WHEAT, 10000 * RESOURCE_PRECISION,
        );
        world_test_support::tests::resource_commands::grant(
            d, home, crate::troops::troop_resource(crate::troops::TroopType::Knight, 0), 3000 * RESOURCE_PRECISION,
        );
        assert!(
            world_test_support::tests::play_fixture::play(
                d.games,
                world_test_support::tests::play_fixture::TestAction {
                    game_id, actor: d.actor, command: super::army_activity::muster(home.entity_id, 0, 0, 3000),
                },
                super::banes::root_for(game_id, 1, 20, 0),
                now,
            ),
        );
        let key = crate::troops::ExplorerKey {
            game_id,
            explorer_id: super::army_activity::slot_army(
                d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
            ),
        };
        let relic = crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::Tome, rank: 1 };
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
            game_id, preset.economy.discovery.unwrap(), 200, 0, Some(relic), expected,
        );
        assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, key.explorer_id, root, now));
        let site_key = interact_with_state(
            d.games,
            || ResourceKey {
                game_id,
                entity_id: crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination))
                    .unwrap()
                    .entity_id,
            },
        );
        let site = interact_with_state(d.games, || crate::logic::expeditions::expedition_site(site_key).unwrap());
        let discovered_relic = interact_with_state(d.games, || crate::logic::army_relics::ruin(site_key));
        let before = interact_with_state(d.games, || crate::logic::progression::require(key).xp);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle {
                        attacker_id: key.explorer_id, defender_id: site_key.entity_id, relic_slot: None,
                    },
                ),
                now + 60,
            ),
        );
        interact_with_state(
            d.games,
            || {
                let receipt = crate::logic::expeditions::expedition_site(site_key).unwrap().clear.unwrap();
                let expected_xp = crate::progression::clear_xp(site.initial_guard_count, 0) * 2;
                assert_eq!(receipt.xp, expected_xp);
                assert_eq!(crate::logic::progression::require(key).xp - before, expected_xp);
                if category == crate::taxonomy::RUIN_CATEGORY {
                    assert_eq!(receipt.reward, None);
                    assert!(discovered_relic.is_some());
                    assert_eq!(crate::logic::army_relics::read(key).first, discovered_relic);
                } else {
                    let base = crate::expeditions::site_reward(category, site, 0).unwrap();
                    let paid = receipt.reward.unwrap();
                    assert_eq!(paid.resource_type, base.resource_type);
                    assert_eq!(paid.amount, base.amount * 2);
                }
                assert_eq!(crate::logic::triumphs::effects(home, now - 1).spoils_percent, 100);
                assert_eq!(crate::logic::triumphs::effects(home, now).spoils_percent, 200);
            },
        );
    }
}
