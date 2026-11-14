use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::preset_projection::optional_race_rules;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::deep::{DeepShare, IDeepRewardsDispatcherTrait, IDeepRewardsLibraryDispatcher};
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
            assert!(repeated.get_events().emitted_by(d.games).events.is_empty());
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
    let emitted = events.get_events().emitted_by(d.games);
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
    use crate::deep::{IDeepRewardsSafeDispatcherTrait, IDeepRewardsSafeLibraryDispatcher};
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
    use crate::deep::{IDeepRewardsSafeDispatcherTrait, IDeepRewardsSafeLibraryDispatcher};
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
    use world_test_support::tests::registrar::{
        CreateGameParams, IRegistrarDispatcherTrait, IRegistrarSafeDispatcherTrait, params, registry, safe,
    };
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
