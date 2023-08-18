// claim either maker or taker order
// TODO: testing
#[system]
mod ClaimFungibleOrder {
    use eternum::alias::ID;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::components::config::WeightConfig;
    use eternum::components::capacity::Capacity;
    use eternum::components::movable::ArrivalTime;
    use eternum::components::movable::Movable;
    use eternum::components::quantity::Quantity;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::resources::Resource;
    use eternum::components::caravan::Caravan;
    use eternum::components::trade::{Trade, Status, TradeStatus, OrderResource};
    use eternum::components::trade::FungibleEntities;

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, trade_id: u128) {
        // assert caller is owner of the entity_id
        let caller = starknet::get_tx_info().unbox().account_contract_address;
        let owner = get !(ctx.world, entity_id, Owner);
        assert(owner.address == caller, 'not owned by caller');

        let meta = get !(ctx.world, trade_id, Trade);

        // check if entity is maker or taker
        // if taker then query maker order id
        // if maker then query taker order id
        let mut order_id = 0;
        let mut claimed_by_maker = meta.claimed_by_maker;
        let mut claimed_by_taker = meta.claimed_by_taker;

        let order_id = if (entity_id == meta.maker_id) {
            // caller is the maker so need the taker order
            assert(!claimed_by_maker, 'already claimed by maker');
            claimed_by_maker = true;
            meta.taker_order_id
        } else {
            // assert caller is the taker
            assert(entity_id == meta.taker_id, 'Caller is not maker nor taker');
            assert(!claimed_by_taker, 'already claimed by taker');
            claimed_by_taker = true;
            meta.maker_order_id
        };

        set!(
            ctx.world,
            (Trade {
                trade_id,
                maker_id: meta.maker_id,
                taker_id: meta.taker_id,
                maker_order_id: meta.maker_order_id,
                taker_order_id: meta.taker_order_id,
                expires_at: meta.expires_at,
                claimed_by_maker,
                claimed_by_taker,
                taker_needs_caravan: meta.taker_needs_caravan,
            },)
        );

        // check position and arrival time
        let (position, arrival_time, fungible_entities) = get !(
            ctx.world, order_id, (Position, ArrivalTime, FungibleEntities)
        );
        // assert that position is same as entity
        let entity_position = get !(ctx.world, entity_id, Position);
        assert(position == entity_position, 'position mismatch');

        let ts = starknet::get_block_timestamp();

        // assert that arrival time < current time 
        assert(arrival_time.arrives_at <= ts, 'not yet arrived');

        // loop over fungible entities and add to balance of entity
        let mut index = 0;
        loop {
            if index == fungible_entities.count {
                break ();
            }

            let order_resource = get !(
                ctx.world, (order_id, fungible_entities.key, index), OrderResource
            );

            // add quantity to balance of entity
            let current_resource = get !(
                ctx.world, (entity_id, order_resource.resource_type), Resource
            );
            set!(
                ctx.world,
                (Resource {
                    entity_id, resource_type: order_resource.resource_type,
                    balance: current_resource.balance + order_resource.balance,
                },)
            );
            index += 1;
            }
        }
}
// TODO: need to test it when withdraw gas is working
// mod tests {
//     // utils
//     use eternum::utils::testing::spawn_test_world_without_init;
//     use eternum::constants::WORLD_CONFIG_ID;

//     use core::traits::Into;
//     use array::ArrayTrait;
//     use option::OptionTrait;
//     use debug::PrintTrait;

//     use dojo::interfaces::IWorldDispatcherTrait;
//     use dojo::storage::query::{Query, TupleSize3IntoQuery};
//     use dojo::storage::query::TupleSize2IntoQuery;
//     use dojo::execution_context::Context;
//     use dojo::auth::components::AuthRole;

//     #[test]
//     #[available_gas(30000000000000)]
//     // 1. attach for the maker
//     // 2. attach for the taker
//     fn test_claim_order() {
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
//         // set owner as caller
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(0);
//         world.set_entity(ctx, 'Owner'.into(), 11.into(), 0_u8, values.span());

//         // create entity 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(60);
//         values.append(70);
//         // taker_id = 12
//         world.set_entity(ctx, 'Position'.into(), 12.into(), 0_u8, values.span());

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

//         // set arrival of the taker order in the future
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(100);
//         world.set_entity(ctx, 'ArrivalTime'.into(), 14.into(), 0_u8, values.span());

//         // set block_timestamp to 100
//         starknet::testing::set_block_timestamp(100);

//         // set fungible entities in the taker order
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // key = 33
//         values.append(33);
//         values.append(2);
//         world.set_entity(ctx, 'FungibleEntities'.into(), 14.into(), 0_u8, values.span());
//         // set resource
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(1);
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (14, 33, 0).into(), 0_u8, values.span());
//         // set resource
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(2);
//         values.append(200);
//         world.set_entity(ctx, 'Resource'.into(), (14, 33, 1).into(), 0_u8, values.span());

//         // set position of the taker order at the same position as the maker
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(45);
//         values.append(50);
//         world.set_entity(ctx, 'Position'.into(), 14.into(), 0_u8, values.span());

//         // call ClaimFungibleOrder
//         let mut calldata = array::ArrayTrait::<felt252>::new();
//         // maker_id
//         calldata.append(11);
//         // trade_id
//         calldata.append(10);
//         // execute
//         world.execute('ClaimFungibleOrder'.into(), calldata.span());

//         // assert that trade has been claimed by the maker
//         let trade_meta = world.entity('Trade'.into(), 10.into(), 0_u8, 0_usize);
//         assert(*trade_meta[5] == 1, 'trade not claimed by maker');
//         // assert that trade has not been claimed by the taker
//         assert(*trade_meta[6] == 0, 'trade claimed by taker');

//         // assert that the balance of the maker has been updated
//         let resource = world.entity('Resource'.into(), (11, 1).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 100, 'balance not updated');
//         let resource = world.entity('Resource'.into(), (11, 2).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 200, 'balance not updated');

//         // assert that the balance of the taker has not been updated
//         let resource = world.entity('Resource'.into(), (12, 1).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 0, 'balance updated');
//         let resource = world.entity('Resource'.into(), (12, 2).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 0, 'balance updated');
//     }
// }


