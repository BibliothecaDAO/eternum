use world_test_support::tests::releases::*;

fn setup() -> (super::Deployment, u32) {
    let (d, game_id) = super::registrar::setup_open_frontier();
    let releases = IReleasesDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    releases
        .register_release(
            2,
            Release { previous: 1, migration: declare_logic("ReleaseMigration"), ..releases.release(1) },
            releases.release_classes(1),
        );
    (d, game_id)
}
#[test]
fn release_backfills_the_scheduled_end_once_without_extending_play() {
    let (d, game_id) = setup();
    let games = IGameDispatcher { contract_address: d.games };
    let before = games.game(game_id);
    assert!(before.end_at != 0);
    interact_with_state(
        d.games,
        || {
            crate::state::write()
                .games
                .games
                .write(game_id, crate::game::GameRegistry { scheduled_end_at: 0, ..before });
        },
    );
    let releases = IReleasesDispatcher { contract_address: d.games };
    let mut events = spy_events();
    releases.apply_release(game_id, 2);
    let backfilled = crate::game::GameRegistry { scheduled_end_at: before.end_at, ..before };
    assert_eq!(games.game(game_id), backfilled);
    assert_eq!(releases.game_release(game_id), 2);
    let emitted = events.get_events().emitted_by(d.games);
    assert_eq!(emitted.events.len(), 2);
    let (_, row) = emitted.events.at(1);
    assert_eq!(row.keys.span(), array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameRegistry'].span());
    let mut values = array![];
    backfilled.serialize(ref values);
    let mut expected = array![1, game_id.into(), values.len().into()];
    expected.append_span(values.span());
    assert_eq!(row.data.span(), expected.span());
    let mut repeated = spy_events();
    releases.apply_release(game_id, 2);
    assert!(repeated.get_events().emitted_by(d.games).events.is_empty());
    assert_eq!(games.game(game_id), backfilled);
}
