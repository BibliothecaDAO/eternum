
use eternum::models::resources::Resource;
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::position::{Coord, Position};
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::config::RoadConfig;
use eternum::models::config::LevelingConfig;
use eternum::models::level::Level;
use eternum::models::realm::Realm;
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::road::{Road, RoadImpl};

use eternum::constants::ResourceTypes;
use eternum::constants::{ROAD_CONFIG_ID, REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_CONFIG_ID};
use eternum::constants::LevelIndex;

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ILevelingConfigDispatcher,
    ILevelingConfigDispatcherTrait,
};

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
fn test_travel_with_realm_bonus() {

    let (
        world, travelling_entity_id,
         _, destination_coord, travel_systems_dispatcher
    ) = setup();


    ///////////////////////////////
    // create realm and set level
    ///////////////////////////////

    let realm_entity_id = 99;
    let realm_order_hyperstructure_id = 44;
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        EntityOwner {
            entity_id: travelling_entity_id.into(),
            entity_owner_id: realm_entity_id
        }, 
        Realm {
            entity_id: realm_entity_id,
            realm_id: 0,
            resource_types_packed: 0,
            resource_types_count: 0,
            cities: 76,
            harbors: 0,
            rivers: 0,
            regions: 0,
            wonder: 0,
            order: 0,
            order_hyperstructure_id: realm_order_hyperstructure_id
        },
        Level {
            entity_id: realm_entity_id,
            level: LevelIndex::TRAVEL.into() + 4,
            valid_until: 10000000,
        },
        LevelingConfig {
            config_id: REALM_LEVELING_CONFIG_ID,
            decay_interval: 0,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            cost_percentage_scaled: 0,
            base_multiplier: 25
        }
    ));

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
    assert(travelling_entity_arrival_time.arrives_at == 640, 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');

}


#[test]
#[available_gas(30000000000000)]
fn test_travel_with_realm_and_hyperstructure_bonus() {

    let (
        world, travelling_entity_id,
         _, destination_coord, travel_systems_dispatcher
    ) = setup();




    ///////////////////////////////
    // create realm and set level
    ///////////////////////////////

    let realm_entity_id = 99;
    let realm_order_hyperstructure_id = 999;
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        EntityOwner {
            entity_id: travelling_entity_id.into(),
            entity_owner_id: realm_entity_id
        }, 
        Realm {
            entity_id: realm_entity_id,
            realm_id: 0,
            resource_types_packed: 0,
            resource_types_count: 0,
            cities: 76,
            harbors: 0,
            rivers: 0,
            regions: 0,
            wonder: 0,
            order: 0,
            order_hyperstructure_id: realm_order_hyperstructure_id
        },
        Level {
            entity_id: realm_entity_id,
            level: LevelIndex::TRAVEL.into() + 4,
            valid_until: 10000000,
        },
        LevelingConfig {
            config_id: REALM_LEVELING_CONFIG_ID,
            decay_interval: 0,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            cost_percentage_scaled: 0,
            base_multiplier: 25
        }
    ));


    ///////////////////////////////////////
    // create hyperstructure and set level
    ///////////////////////////////////////

    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        EntityOwner {
            entity_id: travelling_entity_id.into(),
            entity_owner_id: realm_entity_id
        }, 
        HyperStructure {
            entity_id: realm_order_hyperstructure_id,
            hyperstructure_type: 0,
            order: 0,
        },
        Level {
            entity_id: realm_order_hyperstructure_id,
            level: LevelIndex::TRAVEL.into(),
            valid_until: 10000000,
        },
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
            decay_interval: 0,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            cost_percentage_scaled: 0,
            base_multiplier: 25
        }
    ));

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

    assert(travelling_entity_arrival_time.arrives_at == 512, 'arrival time not correct');

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


