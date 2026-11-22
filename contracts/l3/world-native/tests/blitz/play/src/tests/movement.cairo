pub use world_test_support::tests::troop_management::*;
use crate::troops::Coord;
use super::fixture::{ARMY_UNITS, EAST, GRASSLAND, REALM_COORD, RESTED_AT, blitz_army, step_east};
use super::resource_commands::{execute_in_game, grant};

const WHEAT: u8 = 35;

fn wheat(d: super::Deployment, home: ResourceKey) -> u128 {
    resource(d)
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type: WHEAT })
}

fn army(d: super::Deployment, home: ResourceKey, id: u64) -> ExplorerTroops {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: home.game_id, explorer_id: id }).unwrap()
}

fn reveal(d: super::Deployment, home: ResourceKey, coord: Coord) {
    IMapLogicDispatcher { contract_address: d.games }.reveal(crate::geometry::tile_key(home.game_id, coord), GRASSLAND);
}

fn march(id: u64, steps: u32) -> Command {
    let mut directions = array![];
    for _ in 0..steps {
        directions.append(EAST);
    }
    Command::Move(Move { explorer_id: id, directions: directions.span() })
}

fn step_wheat() -> u128 {
    crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_travel_wheat_cost.into() * ARMY_UNITS
}

#[test]
fn an_army_marches_over_revealed_tiles_for_stamina_and_wheat_each_step() {
    let (d, home, id) = blitz_army();
    reveal(d, home, step_east(REALM_COORD, 2));
    reveal(d, home, step_east(REALM_COORD, 3));
    grant(d, home, WHEAT, 2 * step_wheat());
    assert!(execute_in_game(d, home.game_id, march(id, 2), RESTED_AT));
    let marched = army(d, home, id);
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
    assert_eq!(marched.coord, step_east(REALM_COORD, 3));
    assert_eq!(
        marched.troops.stamina.inline().amount,
        Into::<u16, u64>::into(stamina.stamina_knight_max) - 2 * stamina.stamina_travel_stamina_cost.into(),
    );
    assert_eq!(wheat(d, home), 0);
}

#[test]
fn an_army_does_not_march_onto_a_tile_nobody_has_explored() {
    let (d, home, id) = blitz_army();
    grant(d, home, WHEAT, step_wheat());
    assert!(!execute_in_game(d, home.game_id, march(id, 1), RESTED_AT));
    assert_eq!(army(d, home, id).coord, step_east(REALM_COORD, 1));
    assert_eq!(wheat(d, home), step_wheat());
}

#[test]
fn an_army_does_not_march_without_wheat() {
    let (d, home, id) = blitz_army();
    reveal(d, home, step_east(REALM_COORD, 2));
    assert!(!execute_in_game(d, home.game_id, march(id, 1), RESTED_AT));
    assert_eq!(army(d, home, id).coord, step_east(REALM_COORD, 1));
}
