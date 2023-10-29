
use eternum::models::resources::Resource;
use eternum::models::owner::Owner;
use eternum::models::position::{Coord, Position};
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::config::RoadConfig;
use eternum::models::road::{Road, RoadImpl};

use eternum::constants::ResourceTypes;
use eternum::constants::ROAD_CONFIG_ID;

use eternum::systems::transport::contracts::{
    travel_systems::travel_systems
};
use eternum::systems::transport::interface::{
    travel_systems_interface::{
        ITravelSystemsDispatcher,ITravelSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
use starknet::contract_address_const;

use core::traits::Into;
use core::serde::Serde;

fn setup() -> (IWorldDispatcher, u64, Position, Coord, ITravelSystemsDispatcher) {
    let world = spawn_eternum();

    // set as executor
    starknet::testing::set_contract_address(world.executor());


    let travelling_entity_id = 11_u64;
    let travelling_entity_position = Position { 
        x: 100_000, 
        y: 200_000, 
        entity_id: travelling_entity_id.into()
    };

    set!(world, (travelling_entity_position));
    set!(world, (
        Owner { 
            address: contract_address_const::<'travelling_entity'>(), 
            entity_id: travelling_entity_id.into()
        }
    ));

    let destination_coord = Coord { 
        x: 900_000, 
        y: 100_000
    };


    let travel_systems_address 
        = deploy_system(travel_systems::TEST_CLASS_HASH);
    let travel_systems_dispatcher = ITravelSystemsDispatcher {
        contract_address: travel_systems_address
    };

    (
        world, travelling_entity_id, travelling_entity_position,
         destination_coord, travel_systems_dispatcher
     )
}





#[test]
#[available_gas(30000000000000)]
fn test_travel() {

    let (
        world, travelling_entity_id,
         _, destination_coord, travel_systems_dispatcher
    ) = setup();

    set!(world, (
        Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
            intermediate_coord_x: 0,  
            intermediate_coord_y: 0,          
        }
    ));


    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(
        world,
        travelling_entity_id.into(),
        destination_coord
    );


    // verify arrival time and position of travelling_entity 
    let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
    let new_travelling_entity_position = get!(world, travelling_entity_id, Position);

    assert(travelling_entity_arrival_time.arrives_at == 800, 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');

}


#[test]
#[available_gas(30000000000000)]
fn test_travel_with_road(){

    let (world, travelling_entity_id, 
        travelling_entity_position, destination_coord, travel_systems_dispatcher
        ) = setup();

    set!(world, (

        RoadConfig {
            config_id: ROAD_CONFIG_ID, 
            fee_resource_type: ResourceTypes::STONE,
            fee_amount: 10,
            speed_up_by: 2
            },
            Road {
            start_coord_x: travelling_entity_position.x,
            start_coord_y: travelling_entity_position.y,
            end_coord_x: destination_coord.x,
            end_coord_y: destination_coord.y,
            usage_count: 2
            },
        Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
            intermediate_coord_x: 0,  
            intermediate_coord_y: 0  
        }

    ));


    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());

    travel_systems_dispatcher.travel(
        world,
        travelling_entity_id.into(),
        destination_coord
    );

    // verify arrival time and position of travelling_entity 
    let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
    let new_travelling_entity_position = get!(world, travelling_entity_id, Position);

    assert(travelling_entity_arrival_time.arrives_at == 800 / 2 , 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');

    // verify road usage count
    let road = RoadImpl::get(world, travelling_entity_position.into(), destination_coord);
    assert(road.usage_count == 1, 'road usage count not correct');

}



#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('not owner of entity', 'ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (
        world, travelling_entity_id, _, 
        destination_coord, travel_systems_dispatcher 
    ) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'not_owner'>());
    travel_systems_dispatcher.travel(
        world,
        travelling_entity_id.into(),
        destination_coord
    );
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity has no speed', 'ENTRYPOINT_FAILED' ))]
fn test_no_speed() {

    let (
        world, travelling_entity_id, _, 
        destination_coord, travel_systems_dispatcher
        ) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'travelling_entity'>()
    );
    travel_systems_dispatcher.travel(
        world,
        travelling_entity_id.into(),
        destination_coord
    );
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity is blocked', 'ENTRYPOINT_FAILED' ))]
fn test_blocked() {

    let (
        world, travelling_entity_id, _, 
        destination_coord, travel_systems_dispatcher
    ) = setup();


    set!(world, (
        Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: true,
            round_trip: false,
            intermediate_coord_x: 0,  
            intermediate_coord_y: 0,  
        }
    ));

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(
        world,
        travelling_entity_id.into(),
        destination_coord
    );
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity is in transit', 'ENTRYPOINT_FAILED' ))]
fn test_in_transit() {

    let (
        world, travelling_entity_id, 
        _, destination_coord, travel_systems_dispatcher
    ) = setup();


    set!(world, (
        Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
              intermediate_coord_x: 0,  
            intermediate_coord_y: 0,  
        },
        ArrivalTime {
            entity_id: travelling_entity_id.into(),
            arrives_at: 100
        }
    ));

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(
        world,
        travelling_entity_id.into(),
        destination_coord
    );
}


