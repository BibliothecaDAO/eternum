pub use world_test_support::tests::troop_management::*;
use super::fixture::{REALM_COORD, blitz_realm, rival_realm};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{execute_in_game, grant};

const NOW: u64 = FIXTURE_START + 40;

fn level_up(home: ResourceKey) -> Command {
    Command::LevelUp(home.entity_id)
}

fn grant_recipe(d: super::Deployment, home: ResourceKey, level: u8) {
    for cost in crate::logic::upgrades::recipe(level).costs {
        grant(d, home, *cost.resource_type, *cost.amount);
    }
}

fn level(d: super::Deployment, home: ResourceKey) -> u8 {
    IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap().base.level
}

fn tile_category(d: super::Deployment, home: ResourceKey, coord: crate::troops::Coord) -> u8 {
    IMapLogicDispatcher { contract_address: d.games }
        .occupancy(crate::geometry::tile_key(home.game_id, coord))
        .unwrap()
        .category
}

fn balance(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
}

#[test]
fn a_realm_rises_a_level_for_its_recipe_and_its_tile_shows_it() {
    let (d, home) = blitz_realm();
    assert!(execute_in_game(d, home.game_id, level_up(home), NOW));
    grant_recipe(d, home, 2);
    assert!(execute_in_game(d, home.game_id, level_up(home), NOW));
    assert_eq!(level(d, home), 2);
    assert_eq!(tile_category(d, home, REALM_COORD), crate::taxonomy::REALM_REGULAR_LEVEL_3_OCCUPIER);
    for cost in crate::logic::upgrades::recipe(2).costs {
        assert_eq!(balance(d, home, *cost.resource_type), 0);
    }
}

#[test]
fn a_realm_does_not_rise_without_its_recipe() {
    let (d, home) = blitz_realm();
    assert!(execute_in_game(d, home.game_id, level_up(home), NOW));
    assert!(!execute_in_game(d, home.game_id, level_up(home), NOW));
    assert_eq!(level(d, home), 1);
}

#[test]
fn a_realm_rises_no_higher_than_its_maximum() {
    let (d, home) = blitz_realm();
    let maximum = crate::logic::upgrades::limits().realm_max;
    for next in 1..maximum + 1 {
        grant_recipe(d, home, next);
        assert!(execute_in_game(d, home.game_id, level_up(home), NOW));
    }
    assert!(!execute_in_game(d, home.game_id, level_up(home), NOW));
    assert_eq!(level(d, home), maximum);
}

#[test]
fn a_player_does_not_raise_a_realm_of_another() {
    let (d, home) = blitz_realm();
    let (_, rival_home) = rival_realm(d, home);
    assert!(!execute_in_game(d, home.game_id, level_up(rival_home), NOW));
    assert_eq!(level(d, rival_home), 0);
}
