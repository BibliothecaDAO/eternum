use snforge_std::interact_with_state;
use starknet::storage::StoragePointerReadAccess;
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::FIXTURE_START;
use world_test_support::tests::registrar::{discovery_root, explore_with_root, setup_frontier_relics};
use world_test_support::tests::resource_commands::{execute_in_game, grant, set_explorer_fixture};
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;
use crate::troop_management::{ManageTroops, RecruitExplorer};

#[test]
fn a_cleared_camp_holds_its_hex_and_reinforces_from_home_on_each_layer_above_the_deep() {
    for depth in 0_u8..3 {
        let (d, game_id, key) = setup_frontier_relics();
        let home = ResourceKey { game_id, entity_id: super::army_activity::army(d, key).owner };
        grant(d, home, crate::resources::WHEAT, 10000 * RESOURCE_PRECISION);
        grant(d, home, 26, 200 * RESOURCE_PRECISION);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::ManageTroops(
                    ManageTroops::RecruitExplorer(
                        RecruitExplorer {
                            explorer_id: key.explorer_id, amount: 99 * RESOURCE_PRECISION, supply_post: None,
                        },
                    ),
                ),
                FIXTURE_START,
            ),
        );
        let mut army = super::army_activity::army(d, key);
        army.coord = crate::expeditions::site(crate::balance::settlement::SETTLEMENT_SPACING_STEPS, 1, 0, depth);
        army.coord.x += 10;
        set_explorer_fixture(d.games, key, army);
        let destination = crate::geometry::neighbor(army.coord, 0);
        let discovery = crate::balance::expeditions::FRONTIER_DISCOVERY;
        let find_percent = interact_with_state(
            d.games, || crate::logic::triumphs::effects(home, FIXTURE_START).find_percent,
        );
        let root = discovery_root(
            game_id,
            discovery,
            find_percent,
            0,
            Some(world_test_support::tests::registrar::any_relic()),
            crate::discovery::Discovery::Camp,
        );
        assert!(explore_with_root(d, game_id, key.explorer_id, root, FIXTURE_START));
        let site_key = interact_with_state(
            d.games,
            || ResourceKey {
                game_id,
                entity_id: crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination))
                    .unwrap()
                    .entity_id,
            },
        );
        interact_with_state(
            d.games,
            || {
                let site = crate::logic::expeditions::expedition_site(site_key).expect('camp was not discovered');
                assert_eq!(site.category, crate::taxonomy::CAMP_CATEGORY);
                assert!(site.clear.is_none());
            },
        );
        let next_day = world_test_support::tests::registrar::day_start(d, game_id, 1);
        assert!(FIXTURE_START + 5 < next_day, "camp actions must stay on the discovery day");
        let recruit = Command::ManageTroops(
            ManageTroops::RecruitExplorer(
                RecruitExplorer {
                    explorer_id: key.explorer_id, amount: RESOURCE_PRECISION, supply_post: Some(site_key.entity_id),
                },
            ),
        );
        assert!(!execute_in_game(d, game_id, recruit, FIXTURE_START + 1));
        let size = super::army_activity::army(d, key).troops.count;
        world_test_support::tests::registrar::strong_frontier_army(d, game_id, key);
        let battle = Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site_key.entity_id },
        );
        let mut events = snforge_std::spy_events();
        if !execute_in_game(d, game_id, battle, FIXTURE_START + 2) {
            panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
        }
        if !crate::geometry::adjacent(super::army_activity::army(d, key).coord, destination) {
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![3].span() }),
                    FIXTURE_START + 3,
                ),
            );
        }
        let standing = super::army_activity::army(d, key).coord;
        let mut toward_post = 0_u8;
        while crate::geometry::neighbor(standing, toward_post) != destination {
            toward_post += 1;
        }
        interact_with_state(
            d.games,
            || {
                let post = crate::logic::map::occupancy(crate::geometry::tile_key(game_id, destination)).unwrap();
                assert_eq!(post.category, crate::taxonomy::SUPPLY_POST_OCCUPIER);
                assert_eq!(post.entity_id, site_key.entity_id);
            },
        );
        let onto_post = Command::Move(
            crate::commands::Move { explorer_id: key.explorer_id, directions: array![toward_post].span() },
        );
        let mut refused = snforge_std::spy_events();
        assert!(!execute_in_game(d, game_id, onto_post, FIXTURE_START + 3));
        assert_eq!(
            world_test_support::tests::play_fixture::rejection(ref refused, d.games).reason, "movement tile occupied",
        );
        let mut survivors = super::army_activity::army(d, key);
        survivors.troops.count = size;
        set_explorer_fixture(d.games, key, survivors);
        let before = size;
        let stock = interact_with_state(d.games, || crate::logic::resources::balance(home, 26));
        recruited(d, game_id, recruit, FIXTURE_START + 4);
        assert_eq!(super::army_activity::army(d, key).troops.count, before + RESOURCE_PRECISION);
        interact_with_state(
            d.games,
            || {
                assert_eq!(crate::logic::resources::balance(home, 26), stock - RESOURCE_PRECISION);
                assert_eq!(
                    crate::logic::expeditions::expedition_site(site_key).unwrap().clear.unwrap().home_id,
                    home.entity_id,
                );
            },
        );
        recruited(d, game_id, recruit, FIXTURE_START + 5);
        assert_eq!(super::army_activity::army(d, key).troops.count, before + 2 * RESOURCE_PRECISION);
        assert!(!execute_in_game(d, game_id, recruit, next_day));
    }
}

fn recruited(d: Deployment, game_id: u32, recruit: Command, now: u64) {
    let mut events = snforge_std::spy_events();
    if !execute_in_game(d, game_id, recruit, now) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
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
        clear: Some(crate::expeditions::SiteClear { explorer_id: 8, home_id: 7, reward: None }),
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
