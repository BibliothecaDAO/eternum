use snforge_std::interact_with_state;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;

#[test]
fn world_rolls_match_the_client_and_stop_after_the_first_team_issue() {
    let expected = array![0_u8, 0, 3, 0, 0, 0, 3, 0, 0, 1, 0, 1, 0, 0, 3, 0, 0, 2, 0, 0, 3, 0, 0, 0, 0];
    for day in 0..expected.len() {
        assert_eq!(crate::banes::world_kind(5, day.into(), None, 20).unwrap_or(0), *expected.at(day));
    }
    assert_eq!(crate::banes::world_kind(14, 1, Some(1), 20), Some(crate::banes::MIST_TIDE));
    for day in 2_u64..50 {
        assert!(crate::banes::world_kind(14, day, Some(1), 20).is_none());
    }
    assert_eq!(crate::banes::required(0, 25), 0);
    assert_eq!(crate::banes::required(1, 25), 1);
    assert_eq!(crate::banes::required(4, 25), 1);
    assert_eq!(crate::banes::required(5, 25), 2);
}

#[test]
fn two_homes_end_the_lights_and_collect_the_second_grant_once() {
    let (d, game_id) = super::aspects::setup_aspects(15);
    for index in 0_u32..5 {
        let player = Deployment { actor: (1000 + Into::<u32, felt252>::into(index)).try_into().unwrap(), ..d };
        settle(player, game_id, 360);
    }
    let next = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.activity.read((game_id, 1, 0)), 5);
            assert_eq!(crate::logic::banes::required(game_id, 1, 1), 2);
            let game = crate::logic::game::game(game_id);
            let unit = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read();
            crate::days::day_of(game, unit, 360).end
        },
    );
    let first = Deployment { actor: 2001.try_into().unwrap(), ..d };
    let second = Deployment { actor: 2002.try_into().unwrap(), ..d };
    let first_home = settle(first, game_id, next);
    let second_home = settle(second, game_id, next);
    let first_done = reveal_quest(first, first_home, next);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: first_home.entity_id, day: 1 });
    assert!(execute_in_game(first, game_id, claim, first_done));
    interact_with_state(
        d.games,
        || {
            assert!(!crate::logic::banes::won(first_home, 1));
            assert!(crate::state::read().banes.bonus_grants.read((game_id, first_home.entity_id, 1)).is_none());
        },
    );
    let second_done = reveal_quest(second, second_home, first_done);
    let now = core::cmp::max(first_done, second_done);
    assert!(execute_in_game(first, game_id, claim, now));
    assert!(execute_in_game(first, game_id, claim, now));
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::banes::progress(game_id, 1, 1);
            assert_eq!(progress.completed, 2);
            assert_eq!(progress.ended_at, second_done);
            assert_eq!(crate::logic::banes::quest_kind(first_home, 1), crate::quests::LIGHTS);
            assert_eq!(crate::state::read().banes.activity.read((game_id, 1, 1)), 2);
            assert_eq!(
                crate::logic::resources::balance(first_home, crate::resources::ESSENCE),
                3000 * crate::rules::RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::state::read().banes.bonus_grants.read((game_id, first_home.entity_id, 1)),
                Some((1000 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION)),
            );
            let windows = crate::logic::banes::windows(first_home, next - 1, now + 1);
            assert_eq!(windows.len(), 1);
            assert_eq!(
                *windows.at(0),
                crate::banes::BaneWindow { kind: crate::banes::MIST_TIDE, start: next, end: second_done },
            );
        },
    );
}

fn settle(d: Deployment, game_id: u32, timestamp: u64) -> ResourceKey {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            timestamp,
        ),
    );
    ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    }
}

fn reveal_quest(d: Deployment, home: ResourceKey, start: u64) -> u64 {
    for step in 0_u32..45 {
        let timestamp = start + Into::<u32, u64>::into(step + 1) * 1200;
        let action = interact_with_state(
            d.games, || super::quests::next_reveal_action(home, (step % 2).try_into().unwrap()),
        );
        assert!(execute_in_game(d, home.game_id, action, timestamp));
        if interact_with_state(d.games, || crate::logic::quests::read(home, 1).completed_level == 1) {
            return timestamp;
        }
    }
    panic!("The Lights did not complete")
}
