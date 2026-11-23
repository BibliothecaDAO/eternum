use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::play_fixture::{create_game, fixture_params};
use world_test_support::tests::registrar::{CreateGameParams, IRegistrarSafeDispatcherTrait, safe};
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::race::{IRaceDispatcherTrait, IRaceLibraryDispatcher};

fn season_seconds(days: u64) -> u64 {
    days / crate::days::DAYS_PER_BAG * world_test_support::tests::registrar::bag_seconds()
}

#[test]
#[feature("safe_dispatcher")]
fn fifty_day_limit_finishes_once_before_a_rejected_order_and_keeps_settlement_independent() {
    let rules = crate::balance::race::RACE_RULES;
    let (d, _) = super::aspects::setup_aspects(5);
    let duration = season_seconds(rules.season_days);
    let launch = CreateGameParams { duration_seconds: duration, seed: 5, ..fixture_params('full season') };
    assert!(
        safe(d, world_test_support::tests::authority())
            .create_game(CreateGameParams { duration_seconds: duration + 1, ..launch })
            .is_err(),
    );
    let game_id = create_game(d.games, launch);
    let home = super::army_activity::found(d, game_id, 1);
    let end = launch.start_main_at + duration;
    let before = interact_with_state(d.games, || crate::logic::game::game(game_id));
    assert_eq!(
        crate::days::day_at_index(before, crate::balance::rules::SWITCHES.day_unit_seconds, rules.season_days - 1).end,
        end,
    );
    let command = Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'before end' });
    assert!(execute_in_game(d, game_id, command, end - 1));
    interact_with_state(
        d.games,
        || {
            let race = IRaceLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY),
            };
            assert_eq!(race.race_result(game_id), None);
        },
    );
    let mut events = spy_events();
    assert!(!execute_in_game(d, game_id, command, end));
    assert!(!execute_in_game(d, game_id, command, end + 10));
    assert!(execute_in_game(d, game_id, Command::MarkGameSettled(()), end + 10));
    assert!(execute_in_game(d, game_id, Command::MarkGameSettled(()), end + 11));
    interact_with_state(
        d.games,
        || {
            let race = IRaceLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY),
            };
            assert_eq!(
                race.race_result(game_id),
                Some(crate::race::RaceResult { winner: None, ended_at: end, scheduled_end_at: end }),
            );
            let game = crate::logic::game::game(game_id);
            assert_eq!(game.end_at, before.end_at);
            assert_eq!(game.scheduled_end_at, before.scheduled_end_at);
            assert!(game.settled);
            assert_eq!(
                crate::state::read().deep.paid_tick.read(game_id),
                Some(end / crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds),
            );
        },
    );
    let mut results = 0;
    for (_, event) in events.get_events().emitted_by(d.games).events {
        if event.keys.span() == array![selector!("RaceEvent"), selector!("RowSet"), 1, 'RaceResult'].span() {
            results += 1;
        }
    }
    assert_eq!(results, 1);
}

#[test]
fn published_season_one_starts_all_systems_and_settles_its_fiftieth_day() {
    let rules = crate::balance::race::RACE_RULES;
    assert_eq!(rules.season_days, 50);
    let (d, game_id) = world_test_support::tests::registrar::setup_open_frontier_for(season_seconds(rules.season_days));
    let home = super::army_activity::found(d, game_id, 1);
    let end = interact_with_state(
        d.games,
        || {
            let game = crate::logic::game::game(game_id);
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 0)), Some(0));
            assert_eq!(crate::logic::banes::kind(game_id, 0), None);
            assert_eq!(
                crate::logic::aspects::home_aspect(crate::resources::ResourceKey { game_id, entity_id: home }), 1,
            );
            let race = IRaceLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY),
            };
            for aspect in 1_u8..5 {
                let monument = race.aspect_hyperstructure(crate::race::AspectKey { game_id, aspect });
                assert_eq!(monument.height, 0);
            }
            assert_eq!(
                game.end_at,
                crate::days::day_at_index(game, crate::balance::rules::SWITCHES.day_unit_seconds, rules.season_days - 1)
                    .end,
            );
            game.end_at
        },
    );
    assert!(execute_in_game(d, game_id, Command::MarkGameSettled(()), end));
    interact_with_state(
        d.games,
        || {
            let race = IRaceLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::ECONOMY),
            };
            assert_eq!(race.race_result(game_id).unwrap().winner, None);
            assert!(crate::logic::game::game(game_id).settled);
        },
    );
}
