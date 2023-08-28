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
    use poseidon::poseidon_hash_span;

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
        let caravan_key_arr = array![meta.maker_order_id.into(), meta.maker_id.into()];
        let caravan_key = poseidon_hash_span(caravan_key_arr.span());
        let caravan = get!(ctx.world, caravan_key, Caravan);

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
        //
        // taker caravan is not directly attached to the taker_order_id, but to the
        // (taker_order_id, taker_id), this is because more than one taker can attach a caravan to the same order
        // before one of them accepts it
        if meta.taker_needs_caravan == true {
            let caravan_key_arr = array![meta.taker_order_id.into(), taker_id.into()];
            let caravan_key = poseidon_hash_span(caravan_key_arr.span());
            let caravan = get!(ctx.world, caravan_key, Caravan);

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




#[cfg(test)]
mod tests {
    use eternum::components::resources::Resource;
    use eternum::components::trade::FungibleEntities;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::capacity::Capacity;
    use eternum::components::movable::{Movable, ArrivalTime};
    use eternum::components::caravan::Caravan;
    use eternum::components::config::WeightConfig;
    
    use eternum::components::trade::{Trade,Status, OrderId, OrderResource};

    use eternum::constants::ResourceTypes;
    use eternum::constants::WORLD_CONFIG_ID;

    use eternum::utils::testing::spawn_eternum;

    use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};
    use starknet::contract_address_const;


    use poseidon::poseidon_hash_span;
    use traits::{TryInto, Into};
    use result::ResultTrait;
    use array::ArrayTrait;
    use option::OptionTrait;
    use serde::Serde;


    fn setup(taker_needs_caravan: bool) -> (IWorldDispatcher, u64, u64, u128, u128, u128) {
        let world = spawn_eternum();
        
        // set as executor
        starknet::testing::set_contract_address(world.executor());

        let maker_id = 11_u64;
        let taker_id = 12_u64;

        set!(world, (Position { x: 45, y: 50, entity_id: maker_id.into()}));
        set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_id.into()}));

        set!(world, (Position { x: 60, y: 70, entity_id: taker_id.into()}));
        set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_id.into()}));



        // give wood and stone resources to taker
        set!(world, (
            Resource { 
                entity_id: taker_id.into(), 
                resource_type: ResourceTypes::WOOD, 
                balance: 600
            }
        ));

        set!(world, (
            Resource { 
                entity_id: taker_id.into(), 
                resource_type: ResourceTypes::STONE, 
                balance: 600
            }
        ));

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
                taker_needs_caravan
        }));



        // set fungible entities for maker
        set!(world, (FungibleEntities { entity_id: maker_order_id, count: 2, key: 33}));
        set!(world, (
            OrderResource { 
                order_id: maker_order_id,
                fungible_entities_id: 33,
                index: 0,
                resource_type: ResourceTypes::GOLD,
                balance: 100
            }
        ));
        set!(world, (
            OrderResource { 
                order_id: maker_order_id,
                fungible_entities_id: 33,
                index: 1,
                resource_type: ResourceTypes::SILVER,
                balance: 200
            }
        ))



        
        // set fungible entities for taker
        set!(world, (FungibleEntities { entity_id: taker_order_id, count: 2, key: 34}));
        set!(world, (
            OrderResource { 
                order_id: taker_order_id,
                fungible_entities_id: 34,
                index: 0,
                resource_type: ResourceTypes::WOOD,
                balance: 100
            }
        ));

        set!(world, (
            OrderResource { 
                order_id: taker_order_id,
                fungible_entities_id: 34,
                index: 1,
                resource_type: ResourceTypes::STONE,
                balance: 200
            }
        ));

        (world, maker_id, taker_id, trade_id, maker_order_id, taker_order_id)
    }





    #[test]
    #[available_gas(30000000000000)]
    fn test_take_trade_without_caravan() {

        let (
            world,
            maker_id,
            taker_id, 
            trade_id, 
            maker_order_id, 
            taker_order_id
        ) = setup(false);


        // taker takes trade
        starknet::testing::set_contract_address(
            contract_address_const::<'taker'>()
        );
        let mut calldata = array![];
        Serde::serialize(@taker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        world.execute('TakeFungibleOrder', calldata);



        // taker wood balance should be 500
        let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
        assert(taker_wood_resource.balance == 500, 'resource balance should be 500'); // 600 - 100

        // taker stone balance should be 400
        let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
        assert(taker_stone_resource.balance == 400, 'resource balance should be 400'); // 600 - 200


        // status should be accepted
        let status = get!(world, trade_id, Status);
        assert(status.value == 1, 'status should be accepted');


        // verify arrival time of maker order
        let maker_arrival_time = get!(world, maker_order_id, ArrivalTime);
        assert(maker_arrival_time.arrives_at == 0, 'arrival time should be 0');
 

        // verify arrival time of taker order
        let taker_arrival_time = get!(world, taker_order_id, ArrivalTime);
        assert(taker_arrival_time.arrives_at == 0, 'arrival time should be 0');
       

        // verify position of maker order
        let maker_order_position = get!(world, maker_order_id, Position);
        assert(maker_order_position.x == 45, 'position x should be 45');
        assert(maker_order_position.y == 50, 'position y should be 50');


        // verify position of taker order
        let taker_order_position = get!(world, taker_order_id, Position);
        assert(taker_order_position.x == 60, 'position x should be 60');
        assert(taker_order_position.y == 70, 'position y should be 70');
    }






    #[test]
    #[available_gas(30000000000000)]
    fn test_take_trade_with_caravan() {
        
        let (
            world,
            maker_id,
            taker_id, 
            trade_id, 
            maker_order_id, 
            taker_order_id
        ) = setup(true);

        // create a caravan owned by the maker
        let maker_caravan_id = 20_u64;
        let maker_caravan_id_felt: felt252 = maker_caravan_id.into();

        set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_caravan_id.into()}));
        set!(world, (Position { x: 100_000, y: 200_000, entity_id: maker_caravan_id.into()}));
        set!(world, (Capacity { weight_gram: 10_000, entity_id: maker_caravan_id.into()}));
        set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: maker_caravan_id.into()}));
        // attach caravan to the maker order
        let maker_caravan_key_arr = array![maker_order_id.into(), maker_id.into()];
        let maker_caravan_key = poseidon_hash_span(maker_caravan_key_arr.span());
        set!(world, (Caravan { caravan_id: maker_caravan_id.into(), entity_id: maker_caravan_key }));


        // create a caravan owned by the taker
        let taker_caravan_id = 30_u64;
        let taker_caravan_id_felt: felt252 = taker_caravan_id.into();
        set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_caravan_id.into()}));
        set!(world, (Position { x: 900_000, y: 100_000, entity_id: taker_caravan_id.into()}));
        set!(world, (Capacity { weight_gram: 10_000, entity_id: taker_caravan_id.into()}));
        set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: taker_caravan_id.into()}));
        // attach caravan to the taker order
        let taker_caravan_key_arr = array![taker_order_id.into(), taker_id.into()];
        let taker_caravan_key = poseidon_hash_span(taker_caravan_key_arr.span());
        set!(world, (Caravan { caravan_id: taker_caravan_id.into(), entity_id: taker_caravan_key }));



        // taker takes trade
        starknet::testing::set_contract_address(
            contract_address_const::<'taker'>()
        );
        let mut calldata = array![];
        Serde::serialize(@taker_id, ref calldata);
        Serde::serialize(@trade_id, ref calldata);
        world.execute('TakeFungibleOrder', calldata);



        // taker wood balance should be 500
        let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
        assert(taker_wood_resource.balance == 500, 'resource balance should be 500'); // 600 - 100

        // taker stone balance should be 400
        let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
        assert(taker_stone_resource.balance == 400, 'resource balance should be 400'); // 600 - 200


        // status should be accepted
        let status = get!(world, trade_id, Status);
        assert(status.value == 1, 'status should be accepted');

        
        // verify arrival time and position of maker order
        let maker_order_arrival_time = get!(world, maker_order_id, ArrivalTime);
        let maker_order_position = get!(world, maker_order_id, Position);
        assert(maker_order_arrival_time.arrives_at == 220, 'arrival time should be 220');
        assert(maker_order_position.x == 60, 'position x should be 60');
        assert(maker_order_position.y == 70, 'position y should be 70');
        // verify arrival time of maker caravan
        let maker_caravan_arrival_time = get!(world, maker_caravan_id, ArrivalTime);
        assert(maker_caravan_arrival_time.arrives_at == (220 * 2), 'arrival time should be 440');

 

        // verify arrival time and position of taker order
        let taker_order_arrival_time = get!(world, taker_order_id, ArrivalTime);
        let taker_order_position = get!(world, taker_order_id, Position);
        assert(taker_order_arrival_time.arrives_at == 900, 'arrival time should be 900');
        assert(taker_order_position.x == 45, 'position x should be 45');
        assert(taker_order_position.y == 50, 'position y should be 50');
        // verify arrival time of taker caravan
        let taker_caravan_arrival_time = get!(world, taker_caravan_id, ArrivalTime);
        assert(taker_caravan_arrival_time.arrives_at == (900 * 2), 'arrival time should be 1800');


    }
}


