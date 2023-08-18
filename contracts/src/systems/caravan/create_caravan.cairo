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
    use eternum::components::quantity::Quantity;
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

        let caller = starknet::get_tx_info().unbox().account_contract_address;

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
            let (movable, capacity, position) = get!(
                ctx.world, (entity_id), (Movable, Capacity, Position)
            );

            // assert that they are all at the same position when index > 0
            // if index == 0, then initialize position as the first entity position
            if index != 0 {
                assert(entity_position == position, 'entities not same position');
            } else {
                entity_position = position;
            }

            // assert that caller is the owner of the entities
            let owner = get!(ctx.world, (entity_id), Owner);
            assert(caller == owner.address, 'entity is not owned by caller');

            // assert that they are not blocked
            assert(movable.blocked == false, 'entity is blocked');

            // DISUCSS: is that more cumbersome than just getting the quantity?
            // like below
            let mut calldata = array::ArrayTrait::<felt252>::new();
            calldata.append(entity_id.into());

            let result = ctx.world.execute('GetQuantity'.into(), calldata);
            let quantity: u128 = (*result[0]).try_into().unwrap();

            // // try to retrieve the Quantity component of the entity
            // let maybe_quantity = commands::<Quantity>::try_entity((*entity_ids[index]).into());
            // // TODO: match inside a loop does not work yet on dojo
            // let quantity = match maybe_quantity {
            //     Option::Some(res) => {
            //         res.value
            //     },
            //     Option::None(_) => { // if not present quantity = 1
            //         1_u128
            //     }
            // };

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
// mod tests {
//     // consts
//     use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

//     // testing
//     use eternum::utils::testing::spawn_test_world_without_init;

//     use core::traits::Into;
//     use core::result::ResultTrait;
//     use array::ArrayTrait;
//     use option::OptionTrait;
//     use debug::PrintTrait;

//     use starknet::syscalls::deploy_syscall;

//     use dojo::interfaces::IWorldDispatcherTrait;
//     use dojo::storage::query::{
//         Query, TupleSize2IntoQuery, LiteralIntoQuery, TupleSize3IntoQuery
//     };
//     use dojo::test_utils::spawn_test_world;

//     #[test]
//     #[available_gas(300000000000)]
//     fn test_create_caravan() {
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
//         // set world config
//         let mut world_config_call_data = array::ArrayTrait::<felt252>::new();
//         world_config_call_data.append(0);
//         world_config_call_data.append(0);
//         world_config_call_data.append(252000000000000000000);
//         world_config_call_data.append(0);
//         world_config_call_data.append(0);
//         world_config_call_data.append(0);
//         world_config_call_data.append(0);
//         // 10 free transport per city
//         world_config_call_data.append(10);
//         world.execute('WorldConfig'.into(), world_config_call_data.span());

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

//         // create caravan
//         let mut create_caravan_calldata = array::ArrayTrait::<felt252>::new();
//         create_caravan_calldata.append(2);
//         create_caravan_calldata.append(units_1_id);
//         create_caravan_calldata.append(units_2_id);
//         let result = world.execute('CreateCaravan'.into(), create_caravan_calldata.span());
//         let caravan_id = *result[0];

//         // assert that the caravan has been created
//         let caravan_members = world
//             .entity('CaravanMembers'.into(), caravan_id.into(), 0_u8, 0_usize);

//         // verify that the caravan has been created
//         let caravan_members = world
//             .entity('CaravanMembers'.into(), caravan_id.into(), 0_u8, 0_usize);
//         assert(*caravan_members[1] == 2, 'count not right');

//         // verify that the caravan has the correct speed
//         let speed = world.entity('Movable'.into(), caravan_id.into(), 0_u8, 0_usize);
//         assert(*speed[0] == 10, 'speed not set');
//         // verify that the caravan is not blocked
//         assert(*speed[1] == 0, 'entity is blocked');

//         // verify that the caravan has the correct capacity
//         let capacity = world.entity('Capacity'.into(), caravan_id.into(), 0_u8, 0_usize);
//         assert(*capacity[0] == 400000, 'capacity not set');

//         // verify that the caravan has the correct position
//         let position = world.entity('Position'.into(), caravan_id.into(), 0_u8, 0_usize);
//         assert(*position[0] == 20, 'position not set');
//         assert(*position[1] == 30, 'position not set');

//         // verify that the caravan has the correct owner
//         let owner = world.entity('Owner'.into(), caravan_id.into(), 0_u8, 0_usize);
//         assert(*owner[0] == starknet::get_caller_address().into(), 'owner not set');

//         // verify that the caravan has the correct foreign key
//         let foreign_key_1 = world
//             .entity(
//                 'ForeignKey'.into(), (caravan_id, *caravan_members[0], 0).into(), 0_u8, 0_usize
//             );
//         assert(*foreign_key_1[0] == units_1_id, 'foreign key not set');

//         let foreign_key_2 = world
//             .entity(
//                 'ForeignKey'.into(), (caravan_id, *caravan_members[0], 1).into(), 0_u8, 0_usize
//             );

//         assert(*foreign_key_2[0] == units_2_id, 'foreign key not set');
//     }
// }


