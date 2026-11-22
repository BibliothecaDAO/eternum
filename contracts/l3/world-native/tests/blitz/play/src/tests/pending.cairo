use super::play_fixture::encode;

#[test]
fn a_blitz_game_refuses_a_command_whose_logic_has_not_returned() {
    let (deployment, game_id) = super::fixture::blitz_game();
    let relic = crate::relics::ApplyRelic { entity_id: 1, relic_id: 1, recipient: crate::relics::Recipient::Explorer };
    super::assert_entry_refusal(
        deployment, game_id, 1, encode(super::Command::ApplyRelic(relic)), "Blitz logic pending",
    );
}

#[test]
fn a_blitz_game_refuses_a_command_of_the_season_alone() {
    let (deployment, game_id) = super::fixture::blitz_game();
    let quest = crate::quests::ClaimDailyQuest { home: 1, day: 0 };
    super::assert_entry_refusal(
        deployment, game_id, 1, encode(super::Command::ClaimDailyQuest(quest)), "command disabled",
    );
}
