pub use world_test_support::tests::season_lifecycle::*;

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
