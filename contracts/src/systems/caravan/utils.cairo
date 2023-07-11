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

    use dojo::world::Context;

    // create an execute function that takes a list of entity ids as input and
    // returns the average speed of the entities 
    fn execute(ctx: Context, entity_ids: Span<ID>) -> u128 {
        let mut total_speed: u128 = 0_u128;
        let mut total_quantity: u128 = 0_u128;
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let mut index = 0;
        // loop over the entities
        loop {
            if index == entity_ids.len() {
                break ();
            }
            // assert that they are movable
            let movable = get !(ctx.world, (*entity_ids[index]).into(), Movable);

            // try to retrieve the Quantity component of the entity
            let maybe_quantity = try_get !(ctx.world, (*entity_ids[index]).into(), Quantity);

            let quantity = match maybe_quantity {
                Option::Some(res) => {
                    res.value
                },
                Option::None(_) => { // if not present quantity = 1
                    1_u128
                }
            };

            total_speed += movable.sec_per_km.into() * quantity;
            total_quantity += quantity;
            index += 1;
        }

        let average_speed = total_speed / total_quantity;
        average_speed
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

    fn execute(ctx: Context, entity_id: ID) -> u128 {
        // try to retrieve the Quantity component of the entity
        let maybe_quantity = try_get !(ctx.world, entity_id.into(), Quantity);

        match maybe_quantity {
            Option::Some(res) => {
                res.value
            },
            Option::None(_) => { // if not present quantity = 1
                1_u128
            }
        }
    }
}
// mod tests {
//     // consts
//     use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

//     // utils
//     use eternum::utils::testing::spawn_test_world_without_init;

//     use core::traits::Into;
//     use core::result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;
//     use debug::PrintTrait;

//     use starknet::syscalls::deploy_syscall;

//     use dojo::interfaces::{IWorldDispatcherTrait, IWorldDispatcherImpl};
//     use dojo::storage::query::Query;
//     use dojo::execution_context::Context;
//     use dojo::auth::components::AuthRole;

//     // test that the average speed is correct
//     #[test]
//     #[available_gas(300000000000)]
//     fn test_get_average_speed() {
//         let world = spawn_test_world_without_init();

//         // create realm
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

//         // set world config
//         let mut travel_config_call_data = array::ArrayTrait::<felt252>::new();
//         travel_config_call_data.append(10);
//         world.execute('SetTravelConfig'.into(), travel_config_call_data.span());

//         // set speed configuration entity
//         let mut set_speed_conf_calldata = array::ArrayTrait::<felt252>::new();
//         set_speed_conf_calldata.append(FREE_TRANSPORT_ENTITY_TYPE.into());
//         // speed of 10 km per hr for free transport unit
//         set_speed_conf_calldata.append(10);
//         world.execute('SetSpeedConfig'.into(), set_speed_conf_calldata.span());

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
//         let units_1_id: felt252 = *result[0];
//         // create free transport unit
//         let mut create_free_transport_unit_calldata = array::ArrayTrait::<felt252>::new();
//         create_free_transport_unit_calldata.append(1);
//         create_free_transport_unit_calldata.append(10);
//         let result = world
//             .execute('CreateFreeTransportUnit'.into(), create_free_transport_unit_calldata.span());
//         let units_2_id: felt252 = *result[0];

//         // get average speed
//         let mut get_average_speed_calldata = array::ArrayTrait::<felt252>::new();
//         get_average_speed_calldata.append(2);
//         get_average_speed_calldata.append(units_1_id);
//         get_average_speed_calldata.append(units_2_id);
//         let result = world.execute('GetAverageSpeed'.into(), get_average_speed_calldata.span());
//         let average_speed = *result[0];
//         assert(average_speed == 10, 'average speed not correct');
//     }

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_get_quantity_with_quantity_component() {
//         let world = spawn_test_world_without_init();
//         // random, does not matter since world is not init yet
//         let ctx = Context {
//             world,
//             caller_account: starknet::contract_address_const::<0x1337>(),
//             caller_system: 'Tester'.into(),
//             execution_role: AuthRole {
//                 id: 'FooWriter'.into()
//             },
//         };
//         // set caller as executor 
//         starknet::testing::set_contract_address(starknet::contract_address_const::<1>());
//         let mut value = array::ArrayTrait::<felt252>::new();
//         value.append(10);
//         let entity_id = 1;
//         world.set_entity(ctx, 'Quantity'.into(), entity_id.into(), 0_u8, value.span());

//         let mut calldata = array::ArrayTrait::<felt252>::new();
//         calldata.append(entity_id);
//         let quantity = world.execute('GetQuantity'.into(), calldata.span());
//         assert(*quantity[0] == 10, 'quantity not correct');
//     }

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_get_quantity_without_quantity_component() {
//         let world = spawn_test_world_without_init();
//         // set caller as executor 
//         starknet::testing::set_contract_address(starknet::contract_address_const::<1>());
//         let entity_id = 1;
//         let mut calldata = array::ArrayTrait::<felt252>::new();
//         calldata.append(entity_id);
//         let quantity = world.execute('GetQuantity'.into(), calldata.span());
//         assert(*quantity[0] == 1, 'quantity not correct');
//     }
// }


