use snforge_std::interact_with_state;
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;

#[test]
fn weekly_bags_match_the_client_vector_and_never_repeat_at_the_boundary() {
    let expected = array![6_u8, 4, 0, 3, 1, 2, 5, 0, 2, 6, 3, 1, 4, 5, 4, 5, 2, 1, 3, 0, 6];
    for day in 0..expected.len() {
        assert_eq!(crate::quests::daily_quest(5, day.into()), *expected.at(day));
    }
    for seed in 0_u64..20 {
        let mut previous = 255_u8;
        for week in 0_u64..8 {
            let mut found = 0_u16;
            for index in 0_u64..7 {
                let kind = crate::quests::daily_quest(seed.into(), week * 7 + index);
                assert!(kind != previous);
                let mut bit = 1_u16;
                for _ in 0..kind {
                    bit *= 2;
                }
                assert!(found & bit == 0);
                found += bit;
                previous = kind;
            }
            assert_eq!(found, 127);
        }
    }
}

#[test]
fn a_free_home_reveals_then_collects_once_through_the_player_command() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    let home = ResourceKey { game_id, entity_id: crate::entity_ids::home_for_actor(game_id, d.actor) };
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(!execute_in_game(d, game_id, claim, 360));
    let mut timestamp = 360;
    let mut done = false;
    for step in 0_u32..40 {
        timestamp += 600;
        let action = interact_with_state(d.games, || next_reveal_action(home, (step % 2).try_into().unwrap()));
        assert!(execute_in_game(d, game_id, action, timestamp));
        done = interact_with_state(d.games, || crate::logic::quests::read(home, 0).completed_level == 1);
        if done {
            break;
        }
    }
    assert!(done);
    assert!(execute_in_game(d, game_id, claim, timestamp));
    assert!(execute_in_game(d, game_id, claim, timestamp));
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::quests::read(home, 0);
            assert_eq!(progress.progress, 15);
            assert_eq!(progress.completed_level, 1);
            assert_eq!(
                crate::logic::resources::balance(home, crate::resources::ESSENCE),
                1500 * crate::rules::RESOURCE_PRECISION,
            );
            use starknet::storage::StorageMapReadAccess;
            let grant = crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)).unwrap();
            assert_eq!(
                grant, (d.actor, 1000 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION),
            );
        },
    );
    let stranger = Deployment { actor: 777.try_into().unwrap(), ..d };
    assert!(!execute_in_game(stranger, game_id, claim, timestamp));
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 1 }),
            timestamp,
        ),
    );
}

fn next_reveal_action(home: ResourceKey, index: u8) -> Command {
    let id = *crate::logic::troops::home_armies(home).at(index.into());
    let explorer = crate::logic::troops::explorer(crate::troops::ExplorerKey { game_id: home.game_id, explorer_id: id })
        .unwrap();
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(explorer.coord, direction);
        let tile = crate::logic::map::tile(crate::geometry::tile_key(home.game_id, coord));
        if tile.is_none() || tile.unwrap().data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE == 0 {
            return Command::Explore(crate::commands::Explore { explorer_id: id, direction });
        }
    }
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(explorer.coord, direction);
        if crate::logic::map::occupancy(crate::geometry::tile_key(home.game_id, coord)).is_none() {
            return Command::Move(crate::commands::Move { explorer_id: id, directions: array![direction].span() });
        }
    }
    panic!("explorer surrounded");
}

#[test]
fn each_realm_level_doubles_both_rewards_and_the_bonus_changes_only_labor() {
    let normal = array![(1000_u128, 1500_u128), (2000, 3000), (4000, 6000), (8000, 12000)];
    let bonus = array![(1500_u128, 1500_u128), (3000, 3000), (6000, 6000), (12000, 12000)];
    for level in 1_u8..5 {
        assert_eq!(crate::quests::reward(1000, 1500, 100, level), *normal.at((level - 1).into()));
        assert_eq!(crate::quests::reward(1000, 1500, 150, level), *bonus.at((level - 1).into()));
    }
}

#[test]
#[feature("safe_dispatcher")]
fn the_operator_cannot_bypass_the_quest() {
    use crate::entry::{IHomeGrantsSafeDispatcher, IHomeGrantsSafeDispatcherTrait, LaborHome};
    use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
    let (d, game_id) = super::aspects::setup_aspects(5);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    start_cheat_caller_address(d.games, world_test_support::tests::authority());
    assert!(
        IHomeGrantsSafeDispatcher { contract_address: d.games }
            .grant_labor(LaborHome { game_id, home: crate::entity_ids::home_for_actor(game_id, d.actor) }, 0, d.actor)
            .is_err(),
    );
    stop_cheat_caller_address(d.games);
}
