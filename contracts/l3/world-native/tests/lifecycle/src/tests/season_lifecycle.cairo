pub use world_test_support::tests::season_lifecycle::*;

#[test]
fn season_close_at_the_same_block_time_has_the_same_points() {
    let (immediate, first, home, _) = super::hyperstructures::setup_with_threshold(1);
    super::hyperstructures::complete(immediate, first, home);
    assert!(execute(immediate, Command::CloseSeason, 100));
    let (delayed, second, home, _) = super::hyperstructures::setup_with_threshold(1);
    super::hyperstructures::complete(delayed, second, home);
    assert!(execute(delayed, Command::CloseSeason, 100));
    assert_eq!(games(delayed).game(3).end_at, games(immediate).game(3).end_at);
    assert_eq!(
        crate::game::status_at(games(delayed).game(3), 100), crate::game::status_at(games(immediate).game(3), 100),
    );
    assert_eq!(points(delayed).player_points(3, delayed.actor), points(immediate).player_points(3, immediate.actor));
    assert_eq!(
        hypers(delayed).hyperstructure_shares(second).start_at, hypers(immediate).hyperstructure_shares(first).start_at,
    );
}

#[test]
fn zero_or_missing_threshold_never_ends_the_season() {
    let (deployment, _, _) = setup_with_rules(super::play_fixture::rules());
    assert_terminal_rejection(deployment, Command::CloseSeason, 40);
    assert_terminal_rejection(deployment, Command::CloseSeason, 40);
    assert_eq!(games(deployment).game(3).end_at, 200);
}

#[test]
fn season_close_requires_started_eternum_and_timed_games_stop_at_their_clock() {
    let (eternum, _, _) = setup_with_threshold(super::play_fixture::rules(), 1);
    assert_terminal_rejection(eternum, Command::CloseSeason, 19);
    assert_terminal_rejection(eternum, Command::CloseSeason, 200);
    let rules = crate::rules::SliceRules {
        mode_rules: super::play_fixture::BLITZ_RULES,
        entry_rule: crate::rules::ENTRY_ROSTER,
        command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
        ..super::play_fixture::rules(),
    };
    let (blitz, home, _) = setup_with_threshold(rules, 1);
    assert_terminal_rejection(blitz, Command::CloseSeason, 100);
    let name = Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'Last turn' });
    assert!(execute(blitz, name, 199));
    assert_terminal_rejection(blitz, name, 200);
}

#[test]
#[feature("safe_dispatcher")]
fn season_presets_are_authorized_immutable_and_game_scoped() {
    let (deployment, _, _) = setup_with_threshold(super::play_fixture::rules(), 1);
    let season = ISeasonLifecycleSafeDispatcher { contract_address: deployment.games };
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let mut preset = super::resource_commands::fixture_preset(super::play_fixture::rules());
    preset.season_win_points = 2;
    start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    let before = games(deployment).game(3);
    let remaining = season
        .close_season(3, deployment.actor, crate::commands::action_context(super::context(deployment.games, 3)))
        .unwrap();
    assert_eq!(remaining, 0);
    assert_eq!(games(deployment).game(3), before);
    start_cheat_caller_address(deployment.games, super::authority());
    assert!(registrar.register_preset(games(deployment).game(3).preset_id, preset).is_err());
    assert_eq!(season.season_win_threshold(3).unwrap(), 1);
    assert_eq!(season.season_win_threshold(2).unwrap(), 0);
    assert!(season.season_win_threshold(999).is_err());
}

#[test]
fn empty_checkpoint_work_reports_zero_without_claiming_a_win() {
    let (d, _, _) = setup_with_threshold(super::play_fixture::rules(), 1);
    execute_batch(d, Command::CloseSeason, 100, 0);
    assert_eq!(games(d).game(3).end_at, 200);
}

#[test]
fn another_player_can_finish_an_attempt_without_changing_its_initiator() {
    let (d, _) = nine_completed_hyperstructures(1);
    let other = super::bind_authority(d);
    assert!(execute(d, Command::CloseSeason, 100));
    assert!(execute(other, Command::CloseSeason, 110));
    assert_eq!(games(d).game(3).end_at, 110);
    assert_eq!(points(d).player_points(3, other.actor), 0);
}

#[test]
fn game_finalization_waits_for_the_last_hyperstructure_checkpoint_batch() {
    let (deployment, keys) = nine_completed_hyperstructures(0);
    let first_player = super::bind_authority(deployment);
    assert!(deployment.actor != super::authority());
    let game = games(deployment).game(3);
    let timestamp = game.end_at + game.end_grace_seconds.into() + 1;
    execute_batch(first_player, Command::MarkGameSettled, timestamp, 1);
    assert!(!games(deployment).game(3).settled);
    assert_eq!(hypers(deployment).hyperstructure_shares(*keys.at(7)).start_at, game.end_at);
    assert_eq!(hypers(deployment).hyperstructure_shares(*keys.at(8)).start_at, 50);
    execute_batch(deployment, Command::MarkGameSettled, timestamp + 1, 0);
    assert!(games(deployment).game(3).settled);
    assert_eq!(hypers(deployment).hyperstructure_shares(*keys.at(8)).start_at, game.end_at);
}

#[test]
fn checkpoint_member_event_uses_the_declared_short_string_identity() {
    let (deployment, hyper, home, _) = super::hyperstructures::setup_with_threshold(1);
    super::hyperstructures::complete(deployment, hyper, home);
    let mut events = snforge_std::spy_events();
    assert!(execute(deployment, Command::CloseSeason, 100));
    let mut found = false;
    for (_, event) in events.get_events().emitted_by(deployment.games).events.span() {
        if event.keys.len() == 5
            && *event.keys.at(1) == selector!("RowMemberSet")
            && *event.keys.at(3) == 'HyperstructureShares' {
            assert_eq!(*event.keys.at(4), 'start_at');
            assert_eq!(event.data.span(), array![2, 3, hyper.entity_id.into(), 1, 100].span());
            found = true;
        }
    }
    assert!(found);
}

#[test]
fn a_winning_final_player_cannot_replace_an_ineligible_close_initiator() {
    let (d, _) = nine_completed_hyperstructures(1);
    let other = super::bind_authority(d);
    assert!(execute(other, Command::CloseSeason, 100));
    assert!(execute(d, Command::CloseSeason, 110));
    assert_eq!(games(d).game(3).end_at, 200);
    assert_eq!(points(d).player_points(3, other.actor), 0);
    assert!(execute(d, Command::CloseSeason, 120));
    assert!(execute(other, Command::CloseSeason, 130));
    assert_eq!(games(d).game(3).end_at, 130);
}

#[test]
fn players_with_different_accounts_final_batches_settle_the_same_points_and_game() {
    let (first_player, first_player_key, first_player_home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(first_player, first_player_key, first_player_home);
    let (helper, helper_key, helper_home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(helper, helper_key, helper_home);
    let game = games(first_player).game(3);
    for d in array![first_player, helper] {
        super::resource_commands::set_fixture(d.games, selector!("games"), selector!("games"), array![3].span(), game);
    }
    let (helper_account, _) = super::deploy_player(3, super::GUARDIAN);
    let helper_player = super::Deployment { actor: helper_account, ..helper };
    assert!(first_player.actor != super::authority() && helper_player.actor != first_player.actor);
    let first_player_before = points(first_player).player_points(3, first_player.actor);
    let helper_before = points(helper).player_points(3, helper.actor);
    let timestamp = game.end_at + game.end_grace_seconds.into() + 1;
    execute_batch(first_player, Command::MarkGameSettled, timestamp, 0);
    execute_batch(helper_player, Command::MarkGameSettled, timestamp, 0);
    assert_eq!(games(first_player).game(3), games(helper).game(3));
    assert_eq!(
        points(first_player).player_points(3, first_player.actor) - first_player_before,
        points(helper).player_points(3, helper.actor) - helper_before,
    );
    assert_eq!(hypers(first_player).hyperstructure_shares(first_player_key).start_at, game.end_at);
    assert_eq!(hypers(helper).hyperstructure_shares(helper_key).start_at, game.end_at);
    assert!(games(helper).game(3).settled);
    let final_points = points(helper).player_points(3, helper.actor);
    execute_batch(helper_player, Command::MarkGameSettled, timestamp + 2, 0);
    assert_eq!(points(helper).player_points(3, helper.actor), final_points);
}

#[test]
fn points_awards_wire_matches_the_herald_replay_fixture() {
    let (d, _, _) = setup_with_rules(super::play_fixture::rules());
    let mut spy = snforge_std::spy_events();
    start_cheat_caller_address(d.games, d.games);
    let first = 273.try_into().unwrap();
    let second = 546.try_into().unwrap();
    points(d).register_hyperstructure_points(3, first, 9007199254740993);
    points(d).register_hyperstructure_points(3, second, 7);
    points(d).register_hyperstructure_points(3, first, 11);
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 3);
    let mut wire = array![];
    for (_, event) in events.events {
        assert_eq!(event.keys.len(), 4);
        assert_eq!(*event.keys.at(0), selector!("PointsAwarded"));
        wire.append_span(event.keys.span().slice(1, 3));
        wire.append_span(event.data.span());
    }
    assert_eq!(wire, read_txt(@FileTrait::new("../fixtures/gameplay-facts/points-awards.txt")));
    assert_eq!(points(d).player_points(3, first), 9007199254741004);
    assert_eq!(points(d).player_points(3, second), 7);
    assert_eq!(points(d).season_points(3), 9007199254741011);
}
