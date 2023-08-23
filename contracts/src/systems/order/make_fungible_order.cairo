// creates a non fungible order
// if taker_id is specified, the order can only be taken by a certain entity
// if taker_id = 0, then can be taken by any entity

#[system]
mod MakeFungibleOrder {
    use eternum::components::trade::FungibleEntities;
    use eternum::components::resources::Resource;
    use eternum::alias::ID;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::realm::Realm;
    use eternum::components::trade::{Trade, Status, TradeStatus, OrderResource};
    use eternum::components::capacity::Capacity;
    use eternum::components::metadata::MetaData;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::components::quantity::{Quantity, QuantityTracker};
    use eternum::constants::{REALM_ENTITY_TYPE, WORLD_CONFIG_ID, FREE_TRANSPORT_ENTITY_TYPE};

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;
    use array::SpanTrait;

    use dojo::world::Context;

    // TODO: create a function that takes also an array of strings as input, these 
    // strings are names of components that have the {type, balance} fields.
    // Using the name of the component, we can query and set component.

    // maker_id: entity id of the maker
    // maker_entity_types: array of entity types (resources or other) that the maker wants to trade
    // DISCUSS: called entity_types and not resource_types because initial goal is to create a system
    // that is not only for resources but for any other fungible entity type (like coins)
    // maker_quantities: array of quantities of the entity types that the maker wants to trade
    // taker_id: entity id of the taker
    // DISCUSS: if taker_id = 0, then the order can be taken by any entity, is there better way?
    // taker_entity_types: array of entity types (resources or other) that the taker wants to trade
    // taker_quantities: array of quantities of the entity types that the taker wants to trade
    // taker_needs_caravan: if true, the taker needs to send a caravan to the maker
    // expires_at: timestamp when the order expires
    fn execute(
        ctx: Context,
        maker_id: u128,
        maker_entity_types: Span<u8>,
        maker_quantities: Span<u128>,
        taker_id: u128,
        taker_entity_types: Span<u8>,
        taker_quantities: Span<u128>,
        taker_needs_caravan: bool,
        expires_at: u64
    ) {
        let caller = ctx.origin;

        // assert that maker entity is owned by caller
        let maker_owner = get !(ctx.world, maker_id, Owner);
        assert(maker_owner.address == caller, 'Only owner can create order');

        // assert that length of maker_entity_types is equal to length of maker_quantities
        assert(maker_entity_types.len() == maker_quantities.len(), 'length not equal');

        // assert that length of taker_entity_types is equal to length of taker_quantities
        assert(taker_entity_types.len() == taker_quantities.len(), 'length not equal');

        // create maker order entity
        let maker_order_id = ctx.world.uuid();
        let fungible_entities_id = ctx.world.uuid();
        set !(
            ctx.world,
            (
                FungibleEntities {
                    entity_id: maker_order_id.into(), key: fungible_entities_id.into(), count: maker_entity_types.len(), 
                },
            )
        );
        // create maker fungible entities and remove them from the maker balance
        let mut index = 0;
        loop {
            if index == maker_entity_types.len() {
                break ();
            }

            set !(
                ctx.world,
                (OrderResource {
                    order_id: maker_order_id.into(), fungible_entities_id: fungible_entities_id.into(), index, resource_type: *maker_entity_types[index], balance: *maker_quantities[index]
                })
            );

            // decrease balance of maker
            let resource = get !(ctx.world, (maker_id, *maker_entity_types[index]), Resource);
            assert(resource.balance >= *maker_quantities[index], 'Balance too small');
            set !(
                ctx.world,
                (Resource {
                    entity_id: maker_id,
                    resource_type: *maker_entity_types[index],
                    balance: resource.balance - *maker_quantities[index]
                },)
            );

            index += 1;
        };

        // create taker order entity
        let taker_order_id = ctx.world.uuid();
        set !(
            ctx.world,
            (
                FungibleEntities {
                    entity_id: taker_order_id.into(),
                    key: fungible_entities_id.into(), count: taker_entity_types.len(), 
                },
            )
        );

        // create taker fungible entities but dont remove them from the taker balance, because 
        // needs to be taken first by a taker
        let mut index = 0;
        loop {
            if index == taker_entity_types.len() {
                break ();
            }
            set !(
                ctx.world,
                (OrderResource {
                    order_id: taker_order_id.into(), fungible_entities_id: fungible_entities_id.into(), index, resource_type: *taker_entity_types[index], balance: *taker_quantities[index] 
                },)
            );

            index += 1;
        };

        // create trade entity
        let trade_id = ctx.world.uuid();
        set !(
            ctx.world,
            (
                Trade {
                    trade_id: trade_id.into(),
                    maker_id,
                    taker_id,
                    maker_order_id: maker_order_id.into(),
                    taker_order_id: taker_order_id.into(),
                    claimed_by_maker: false,
                    claimed_by_taker: false,
                    expires_at: expires_at,
                    taker_needs_caravan: taker_needs_caravan,
                    }, Status {
                    // TODO: change back to enum when works with torii
                    trade_id: trade_id.into(),
                    value: 0,
                },
            ),
        );
    }
}
// TODO: need to test it when withdraw gas is working
// TODO: same auth system as for attach_caravan
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

//     use dojo::interfaces::IWorldDispatcherTrait;
//     use dojo::auth::systems::{Route, RouteTrait};
//     use dojo::storage::query::{
//         Query, TupleSize2IntoQuery, LiteralIntoQuery, TupleSize3IntoQuery
//     };
//     use dojo::execution_context::Context;
//     use dojo::auth::components::AuthRole;

//     // test that the average speed is correct
//     #[test]
//     #[available_gas(3000000000000)]
//     fn test_make_fungible_order() {
//         let world = spawn_test_world_without_init();
//         // set as executor
//         starknet::testing::set_contract_address(starknet::contract_address_const::<1>());
//         // ap change issue
//         // let maker_id = 11;
//         // let taker_id = 12;
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
//         values.append(11);
//         world.set_entity(ctx, 'Owner'.into(), 11.into(), 0_u8, values.span());

//         // entity 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         values.append(12);
//         world.set_entity(ctx, 'Owner'.into(), 12.into(), 0_u8, values.span());

//         // add resources to entity 1 and 2
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         values.append(1);
//         // balance
//         values.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (11, 1).into(), 0_u8, values.span());
//         world.set_entity(ctx, 'Resource'.into(), (12, 1).into(), 0_u8, values.span());
//         let mut resources_2 = array::ArrayTrait::<felt252>::new();
//         // resource_type
//         resources_2.append(2);
//         // balance
//         resources_2.append(100);
//         world.set_entity(ctx, 'Resource'.into(), (11, 2).into(), 0_u8, values.span());
//         world.set_entity(ctx, 'Resource'.into(), (12, 2).into(), 0_u8, values.span());

//         // create order
//         starknet::testing::set_account_contract_address(starknet::contract_address_const::<11>());
//         let mut values = array::ArrayTrait::<felt252>::new();
//         // maker_id
//         values.append(11);
//         // len
//         values.append(2);
//         // types
//         values.append(1);
//         values.append(2);
//         // len
//         values.append(2);
//         // quantities
//         values.append(100);
//         values.append(100);
//         // taker_id
//         values.append(12);
//         // len
//         values.append(2);
//         // types
//         values.append(1);
//         values.append(2);
//         // len
//         values.append(2);
//         // quantities
//         values.append(100);
//         values.append(100);
//         // taker_needs_caravan
//         values.append(0);
//         // expires_at
//         values.append(100);
//         let result = world.execute('MakeFungibleOrder'.into(), values.span());
//         let trade_id = *result[0];

//         // check balances
//         let resource = world.entity('Resource'.into(), (11, 1).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 0, 'Balance should be 0');
//         let resource = world.entity('Resource'.into(), (11, 2).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 0, 'Balance should be 0');

//         let resource = world.entity('Resource'.into(), (12, 1).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 100, 'Balance should be 100');
//         let resource = world.entity('Resource'.into(), (12, 2).into(), 0_u8, 0_usize);
//         assert(*resource[1] == 100, 'Balance should be 100');

//         // check that the trade was created
//         let trade = world.entity('Trade'.into(), trade_id.into(), 0_u8, 0_usize);
//         assert(*trade[0] == 11, 'Maker id should be 11');
//         assert(*trade[1] == 12, 'Taker id should be 12');
//         let maker_order_id = *trade[2];
//         let taker_order_id = *trade[3];
//         assert(*trade[4] == 100, 'Expires at should be 100');
//         assert(*trade[5] == 0, 'Claimed should be false');
//         assert(*trade[6] == 0, 'Claimed should be false');
//         assert(*trade[7] == 0, 'Need caravan should be false');

//         // check that the maker order was created
//         let maker_order = world
//             .entity('FungibleEntities'.into(), maker_order_id.into(), 0_u8, 0_usize);
//         assert(*maker_order[1] == 2, 'Count should be 2');
//         let key = *maker_order[0];
//         let resource = world
//             .entity('Resource'.into(), (maker_order_id, key, 0).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 1, 'Resource type should be 1');
//         assert(*resource[1] == 100, 'Balance should be 100');
//         let resource = world
//             .entity('Resource'.into(), (maker_order_id, key, 1).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 2, 'Resource type should be 2');
//         assert(*resource[1] == 100, 'Balance should be 100');

//         // check that taker order was created
//         let taker_order = world
//             .entity('FungibleEntities'.into(), taker_order_id.into(), 0_u8, 0_usize);
//         assert(*taker_order[1] == 2, 'Count should be 2');
//         let key = *taker_order[0];
//         let resource = world
//             .entity('Resource'.into(), (taker_order_id, key, 0).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 1, 'Resource type should be 1');
//         assert(*resource[1] == 100, 'Balance should be 100');
//         let resource = world
//             .entity('Resource'.into(), (taker_order_id, key, 1).into(), 0_u8, 0_usize);
//         assert(*resource[0] == 2, 'Resource type should be 2');
//         assert(*resource[1] == 100, 'Balance should be 100');
//     }
// }


