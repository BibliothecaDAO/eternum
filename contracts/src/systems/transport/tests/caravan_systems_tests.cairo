

use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
use eternum::models::position::Position;
use eternum::models::caravan::CaravanMembers;
use eternum::models::metadata::ForeignKey;
use eternum::models::movable::Movable;
use eternum::models::capacity::Capacity;
use eternum::models::owner::{Owner, EntityOwner};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};


use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    IWorldConfigDispatcher, IWorldConfigDispatcherTrait,
    ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait,
};
use eternum::systems::transport::contracts::{
    transport_unit_systems::transport_unit_systems, 
    caravan_systems::caravan_systems
};

use eternum::systems::transport::interface::{
    caravan_systems_interface::{
        ICaravanSystemsDispatcher,ICaravanSystemsDispatcherTrait
    },
    transport_unit_systems_interface::{
        ITransportUnitSystemsDispatcher,ITransportUnitSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address::contract_address_const;

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use core::poseidon::poseidon_hash_span;
use core::traits::Into;
use core::array::ArrayTrait;
use core::clone::Clone;



fn setup() -> (IWorldDispatcher, Array<u128>, ICaravanSystemsDispatcher, u128) {
    let world = spawn_eternum();

    // set realm entity
    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let position = Position { x: 20, y: 30, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    let realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, position.clone(),
    );


    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set speed configuration 
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_speed_config(world, FREE_TRANSPORT_ENTITY_TYPE, 10); // 10km per sec

    // set world config
    IWorldConfigDispatcher {
        contract_address: config_systems_address
    }.set_world_config(world, world.contract_address); // realm l2 contract address


    // set capacity configuration
    ICapacityConfigDispatcher {
        contract_address: config_systems_address
    }.set_capacity_config(world, FREE_TRANSPORT_ENTITY_TYPE, 200_000); // 200_000 grams ==  200 kg
    

    // set travel configuration
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_travel_config(world, 5); // 5 free transport per city



    // create two free transport unit for the realm
    let transport_unit_systems_address 
        = deploy_system(transport_unit_systems::TEST_CLASS_HASH);
    let transport_unit_systems_dispatcher = ITransportUnitSystemsDispatcher {
        contract_address: transport_unit_systems_address
    };
    let first_free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, realm_entity_id, 10
        );
    let second_free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, realm_entity_id, 10
        );
    let transport_units: Array<u128> = array![
        first_free_transport_unit_id,
        second_free_transport_unit_id
    ];

    // deploy caravan systems
    let caravan_systems_address 
        = deploy_system(caravan_systems::TEST_CLASS_HASH);
    let caravan_systems_dispatcher = ICaravanSystemsDispatcher {
        contract_address: caravan_systems_address
    };

    (world, transport_units, caravan_systems_dispatcher, realm_entity_id)
}



#[test]
#[available_gas(300000000000)]
fn test_create_caravan() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());


    // verify that the caravan has been created
    let (caravan_members, caravan_movable, caravan_capacity, caravan_position, caravan_owner, caravan_entity_owner) 
    = get!(world, caravan_id, (CaravanMembers, Movable, Capacity, Position, Owner, EntityOwner));
            
    assert(caravan_entity_owner.entity_owner_id == realm_entity_id, 'not right entity_owner_id');
    assert(caravan_members.count == 2, 'count should be 2');
    assert(caravan_members.key != 0, 'member key should be set');
    assert(caravan_movable.sec_per_km == 10, 'average speed should be 10');
    assert(caravan_movable.blocked == false, 'should not be blocked');
    assert(caravan_capacity.weight_gram == 4_000_000, 'weight_gram should be 4_000_000');
    assert(caravan_position.x == 20, 'x should be 20');
    assert(caravan_position.y == 30, 'y should be 30');
    assert(caravan_owner.address == starknet::get_caller_address(), 'owner should be caller');

    // verify that the caravan has the correct foreign keys
    let foreign_key_1: Array<felt252> = array![caravan_id.into(), caravan_members.key.into(), 0];
    let foreign_key_1: felt252 = poseidon_hash_span(foreign_key_1.span());
    let first_transport = get!(world, foreign_key_1, ForeignKey);
    assert(first_transport.entity_id.into() == *transport_units.at(0), 'foreign key not set');


    let foreign_key_2: Array<felt252> = array![caravan_id.into(), caravan_members.key.into(), 1];
    let foreign_key_2: felt252 = poseidon_hash_span(foreign_key_2.span());
    let second_transport = get!(world, foreign_key_2, ForeignKey);
    assert(second_transport.entity_id.into() == *transport_units.at(1), 'foreign key not set');

}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('entity is not owned by caller','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    starknet::testing::set_contract_address(contract_address_const::<0x99>());
    caravan_systems_dispatcher.create(world, transport_units);
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('entity is blocked','ENTRYPOINT_FAILED' ))]
fn test_blocked_entity() {
    let (world, mut transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    
    // duplicate the first transport unit
    transport_units.append(*transport_units[0]);

    // create caravan
    caravan_systems_dispatcher.create(world, transport_units);
}




