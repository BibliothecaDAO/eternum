// claim either maker or taker order
// TODO: testing
#[system]
mod ClaimFungibleOrder {
    use eternum::alias::ID;
    use eternum::constants::WORLD_CONFIG_ID;
    use eternum::models::config::WeightConfig;
    use eternum::models::capacity::Capacity;
    use eternum::models::movable::ArrivalTime;
    use eternum::models::movable::Movable;
    use eternum::models::quantity::Quantity;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::resources::Resource;
    use eternum::models::caravan::Caravan;
    use eternum::models::trade::{Trade, Status, TradeStatus, OrderResource};
    use eternum::models::trade::FungibleEntities;

    use traits::Into;
    use traits::TryInto;
    use box::BoxTrait;
    use array::ArrayTrait;

    use dojo::world::Context;

    fn execute(ctx: Context, entity_id: u128, trade_id: u128) {
        // assert caller is owner of the entity_id
        let caller = ctx.origin;
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
        // TODO: test out position equality
        assert(position.x == entity_position.x, 'position mismatch');
        assert(position.y == entity_position.y, 'position mismatch');

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




#[cfg(test)]
mod tests {
   
    use eternum::models::resources::Resource;
    use eternum::models::trade::FungibleEntities;
    use eternum::models::owner::Owner;
    use eternum::models::position::Position;
    use eternum::models::movable::ArrivalTime;
    use eternum::models::trade::{Trade, OrderResource};

    use eternum::constants::ResourceTypes;

    use eternum::utils::testing::spawn_eternum;

    use traits::Into;
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;
    
    use starknet::contract_address_const;

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

   
    #[test]
    #[available_gas(30000000000000)]
    fn test_claim_by_maker() {
        let world = spawn_eternum();

        // set as executor
        starknet::testing::set_contract_address(world.executor());

        let maker_id = 11_u64;
        let taker_id = 12_u64;

        set!(world, (Position { x: 45, y: 50, entity_id: maker_id.into()}));
        set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_id.into()}));

        set!(world, (Position { x: 60, y: 70, entity_id: taker_id.into()}));
        set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_id.into()}));

        // create a trade  
        let trade_id = 10_u128;
        let maker_order_id = 13_u128;
        let taker_order_id = 14_u128;
        set!(world, (Trade {
                trade_id,
                maker_id: maker_id.into(),
                taker_id: taker_id.into(),
                maker_order_id: maker_order_id,
                taker_order_id: taker_order_id,
                expires_at: 100,
                claimed_by_maker: false,
                claimed_by_taker: false,
                taker_needs_caravan: false
        }));

        // set arrival of the taker order in the future
        set!(world, (ArrivalTime { arrives_at: 100, entity_id: taker_order_id}));

        // set block_timestamp to 100
        starknet::testing::set_block_timestamp(100);

        set!(world, (FungibleEntities { entity_id: taker_order_id, count: 2, key: 33}));
        set!(world, (
            OrderResource { 
                order_id: taker_order_id,
                fungible_entities_id: 33,
                index: 0,
                resource_type: ResourceTypes::WOOD,
                balance: 100
            }
        ));

        set!(world, (
            OrderResource { 
                order_id: taker_order_id,
                fungible_entities_id: 33,
                index: 1,
                resource_type: ResourceTypes::STONE,
                balance: 200
            }
        ));


        // set position of the taker order at the same position as the maker
        set!(world, (
            Position { 
                x: 45, 
                y: 50,
                entity_id: taker_order_id
            }
        ));
    
        // claim the order
        starknet::testing::set_contract_address(contract_address_const::<'maker'>());

        let mut calldata = array![];
        Serde::serialize(@maker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        world.execute('ClaimFungibleOrder', calldata);

        // assert that trade has been claimed by the maker
        let trade = get!(world, trade_id, Trade);
        assert(trade.claimed_by_maker == true, 'trade not claimed by maker');
        assert(trade.claimed_by_taker == false, 'trade claimed by taker');

        let maker_wood_resource = get!(world, (maker_id, ResourceTypes::WOOD), Resource);
        let maker_stone_resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
        assert(maker_wood_resource.balance == 100, 'balance not updated');
        assert(maker_stone_resource.balance == 200, 'balance not updated');

        let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
        let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
        assert(taker_wood_resource.balance == 0, 'balance updated');
        assert(taker_stone_resource.balance == 0, 'balance updated');

    }



    #[test]
    #[available_gas(30000000000000)]
    fn test_claim_by_taker() {
        let world = spawn_eternum();

        // set as executor
        starknet::testing::set_contract_address(world.executor());

        let maker_id = 11_u64;
        let taker_id = 12_u64;

        set!(world, (Position { x: 45, y: 50, entity_id: maker_id.into()}));
        set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_id.into()}));

        set!(world, (Position { x: 60, y: 70, entity_id: taker_id.into()}));
        set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_id.into()}));

        // create a trade  
        let trade_id = 10_u128;
        let maker_order_id = 13_u128;
        let taker_order_id = 14_u128;
        set!(world, (Trade {
                trade_id,
                maker_id: maker_id.into(),
                taker_id: taker_id.into(),
                maker_order_id: maker_order_id,
                taker_order_id: taker_order_id,
                expires_at: 100,
                claimed_by_maker: false,
                claimed_by_taker: false,
                taker_needs_caravan: false
        }));

        // set arrival of the maker order in the future
        set!(world, (ArrivalTime { arrives_at: 100, entity_id: maker_order_id}));

        // set block_timestamp to 100
        starknet::testing::set_block_timestamp(100);

        set!(world, (FungibleEntities { entity_id: maker_order_id, count: 2, key: 33}));
        set!(world, (
            OrderResource { 
                order_id: maker_order_id,
                fungible_entities_id: 33,
                index: 0,
                resource_type: ResourceTypes::WOOD,
                balance: 100
            }
        ));

        set!(world, (
            OrderResource { 
                order_id: maker_order_id,
                fungible_entities_id: 33,
                index: 1,
                resource_type: ResourceTypes::STONE,
                balance: 200
            }
        ));


        // set position of the taker order at the same position as the maker
        set!(world, (
            Position { 
                x: 60, 
                y: 70,
                entity_id: maker_order_id
            }
        ));
    
        // claim the order
        starknet::testing::set_contract_address(contract_address_const::<'taker'>());

        let mut calldata = array![];
        Serde::serialize(@taker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        world.execute('ClaimFungibleOrder', calldata);

        // assert that trade has been claimed by the maker
        let trade = get!(world, trade_id, Trade);
        assert(trade.claimed_by_maker == false, 'trade claimed by maker');
        assert(trade.claimed_by_taker == true, 'trade not claimed by taker');

        let maker_wood_resource = get!(world, (maker_id, ResourceTypes::WOOD), Resource);
        let maker_stone_resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
        assert(maker_wood_resource.balance == 0, 'balance updated');
        assert(maker_stone_resource.balance == 0, 'balance updated');

        let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
        let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
        assert(taker_wood_resource.balance == 100, 'balance not updated');
        assert(taker_stone_resource.balance == 200, 'balance not updated');

    }




    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('not owned by caller','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
        let world = spawn_eternum();
    
        starknet::testing::set_contract_address(contract_address_const::<'unknown'>());

        let maker_id = 11_u64;
        let trade_id = 10_u64;
        let mut calldata = array![];
        Serde::serialize(@maker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        world.execute('ClaimFungibleOrder', calldata);

    }


}


