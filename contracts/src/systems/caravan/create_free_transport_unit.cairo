// need store the number of free transport unit per realm
// need to get the maximum number of free transport unit per realm from the transport config

// Module for creating a free transport unit
#[system]
mod CreateFreeTransportUnit {
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::{Position, HomePosition};
    use eternum::components::realm::Realm;
    use eternum::components::capacity::Capacity;
    use eternum::components::metadata::MetaData;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::config::{TravelConfig, SpeedConfig, CapacityConfig};
    use eternum::components::quantity::{Quantity, QuantityTracker};
    use eternum::constants::{
        REALM_ENTITY_TYPE, WORLD_CONFIG_ID, TRANSPORT_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE
    };

    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use option::OptionTrait;
    use box::BoxTrait;
    use poseidon::poseidon_hash_span;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, quantity: u128) -> ID {
        // Ensure that the entity is a realm
        let (owner, realm, position) = get!(ctx.world, entity_id, (Owner, Realm, Position));

        // Ensure the entity is owned by the caller
        let caller = ctx.origin;
        assert(caller == owner.address, 'entity is not owned by caller');

        // Determine the max number of free transport units available for creation
        let travel_config = get!(ctx.world, TRANSPORT_CONFIG_ID, TravelConfig);
        let max_free_transport = realm.cities.into() * travel_config.free_transport_per_city;

        // TODO: Move to utils
        // Create a key for the quantity tracker
        let quantity_tracker_arr = array![entity_id.into(), FREE_TRANSPORT_ENTITY_TYPE.into()];
        let quantity_tracker_key = poseidon_hash_span(quantity_tracker_arr.span());

        // Check the existing count of free transport units
        let maybe_quantity_tracker = get!(ctx.world, quantity_tracker_key, QuantityTracker);
        let mut count = if maybe_quantity_tracker.count != 0 {
            maybe_quantity_tracker.count
        } else {
            0
        };

        // Ensure we're not exceeding the max free transport units allowed
        assert(count + quantity <= max_free_transport, 'not enough free transport unit');

        // Update count of free transport units
        // Note: Consider decrementing when a transport unit is destroyed
        let _ = set!(
            ctx.world,
            (QuantityTracker { entity_id: quantity_tracker_key, count: count + quantity })
        );

        // Fetch configuration values for the new transport unit
        let (speed, capacity) = get!(
            ctx.world, (WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE), (SpeedConfig, CapacityConfig)
        );

        // Instantiate the new transport unit
        let id = ctx.world.uuid();
        let _ = set!(
            ctx.world,
            (
                Position {
                    entity_id: id.into(), x: position.x, y: position.y
                    }, HomePosition {
                    entity_id: id.into(), x: position.x, y: position.y                    
                    }, MetaData {
                    entity_id: id.into(), entity_type: FREE_TRANSPORT_ENTITY_TYPE
                    }, Owner {
                    entity_id: id.into(), address: caller
                    }, Quantity {
                    entity_id: id.into(), value: quantity
                    }, Movable {
                    entity_id: id.into(), sec_per_km: speed.sec_per_km, blocked: false, 
                    }, ArrivalTime {
                    entity_id: id.into(), arrives_at: 0, 
                    }, Capacity {
                    entity_id: id.into(), weight_gram: capacity.weight_gram
                }
            )
        );
        id.into()
    }
}

#[cfg(test)]
mod tests {

    use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
    use eternum::components::position::Position;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::capacity::Capacity;
    use eternum::components::owner::Owner;
    use eternum::components::metadata::MetaData;
    use eternum::components::quantity::{Quantity, QuantityTracker};

    // testing
    use eternum::utils::testing::spawn_eternum;

    use poseidon::poseidon_hash_span;
    use traits::Into;
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;
    use clone::Clone;
    
    use starknet::syscalls::deploy_syscall;
    use starknet::contract_address::contract_address_const;
    use dojo::world::{IWorldDispatcher,IWorldDispatcherTrait};

    fn setup() -> (IWorldDispatcher, felt252) {
        let world = spawn_eternum();

        // set realm entity
        let position = Position { x: 20, y: 30, entity_id: 1_u128};
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(@1, ref create_realm_calldata); // resource_types_packed
        Serde::serialize(@1, ref create_realm_calldata); // resource_types_count
        Serde::serialize(@6, ref create_realm_calldata); // cities
        Serde::serialize(@5, ref create_realm_calldata); // harbors
        Serde::serialize(@5, ref create_realm_calldata); // rivers
        Serde::serialize(@5, ref create_realm_calldata); // regions
        Serde::serialize(@1, ref create_realm_calldata); // wonder
        Serde::serialize(@1, ref create_realm_calldata); // order
        Serde::serialize(@position, ref create_realm_calldata); // position

        let create_realm_result = world.execute('CreateRealm', create_realm_calldata);
        let realm_entity_id = *create_realm_result[0];


        // set speed configuration 
        let mut set_speed_conf_calldata =  Default::default();
        Serde::serialize(@FREE_TRANSPORT_ENTITY_TYPE, ref set_speed_conf_calldata);
        Serde::serialize(@10, ref set_speed_conf_calldata); // 10km per sec
        world.execute('SetSpeedConfig', set_speed_conf_calldata);

        // set travel configuration
        let mut set_travel_conf_calldata = Default::default();
        Serde::serialize(@10, ref set_travel_conf_calldata); // free transport per city
        world.execute('SetTravelConfig', set_travel_conf_calldata);

        // set capacity configuration
        let mut set_capacity_conf_calldata = Default::default();
        Serde::serialize(@FREE_TRANSPORT_ENTITY_TYPE, ref set_capacity_conf_calldata);
        Serde::serialize(@200_000, ref set_capacity_conf_calldata); // 200_000 grams ==  200 kg
        world.execute('SetCapacityConfig', set_capacity_conf_calldata);

        (world, realm_entity_id)
    }


    #[test]
    #[available_gas(300000000000)]
    fn test_create_free_transport_unit() {

        let (world, realm_entity_id) = setup();

        // create free transport unit
        let mut create_free_transport_unit_calldata = Default::default();
        Serde::serialize(@realm_entity_id, ref create_free_transport_unit_calldata);
        Serde::serialize(@10, ref create_free_transport_unit_calldata); // quantity
        let free_transport_unit_result = world
            .execute('CreateFreeTransportUnit', create_free_transport_unit_calldata.clone());
        let free_transport_unit_id = *free_transport_unit_result[0];
        

        // check that the free transport unit has been created
        let (quantity, position, metadata, owner, capacity, movable, arrival_time) 
        = get!(world, free_transport_unit_id, (Quantity, Position, MetaData, Owner, Capacity, Movable, ArrivalTime));

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
        world.execute('CreateFreeTransportUnit', create_free_transport_unit_calldata.clone());       
        let quantity_tracker = get!(world, quantity_tracker_key, QuantityTracker);
        assert(quantity_tracker.count == 20, 'quantity tracker not updated'); 
    }



    #[test]
    #[available_gas(300000000000)]
    #[should_panic(expected: ('entity is not owned by caller','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {

        let (world, realm_entity_id) = setup();

        // create free transport unit
        let mut create_free_transport_unit_calldata = Default::default();
        Serde::serialize(@realm_entity_id, ref create_free_transport_unit_calldata);
        Serde::serialize(@10, ref create_free_transport_unit_calldata); // quantity

        starknet::testing::set_contract_address(contract_address_const::<0x99>());
        world.execute('CreateFreeTransportUnit', create_free_transport_unit_calldata);
    }



    #[test]
    #[available_gas(300000000000)]
    #[should_panic(expected: ('not enough free transport unit','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_enough_free_transport_unit() {

        let (world, realm_entity_id) = setup();

        // create free transport unit
        let mut create_free_transport_unit_calldata = Default::default();
        Serde::serialize(@realm_entity_id, ref create_free_transport_unit_calldata);
        Serde::serialize(@70, ref create_free_transport_unit_calldata); // quantity
        world.execute('CreateFreeTransportUnit', create_free_transport_unit_calldata);
    }

}


