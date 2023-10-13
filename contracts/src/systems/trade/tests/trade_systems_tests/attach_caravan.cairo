use eternum::models::resources::Resource;
use eternum::models::trade::FungibleEntities;
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::capacity::Capacity;
use eternum::models::movable::Movable;
use eternum::models::caravan::Caravan;
use eternum::models::config::WeightConfig;
use eternum::models::trade::{Trade,Status, OrderId, OrderResource};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{
        ITradeCaravanSystemsDispatcher, 
        ITradeCaravanSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::WORLD_CONFIG_ID;


use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::poseidon::poseidon_hash_span;
use core::traits::Into;



fn setup() -> (IWorldDispatcher, ITradeCaravanSystemsDispatcher) {
    let world = spawn_eternum();

    let trade_systems_address 
        = deploy_system(trade_systems::TEST_CLASS_HASH);
    let trade_caravan_systems_dispatcher = ITradeCaravanSystemsDispatcher {
        contract_address: trade_systems_address
    };

    (world, trade_caravan_systems_dispatcher)
}




#[test]
#[available_gas(30000000000000)]
fn test_maker_attach_caravan() {
    let (world, trade_caravan_systems_dispatcher) = setup();

    // set as executor
    starknet::testing::set_contract_address(world.executor());

    let maker_id = 11_u128;
    let taker_id = 12_u128;

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
    ));


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
    let caravan_id = 20_u128;
    let caravan_id_felt: felt252 = caravan_id.into();
    set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: caravan_id.into()}));
    set!(world, (Position { x: 45, y: 50, entity_id: caravan_id.into()}));
    set!(world, (Capacity { weight_gram: 10_000, entity_id: caravan_id.into()}));
    set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: caravan_id.into()}));


    // attach caravan to maker
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    trade_caravan_systems_dispatcher.attach_caravan(
        world,
        maker_id,
        trade_id,
        caravan_id
    );



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
    let (world, trade_caravan_systems_dispatcher) = setup();

    // set as executor
    starknet::testing::set_contract_address(world.executor());

    let maker_id = 11_u128;
    let taker_id = 12_u128;

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
    ));


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
    let caravan_id = 20_u128;
    let caravan_id_felt: felt252 = caravan_id.into();
    set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: caravan_id.into()}));
    set!(world, (Position { x: 60, y: 70, entity_id: caravan_id.into()}));
    set!(world, (Capacity { weight_gram: 10_000, entity_id: caravan_id.into()}));
    set!(world, (Movable { sec_per_km: 10, blocked: false, entity_id: caravan_id.into()}));


    // attach caravan to taker
    starknet::testing::set_contract_address(contract_address_const::<'taker'>());
    trade_caravan_systems_dispatcher.attach_caravan(
        world,
        taker_id,
        trade_id,
        caravan_id
    );


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
#[should_panic(expected: ('Caller not owner of entity_id', 'ENTRYPOINT_FAILED' ))]
fn test_not_owner() {
    let (world, trade_caravan_systems_dispatcher) = setup();

    let taker_id = 12_u128;
    let trade_id = 10_u128;
    let caravan_id = 20_u128;

    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    trade_caravan_systems_dispatcher.attach_caravan(
        world,
        taker_id,
        trade_id,
        caravan_id
    );

}