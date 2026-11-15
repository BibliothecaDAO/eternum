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
    let mut preset = super::banes::deep_definition();
    let rules = world_test_support::tests::preset_projection::optional_race_rules();
    preset.economy.race = Some(rules);
    let (d, _) = super::aspects::setup_aspect_preset(5, preset);
    let duration = rules.season_days
        / crate::days::DAYS_PER_BAG
        * crate::days::UNITS_PER_BAG
        * Into::<u32, u64>::into(preset.rules.day_unit_seconds);
    let launch = CreateGameParams {
        start_main_at: 360, duration_seconds: duration, end_grace_seconds: 0, seed: 5, ..params(false),
    };
    assert!(safe(d).create_game(CreateGameParams { duration_seconds: duration + 1, ..launch }).is_err());
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
                Some(end / preset.rules.tick_config.armies_tick_in_seconds),
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
