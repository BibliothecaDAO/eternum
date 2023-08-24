// DISCUSS: created 2 systems in order to make systems more atomic

// GetAverageSpeed: can be used in order to calculate how fast a group of entities can move
// together. Haven't used it for the CreateCaravan system because it would mean making an extra loop
// over the entities
#[system]
mod GetAverageSpeed {
    use eternum::alias::ID;
    use eternum::components::quantity::Quantity;
    use eternum::components::movable::Movable;

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


// GetQuantity: either return 1 if no quantity component or the value of the 
// quantity component.
#[system]
mod GetQuantity {
    use eternum::alias::ID;
    use eternum::components::quantity::Quantity;

    use traits::Into;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128) -> u128 {
        // try to retrieve the Quantity component of the entity
        let maybe_quantity = get!(ctx.world, entity_id, Quantity);

        if maybe_quantity.value != 0 {
            maybe_quantity.value
        } else {
            0
        }
    }
}


mod tests {
    // testing
    use eternum::utils::testing::setup_eternum;

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
        let (world, realm_entity_id) = setup_eternum();

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


