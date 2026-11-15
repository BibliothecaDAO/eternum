use snforge_std::interact_with_state;
use starknet::storage::StoragePointerReadAccess;
use world_test_support::tests::registrar::{discovery_root, explore_with_root, setup_frontier_relics};
use world_test_support::tests::resource_commands::{execute_in_game, grant, set_explorer_fixture};
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;
use crate::troop_management::{ManageTroops, RecruitExplorer};

#[test]
fn a_cleared_camp_reinforces_from_home_on_each_layer_above_the_deep() {
    for depth in 0_u8..3 {
        let (d, game_id, key) = setup_frontier_relics();
        let home = ResourceKey { game_id, entity_id: 1 };
        let mut army = super::army_activity::army(d, key);
        army.coord = crate::expeditions::site(1024, 1, 0, depth);
        army.coord.x += 10;
        army.troops.count = 100 * RESOURCE_PRECISION;
        set_explorer_fixture(d.games, key, army);
        grant(d, home, crate::resources::WHEAT, 10000 * RESOURCE_PRECISION);
        let destination = crate::geometry::neighbor(army.coord, 0);
        let discovery = interact_with_state(
            d.games, || crate::logic::preset_record::for_game(game_id).discovery_rules.read().unwrap(),
        );
        let root = discovery_root(game_id, discovery, 200, 0, None, crate::discovery::Discovery::Camp);
        assert!(explore_with_root(d, game_id, key.explorer_id, root, 360));
        let site_key = interact_with_state(
            d.games,
            || ResourceKey {
                game_id,
                entity_id: crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination))
                    .unwrap()
                    .entity_id,
            },
        );
        let recruit = Command::ManageTroops(
            ManageTroops::RecruitExplorer(
                RecruitExplorer {
                    explorer_id: key.explorer_id, amount: RESOURCE_PRECISION, supply_post: Some(site_key.entity_id),
                },
            ),
        );
        assert!(!execute_in_game(d, game_id, recruit, 361));
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::BattleGuard(
                    crate::commands::Battle {
                        attacker_id: key.explorer_id, defender_id: site_key.entity_id, relic_slot: None,
                    },
                ),
                420,
            ),
        );
        if !crate::geometry::adjacent(super::army_activity::army(d, key).coord, destination) {
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![3].span() }),
                    480,
                ),
            );
        }
        let before = super::army_activity::army(d, key).troops.count;
        let stock = interact_with_state(d.games, || crate::logic::resources::balance(home, 26));
        assert!(execute_in_game(d, game_id, recruit, 540));
        assert_eq!(super::army_activity::army(d, key).troops.count, before + RESOURCE_PRECISION);
        interact_with_state(
            d.games,
            || {
                assert_eq!(crate::logic::resources::balance(home, 26), stock - RESOURCE_PRECISION);
                assert_eq!(crate::logic::expeditions::expedition_site(site_key).unwrap().clear.unwrap().home_id, 1);
            },
        );
        assert!(execute_in_game(d, game_id, recruit, 541));
        assert_eq!(super::army_activity::army(d, key).troops.count, before + 2 * RESOURCE_PRECISION);
        let next_day = world_test_support::tests::registrar::day_start(d, game_id, 1);
        assert!(!execute_in_game(d, game_id, recruit, next_day));
    }
}

#[test]
fn a_supply_post_requires_the_clearing_home_today_above_the_deep() {
    let site = crate::expeditions::ExpeditionSite {
        category: crate::taxonomy::CAMP_CATEGORY,
        initial_guard_count: RESOURCE_PRECISION,
        alt: false,
        col: 10,
        row: 65,
        clear: Some(crate::expeditions::SiteClear { xp: 0, explorer_id: 8, home_id: 7, reward: None }),
    };
    assert!(crate::expeditions::is_supply_post(site, 7, 1, 10));
    assert!(!crate::expeditions::is_supply_post(site, 8, 1, 10));
    assert!(!crate::expeditions::is_supply_post(site, 7, 2, 10));
    assert!(!crate::expeditions::is_supply_post(crate::expeditions::ExpeditionSite { row: 75, ..site }, 7, 1, 10));
    assert!(!crate::expeditions::is_supply_post(crate::expeditions::ExpeditionSite { alt: true, ..site }, 7, 1, 10));
    assert!(!crate::expeditions::is_supply_post(crate::expeditions::ExpeditionSite { clear: None, ..site }, 7, 1, 10));
    assert!(
        !crate::expeditions::is_supply_post(
            crate::expeditions::ExpeditionSite { category: crate::taxonomy::RIFT_CATEGORY, ..site }, 7, 1, 10,
        ),
    );
}
