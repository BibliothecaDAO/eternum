use core::traits::TryInto;
use eternum::models::resources::{Resource, ResourceFoodImpl};
use eternum::models::owner::Owner;
use eternum::models::owner::{EntityOwner};
use eternum::models::quantity::Quantity;
use eternum::models::capacity::Capacity;
use eternum::models::tick::TickConfig;
use eternum::models::movable::{Movable};
use eternum::models::position::{Position, Coord, CoordTrait, Direction};
use eternum::models::realm::Realm;
use eternum::models::inventory::{Inventory, InventoryTrait};
use eternum::models::weight::Weight;


use eternum::models::map::Tile;

use eternum::systems::map::interface::{
    IMapSystemsDispatcher, IMapSystemsDispatcherTrait
};
use eternum::systems::map::contracts::map_systems;

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IRealmFreeMintConfigDispatcher, IRealmFreeMintConfigDispatcherTrait,
    IMapConfigDispatcher, IMapConfigDispatcherTrait
};
use eternum::systems::config::interface::{
    IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
};

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};
use eternum::systems::transport::contracts::{
    travel_systems::travel_systems
};
use eternum::systems::transport::interface::{
    travel_systems_interface::{
        ITravelSystemsDispatcher,ITravelSystemsDispatcherTrait
    },
};

use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
use starknet::contract_address_const;

const TIMESTAMP: u64 = 10000;
const MAP_EXPLORE_RANDOM_MINT_AMOUNT: u128 = 3;
const MAP_EXPLORE_PRECOMPUTED_RANDOM_MINT_RESOURCE : u8 = 6; // silver
const MAX_MOVES_PER_TICK : u8 = 12;
const TICK_INTERVAL_IN_SECONDS : u64= 3;

fn setup() -> (IWorldDispatcher, u128, u128, IMapSystemsDispatcher) {
    let world = spawn_eternum();

    starknet::testing::set_block_timestamp(TIMESTAMP);


    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set weight configuration for rewarded resource (silver)
    IWeightConfigDispatcher {
            contract_address: config_systems_address
        }.set_weight_config(world, ResourceTypes::SILVER.into(), 1); 
        

    // set map exploration config
    IMapConfigDispatcher {
        contract_address: config_systems_address
    }.set_exploration_config(world, MAP_EXPLORE_RANDOM_MINT_AMOUNT);

    // set tick config
    let tick_config = TickConfig {
        config_id: WORLD_CONFIG_ID, 
        max_moves_per_tick: MAX_MOVES_PER_TICK,
        tick_interval_in_seconds: TICK_INTERVAL_IN_SECONDS
    };
    set!(world, (tick_config));



    // create realm
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let realm_position = Position { x: 20, y: 30, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    starknet::testing::set_contract_address(
        contract_address_const::<'realm_owner'>()
    );


    let realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, realm_position.clone(),
    );

    let realm_owner: Owner = get!(world, realm_entity_id, Owner);

    // create realm army unit
    let realm_army_unit_id: u128 = 'army unit'.try_into().unwrap();
    let army_quantity_value: u128 = 7;
    let army_capacity_value_per_soldier: u128 = 7;

    set!(world, (
        Owner {
            entity_id: realm_army_unit_id,
            address: realm_owner.address
        },
        EntityOwner {
            entity_id: realm_army_unit_id,
            entity_owner_id: realm_entity_id
        },
        Quantity { 
            entity_id: realm_army_unit_id,
            value: army_quantity_value
        },
        Position {
            entity_id: realm_army_unit_id,
            x: realm_position.x,
            y: realm_position.y
        },
        Inventory {
            entity_id: realm_army_unit_id,
            items_key: world.uuid().into(),
            items_count: 0
        },
        Capacity {
            entity_id: realm_army_unit_id,
            weight_gram: army_capacity_value_per_soldier
        },
        Movable {
            entity_id: realm_army_unit_id, 
            sec_per_km: 1, 
            blocked: false,
            round_trip: false,
            intermediate_coord_x: 0,  
            intermediate_coord_y: 0,  
        }
    ));  




    // deploy map systems
    let map_systems_address 
        = deploy_system(map_systems::TEST_CLASS_HASH);    
    let map_systems_dispatcher 
        = IMapSystemsDispatcher{contract_address: map_systems_address};

    (world, realm_entity_id, realm_army_unit_id,  map_systems_dispatcher)
}



#[test]
fn test_map_explore() {

    let (world, realm_entity_id,realm_army_unit_id, map_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'realm_owner'>()
    );

    starknet::testing::set_transaction_hash('hellothash');

    let mut army_coord: Coord  = get!(world, realm_army_unit_id, Position).into();
    let explore_tile_direction: Direction = Direction::West;

    map_systems_dispatcher
        .explore(world, realm_army_unit_id, explore_tile_direction);

    let expected_explored_coord 
        = army_coord.neighbor(explore_tile_direction);

    // ensure that Tile model is correct
    let explored_tile: Tile 
        = get!(world, (expected_explored_coord.x, expected_explored_coord.y), Tile);
    assert_eq!(explored_tile.col, explored_tile._col, "wrong col");
    assert_eq!(explored_tile.row, explored_tile._row, "wrong row");
    assert_eq!(explored_tile.explored_by_id, realm_army_unit_id, "wrong realm owner");
    assert_eq!(explored_tile.explored_at, TIMESTAMP, "wrong exploration time");

    // ensure that item was added to realm_army's inventory
    let realm_army_inventory: Inventory = get!(world, realm_army_unit_id, Inventory);
    assert_eq!(realm_army_inventory.items_count, 1);
    let item_id: u128 = realm_army_inventory.item_id(world, 0).into();
    assert(item_id != 0, 'wrong inventory item id');

    army_coord = expected_explored_coord;
}

#[test]
#[should_panic(expected: ("max moves per tick exceeded",'ENTRYPOINT_FAILED' ))]
fn test_map_explore__ensure_explorer_cant_hex_travel_till_next_tick() {

    let (world, realm_entity_id,realm_army_unit_id, map_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'realm_owner'>()
    );

    starknet::testing::set_transaction_hash('hellothash');

    let mut army_coord: Coord = get!(world, realm_army_unit_id, Position).into();
    let explore_tile_direction: Direction = Direction::West;

    map_systems_dispatcher
        .explore(world, realm_army_unit_id, explore_tile_direction);


    // deploy travel systems
    let travel_systems_address 
        = deploy_system(travel_systems::TEST_CLASS_HASH);    
    let travel_systems_dispatcher 
        = ITravelSystemsDispatcher{contract_address: travel_systems_address};

    // ensure army cant travel in same tick
    travel_systems_dispatcher
        .travel_hex(world, realm_army_unit_id, array![Direction::West].span());
}