#[system]
mod AttachCaravan {
    use eternum::alias::ID;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::components::config::WeightConfig;
    use eternum::components::capacity::Capacity;
    use eternum::components::movable::Movable;
    use eternum::components::quantity::Quantity;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::resources::Resource;
    use eternum::components::caravan::Caravan;
    use eternum::components::trade::{Trade, Status, OrderId, TradeStatus, OrderResource};
    use eternum::components::trade::FungibleEntities;

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;

    use dojo::world::Context;

    use poseidon::poseidon_hash_span;

    // This system can be called by the maker or the taker.
    // Taker can only attach caravan if it's asked by the maker.
    // When taker attach a caravan, it's attached to your entity as a composite key 
    // so that any possible taker can attach his caravan to it until a taker takes the order.
    // like this:
    // set !(ctx.world, (order_id, entity_id), (Caravan { caravan_id }));

    fn execute(ctx: Context, entity_id: u128, trade_id: u128, caravan_id: u128) {
        let caller = ctx.origin;

        // get trade info
        let (meta, trade_status) = get!(ctx.world, trade_id, (Trade, Status));

        // assert that caller is the owner of entity_id
        let (owner, position) = get!(ctx.world, entity_id, (Owner, Position));
        assert(owner.address == caller, 'Caller not owner of entity_id');

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

        let order_id = if (entity_id == meta.maker_id) {
            // caller is the maker
            meta.maker_order_id
        } else if meta.taker_id == 0 {
            // no taker specified, caller can be taker
            meta.taker_order_id
        } else {
            // caller is neither the maker nor the taker
            assert(entity_id == meta.taker_id, 'Caller is not maker nor taker');
            meta.taker_order_id
        };

        // get the fungible entities from the order
        let fungible_entities = get!(ctx.world, order_id, FungibleEntities);

        let mut total_weight = 0;
        let mut index = 0;
        // loop over all the fungible entities and get their quantity and weight
        loop {
            if index == fungible_entities.count {
                break ();
            }

            // get quantity and entity_type from fungible_entities
            let order_resource = get!(
                ctx.world, (order_id, fungible_entities.key, index), OrderResource
            );

            let entity_type_weight = get!(
                ctx.world, (WORLD_CONFIG_ID, order_resource.resource_type), WeightConfig
            );

            let weight = entity_type_weight.weight_gram * order_resource.balance;
            total_weight += weight;
            index += 1;
        };

        // get the caravan capacity, movable and owner
        // get quantity as well, if quantity not present then it's 1
        let (capacity, movable, caravan_owner, caravan_position) = get!(
            ctx.world, caravan_id, (Capacity, Movable, Owner, Position)
        );

        // if quantity is not set (=0), then it means there is only 1
        let maybe_quantity = get!(ctx.world, caravan_id, Quantity);
        let quantity = if (maybe_quantity.value == 0) {
            1
        } else {
            maybe_quantity.value
        }; 

        // assert that the caravan position is the same as the entity
        assert(caravan_position.x == position.x, 'Not same position');
        assert(caravan_position.y == position.y, 'Not same position');

        // assert that the owner if the caller
        assert(caravan_owner.address == caller, 'Caller not owner of caravan');

        // assert that the caravan can move the total weight
        assert(capacity.weight_gram * quantity >= total_weight, 'Caravan capacity is not enough');

        // attach the caravan to the order + entity so that multiple different takers can attach caravans
        let caravan_key_arr = array![order_id.into(), entity_id.into()];
        let caravan_key = poseidon_hash_span(caravan_key_arr.span());
        let caravan = get!(ctx.world, caravan_key, Caravan);
        assert(caravan.caravan_id == 0, 'Caravan already attached');

        set!(
            // attach the caravan to the order + entity so that multiple different takers can attach caravans
            ctx.world, (Caravan { entity_id: caravan_key, caravan_id })
        );

        // assert that the caravan is not already blocked by a system
        assert(!movable.blocked, 'Caravan is already blocked');

        set!(
            // set the caravan to blocked
            ctx.world,
            (OrderId { entity_id: caravan_id, id: order_id }, Movable { entity_id: caravan_id, sec_per_km: movable.sec_per_km, blocked: true })
        );
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
//     fn test_attach_caravan() {
//         let world = spawn_test_world_without_init();

//         // set as executor
//         starknet::testing::set_contract_address(starknet::contract_address_const::<1>());

//         // context (can be any value since world not init)
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
//         // set owner
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

//         // set status of trade
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(0);
//         world.set_entity(ctx, 'Status'.into(), trade_id.into(), 0_u8, values.span());

//         // set fungible entities in the maker order
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // key = 33
//         values.append(33);
//         values.append(2);
//         world.set_entity(ctx, 'FungibleEntities'.into(), 13.into(), 0_u8, values.span());
//         // set resource
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(1);
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (13, 33, 0).into(), 0_u8, values.span());
//         // set resource
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(2);
//         values.append(200);
//         world.set_entity(ctx, 'Resource'.into(), (13, 33, 1).into(), 0_u8, values.span());

//         // set weight of resources
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(1);
//         values.append(10);
//         world
//             .set_entity(
//                 ctx, 'WeightConfig'.into(), (WORLD_CONFIG_ID, 1).into(), 0_u8, values.span()
//             );
//         // set weight of resources
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(2);
//         values.append(20);
//         world
//             .set_entity(
//                 ctx, 'WeightConfig'.into(), (WORLD_CONFIG_ID, 2).into(), 0_u8, values.span()
//             );

//         // caravan_id = 20;
//         // create a caravan owned by the maker
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

//         // attach caravan to maker
//         let mut calldata = array::ArrayTrait::<felt252>::new();
//         // maker_id
//         calldata.append(11);
//         // trade_id
//         calldata.append(10);
//         // caravan_id
//         calldata.append(20);
//         // execute
//         world.execute('AttachCaravan'.into(), calldata.span());

//         // assert that caravan is non movable
//         let caravan_movable = world.entity('Movable'.into(), 20.into(), 0_u8, 0_usize);
//         assert(*caravan_movable[1] == 1, 'caravan is not blocked');

//         // assert that caravan is attached to the trade for that entity
//         let caravan = world.entity('Caravan'.into(), (10, 11).into(), 0_u8, 0_usize);
//         assert(*caravan[0] == 20, 'caravan not attached to trade');
//     }
// }


