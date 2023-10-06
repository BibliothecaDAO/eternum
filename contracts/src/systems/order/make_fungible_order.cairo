// creates a non fungible order
// if taker_id is specified, the order can only be taken by a certain entity
// if taker_id = 0, then can be taken by any entity

#[system]
mod MakeFungibleOrder {
    use eternum::models::trade::FungibleEntities;
    use eternum::models::resources::Resource;
    use eternum::alias::ID;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::realm::Realm;
    use eternum::models::trade::{Trade, Status, TradeStatus, OrderResource};
    use eternum::models::capacity::Capacity;
    use eternum::models::metadata::MetaData;
    use eternum::models::movable::{Movable, ArrivalTime};
    use eternum::models::config::{WorldConfig, SpeedConfig, CapacityConfig};
    use eternum::models::quantity::{Quantity, QuantityTracker};
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
    ) -> ID {
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

        trade_id.into()
    }
}

#[cfg(test)]
mod tests {
    use eternum::models::resources::Resource;
    use eternum::models::trade::FungibleEntities;
    use eternum::models::owner::Owner;
    use eternum::models::trade::{Trade, OrderResource};

    use eternum::constants::ResourceTypes;

    use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;
    use eternum::utils::testing::spawn_eternum;

    use traits::Into;
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;
    use clone::Clone;
    
    use starknet::contract_address_const;

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};


    #[test]
    #[available_gas(3000000000000)]
    fn test_make_fungible_order() {

        let world = spawn_eternum();

        starknet::testing::set_contract_address(world.executor());

        let maker_id = 11_u64;
        let taker_id = 12_u64;
        
        set!(world, (Owner { entity_id: maker_id.into(), address: contract_address_const::<'maker'>()}));

        set!(world, (Resource { entity_id: maker_id.into(), resource_type: ResourceTypes::STONE, balance: 100 }));
        set!(world, (Resource { entity_id: taker_id.into(), resource_type: ResourceTypes::STONE, balance: 100 }));

        set!(world, (Resource { entity_id: maker_id.into(), resource_type: ResourceTypes::GOLD, balance: 100 }));
        set!(world, (Resource { entity_id: taker_id.into(), resource_type: ResourceTypes::GOLD, balance: 100 }));

        // create order
        starknet::testing::set_contract_address(contract_address_const::<'maker'>());

        let mut make_order_calldata = Default::default();
        Serde::serialize(@maker_id, ref make_order_calldata);
        Serde::serialize(@array![ResourceTypes::STONE, ResourceTypes::GOLD], ref make_order_calldata);
        Serde::serialize(@array![100, 100], ref make_order_calldata);
        Serde::serialize(@taker_id, ref make_order_calldata);
        Serde::serialize(@array![ResourceTypes::STONE, ResourceTypes::GOLD], ref make_order_calldata);
        Serde::serialize(@array![100, 100], ref make_order_calldata);
        Serde::serialize(@false, ref make_order_calldata);
        Serde::serialize(@100, ref make_order_calldata);

        let result = world.execute('MakeFungibleOrder', make_order_calldata);
        let trade_id = *result[0];

        // check maker balances
        let resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
        assert(resource.balance == 0, 'Balance should be 0');

        let resource = get!(world, (maker_id, ResourceTypes::GOLD), Resource);
        assert(resource.balance == 0, 'Balance should be 0');

        // check taker balances
        let resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
        assert(resource.balance == 100, 'Balance should be 100');

        let resource = get!(world, (taker_id, ResourceTypes::GOLD), Resource);
        assert(resource.balance == 100, 'Balance should be 100');


        let trade = get!(world, trade_id, Trade);
        assert(trade.maker_id == maker_id.into(), 'Maker id should be 11');
        assert(trade.taker_id == taker_id.into(), 'Taker id should be 12');
        assert(trade.expires_at == 100, 'Expires at should be 100');
        assert(trade.claimed_by_maker == false, 'Claimed should be false');
        assert(trade.claimed_by_taker == false, 'Claimed should be false');
        assert(trade.taker_needs_caravan == false, 'needs caravan should be false');

        // check that the maker order was created
        let maker_order = get!(world, trade.maker_order_id, FungibleEntities);
        assert(maker_order.count == 2, 'Count should be 2');

        let maker_stone_resource = get!(world, (trade.maker_order_id, maker_order.key, 0), OrderResource);
        assert(maker_stone_resource.resource_type == ResourceTypes::STONE, 'Resource should be stone');
        assert(maker_stone_resource.balance == 100, 'Balance should be 100');

        let maker_gold_resource = get!(world, (trade.maker_order_id, maker_order.key, 1), OrderResource);
        assert(maker_gold_resource.resource_type == ResourceTypes::GOLD, 'Resource should be gold');
        assert(maker_gold_resource.balance == 100, 'Balance should be 100');


        // check that taker order was created
        let taker_order = get!(world, trade.taker_order_id, FungibleEntities);
        assert(taker_order.count == 2, 'Count should be 2');

        let taker_stone_resource = get!(world, (trade.taker_order_id, taker_order.key, 0), OrderResource);
        assert(taker_stone_resource.resource_type == ResourceTypes::STONE, 'Resource should be stone');
        assert(taker_stone_resource.balance == 100, 'Balance should be 100');

        let taker_gold_resource = get!(world, (trade.taker_order_id, taker_order.key, 1), OrderResource);
        assert(taker_gold_resource.resource_type == ResourceTypes::GOLD, 'Resource should be gold');
        assert(taker_gold_resource.balance == 100, 'Balance should be 100');

    }

    #[test]
    #[available_gas(3000000000000)]
    #[should_panic(expected: ('Only owner can create order','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
        let world = spawn_eternum();

        let maker_id = 11_u64;
        let taker_id = 12_u64;
        
        starknet::testing::set_contract_address(world.executor());
        set!(world, (Owner { entity_id: maker_id.into(), address: contract_address_const::<'maker'>()}));

        // set ctx.origin to be some other address
        starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());

        let mut make_order_calldata = Default::default();
        Serde::serialize(@maker_id, ref make_order_calldata);
        Serde::serialize(@array![ResourceTypes::STONE, ResourceTypes::GOLD], ref make_order_calldata);
        Serde::serialize(@array![100, 100], ref make_order_calldata);
        Serde::serialize(@taker_id, ref make_order_calldata);
        Serde::serialize(@array![ResourceTypes::STONE, ResourceTypes::GOLD], ref make_order_calldata);
        Serde::serialize(@array![100, 100], ref make_order_calldata);
        Serde::serialize(@false, ref make_order_calldata);
        Serde::serialize(@100, ref make_order_calldata);

        world.execute('MakeFungibleOrder', make_order_calldata);
    }
}


