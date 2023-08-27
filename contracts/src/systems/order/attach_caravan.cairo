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



#[cfg(test)]
mod tests {   
    use eternum::components::resources::Resource;
    use eternum::components::trade::FungibleEntities;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::capacity::Capacity;
    use eternum::components::movable::Movable;
    use eternum::components::caravan::Caravan;
    use eternum::components::config::WeightConfig;
    
    use eternum::components::trade::{Trade,Status, OrderId, OrderResource};

    use eternum::constants::ResourceTypes;
    use eternum::constants::WORLD_CONFIG_ID;

    use eternum::utils::testing::spawn_eternum;

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;


    use poseidon::poseidon_hash_span;
    use traits::Into;
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;


    #[test]
    #[available_gas(30000000000000)]
    fn test_maker_attach_caravan() {
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

        // set trade status to open
        set!(world, (Status { value: 0, trade_id }));

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
        ))


        set!(world, (
            WeightConfig {
                config_id: WORLD_CONFIG_ID,
                weight_config_id: ResourceTypes::WOOD.into(),
                entity_type: ResourceTypes::WOOD.into(),
                weight_gram: 10
            }
        ));

        set!(world, (
            WeightConfig {
                config_id: WORLD_CONFIG_ID,
                weight_config_id: ResourceTypes::STONE.into(),
                entity_type: ResourceTypes::STONE.into(),
                weight_gram: 20
            }
        ));


        // create a caravan owned by the maker
        let caravan_id = 20_u64;
        let caravan_id_felt: felt252 = caravan_id.into();
        set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: caravan_id.into()}));
        set!(world, (Position { x: 45, y: 50, entity_id: caravan_id.into()}));
        set!(world, (Capacity { weight_gram: 10_000, entity_id: caravan_id.into()}));
        set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: caravan_id.into()}));


        // attach caravan to maker
        starknet::testing::set_contract_address(contract_address_const::<'maker'>());
        let mut calldata = array![];
        Serde::serialize(@maker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        Serde::serialize(@caravan_id, ref calldata);
        world.execute('AttachCaravan', calldata);


        // check caravan 
        let (caravan_movable, caravan_orderid) = get!(world, caravan_id_felt, (Movable, OrderId));
        assert(caravan_movable.blocked, 'caravan is not blocked');
        assert(caravan_orderid.id == maker_order_id.into(), 'caravan order id is not correct');

        
        let caravan_key_arr = array![maker_order_id.into(), maker_id.into()];
        let caravan_key = poseidon_hash_span(caravan_key_arr.span());
        let caravan = get!(world, caravan_key, Caravan);

        assert(caravan.caravan_id == caravan_id.into(), 'incorrect caravan id');
    }







    #[test]
    #[available_gas(30000000000000)]
    fn test_taker_attach_caravan() {
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

        // set trade status to open
        set!(world, (Status { value: 0, trade_id }));

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
        ))


        set!(world, (
            WeightConfig {
                config_id: WORLD_CONFIG_ID,
                weight_config_id: ResourceTypes::WOOD.into(),
                entity_type: ResourceTypes::WOOD.into(),
                weight_gram: 10
            }
        ));

        set!(world, (
            WeightConfig {
                config_id: WORLD_CONFIG_ID,
                weight_config_id: ResourceTypes::STONE.into(),
                entity_type: ResourceTypes::STONE.into(),
                weight_gram: 20
            }
        ));


        // create a caravan owned by the taker
        let caravan_id = 20_u64;
        let caravan_id_felt: felt252 = caravan_id.into();
        set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: caravan_id.into()}));
        set!(world, (Position { x: 60, y: 70, entity_id: caravan_id.into()}));
        set!(world, (Capacity { weight_gram: 10_000, entity_id: caravan_id.into()}));
        set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: caravan_id.into()}));

    
        // attach caravan to taker
        starknet::testing::set_contract_address(contract_address_const::<'taker'>());
        let mut calldata = array![];
        Serde::serialize(@taker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        Serde::serialize(@caravan_id, ref calldata);
        world.execute('AttachCaravan', calldata);


        // check caravan
        let (caravan_movable, caravan_orderid) = get!(world, caravan_id_felt, (Movable, OrderId));
        assert(caravan_movable.blocked, 'caravan is not blocked');
        assert(caravan_orderid.id == taker_order_id.into(), 'caravan order id is not correct');

        let caravan_key_arr = array![taker_order_id.into(), taker_id.into()];
        let caravan_key = poseidon_hash_span(caravan_key_arr.span());
        let caravan = get!(world, caravan_key, Caravan);

        assert(caravan.caravan_id == caravan_id.into(), 'incorrect caravan id');
    }






    #[test]
    #[available_gas(30000000000000)]
    #[should_panic(expected: ('Caller not owner of entity_id','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED','ENTRYPOINT_FAILED' ))]
    fn test_not_owner() {
        let world = spawn_eternum();

        let taker_id = 12_u64;
        let trade_id = 10_u128;
        let caravan_id = 20_u64;
    
        starknet::testing::set_contract_address(
            contract_address_const::<'unknown'>()
        );

        let mut calldata = array![];
        Serde::serialize(@taker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        Serde::serialize(@caravan_id, ref calldata);
        world.execute('AttachCaravan', calldata);

    }

}


