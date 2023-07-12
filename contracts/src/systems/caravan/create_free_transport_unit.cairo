// need store the number of free transport unit per realm
// need to get the maximum number of free transport unit per realm from the transport config

#[system]
mod CreateFreeTransportUnit {
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
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
    use box::BoxTrait;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, quantity: u128) -> ID {
        // assert that the entity is a realm by querying the entity type
        let (owner, realm, position) = get !(ctx.world, entity_id.into(), (Owner, Realm, Position));

        // assert that entity is owned by caller
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        assert(caller == owner.address, 'entity is not owned by caller');

        // check how many free transport units you can still build
        let travel_config = get !(ctx.world, TRANSPORT_CONFIG_ID.into(), TravelConfig);

        // nb cities for the realm
        let max_free_transport = realm.cities.into() * travel_config.free_transport_per_city;

        // check the quantity_tracker for free transport unit
        let maybe_quantity_tracker = try_get !(
            ctx.world, (entity_id, FREE_TRANSPORT_ENTITY_TYPE).into(), QuantityTracker
        );
        let count = match maybe_quantity_tracker {
            Option::Some(quantity_tracker) => (quantity_tracker.count),
            Option::None(_) => {
                0
            }
        };
        assert(count + quantity <= max_free_transport, 'not enough free transport unit');

        // increment count when create new units
        // TODO: need to decrease count when transport unit is destroyed
        set !(
            ctx.world,
            (entity_id, FREE_TRANSPORT_ENTITY_TYPE).into(),
            (QuantityTracker { count: count + quantity })
        );

        // get the speed and capacity of the free transport unit from the config entity
        let (speed, capacity) = get !(
            ctx.world,
            (WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE).into(),
            (SpeedConfig, CapacityConfig)
        );
        // create the transport unit
        let id = ctx.world.uuid();
        set !(
            ctx.world,
            id.into(),
            (
                Position {
                    x: position.x, y: position.y
                    }, MetaData {
                    entity_type: FREE_TRANSPORT_ENTITY_TYPE
                    }, Owner {
                    address: caller
                    }, Quantity {
                    value: quantity
                    }, Movable {
                    sec_per_km: speed.sec_per_km, blocked: false, 
                    }, ArrivalTime {
                    arrives_at: 0, 
                    }, Capacity {
                    weight_gram: capacity.weight_gram
                }
            )
        );
        id.into()
    }
}
// mod tests {
// // consts
// use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

// use core::traits::Into;
// use core::result::ResultTrait;
// use array::ArrayTrait;
// use option::OptionTrait;
// use debug::PrintTrait;

// use starknet::syscalls::deploy_syscall;

// use eternum::utils::testing::spawn_test_world_without_init;

// use dojo::interfaces::IWorldDispatcherTrait;
// use dojo::storage::query::{Query, TupleSize2IntoQuery, LiteralIntoQuery, TupleSize3IntoQuery};
//     #[test]
//     #[available_gas(300000000000)]
//     fn test_create_free_transport_unit() {
//         let world = spawn_test_world_without_init();

//         /// CREATE ENTITIES ///
//         // set realm entity
//         let mut create_realm_calldata = array::ArrayTrait::<felt252>::new();
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(starknet::get_caller_address().into());
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         // cities = 6
//         create_realm_calldata.append(6);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(5);
//         create_realm_calldata.append(1);
//         create_realm_calldata.append(1);
//         // position
//         create_realm_calldata.append(20);
//         create_realm_calldata.append(30);
//         world.execute('CreateRealm'.into(), create_realm_calldata.span());

//         // set speed configuration entity
//         let mut set_speed_conf_calldata = array::ArrayTrait::<felt252>::new();
//         set_speed_conf_calldata.append(FREE_TRANSPORT_ENTITY_TYPE.into());
//         // speed of 10 km per hr for free transport unit
//         set_speed_conf_calldata.append(10);
//         world.execute('SetSpeedConfig'.into(), set_speed_conf_calldata.span());

//         // set travel config
//         let mut travel_config_call_data = array::ArrayTrait::<felt252>::new();
//         travel_config_call_data.append(10);
//         world.execute('SetTravelConfig'.into(), travel_config_call_data.span());

//         // set capacity configuration entity
//         let mut set_capacity_conf_calldata = array::ArrayTrait::<felt252>::new();
//         set_capacity_conf_calldata.append(FREE_TRANSPORT_ENTITY_TYPE.into());
//         // free transport unit can carry 200_000 grams (200 kg)
//         set_capacity_conf_calldata.append(200000);
//         world.execute('SetCapacityConfig'.into(), set_capacity_conf_calldata.span());

//         // create free transport unit
//         let mut create_free_transport_unit_calldata = array::ArrayTrait::<felt252>::new();
//         create_free_transport_unit_calldata.append(1);
//         create_free_transport_unit_calldata.append(10);
//         let result = world
//             .execute('CreateFreeTransportUnit'.into(), create_free_transport_unit_calldata.span());
//         let new_entity_id = *result[0];

//         // check that the free transport unit has been created
//         let quantity = world.entity('Quantity'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*quantity[0] == 10, 'free transport unit not created');
//         // verify that quantity tracker has been updated
//         let quantity_tracker = world
//             .entity(
//                 'QuantityTracker'.into(), (1, FREE_TRANSPORT_ENTITY_TYPE).into(), 0_u8, 0_usize
//             );
//         assert(*quantity_tracker[0] == 10, 'quantity tracker not updated');

//         // verify the position
//         let position = world.entity('Position'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*position[0] == 20, 'position not set');
//         assert(*position[1] == 30, 'position not set');

//         // verify the entity type
//         let entity_type = world.entity('MetaData'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*entity_type[0] == FREE_TRANSPORT_ENTITY_TYPE.into(), 'entity type not set');

//         // verify the owner
//         let owner = world.entity('Owner'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*owner[0] == starknet::get_caller_address().into(), 'owner not set');

//         // verify the capacity
//         let capacity = world.entity('Capacity'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*capacity[0] == 200000, 'capacity not set');

//         // verify the speed
//         let speed = world.entity('Movable'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*speed[0] == 10, 'speed not set');
//         // verify that the free transport unit is not blocked
//         assert(*speed[1] == 0, 'entity is blocked');

//         // verify the arrival time
//         let arrival_time = world.entity('ArrivalTime'.into(), new_entity_id.into(), 0_u8, 0_usize);
//         assert(*arrival_time[0] == 0, 'arrival time not set');
//     }
// // TODO: #[should_panic(expected: ('not enough free transport unit', ))]
// // not working atm 
// }


