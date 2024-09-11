use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::MAX_REALMS_PER_ADDRESS;

use eternum::constants::ResourceTypes;
use eternum::models::map::Tile;
use eternum::models::owner::Owner;

use eternum::models::position::{Position, Coord};
use eternum::models::realm::Realm;
use eternum::models::resources::Resource;

use eternum::systems::config::contracts::{config_systems};

use eternum::systems::realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait};

use eternum::utils::map::biomes::Biome;

use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems, deploy_hyperstructure_systems},
    general::{
        spawn_realm, get_default_realm_pos, generate_realm_positions, spawn_hyperstructure,
        get_default_hyperstructure_coord
    },
    config::{set_combat_config, set_capacity_config}
};
use starknet::contract_address_const;

const TIMESTAMP: u64 = 1000;

const INITIAL_RESOURCE_1_TYPE: u8 = 1;
const INITIAL_RESOURCE_1_AMOUNT: u128 = 800;

const INITIAL_RESOURCE_2_TYPE: u8 = 2;
const INITIAL_RESOURCE_2_AMOUNT: u128 = 700;

const REALM_FREE_MINT_CONFIG_ID: ID = 0;

fn setup() -> (IWorldDispatcher, IRealmSystemsDispatcher) {
    let world = spawn_eternum();

    let realm_systems_dispatcher = deploy_realm_systems(world);

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

    set_capacity_config(config_systems_address);

    (world, realm_systems_dispatcher)
}

#[test]
#[available_gas(3000000000000)]
fn test_realm_create() {
    let (world, realm_systems_dispatcher) = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let position = Position { x: 20, y: 30, entity_id: 1 };

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    starknet::testing::set_contract_address(contract_address_const::<'caller'>());

    let realm_entity_id = realm_systems_dispatcher
        .create(
            realm_id,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            position.clone(),
        );

    let realm_owner = get!(world, realm_entity_id, Owner);
    assert(realm_owner.address == contract_address_const::<'caller'>(), 'wrong realm owner');

    let realm = get!(world, realm_entity_id, Realm);
    assert(realm.realm_id == realm_id, 'wrong realm id');

    // ensure realm Tile is explored
    let tile: Tile = get!(world, (position.x, position.y), Tile);
    assert_eq!(tile.col, tile.col, "wrong col");
    assert_eq!(tile.row, tile.row, "wrong row");
    assert_eq!(tile.explored_by_id, realm_entity_id, "wrong realm owner");
    assert_eq!(tile.explored_at, TIMESTAMP, "wrong exploration time");
}


#[test]
#[available_gas(3000000000000)]
fn test_realm_create_equal_max_realms_per_address() {
    let (world, realm_systems_dispatcher) = setup();

    let positions = generate_realm_positions();

    let mut index = 0_u8;
    loop {
        if index == MAX_REALMS_PER_ADDRESS {
            break;
        }
        spawn_realm(world, realm_systems_dispatcher, *positions.at(index.into()));
        index += 1;
    };
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('max num of realms settled', 'ENTRYPOINT_FAILED'))]
fn test_realm_create_greater_than_max_realms_per_address() {
    let (world, realm_systems_dispatcher) = setup();

    let positions = generate_realm_positions();

    starknet::testing::set_contract_address(starknet::get_contract_address());

    let mut index = 0;
    loop {
        if index == MAX_REALMS_PER_ADDRESS + 1 {
            break;
        }
        spawn_realm(world, realm_systems_dispatcher, *positions.at(index.into()));
        index += 1;
    };
}

#[test]
#[available_gas(3000000000000)]
fn test_mint_starting_resources() {
    let (world, realm_systems_dispatcher) = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    realm_systems_dispatcher.mint_starting_resources(REALM_FREE_MINT_CONFIG_ID, realm_entity_id);

    let realm_initial_resource_1 = get!(world, (realm_entity_id, INITIAL_RESOURCE_1_TYPE), Resource);

    assert(realm_initial_resource_1.balance == INITIAL_RESOURCE_1_AMOUNT, 'wrong mint 1 amount');

    let realm_initial_resource_2 = get!(world, (realm_entity_id, INITIAL_RESOURCE_2_TYPE), Resource);
    assert(realm_initial_resource_2.balance == INITIAL_RESOURCE_2_AMOUNT, 'wrong mint 2 amount');
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('already claimed', 'ENTRYPOINT_FAILED'))]
fn test_mint_starting_resources_twice() {
    let (world, realm_systems_dispatcher) = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    realm_systems_dispatcher.mint_starting_resources(REALM_FREE_MINT_CONFIG_ID, realm_entity_id);

    realm_systems_dispatcher.mint_starting_resources(REALM_FREE_MINT_CONFIG_ID, realm_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Entity is not a realm', 'ENTRYPOINT_FAILED'))]
fn test_mint_starting_resources_as_not_realm() {
    let (world, realm_systems_dispatcher) = setup();

    let hyperstructure_systems_dispatcher = deploy_hyperstructure_systems(world);

    starknet::testing::set_contract_address(contract_address_const::<'caller'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'caller'>());

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    realm_systems_dispatcher.mint_starting_resources(REALM_FREE_MINT_CONFIG_ID, hyperstructure_entity_id);
}
