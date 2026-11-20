pub use world_test_support::tests::season_lifecycle::*;

fn rules_awarding(explore: u32, capture: u32) -> crate::rules::SliceRules {
    let rules = super::play_fixture::rules();
    crate::rules::SliceRules {
        victory_points_grant_config: crate::rules::VictoryPointsGrantConfig {
            explore_tiles_points: explore, claim_otherstructure_points: capture, ..rules.victory_points_grant_config,
        },
        ..rules,
    }
}

fn award_context(d: super::Deployment) -> crate::commands::ActionContext {
    crate::commands::action_context(
        crate::commands::ExecutionContext { timestamp: 100, ..crate::tests::context(d.games, 3) },
    )
}

#[test]
fn timed_games_accept_commands_until_their_clock_stops() {
    let rules = crate::rules::SliceRules {
        mode_rules: super::play_fixture::BLITZ_RULES,
        entry_rule: crate::rules::ENTRY_ROSTER,
        command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
        ..super::play_fixture::rules(),
    };
    let (blitz, home, _) = setup_with_rules(rules);
    let name = Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'Last turn' });
    assert!(execute(blitz, name, 199));
    assert_terminal_rejection(blitz, name, 200);
}

#[test]
fn each_points_change_emits_one_award_with_absolute_player_and_season_totals() {
    let (d, _, _) = setup_with_rules(rules_awarding(11, 7));
    let mut spy = snforge_std::spy_events();
    start_cheat_caller_address(d.games, d.games);
    points(d).register_exploration(3, d.actor, award_context(d));
    assert_eq!(points(d).register_capture(3, d.actor, award_context(d)), 7);
    assert_eq!(points(d).register_capture(3, d.actor, award_context(d)), 7);
    stop_cheat_caller_address(d.games);
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 3);
    let expected = array![array![0, 11, 11, 11].span(), array![1, 7, 18, 18].span(), array![1, 7, 25, 25].span()];
    for index in 0..3_u32 {
        let (_, event) = events.events.at(index);
        assert_eq!(event.keys.span(), array![selector!("PointsAwarded"), 1, 3, d.actor.into()].span());
        assert_eq!(event.data.span(), *expected.at(index));
    }
    assert_eq!(points(d).player_points(3, d.actor), 25);
    assert_eq!(points(d).season_points(3), 25);
    let mut spy = snforge_std::spy_events();
    let other = 456.try_into().unwrap();
    start_cheat_caller_address(d.games, d.games);
    points(d).register_capture(3, other, award_context(d));
    stop_cheat_caller_address(d.games);
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 1);
    let (_, event) = events.events.at(0);
    assert_eq!(*event.keys.at(3), other.into());
    assert_eq!(event.data.span(), array![1, 7, 7, 32].span());
    assert_eq!(points(d).player_points(3, other), 7);
    assert_eq!(points(d).player_points(3, d.actor), 25);
    assert_eq!(points(d).season_points(3), 32);
}

#[test]
fn a_zero_point_activity_changes_no_total_and_emits_no_award() {
    let (d, _, _) = setup_with_rules(rules_awarding(0, 7));
    let mut spy = snforge_std::spy_events();
    start_cheat_caller_address(d.games, d.games);
    points(d).register_exploration(3, d.actor, award_context(d));
    stop_cheat_caller_address(d.games);
    assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    assert_eq!(points(d).player_points(3, d.actor), 0);
    assert_eq!(points(d).season_points(3), 0);
}

#[test]
fn points_awards_wire_matches_the_herald_replay_fixture() {
    let (d, _, _) = setup_with_rules(rules_awarding(11, 7));
    let first: starknet::ContractAddress = 273.try_into().unwrap();
    let second = 546.try_into().unwrap();
    let carried = 9007199254740982_u128;
    super::resource_commands::set_fixture(
        d.games, selector!("season"), selector!("player_points"), array![3, first.into()].span(), carried,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("season"), selector!("season_points"), array![3].span(), carried,
    );
    let mut spy = snforge_std::spy_events();
    start_cheat_caller_address(d.games, d.games);
    points(d).register_exploration(3, first, award_context(d));
    points(d).register_capture(3, second, award_context(d));
    points(d).register_exploration(3, first, award_context(d));
    stop_cheat_caller_address(d.games);
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
