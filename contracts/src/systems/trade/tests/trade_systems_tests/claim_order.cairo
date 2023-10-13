use eternum::models::resources::Resource;
use eternum::models::trade::FungibleEntities;
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::movable::ArrivalTime;
use eternum::models::trade::{Trade, OrderResource};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{
        ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;



fn setup() -> (IWorldDispatcher, ITradeSystemsDispatcher) {
    let world = spawn_eternum();

    let trade_systems_address 
        = deploy_system(trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher {
        contract_address: trade_systems_address
    };

    (world, trade_systems_dispatcher)
}



#[test]
#[available_gas(30000000000000)]
fn test_claim_by_maker() {
    let (world, trade_systems_dispatcher) = setup();

    // set as executor
    starknet::testing::set_contract_address(world.executor());

    let maker_id = 11_u128;
    let taker_id = 12_u128;

    set!(world, (Position { x: 45, y: 50, entity_id: maker_id}));
    set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_id}));

    set!(world, (Position { x: 60, y: 70, entity_id: taker_id}));
    set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_id}));

    // create a trade  
    let trade_id = 10_u128;
    let maker_order_id = 13_u128;
    let taker_order_id = 14_u128;
    set!(world, (Trade {
            trade_id,
            maker_id: maker_id,
            taker_id: taker_id,
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
    trade_systems_dispatcher.claim_order(
        world,
        maker_id,
        trade_id
    );

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
    let (world, trade_systems_dispatcher) = setup();

    // set as executor
    starknet::testing::set_contract_address(world.executor());

    let maker_id = 11_u128;
    let taker_id = 12_u128;

    set!(world, (Position { x: 45, y: 50, entity_id: maker_id}));
    set!(world, (Owner { address: contract_address_const::<'maker'>(), entity_id: maker_id}));

    set!(world, (Position { x: 60, y: 70, entity_id: taker_id}));
    set!(world, (Owner { address: contract_address_const::<'taker'>(), entity_id: taker_id}));

    // create a trade  
    let trade_id = 10_u128;
    let maker_order_id = 13_u128;
    let taker_order_id = 14_u128;
    set!(world, (Trade {
            trade_id,
            maker_id: maker_id,
            taker_id: taker_id,
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
    trade_systems_dispatcher.claim_order(
        world,
        taker_id,
        trade_id
    );


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
#[should_panic(expected: ('not owned by caller', 'ENTRYPOINT_FAILED' ))]
fn test_not_owner() {
    let (world, trade_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    let maker_id = 11_u128;
    let trade_id = 10_u128;
    trade_systems_dispatcher.claim_order(
        world,
        maker_id,
        trade_id
    );

}