use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::registrar::{
    CreateGameParams, IRegistrarDispatcherTrait, IRegistrarSafeDispatcherTrait, params, registry, safe,
};
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::race::{IRaceDispatcherTrait, IRaceLibraryDispatcher};

#[test]
#[feature("safe_dispatcher")]
fn fifty_day_limit_finishes_once_before_a_rejected_order_and_keeps_settlement_independent() {
    let preset = super::banes::deep_definition();
    let rules = preset.economy.race.unwrap();
    let (d, _) = super::aspects::setup_aspect_preset(5, preset);
    let duration = rules.season_days
        / crate::days::DAYS_PER_BAG
        * crate::days::UNITS_PER_BAG
        * Into::<u32, u64>::into(preset.rules.day_unit_seconds);
    let launch = CreateGameParams {
        name: 'full season',
        start_main_at: 360,
        duration_seconds: duration,
        end_grace_seconds: 0,
        seed: 5,
        ..params(false),
    };
    assert!(
        safe(d, world_test_support::tests::authority())
            .create_game(CreateGameParams { duration_seconds: duration + 1, ..launch })
            .is_err(),
    );
    let game_id = registry(d).create_game(launch);
    let home = super::army_activity::found(d, game_id, 1);
    let end = launch.start_main_at + duration;
    let before = interact_with_state(d.games, || crate::logic::game::game(game_id));
    assert_eq!(crate::days::day_at_index(before, preset.rules.day_unit_seconds, rules.season_days - 1).end, end);
    let command = Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'before end' });
    assert!(execute_in_game(d, game_id, command, end - 1));
    interact_with_state(
        d.games,
        || {
            let race = IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).economy.read() };
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
            let race = IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).economy.read() };
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
    let (preset_id, preset) = world_test_support::tests::preset_projection::current_definition("frontier");
    assert_eq!(preset_id, 7);
    let rules = preset.economy.race.unwrap();
    assert_eq!(rules.season_days, 50);
    let bags = rules.season_days / crate::days::DAYS_PER_BAG;
    let (d, game_id) = world_test_support::tests::registrar::setup_open_frontier_preset("frontier", bags);
    let home = super::army_activity::found(d, game_id, 1);
    let end = interact_with_state(
        d.games,
        || {
            let game = crate::logic::game::game(game_id);
            assert_eq!(game.preset_id, preset_id);
            assert!(crate::logic::quests::enabled(game_id));
            assert!(crate::logic::deep_sites::rules_entry(game_id).is_some());
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 0)), Some(0));
            assert_eq!(crate::logic::banes::kind(game_id, 0), None);
            assert_eq!(
                crate::logic::aspects::home_aspect(crate::resources::ResourceKey { game_id, entity_id: home }), 1,
            );
            let race = IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).economy.read() };
            for aspect in 1_u8..5 {
                let monument = race.aspect_hyperstructure(crate::race::AspectKey { game_id, aspect });
                assert_eq!(monument.height, 0);
            }
            assert_eq!(game.end_at, crate::days::day_at_index(game, preset.rules.day_unit_seconds, 49).end);
            game.end_at
        },
    );
    assert!(execute_in_game(d, game_id, Command::MarkGameSettled(()), end));
    interact_with_state(
        d.games,
        || {
            let race = IRaceLibraryDispatcher { class_hash: crate::logic::release::classes(game_id).economy.read() };
            assert_eq!(race.race_result(game_id).unwrap().winner, None);
            assert!(crate::logic::game::game(game_id).settled);
        },
    );
}
