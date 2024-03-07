

use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
use eternum::models::position::Position;
use eternum::models::caravan::CaravanMembers;
use eternum::models::metadata::ForeignKey;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::capacity::Capacity;
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::inventory::Inventory;

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{
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
use core::zeroable::Zeroable;



fn setup() -> (IWorldDispatcher, Array<u128>, ICaravanSystemsDispatcher, u128) {
    let world = spawn_eternum();

    // set realm entity
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
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
        world, realm_id,
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
    }.set_world_config(world, contract_address_const::<0>(), world.contract_address); // realm l2 contract address


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
fn test_create_caravan__not_owner() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    starknet::testing::set_contract_address(contract_address_const::<0x99>());
    caravan_systems_dispatcher.create(world, transport_units);
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('entity is blocked','ENTRYPOINT_FAILED' ))]
fn test_create_caravan__blocked_entity() {
    let (world, mut transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    
    // duplicate the first transport unit
    transport_units.append(*transport_units[0]);

    // create caravan
    caravan_systems_dispatcher.create(world, transport_units);
}







//////////////////////////////////////////
//
//          Test disassemble caravan
//
//////////////////////////////////////////






#[test]
#[available_gas(300000000000)]
fn test_disassemble_caravan() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());
    let original_caravan_members = get!(world, caravan_id, CaravanMembers);


    // disassemble caravan
    let disassembled_transport_ids 
        = caravan_systems_dispatcher.disassemble(world, caravan_id);

    // check that disassembled transport units are the same as the original ones
    assert(disassembled_transport_ids.len() == transport_units.len(), 'not the same length');
    let mut index = 0;
    loop {
        if index == transport_units.len() {
            break;
        }
        assert(
            *transport_units.at(index) == *disassembled_transport_ids.at(index), 
                'not same transport id'
        );

        // check that transport unit isnt blocked
        let transport_unit = get!(world, *transport_units.at(index), Movable);
        assert(transport_unit.blocked == false, 'should not be blocked');

        index += 1;
    };


    // verify that the caravan has been disassembled
    let (caravan_members, caravan_movable, caravan_capacity, caravan_position, caravan_owner, caravan_entity_owner) 
    = get!(world, caravan_id, (CaravanMembers, Movable, Capacity, Position, Owner, EntityOwner));
            
    assert(caravan_entity_owner.entity_owner_id == Zeroable::zero(), 'wrong entity owner');
    assert(caravan_members.count == 0, 'wrong count');
    assert(caravan_members.key == 0, 'key should not be set');
    assert(caravan_movable.sec_per_km == 0, 'average speed should be 0');
    assert(caravan_capacity.weight_gram == 0, 'weight_gram should be 0');
    assert(caravan_position.x == 0, 'x should be 0');
    assert(caravan_position.y == 0, 'y should be 0');
    assert(caravan_owner.address == Zeroable::zero(), 'owner should be 0');

    // verify that the caravan foreign keys have been unset
    let foreign_key_1: Array<felt252> = array![caravan_id.into(), original_caravan_members.key.into(), 0];
    let foreign_key_1: felt252 = poseidon_hash_span(foreign_key_1.span());
    let first_transport = get!(world, foreign_key_1, ForeignKey);
    assert(first_transport.entity_id.into() == 0, 'foreign key is set');


    let foreign_key_2: Array<felt252> = array![caravan_id.into(), original_caravan_members.key.into(), 1];
    let foreign_key_2: felt252 = poseidon_hash_span(foreign_key_2.span());
    let second_transport = get!(world, foreign_key_2, ForeignKey);
    assert(second_transport.entity_id.into() == 0, 'foreign key is set');

}



#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('caller not owner','ENTRYPOINT_FAILED' ))]
fn test_disassemble_caravan__caller_not_owner() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());


    // disassemble caravan
    starknet::testing::set_contract_address(contract_address_const::<0x99>());
    let disassembled_transport_ids 
        = caravan_systems_dispatcher.disassemble(world, caravan_id);
}




#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('not a caravan','ENTRYPOINT_FAILED' ))]
fn test_disassemble_caravan__not_caravan() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    let caravan_id = 0x1234567890; // fictituous id
    // disassemble caravan
    caravan_systems_dispatcher.disassemble(world, caravan_id);
}



#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('inventory not empty','ENTRYPOINT_FAILED' ))]
fn test_disassemble_caravan__non_empty_inventory() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());

    // add item to inventory
    starknet::testing::set_contract_address(world.executor());
    let mut inventory = get!(world, caravan_id, Inventory);
    inventory.items_count = 1;
    set!(world, (inventory));

    // disassemble caravan
    starknet::testing::set_contract_address(contract_address_const::<0>());
    caravan_systems_dispatcher.disassemble(world, caravan_id);
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('caravan is blocked','ENTRYPOINT_FAILED' ))]
fn test_disassemble_caravan__blocked_caravan() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());

    // block caravan
    starknet::testing::set_contract_address(world.executor());
    let mut movable = get!(world, caravan_id, Movable);
    movable.blocked = true;
    set!(world, (movable));

    // disassemble caravan
    starknet::testing::set_contract_address(contract_address_const::<0>());
    caravan_systems_dispatcher.disassemble(world, caravan_id);
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('caravan in transit','ENTRYPOINT_FAILED' ))]
fn test_disassemble_caravan__caravan_in_transit() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());

    // update arrival time
    starknet::testing::set_contract_address(world.executor());
    let mut arrival_time = get!(world, caravan_id, ArrivalTime);
    arrival_time.arrives_at = 1;
    set!(world, (arrival_time));

    // disassemble caravan
    starknet::testing::set_contract_address(contract_address_const::<0>());
    caravan_systems_dispatcher.disassemble(world, caravan_id);
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('mismatched positions','ENTRYPOINT_FAILED' ))]
fn test_disassemble_caravan__not_at_realm() {

    let (world, transport_units, caravan_systems_dispatcher, realm_entity_id) 
        = setup();
    
    // create caravan
    let caravan_id 
        = caravan_systems_dispatcher.create(world, transport_units.clone());

    // update position
    starknet::testing::set_contract_address(world.executor());
    let mut position = get!(world, caravan_id, Position);
    position.x = 1;
    set!(world, (position));

    // disassemble caravan
    starknet::testing::set_contract_address(contract_address_const::<0>());
    caravan_systems_dispatcher.disassemble(world, caravan_id);
}