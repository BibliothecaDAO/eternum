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
