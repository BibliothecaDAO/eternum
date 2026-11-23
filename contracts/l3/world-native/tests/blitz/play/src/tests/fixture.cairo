use super::play_fixture::{FIXTURE_START, TestAction, caller, create_game, fixture_params, play};
use super::resource_commands::{grant, set_fixture};
use super::state::{MapObservationTrait, StructureObservationTrait};

pub fn blitz_game() -> (super::Deployment, u32) {
    blitz_game_from(fixture_params('blitz'))
}

pub fn blitz_game_from(params: crate::registrar::CreateGameParams) -> (super::Deployment, u32) {
    let deployment = super::setup_family(false, "StructuresLogic", "TroopsLogic", "GamesTest", crate::game::BLITZ);
    let params = crate::registrar::CreateGameParams { family: crate::game::BLITZ, ..params };
    let game_id = create_game(deployment.games, params);
    caller(deployment.games, deployment.actor, FIXTURE_START);
    (deployment, game_id)
}

pub fn record_roster(d: super::Deployment, game_id: u32, players: Span<starknet::ContractAddress>) {
    let mut calldata = array![];
    (game_id, players).serialize(ref calldata);
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    crate::games::IGamesSlotsDispatcherTrait::authority_call(
        crate::games::IGamesSlotsDispatcher { contract_address: d.games },
        crate::game::BLITZ,
        crate::slots::SETTLEMENT,
        calldata.span(),
    );
    snforge_std::stop_cheat_caller_address(d.games);
}

pub const WOOD: u8 = 3;
pub const GRASSLAND: u8 = 11;
pub const REALM_COORD: crate::troops::Coord = crate::troops::Coord { alt: false, x: 2000, y: 2000 };
pub const SECOND_COORD: crate::troops::Coord = crate::troops::Coord { alt: false, x: 2020, y: 2000 };
const STORE_CAPACITY: u128 = 1000000 * crate::rules::RESOURCE_PRECISION * 1000;
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
    blitz_army_of(0, ARMY_UNITS)
}

pub fn blitz_army_of(tier: u8, units: u128) -> (super::Deployment, crate::resources::ResourceKey, u64) {
    let (d, home) = blitz_realm();
    let id = raise(d, d.actor, home, crate::troops::TroopType::Knight, tier, units, EAST);
    (d, home, id)
}

pub fn raise(
    d: super::Deployment,
    owner: starknet::ContractAddress,
    home: crate::resources::ResourceKey,
    category: crate::troops::TroopType,
    tier: u8,
    units: u128,
    direction: u8,
) -> u64 {
    let amount = units * crate::rules::RESOURCE_PRECISION;
    grant(d, home, crate::troops::troop_resource(category, tier), amount);
    let category = match category {
        crate::troops::TroopType::Knight => 0,
        crate::troops::TroopType::Paladin => 1,
        crate::troops::TroopType::Crossbowman => 2,
    };
    let command = super::Command::CreateExplorer(
        crate::commands::CreateExplorer { slot: 0, structure_id: home.entity_id, category, tier, amount, direction },
    );
    assert!(play(d.games, TestAction { game_id: home.game_id, actor: owner, command }, 987654321, RAISED_AT));
    *crate::structures::IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0)
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
    rival_realm_at(deployment, home, SECOND_COORD)
}

pub fn rival_realm_at(
    deployment: super::Deployment, home: crate::resources::ResourceKey, coord: crate::troops::Coord,
) -> (starknet::ContractAddress, crate::resources::ResourceKey) {
    let (rival, _) = super::deploy_player(3, super::GUARDIAN);
    let realm = crate::resources::ResourceKey { game_id: home.game_id, entity_id: 2 };
    found_realm(deployment, realm, rival, coord);
    (rival, realm)
}

pub fn second_realm(
    deployment: super::Deployment, home: crate::resources::ResourceKey, owner: starknet::ContractAddress,
) -> crate::resources::ResourceKey {
    let second = crate::resources::ResourceKey { game_id: home.game_id, entity_id: 2 };
    found_realm(deployment, second, owner, SECOND_COORD);
    second
}

pub fn found_realm(
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
        let key = crate::geometry::tile_key(game_id, crate::geometry::neighbor(coord, direction));
        if map.tile(key).map(|tile| tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE == 0).unwrap_or(true) {
            map.reveal(key, GRASSLAND);
        }
    }
}
