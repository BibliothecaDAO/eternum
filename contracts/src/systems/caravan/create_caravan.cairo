// from an array of entities that have the movable, capacity and position components,
// create one with a new movable component and capacity component

// 1. you need to remove the position component of all entities in the caravan
// 2. position is reset for all subentities when the caravan is deleted 
// 3. caravan hash a position, movable and arrival_time component

#[system]
mod CreateCaravan {
    use eternum::alias::ID;
    use eternum::components::metadata::ForeignKey;
    use eternum::components::caravan::CaravanMembers;
    use eternum::components::quantity::{Quantity, QuantityTrait};
    use eternum::components::position::Position;
    use eternum::components::movable::Movable;
    use eternum::components::capacity::Capacity;
    use eternum::components::owner::Owner;

    use traits::Into;
    use traits::TryInto;
    use array::ArrayTrait;
    use option::OptionTrait;
    use box::BoxTrait;
    use poseidon::poseidon_hash_span;

    use dojo::world::Context;


    fn execute(ctx: Context, entity_ids: Array<felt252>) -> ID {
        // speed
        let mut total_speed: u128 = 0_u128;
        let mut total_quantity: u128 = 0_u128;
        // capacity
        let mut total_capacity: u128 = 0_u128;

        // get key to write each entity of the caravan
        let entities_key = ctx.world.uuid();
        // get caravan id
        let caravan_id = ctx.world.uuid();

        let mut entity_position: Position = Position { entity_id: caravan_id.into(), x: 0, y: 0 };

        let caller = ctx.origin;

        let mut index = 0;
        // loop over the entities to
        // - sum speed and capacity
        // - check that all positions are identical
        // - assert owner is caller
        // - assert entity is not already blocked (e.g. by another caravan)

        let length = entity_ids.len();
        loop {
            if index == length {
                break ();
            }
            let entity_id: u128 = (*entity_ids[index]).try_into().unwrap();

            // assert that they are movable
            // assert that they have a capacity component
            let (movable, capacity, position, quantity) = get!(
                ctx.world, (entity_id), (Movable, Capacity, Position, Quantity)
            );

            // assert that they are all at the same position when index > 0
            // if index == 0, then initialize position as the first entity position
            if index != 0 {
                assert(entity_position.x == position.x, 'entities not same position');
                assert(entity_position.y == position.y, 'entities not same position');
            } else {
                entity_position = position;
            }

            // assert that caller is the owner of the entities
            let owner = get!(ctx.world, (entity_id), Owner);
            assert(caller == owner.address, 'entity is not owned by caller');

            // assert that they are not blocked
            assert(movable.blocked == false, 'entity is blocked');

            // set entity in the caravan
            let foreign_key_arr = array![caravan_id.into(), entities_key.into(), index.into()];
            let foreign_key = poseidon_hash_span(foreign_key_arr.span());
            let _ = set!(ctx.world, (ForeignKey { foreign_key, entity_id }));

            // set the entity as blocked so that it cannot be used in another caravan
            let _ = set!(
                ctx.world, (Movable { entity_id, sec_per_km: movable.sec_per_km, blocked: true,  })
            );

            // TODO: add the Caravan component to each entity
            // so that when we know it's in a caravan
            let quantity: u128 = quantity.get_value();
            total_speed += movable.sec_per_km.into() * quantity;
            total_quantity += quantity;
            total_capacity += capacity.weight_gram * quantity;
            index += 1;
        };
        // DISCUSS: i created a getAverageSpeed system but
        // it would mean that we'd have to loop 2x over the entities

        // DISCUSS: i could also create a new CheckAllSamePosition system that checks
        // if a list of entities are at the same position, but again that would be 
        // an extra loop
        let average_speed = total_speed / total_quantity;
        let average_speed: u16 = average_speed.try_into().unwrap();

        // set the caravan entity
        let _ = set!(
            ctx.world,
            (
                Owner {
                    entity_id: caravan_id.into(), address: caller, 
                    }, Movable {
                    entity_id: caravan_id.into(), sec_per_km: average_speed, blocked: false, 
                    }, Capacity {
                    entity_id: caravan_id.into(), weight_gram: total_capacity, 
                    }, CaravanMembers {
                    entity_id: caravan_id.into(), key: entities_key.into(), count: length
                    }, Position {
                    entity_id: caravan_id.into(), x: entity_position.x, y: entity_position.y
                }
            )
        );
        caravan_id.into()
    }
}

#[cfg(test)]
mod tests {

    use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
    use eternum::components::position::Position;
    use eternum::components::caravan::CaravanMembers;
    use eternum::components::metadata::ForeignKey;
    use eternum::components::movable::Movable;
    use eternum::components::capacity::Capacity;
    use eternum::components::owner::Owner;

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

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

    fn setup() -> (IWorldDispatcher, felt252, Array<felt252>) {
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
        let mut transport_units: Array<felt252> = array![];
        let mut create_free_transport_unit_calldata = Default::default();
        Serde::serialize(@realm_entity_id, ref create_free_transport_unit_calldata);
        Serde::serialize(@10, ref create_free_transport_unit_calldata); // quantity
        let first_free_transport_unit_result = world
            .execute('CreateFreeTransportUnit', create_free_transport_unit_calldata.clone());
        
        transport_units.append(*first_free_transport_unit_result[0]);

        let second_free_transport_unit_result = world
            .execute('CreateFreeTransportUnit', create_free_transport_unit_calldata.clone());
        
        transport_units.append(*second_free_transport_unit_result[0]);

        (world, realm_entity_id, transport_units)
    }

    #[test]
    #[available_gas(300000000000)]
    fn test_create_caravan() {

        let (world, realm_entity_id, transport_units) = setup();
        
        // create caravan
        let mut create_caravan_calldata = Default::default();
        Serde::serialize(@transport_units, ref create_caravan_calldata);
        let result = world.execute('CreateCaravan', create_caravan_calldata);
        let caravan_id = *result[0];

        // verify that the caravan has been created
        let (caravan_members, caravan_movable, caravan_capacity, caravan_position, caravan_owner) 
        = get!(world, caravan_id, (CaravanMembers, Movable, Capacity, Position, Owner));

                
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
    #[should_panic(expected: ('entity is not owned by caller','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {

        let (world, realm_entity_id, transport_units) = setup();

        // create caravan
        let mut create_caravan_calldata = Default::default();
        Serde::serialize(@transport_units, ref create_caravan_calldata);

        starknet::testing::set_contract_address(contract_address_const::<0x99>());
        world.execute('CreateCaravan', create_caravan_calldata);   
    }


    #[test]
    #[available_gas(300000000000)]
    #[should_panic(expected: ('entity is blocked','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_blocked_entity() {

        let (world, realm_entity_id, mut transport_units) = setup();

        // duplicate the first transport unit
        transport_units.append(*transport_units.at(0));

        // create caravan
        let mut create_caravan_calldata = Default::default();
        Serde::serialize(@transport_units, ref create_caravan_calldata);
        world.execute('CreateCaravan', create_caravan_calldata);   
    }


}


