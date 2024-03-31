use eternum::models::position::{Coord};
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::road::{Road, RoadImpl};
use eternum::models::owner::Owner;
use eternum::models::config::RoadConfig;

use eternum::constants::{ROAD_CONFIG_ID, ResourceTypes};
use eternum::systems::transport::contracts::{
    road_systems::road_systems
};
use eternum::systems::transport::interface::{
    road_systems_interface::{
        IRoadSystemsDispatcher,IRoadSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};


use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::ArrayTrait;
use core::clone::Clone;



fn setup() -> (IWorldDispatcher, IRoadSystemsDispatcher) {
    let world = spawn_eternum();

    let road_systems_address 
        = deploy_system(road_systems::TEST_CLASS_HASH);
    let road_systems_dispatcher = IRoadSystemsDispatcher {
        contract_address: road_systems_address
    };

    (world, road_systems_dispatcher)
}




#[test]
fn test_create() {

    let (world, road_systems_dispatcher) = setup();

    let entity_id: u128 = 44;

    
    set!(world, ( 
        Owner { 
            entity_id: entity_id, 
            address: contract_address_const::<'entity'>()
        },
        Resource {
            entity_id: entity_id,
            resource_type: ResourceTypes::STONE,
            balance: 400
        },
        ResourceCost {
            entity_id: 1,
            index: 0,
            resource_type: ResourceTypes::STONE,
            amount: 10,
        },
        RoadConfig {
            config_id: ROAD_CONFIG_ID,
            resource_cost_id: 1,
            resource_cost_count: 1,
            speed_up_by: 2
        }
    ));

    let start_coord = @Coord { x: 20, y: 30};
    let end_coord = @Coord { x: 40, y: 50};

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    road_systems_dispatcher.create(
        world, 
        entity_id, 
        *end_coord, // end first because order should not matter
        *start_coord, 
        33
    );
    

    let road = RoadImpl::get(world, *start_coord, *end_coord);
    assert_eq!(road.usage_count, 33, "usage count should be 33");

    let entity_fee_resource = get!(world, (entity_id, ResourceTypes::STONE), Resource);
    assert_eq!(entity_fee_resource.balance, 400 - (33 * 10), "stone balance should be 70");
}


#[test]
#[should_panic(expected:  "entity id not owned by caller")]
fn test_not_entity() {
    let (world, road_systems_dispatcher) = setup();

    
    let entity_id: u128 = 44;
    let start_coord = Coord { x: 20, y: 30};
    let end_coord = Coord { x: 40, y: 50};
    set!(world, ( 
        Owner { entity_id: entity_id, address: contract_address_const::<'entity'>()},
        Road {
            start_coord_x: start_coord.x,
            start_coord_y: start_coord.y,
            end_coord_x: end_coord.x,
            end_coord_y: end_coord.y,
            usage_count: 44
        })
    );

    // call as unknown address
    starknet::testing::set_contract_address(
        contract_address_const::<'some_unknown'>()
    );
    road_systems_dispatcher.create(
        world, 
        entity_id, 
        end_coord, // end first because order should not matter
        start_coord, 
        1
    );
}




#[test]
#[should_panic(expected:  "insufficient resources")]
fn test_insufficient_balance() {
    let (world, road_systems_dispatcher) = setup();

    let entity_id: u128 = 44;

    
    set!(world, ( 
        Owner { entity_id: entity_id, address: contract_address_const::<'entity'>()},
        Resource {
            entity_id: entity_id,
            resource_type: ResourceTypes::STONE,
            balance: 400
        },
        ResourceCost {
            entity_id: 1,
            index: 0,
            resource_type: ResourceTypes::STONE,
            amount: 10,
        },
        RoadConfig {
            config_id: ROAD_CONFIG_ID,
            resource_cost_id: 1,
            resource_cost_count: 1,
            speed_up_by: 2
        }
    ));

    let start_coord = Coord { x: 20, y: 30};
    let end_coord = Coord { x: 40, y: 50};

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    road_systems_dispatcher.create(
        world, 
        entity_id, 
        end_coord,
        start_coord, 
        50 // 50 * 10 > 400
    );
}





#[test]
#[should_panic(expected:  "road already exists")]
fn test_already_exists() {
    let (world, road_systems_dispatcher) = setup();

    
    let entity_id: u128 = 44;
    let start_coord = Coord { x: 20, y: 30};
    let end_coord = Coord { x: 40, y: 50};
    set!(world, ( 
        Owner { entity_id: entity_id, address: contract_address_const::<'entity'>()},
        Road {
            start_coord_x: start_coord.x,
            start_coord_y: start_coord.y,
            end_coord_x: end_coord.x,
            end_coord_y: end_coord.y,
            usage_count: 44
        })
    );

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    road_systems_dispatcher.create(
        world, 
        entity_id, 
        end_coord,
        start_coord, 
        1
    );

}