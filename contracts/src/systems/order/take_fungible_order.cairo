// taker is the entity taking the trade
// trade_id is the entity holding the Meta of the trade 
#[system]
mod TakeFungibleOrder {
    use eternum::components::trade::FungibleEntities;
    use eternum::components::resources::Resource;
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::{Position, PositionTrait};
    use eternum::components::trade::{Trade, Status, TradeStatus, OrderResource};
    use eternum::components::caravan::Caravan;
    use eternum::components::movable::{Movable, ArrivalTime};

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;

    use dojo::world::Context;
    // you can attach a caravan only if it's needed

    fn execute(ctx: Context, taker_id: u128, trade_id: u128) {
        // get the trade 
        let (meta, trade_status) = get !(ctx.world, trade_id, (Trade, Status));

        // verify expiration date
        let ts = starknet::get_block_timestamp();
        assert(meta.expires_at > ts, 'trade expired');

        // assert that the status is open
        // TODO: change back to enum when works with torii
        let is_open = if (trade_status.value == 0) {
            true
        } else if (trade_status.value == 1) {
            false
        } else {
            false
        };
        assert(is_open, 'Trade is not open');

        // assert that taker entity is owned by caller
        let caller = ctx.origin;
        let owner = get !(ctx.world, taker_id, Owner);
        assert(owner.address == caller, 'not owned by caller');

        // if taker_entity in meta is 0, then set the taker_id
        if meta.taker_id == 0 {
            set !(
                ctx.world,
                (
                    Status {
                        trade_id,
                        value: 1
                        }, Trade {
                        trade_id,
                        maker_id: meta.maker_id,
                        taker_id,
                        maker_order_id: meta.maker_order_id,
                        taker_order_id: meta.taker_order_id,
                        expires_at: meta.expires_at,
                        claimed_by_maker: meta.claimed_by_maker,
                        claimed_by_taker: meta.claimed_by_taker,
                        taker_needs_caravan: meta.taker_needs_caravan,
                    },
                )
            );
        } else {
            // if not 0, then verify if the taker_id is the one specified
            // then set the status as accepted
            assert(meta.taker_id == taker_id, 'not the taker');
            set !(ctx.world, (Status { trade_id, value: 1 }, ));
        };

        // caravan only needed if both are not on the same position
        // get the maker position
        let maker_position = get !(ctx.world, meta.maker_id, Position);
        let taker_position = get !(ctx.world, taker_id, Position);

        // check if there is a caravan attached to the maker
        let caravan = get !(
            ctx.world, (meta.maker_order_id, meta.maker_id), Caravan
        );

        // if caravan id is not 0, it means there is a caravan
        if (caravan.caravan_id != 0) {
            let (movable, caravan_position) = get !(
                ctx.world, caravan.caravan_id, (Movable, Position)
            );
            let travel_time = caravan_position
                .calculate_travel_time(taker_position, movable.sec_per_km);

            set !(
                // SET ORDER
                ctx.world,
                (
                    ArrivalTime {
                        entity_id: meta.maker_order_id,
                        arrives_at: ts + travel_time
                        }, Position {
                        entity_id: meta.maker_order_id,
                        x: taker_position.x, y: taker_position.y
                    },
                )
            );

            set !(
                // SET CARAVAN
                // round trip with the caravan
                // set arrival time * 2
                // dont change position because round trip
                // set back blocked to false
                ctx.world,
                (
                    ArrivalTime {
                        entity_id: caravan.caravan_id,
                        arrives_at: ts + travel_time * 2
                        }, Movable {
                        entity_id: caravan.caravan_id,
                        sec_per_km: movable.sec_per_km, blocked: false, 
                    },
                )
            );
        // no caravan = no travel
        } else {
            set !(
                // SET ORDER
                ctx.world,
                (
                    ArrivalTime {
                        entity_id: meta.maker_order_id,
                        arrives_at: ts
                        }, Position {
                        entity_id: meta.maker_order_id,
                        x: maker_position.x, y: maker_position.y
                    },
                )
            );
        }

        // check if there is a caravan attached to the taker if needed
        // taker caravan is not directly attached to the taker_order_id, but to the
        // (taker_order_id, taker_id), this is because more than one taker can attach a caravan to the same order
        // before one of them accepts it
        if meta.taker_needs_caravan == true {
            let caravan = get !(ctx.world, (meta.taker_order_id, taker_id), Caravan);
            let (movable, caravan_position, owner) = get !(
                ctx.world, caravan.caravan_id, (Movable, Position, Owner)
            );
            // if caravan, starts from the caravan position (not taker position)
            let travel_time = caravan_position
                .calculate_travel_time(maker_position, movable.sec_per_km);

            // assert that the owner of the caravan is the caller
            assert(owner.address == caller, 'not owned by caller');

            set !(
                // SET ORDER
                ctx.world,
                (
                    ArrivalTime {
                        entity_id: meta.taker_order_id,
                        arrives_at: ts + travel_time
                        }, Position {
                        entity_id: meta.taker_order_id,
                        x: maker_position.x, y: maker_position.y
                    },
                )
            );
            set !(
                // SET CARAVAN
                // set arrival time * 2
                // dont change position because round trip
                // set back blocked to false
                ctx.world,
                (
                    ArrivalTime {
                        entity_id: caravan.caravan_id,
                        arrives_at: ts + travel_time * 2
                        }, Movable {
                        entity_id: caravan.caravan_id,
                        sec_per_km: movable.sec_per_km, blocked: false, 
                    },
                )
            );
        } else {
            set !(
                // dont travel
                ctx.world,
                (
                    ArrivalTime {
                        entity_id: meta.taker_order_id,
                        arrives_at: ts
                        }, Position {
                        entity_id: meta.taker_order_id,
                        x: taker_position.x, y: taker_position.y
                    }
                ),
            );
        };

        // remove fungible entities from the taker balance
        let mut index = 0;
        let fungible_entities = get !(ctx.world, meta.taker_order_id, FungibleEntities);
        loop {
            if index == fungible_entities.count {
                break ();
            };
            let order_resource = get !(
                ctx.world, (meta.taker_order_id, fungible_entities.key, index), OrderResource
            );

            // remove the quantity from the taker balance
            let taker_resource = get !(
                ctx.world, (taker_id, order_resource.resource_type), Resource
            );

            // assert has enough
            assert(taker_resource.balance >= order_resource.balance, 'not enough balance');

            set !(
                // remove the quantity from the taker balance
                ctx.world,
                (Resource {
                    entity_id: taker_id, resource_type: order_resource.resource_type, balance: taker_resource.balance - order_resource.balance
                })
            );
            index += 1;
        };
    }
}
// TODO: need to test it when withdraw gas is working
// mod tests {
//     // utils
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
//     use dojo::auth::components::AuthRole;
//     use dojo::execution_context::Context;
//     use dojo::auth::systems::{Route, RouteTrait};

//     #[test]
//     #[available_gas(30000000000000)]
//     fn test_take_trade_without_caravan() {
//         let world = spawn_test_world_without_init();

//         // set as executor
//         starknet::testing::set_contract_address(starknet::contract_address_const::<1>());

//         // context to set entity
//         // only caller_system is used here
//         let ctx = Context {
//             world,
//             caller_account: starknet::contract_address_const::<0x1337>(),
//             caller_system: 'Tester'.into(),
//             execution_role: AuthRole {
//                 id: 'FooWriter'.into()
//             },
//         };

//         // create entity 1
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(45);
//         values.append(50);
//         // maker_id = 11
//         world.set_entity(ctx, 'Position'.into(), 11.into(), 0_u8, values.span());

//         // create entity 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(60);
//         values.append(70);
//         // taker_id = 12
//         world.set_entity(ctx, 'Position'.into(), 12.into(), 0_u8, values.span());
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(15);
//         world.set_entity(ctx, 'Owner'.into(), 12.into(), 0_u8, values.span());

//         // give resources to entity 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(3);
//         values.append(600);
//         world.set_entity(ctx, 'Resource'.into(), (12, 3).into(), 0_u8, values.span());

//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(4);
//         values.append(600);
//         world.set_entity(ctx, 'Resource'.into(), (12, 4).into(), 0_u8, values.span());

//         // create a trade
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // maker_id
//         values.append(11);
//         // taker_id
//         values.append(12);
//         // maker_order_id
//         values.append(13);
//         // taker_order_id
//         values.append(14);
//         // expires_at 
//         values.append(100);
//         // claimed_by_maker
//         values.append(0);
//         // claimed_by_taker
//         values.append(0);
//         // taker_needs_caravan
//         values.append(0);

//         // trade_id
//         let trade_id = 10;
//         world.set_entity(ctx, 'Trade'.into(), trade_id.into(), 0_u8, values.span());

//         // set fungible entities for maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // key
//         values.append(1323);
//         // count
//         values.append(2);
//         world.set_entity(ctx, 'FungibleEntities'.into(), 13.into(), 0_u8, values.span());
//         // set resource for maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(1);
//         // balance
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (13, 1323, 0).into(), 0_u8, values.span());
//         // set resource for maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(2);
//         // balance
//         values.append(200);
//         world.set_entity(ctx, 'Resource'.into(), (13, 1323, 1).into(), 0_u8, values.span());

//         // set fungible entities for taker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // key
//         values.append(1324);
//         // count
//         values.append(2);
//         world.set_entity(ctx, 'FungibleEntities'.into(), 14.into(), 0_u8, values.span());
//         // set resource for taker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(3);
//         // balance
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (14, 1324, 0).into(), 0_u8, values.span());
//         // set resource for taker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(4);
//         // balance
//         values.append(200);
//         world.set_entity(ctx, 'Resource'.into(), (14, 1324, 1).into(), 0_u8, values.span());

//         // taker takes trade
//         starknet::testing::set_account_contract_address(starknet::contract_address_const::<15>());
//         let mut calldata = array::ArrayTrait::<felt252>::new();
//         // taker_id
//         calldata.append(12);
//         // trade_id
//         calldata.append(10);
//         world.execute('TakeFungibleOrder'.into(), calldata.span());

//         // taker balance resource_type 3 should be 500
//         let entity_2_resource = world.entity('Resource'.into(), (12, 3).into(), 0_u8, 0_usize);
//         assert(*entity_2_resource[0] == 3, 'should be resource type 3');
//         assert(*entity_2_resource[1] == 500, 'resource balance should be 500');

//         // taker balance resource_type 4 should be 400
//         let entity_2_resource = world.entity('Resource'.into(), (12, 4).into(), 0_u8, 0_usize);
//         assert(*entity_2_resource[0] == 4, 'should be resource type 4');
//         assert(*entity_2_resource[1] == 400, 'resource balance should be 400');

//         // status should be accepted
//         let status = world.entity('Status'.into(), 10.into(), 0_u8, 0_usize);
//         assert(*status[0] == 1, 'status should be accepted');

//         // verify arrival time of maker order
//         let arrival_time = world.entity('ArrivalTime'.into(), 13.into(), 0_u8, 0_usize);
//         assert(*arrival_time[0] == 0, 'arrival time should be 0');

//         // verify arrival time of taker order
//         let arrival_time = world.entity('ArrivalTime'.into(), 14.into(), 0_u8, 0_usize);
//         assert(*arrival_time[0] == 0, 'arrival time should be 0');

//         // verify position of maker order
//         let position = world.entity('Position'.into(), 13.into(), 0_u8, 0_usize);
//         assert(*position[0] == 45, 'position x should be 45');
//         assert(*position[1] == 50, 'position y should be 50');

//         // verify position of taker order
//         let position = world.entity('Position'.into(), 14.into(), 0_u8, 0_usize);
//         assert(*position[0] == 60, 'position x should be 60');
//         assert(*position[1] == 70, 'position y should be 70');
//     }
//     #[test]
//     #[available_gas(30000000000000)]
//     fn test_take_trade_with_caravan() {
//         let world = spawn_test_world_without_init();

//         // set as executor
//         starknet::testing::set_contract_address(starknet::contract_address_const::<1>());

//         // context to set entity
//         // only caller_system is used here
//         let ctx = Context {
//             world,
//             caller_account: starknet::contract_address_const::<0x1337>(),
//             caller_system: 'Tester'.into(),
//             execution_role: AuthRole {
//                 id: 'FooWriter'.into()
//             },
//         };

//         // create entity 1
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(45);
//         values.append(50);
//         // maker_id = 11
//         world.set_entity(ctx, 'Position'.into(), 11.into(), 0_u8, values.span());

//         // create entity 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(60);
//         values.append(70);
//         // taker_id = 12
//         world.set_entity(ctx, 'Position'.into(), 12.into(), 0_u8, values.span());
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(15);
//         world.set_entity(ctx, 'Owner'.into(), 12.into(), 0_u8, values.span());

//         // give resources to entity 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(3);
//         values.append(600);
//         world.set_entity(ctx, 'Resource'.into(), (12, 3).into(), 0_u8, values.span());

//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(4);
//         values.append(600);
//         world.set_entity(ctx, 'Resource'.into(), (12, 4).into(), 0_u8, values.span());

//         // create a trade
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // maker_id
//         values.append(11);
//         // taker_id
//         values.append(12);
//         // maker_order_id
//         values.append(13);
//         // taker_order_id
//         values.append(14);
//         // expires_at 
//         values.append(100);
//         // claimed_by_maker
//         values.append(0);
//         // claimed_by_taker
//         values.append(0);
//         // taker_needs_caravan
//         values.append(0);

//         // trade_id
//         let trade_id = 10;
//         world.set_entity(ctx, 'Trade'.into(), trade_id.into(), 0_u8, values.span());

//         // set fungible entities for maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // key
//         values.append(1323);
//         // count
//         values.append(2);
//         world.set_entity(ctx, 'FungibleEntities'.into(), 13.into(), 0_u8, values.span());
//         // set resource for maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(1);
//         // balance
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (13, 1323, 0).into(), 0_u8, values.span());
//         // set resource for maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(2);
//         // balance
//         values.append(200);
//         world.set_entity(ctx, 'Resource'.into(), (13, 1323, 1).into(), 0_u8, values.span());

//         // set fungible entities for taker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // key
//         values.append(1324);
//         // count
//         values.append(2);
//         world.set_entity(ctx, 'FungibleEntities'.into(), 14.into(), 0_u8, values.span());
//         // set resource for taker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(3);
//         // balance
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (14, 1324, 0).into(), 0_u8, values.span());
//         // set resource for taker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(4);
//         // balance
//         values.append(200);
//         world.set_entity(ctx, 'Resource'.into(), (14, 1324, 1).into(), 0_u8, values.span());

//         // create a caravan owned by the maker
//         // caravan_id = 20;
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(11);
//         world.set_entity(ctx, 'Owner'.into(), 20.into(), 0_u8, values.span());
//         // capacity
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(10000);
//         world.set_entity(ctx, 'Capacity'.into(), 20.into(), 0_u8, values.span());
//         // movable
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(10);
//         values.append(0);
//         world.set_entity(ctx, 'Movable'.into(), 20.into(), 0_u8, values.span());
//         // position
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(45);
//         values.append(50);
//         world.set_entity(ctx, 'Position'.into(), 20.into(), 0_u8, values.span());
//         // attach caravan to the maker order
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(20);
//         world.set_entity(ctx, 'Caravan'.into(), 13.into(), 0_u8, values.span());

//         // taker takes trade
//         starknet::testing::set_account_contract_address(starknet::contract_address_const::<15>());
//         let mut calldata = array::ArrayTrait::<felt252>::new();
//         // taker_id
//         calldata.append(12);
//         // trade_id
//         calldata.append(10);
//         world.execute('TakeFungibleOrder'.into(), calldata.span());

//         // taker balance resource_type 3 should be 500
//         let entity_2_resource = world.entity('Resource'.into(), (12, 3).into(), 0_u8, 0_usize);
//         assert(*entity_2_resource[0] == 3, 'should be resource type 3');
//         assert(*entity_2_resource[1] == 500, 'resource balance should be 500');

//         // taker balance resource_type 4 should be 400
//         let entity_2_resource = world.entity('Resource'.into(), (12, 4).into(), 0_u8, 0_usize);
//         assert(*entity_2_resource[0] == 4, 'should be resource type 4');
//         assert(*entity_2_resource[1] == 400, 'resource balance should be 400');

//         // status should be accepted
//         let status = world.entity('Status'.into(), 10.into(), 0_u8, 0_usize);
//         assert(*status[0] == 1, 'status should be accepted');

//         // verify arrival time of maker order
//         let arrival_time = world.entity('ArrivalTime'.into(), 13.into(), 0_u8, 0_usize);
//         assert(*arrival_time[0] == 0, 'arrival time should be 0');

//         // verify arrival time of taker order
//         let arrival_time = world.entity('ArrivalTime'.into(), 14.into(), 0_u8, 0_usize);
//         assert(*arrival_time[0] == 0, 'arrival time should be 0');

//         // verify position of maker order
//         let position = world.entity('Position'.into(), 13.into(), 0_u8, 0_usize);
//         assert(*position[0] == 45, 'position x should be 45');
//         assert(*position[1] == 50, 'position y should be 50');

//         // verify position of taker order
//         let position = world.entity('Position'.into(), 14.into(), 0_u8, 0_usize);
//         assert(*position[0] == 60, 'position x should be 60');
//         assert(*position[1] == 70, 'position y should be 70');
//     }
// }


