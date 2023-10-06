// DISCUSS: created 2 systems in order to make systems more atomic

// GetAverageSpeed: can be used in order to calculate how fast a group of entities can move
// together. Haven't used it for the CreateCaravan system because it would mean making an extra loop
// over the entities
#[system]
mod GetAverageSpeed {
    use eternum::alias::ID;
    use eternum::models::quantity::Quantity;
    use eternum::models::movable::Movable;

    use traits::Into;
    use box::BoxTrait;
    use array::ArrayTrait;

    use dojo::world::Context;

    // create an execute function that takes a list of entity ids as input and
    // returns the average speed of the entities 
    fn execute(ctx: Context, entity_ids: Array<ID>) -> u128 {
        let mut total_speed: u128 = 0_u128;
        let mut total_quantity: u128 = 0_u128;

        // Get the caller's address
        let caller = ctx.origin;
        let mut index = 0;

        // loop over the entities
        loop {
            if index == entity_ids.len() {
                break ();
            }

            // Ensure the entity is movable
            let movable = get!(ctx.world, (*entity_ids[index]), Movable);

            // try to retrieve the Quantity component of the entity
            let maybe_quantity = get!(ctx.world, (*entity_ids[index]), Quantity);
            let mut quantity = if maybe_quantity.value != 0 {
                maybe_quantity.value
            } else {
                0
            };

            total_speed += movable.sec_per_km.into() * quantity;
            total_quantity += quantity;
            index += 1;
        };

        // Calculate and return average speed
        total_speed / total_quantity
    }
}


#[cfg(test)]
mod tests {
    use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
    use eternum::models::position::Position;

    // testing
    use eternum::utils::testing::spawn_eternum;

    use traits::{Into, TryInto};
    use result::ResultTrait;
    use array::{ArrayTrait, SpanTrait};
    use option::OptionTrait;
    use serde::Serde;
    use clone::Clone;
    
    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};


    #[test]
    #[available_gas(300000000000)]
    fn test_get_average_speed() {
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

        // set world config
        let mut world_config_calldata = Default::default(); 
        Serde::serialize(@world.contract_address, ref world_config_calldata); // realm l2 contract address
    
        world.execute('SetWorldConfig', world_config_calldata);


        // set capacity configuration
        let mut set_capacity_conf_calldata = Default::default();
        Serde::serialize(@FREE_TRANSPORT_ENTITY_TYPE, ref set_capacity_conf_calldata);
        Serde::serialize(@200_000, ref set_capacity_conf_calldata); // 200_000 grams ==  200 kg
        world.execute('SetCapacityConfig', set_capacity_conf_calldata);


        // set travel configuration
        let mut set_travel_conf_calldata = Default::default();
        Serde::serialize(@5, ref set_travel_conf_calldata); // free transport per city
        world.execute('SetTravelConfig', set_travel_conf_calldata);



        // create two free transport unit for the realm
        let mut transport_units: Array<u128> = array![];
        let mut create_free_transport_unit_calldata = Default::default();
        Serde::serialize(@realm_entity_id, ref create_free_transport_unit_calldata);
        Serde::serialize(@10, ref create_free_transport_unit_calldata); // quantity
        let first_free_transport_unit_result = world
            .execute('CreateFreeTransportUnit', create_free_transport_unit_calldata.clone());
        
        transport_units.append((*first_free_transport_unit_result[0]).try_into().unwrap());

        let second_free_transport_unit_result = world
            .execute('CreateFreeTransportUnit', create_free_transport_unit_calldata.clone());
        
        transport_units.append((*second_free_transport_unit_result[0]).try_into().unwrap());

        // get average speed
        let mut get_average_speed_calldata = Default::default();
        Serde::serialize(@transport_units, ref get_average_speed_calldata);
        let result = world.execute('GetAverageSpeed', get_average_speed_calldata);
        let average_speed = *result[0];
        assert(average_speed == 10, 'average speed not correct');
    }
}
