use snforge_std::interact_with_state;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::race::{IHeightBaneDispatcherTrait, IHeightBaneLibraryDispatcher};
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
        let (actor, _) = world_test_support::tests::deploy_player(
            1000 + Into::<u32, felt252>::into(index), world_test_support::tests::GUARDIAN,
        );
        let player = world_test_support::tests::bind_player(d, actor);
        settle(player, game_id, 360);
    }
    let next = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, 0)), 5);
            assert_eq!(crate::logic::banes::required(game_id, 1, 1), 2);
            let game = crate::logic::game::game(game_id);
            let unit = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read();
            crate::days::day_of(game, unit, 360).end
        },
    );
    let (first_actor, _) = world_test_support::tests::deploy_player(2001, world_test_support::tests::GUARDIAN);
    let first = world_test_support::tests::bind_player(d, first_actor);
    let (second_actor, _) = world_test_support::tests::deploy_player(2002, world_test_support::tests::GUARDIAN);
    let second = world_test_support::tests::bind_player(d, second_actor);
    let first_home = settle(first, game_id, next);
    let second_home = settle(second, game_id, next);
    let first_done = reveal_quest(first, first_home, next);
    let essence_before_claim = interact_with_state(
        d.games, || crate::logic::resources::balance(first_home, crate::resources::ESSENCE),
    );
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
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, 1)), 2);
            assert_eq!(
                crate::logic::resources::balance(first_home, crate::resources::ESSENCE),
                essence_before_claim + 3000 * crate::rules::RESOURCE_PRECISION,
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

#[test]
fn activity_counts_a_home_once_through_slot_reuse_rejection_and_rollover() {
    let (d, game_id) = super::aspects::setup_aspects(15);
    let home = settle(d, game_id, 360);
    let armies = interact_with_state(d.games, || crate::logic::troops::home_armies(home));
    assert_eq!(armies.len(), 2);
    for id in armies {
        assert!(
            execute_in_game(
                d, game_id, Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(*id)), 361,
            ),
        );
    }
    world_test_support::tests::resource_commands::grant(
        d,
        home,
        crate::troops::stock_resource(crate::troops::TroopType::Knight, crate::troops::TroopTier::T1),
        10 * crate::rules::RESOURCE_PRECISION,
    );
    let first = Command::CreateExplorer(
        crate::commands::CreateExplorer {
            structure_id: home.entity_id,
            category: crate::troops::TroopType::Knight.into(),
            tier: 0,
            amount: crate::rules::RESOURCE_PRECISION,
            direction: 0,
            slot: 1,
        },
    );
    let second = Command::CreateExplorer(
        crate::commands::CreateExplorer {
            structure_id: home.entity_id,
            category: crate::troops::TroopType::Knight.into(),
            tier: 0,
            amount: crate::rules::RESOURCE_PRECISION,
            direction: 1,
            slot: 0,
        },
    );
    assert!(execute_in_game(d, game_id, first, 362));
    assert!(!execute_in_game(d, game_id, first, 362));
    assert!(execute_in_game(d, game_id, second, 363));
    let next = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, 0)), 1);
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 2, 0)), 0);
            assert_eq!(crate::logic::banes::required(game_id, 1, 1), 1);
            let game = crate::logic::game::game(game_id);
            let unit = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read();
            crate::days::day_of(game, unit, 360).end
        },
    );
    assert!(execute_in_game(d, game_id, first, next + 1));
    assert!(execute_in_game(d, game_id, second, next + 2));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, 0)), 1);
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id, 1, 1)), 1);
            assert_eq!(crate::state::read().troops.aspect_activity.read((game_id + 1, 1, 1)), 0);
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

#[test]
fn team_lights_end_height_suppression_without_a_world_bonus_or_quest_switch() {
    let (d, game_id) = super::aspects::setup_aspects(15);
    for index in 0_u32..5 {
        let (actor, _) = world_test_support::tests::deploy_player(
            3000 + Into::<u32, felt252>::into(index), world_test_support::tests::GUARDIAN,
        );
        settle(world_test_support::tests::bind_player(d, actor), game_id, 360);
    }
    let next = interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            state.deep.team_banes.write((game_id, 1, 1), Some((2, 0, crate::quests::LIGHTS)));
            state.banes.first_team_day.write(game_id, Some(0));
            assert_eq!(state.troops.aspect_activity.read((game_id, 1, 0)), 5);
            assert_eq!(crate::logic::banes::required(game_id, 1, 1), 2);
            assert!(crate::logic::banes::kind(game_id, 1).is_none());
            let game = crate::logic::game::game(game_id);
            let unit = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read();
            crate::days::day_of(game, unit, 360).end
        },
    );
    let (first_actor, _) = world_test_support::tests::deploy_player(4001, world_test_support::tests::GUARDIAN);
    let first = world_test_support::tests::bind_player(d, first_actor);
    let (second_actor, _) = world_test_support::tests::deploy_player(4002, world_test_support::tests::GUARDIAN);
    let second = world_test_support::tests::bind_player(d, second_actor);
    let first_home = settle(first, game_id, next);
    let second_home = settle(second, game_id, next);
    let first_done = reveal_quest(first, first_home, next);
    let before = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::quest_kind(first_home, 1), crate::quests::LIGHTS);
            assert_eq!(crate::logic::banes::progress(game_id, 1, 1).completed, 1);
            assert!(
                IHeightBaneLibraryDispatcher { class_hash: crate::logic::deep_sites::dispatcher(game_id).class_hash }
                    .height_blocked(game_id, 1, first_done),
            );
            crate::logic::resources::balance(first_home, crate::resources::ESSENCE)
        },
    );
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: first_home.entity_id, day: 1 });
    assert!(execute_in_game(first, game_id, claim, first_done));
    let second_done = reveal_quest(second, second_home, first_done);
    assert!(execute_in_game(first, game_id, claim, second_done));
    assert!(execute_in_game(first, game_id, claim, second_done));
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::banes::progress(game_id, 1, 1);
            assert_eq!(progress.completed, 2);
            assert_eq!(progress.ended_at, second_done);
            assert!(
                IHeightBaneLibraryDispatcher { class_hash: crate::logic::deep_sites::dispatcher(game_id).class_hash }
                    .height_blocked(game_id, 1, second_done - 1),
            );
            assert!(
                !IHeightBaneLibraryDispatcher { class_hash: crate::logic::deep_sites::dispatcher(game_id).class_hash }
                    .height_blocked(game_id, 1, second_done),
            );
            assert_eq!(crate::logic::banes::quest_kind(first_home, 1), crate::quests::LIGHTS);
            assert!(!crate::logic::banes::won(first_home, 1));
            assert!(crate::state::read().banes.bonus_grants.read((game_id, first_home.entity_id, 1)).is_none());
            assert_eq!(
                crate::logic::resources::balance(first_home, crate::resources::ESSENCE),
                before + 1500 * crate::rules::RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::state::read().entry.home_labor_grants.read((game_id, first_home.entity_id, 1)),
                Some((first.actor, 1000 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION)),
            );
            assert!(crate::logic::banes::windows(first_home, next, second_done + 1).is_empty());
        },
    );
}
