use eternum::models::resources::Resource;
use eternum::models::trade::FungibleEntities;
use eternum::models::owner::Owner;
use eternum::models::trade::{Trade, OrderResource};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{
        ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};




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
#[available_gas(3000000000000)]
fn test_create_order() {

    let (world, trade_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(world.executor());

    let maker_id = 11_u128;
    let taker_id = 12_u128;
    
    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>()}));

    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::STONE, balance: 100 }));
    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::STONE, balance: 100 }));

    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::GOLD, balance: 100 }));
    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::GOLD, balance: 100 }));

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    let trade_id = trade_systems_dispatcher.create_order(
                world,
                maker_id,
                array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
                array![100, 100].span(),
                taker_id,
                array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
                array![100, 100].span(),
                false,
                100
        );

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
    assert(trade.maker_id == maker_id, 'Maker id should be 11');
    assert(trade.taker_id == taker_id, 'Taker id should be 12');
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
#[should_panic(expected: ('Only owner can create order', 'ENTRYPOINT_FAILED' ))]
fn test_not_owner() {
    let (world, trade_systems_dispatcher) = setup();

    let maker_id = 11_u128;
    let taker_id = 12_u128;
    
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Owner { 
            entity_id: maker_id, 
            address: contract_address_const::<'maker'>()
        }
    ));

    // set caller to be some other address
    starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());
    let trade_id = trade_systems_dispatcher.create_order(
                world,
                maker_id,
                array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
                array![100, 100].span(),
                taker_id,
                array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
                array![100, 100].span(),
                false,
                100
        );
}



