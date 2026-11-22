use super::play_fixture::{FIXTURE_START, caller, create_game, fixture_params};
use super::resource_commands::{execute_in_game, grant, set_fixture};
use super::state::{MapObservationTrait, StructureObservationTrait};

pub fn blitz_game() -> (super::Deployment, u32) {
    let deployment = super::setup_family(false, "StructuresLogic", "TroopsLogic", "GamesTest", crate::game::BLITZ);
    let params = crate::registrar::CreateGameParams { family: crate::game::BLITZ, ..fixture_params('blitz') };
    let game_id = create_game(deployment.games, params);
    caller(deployment.games, deployment.actor, FIXTURE_START);
    (deployment, game_id)
}

pub const WOOD: u8 = 3;
pub const GRASSLAND: u8 = 11;
pub const REALM_COORD: crate::troops::Coord = crate::troops::Coord { alt: false, x: 2000, y: 2000 };
pub const SECOND_COORD: crate::troops::Coord = crate::troops::Coord { alt: false, x: 2020, y: 2000 };
const STORE_CAPACITY: u128 = 1000000 * crate::rules::RESOURCE_PRECISION * 1000;
const KNIGHT_T1: u8 = 26;
pub const EAST: u8 = 0;
pub const RAISED_AT: u64 = FIXTURE_START + 40;
pub const RESTED_AT: u64 = FIXTURE_START + 86400;
pub const ARMY_UNITS: u128 = 100;

pub fn blitz_realm() -> (super::Deployment, crate::resources::ResourceKey) {
    let (deployment, game_id) = blitz_game();
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    found_realm(deployment, home, deployment.actor, REALM_COORD);
    (deployment, home)
}

pub fn blitz_army() -> (super::Deployment, crate::resources::ResourceKey, u64) {
    let (d, home) = blitz_realm();
    grant(d, home, KNIGHT_T1, ARMY_UNITS * crate::rules::RESOURCE_PRECISION);
    let raise = super::Command::CreateExplorer(
        crate::commands::CreateExplorer {
            slot: 0,
            structure_id: home.entity_id,
            category: 0,
            tier: 0,
            amount: ARMY_UNITS * crate::rules::RESOURCE_PRECISION,
            direction: EAST,
        },
    );
    assert!(execute_in_game(d, home.game_id, raise, RAISED_AT));
    let id = *crate::structures::IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    (d, home, id)
}

pub fn step_east(from: crate::troops::Coord, steps: u32) -> crate::troops::Coord {
    let mut coord = from;
    for _ in 0..steps {
        coord = crate::geometry::neighbor(coord, EAST);
    }
    coord
}

pub fn rival_realm(
    deployment: super::Deployment, home: crate::resources::ResourceKey,
) -> (starknet::ContractAddress, crate::resources::ResourceKey) {
    let (rival, _) = super::deploy_player(3, super::GUARDIAN);
    (rival, second_realm(deployment, home, rival))
}

pub fn second_realm(
    deployment: super::Deployment, home: crate::resources::ResourceKey, owner: starknet::ContractAddress,
) -> crate::resources::ResourceKey {
    let second = crate::resources::ResourceKey { game_id: home.game_id, entity_id: 2 };
    found_realm(deployment, second, owner, SECOND_COORD);
    second
}

fn found_realm(
    deployment: super::Deployment,
    home: crate::resources::ResourceKey,
    owner: starknet::ContractAddress,
    coord: crate::troops::Coord,
) {
    let realm = crate::structures::StructureRecord {
        owner,
        base: crate::structures::StructureBase {
            troop_max_guard_count: 1,
            troop_max_explorer_count: 1,
            created_at: 0,
            category: crate::taxonomy::REALM_CATEGORY,
            level: 0,
            starting_troops_granted: false,
        },
        resources_packed: WOOD.into(),
        metadata: crate::structures::StructureMetadata {
            realm_id: home.entity_id.try_into().unwrap(),
            order: 0,
            has_wonder: false,
            village_realm: 0,
            mine_kind: 0,
            deepest_depth: 0,
        },
    };
    super::structure_rules::save(deployment, home, realm);
    snforge_std::interact_with_state(
        deployment.games,
        || crate::logic::map::MapState::relocate_fixture(
            home, coord, crate::taxonomy::REALM_REGULAR_LEVEL_1_OCCUPIER, true,
        ),
    );
    reveal_surroundings(deployment, home.game_id, coord);
    let owner = array![home.game_id.into(), home.entity_id.into()].span();
    let store = crate::resources::Weight { capacity: STORE_CAPACITY, weight: 0 };
    set_fixture(deployment.games, selector!("resources"), selector!("weights"), owner, store);
    set_fixture(deployment.games, selector!("resources"), selector!("resource_exists"), owner, true);
}

fn reveal_surroundings(deployment: super::Deployment, game_id: u32, coord: crate::troops::Coord) {
    let map = crate::map::IMapLogicDispatcher { contract_address: deployment.games };
    for direction in 0_u8..6 {
        map.reveal(crate::geometry::tile_key(game_id, crate::geometry::neighbor(coord, direction)), GRASSLAND);
    }
}
