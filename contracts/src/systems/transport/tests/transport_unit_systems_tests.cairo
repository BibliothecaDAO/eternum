use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
use eternum::models::position::Position;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::capacity::Capacity;
use eternum::models::owner::Owner;
use eternum::models::metadata::EntityMetadata;
use eternum::models::quantity::{Quantity, QuantityTracker};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait,
};

use eternum::systems::transport::contracts::{
    transport_unit_systems::transport_unit_systems
};
use eternum::systems::transport::interface::{
    transport_unit_systems_interface::{
        ITransportUnitSystemsDispatcher,ITransportUnitSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};


use dojo::world::{IWorldDispatcher,IWorldDispatcherTrait};

use starknet::contract_address::contract_address_const;

use core::poseidon::poseidon_hash_span;
use core::traits::Into;
use core::array::ArrayTrait;
use core::clone::Clone;


fn setup() -> (IWorldDispatcher, u128, ITransportUnitSystemsDispatcher) {
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


    // set capacity configuration
    ICapacityConfigDispatcher {
        contract_address: config_systems_address
    }.set_capacity_config(world, FREE_TRANSPORT_ENTITY_TYPE, 200_000); // 200_000 grams ==  200 kg


    // set travel configuration
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_travel_config(world, 5); // 5 free transport per city


    let transport_unit_systems_address 
        = deploy_system(transport_unit_systems::TEST_CLASS_HASH);
    let transport_unit_systems_dispatcher = ITransportUnitSystemsDispatcher {
        contract_address: transport_unit_systems_address
    };

    (world, realm_entity_id, transport_unit_systems_dispatcher)
}



#[test]
#[available_gas(300000000000)]
fn test_create_free_transport_unit() {

    let (world, realm_entity_id, transport_unit_systems_dispatcher) = setup();

    // create free transport unit
    let free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, realm_entity_id, 10
        );
    

    // check that the free transport unit has been created
    let (quantity, position, metadata, owner, capacity, movable, arrival_time) 
    = get!(world, free_transport_unit_id, (Quantity, Position, EntityMetadata, Owner, Capacity, Movable, ArrivalTime));

    assert(quantity.value == 10_u128, 'free transport unit not created');

    assert(position.x == 20, 'position not set');
    assert(position.y == 30, 'position not set');

    assert(metadata.entity_type == FREE_TRANSPORT_ENTITY_TYPE.into(), 'entity type not set');

    assert(owner.address == starknet::get_caller_address(), 'owner not set');

    assert(capacity.weight_gram == 200_000, 'capacity not set');

    assert(movable.sec_per_km == 10, 'sec_per_km not set');
    assert(movable.blocked == false, 'entity is blocked');

    assert(arrival_time.arrives_at == 0, 'arrival time should be 0');

    // check that the quantity tracker has been updated
    let quantity_tracker_arr = array![realm_entity_id.into(), FREE_TRANSPORT_ENTITY_TYPE.into()];
    let quantity_tracker_key = poseidon_hash_span(quantity_tracker_arr.span());
    let quantity_tracker = get!(world, quantity_tracker_key, QuantityTracker);
    assert(quantity_tracker.count == 10, 'quantity tracker not updated');


    // create another free transport unit and confirm 
    // that the quantity tracker has been updated
    transport_unit_systems_dispatcher.create_free_unit(
        world, realm_entity_id, 10
    );

    let quantity_tracker = get!(world, quantity_tracker_key, QuantityTracker);
    assert(quantity_tracker.count == 20, 'quantity tracker not updated'); 
}



#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('entity is not owned by caller', 'ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, realm_entity_id, transport_unit_systems_dispatcher) = setup();

    // create free transport unit
    starknet::testing::set_contract_address(contract_address_const::<0x99>());
    transport_unit_systems_dispatcher.create_free_unit(
        world, realm_entity_id, 10
    );

}



#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('not enough free transport unit', 'ENTRYPOINT_FAILED' ))]
fn test_not_enough_free_transport_unit() {

    let (world, realm_entity_id, transport_unit_systems_dispatcher) = setup();

    // create free transport unit
    transport_unit_systems_dispatcher.create_free_unit(
        world, realm_entity_id, 70
    );
}




