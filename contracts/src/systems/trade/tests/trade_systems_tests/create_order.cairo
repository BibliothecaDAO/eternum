use core::array::{ArrayTrait, SpanTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::DONKEY_ENTITY_TYPE;

use eternum::constants::ResourceTypes;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::resources::Resource;

use eternum::models::trade::{Trade, Status, TradeStatus};
use eternum::models::weight::Weight;

use eternum::systems::config::contracts::{
    config_systems, ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    IWeightConfigDispatcher, IWeightConfigDispatcherTrait, ICapacityConfigDispatcher,
    ICapacityConfigDispatcherTrait
};

use eternum::systems::trade::contracts::trade_systems::{
    trade_systems, ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
};

use eternum::utils::testing::{
    spawn_eternum, deploy_system, spawn_realm, get_default_realm_pos, deploy_realm_systems
};

use starknet::contract_address_const;


fn setup() -> (IWorldDispatcher, u128, u128, ITradeSystemsDispatcher) {
    let world = spawn_eternum();
    // increase world uuid
    world.uuid();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

    // set weight configuration for stone
    IWeightConfigDispatcher { contract_address: config_systems_address }
        .set_weight_config(ResourceTypes::STONE.into(), 200);

    // set weight configuration for gold
    IWeightConfigDispatcher { contract_address: config_systems_address }
        .set_weight_config(ResourceTypes::GOLD.into(), 200);

    // set donkey capacity weight_gram
    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(DONKEY_ENTITY_TYPE, 1_000_000);

    let realm_systems_dispatcher = deploy_realm_systems(world);
    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    let maker_id = realm_entity_id;
    let taker_id = 12_u128;

    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>() }));

    set!(
        world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::STONE, balance: 100 })
    );
    set!(
        world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::GOLD, balance: 100 })
    );
    set!(
        world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::DONKEY, balance: 20_000 })
    );

    set!(
        world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::STONE, balance: 500 })
    );
    set!(
        world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::GOLD, balance: 500 })
    );
    set!(
        world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::DONKEY, balance: 20_000 })
    );

    starknet::testing::set_contract_address(contract_address_const::<'maker'>());

    let trade_systems_address = deploy_system(world, trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher {
        contract_address: trade_systems_address
    };

    (world, maker_id, taker_id, trade_systems_dispatcher)
}


#[test]
#[available_gas(3000000000000)]
fn test_create_order() {
    let (world, maker_id, taker_id, trade_systems_dispatcher) = setup();

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    let trade_id = trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            taker_id,
            array![(ResourceTypes::STONE, 200), (ResourceTypes::GOLD, 200),].span(),
            100
        );

    // check maker balances
    let maker_stone_resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
    assert_eq!(maker_stone_resource.balance, 0);

    let maker_gold_resource = get!(world, (maker_id, ResourceTypes::GOLD), Resource);
    assert_eq!(maker_gold_resource.balance, 0);

    // check that taker balance is unmodified
    let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
    assert(taker_stone_resource.balance == 500, 'Balance should be 500');

    let taker_gold_resource = get!(world, (taker_id, ResourceTypes::GOLD), Resource);
    assert(taker_gold_resource.balance == 500, 'Balance should be 500');

    let trade = get!(world, trade_id, Trade);
    assert(trade.maker_id == maker_id, 'wrong maker id');
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.expires_at == 100, 'expires at is wrong');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::OPEN, 'wrong trade status');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('caller not maker', 'ENTRYPOINT_FAILED'))]
fn test_caller_not_maker() {
    let (_, maker_id, taker_id, trade_systems_dispatcher) = setup();

    // create order with a caller that isnt the owner of maker_id
    starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());
    trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            taker_id,
            array![(ResourceTypes::STONE, 200), (ResourceTypes::GOLD, 200),].span(),
            100
        );
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ("not enough resources, Resource (entity id: 1, resource type: DONKEY, balance: 0). deduction: 1000", 'ENTRYPOINT_FAILED'))]
fn test_transport_not_enough_capacity() {
    let (world, maker_id, taker_id, trade_systems_dispatcher) = setup();

    set!(
        world, (
            Resource { 
                entity_id: maker_id, 
                resource_type: ResourceTypes::DONKEY, 
                balance: 0 
            }
        )
    );
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());

    trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            taker_id,
            array![(ResourceTypes::STONE, 200), (ResourceTypes::GOLD, 200),].span(),
            100
        );
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('maker resource amount is 0', 'ENTRYPOINT_FAILED'))]
fn test_create_order_amount_give_0() {
    let (_world, maker_id, taker_id, trade_systems_dispatcher) = setup();

    trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 0),].span(),
            taker_id,
            array![(ResourceTypes::STONE, 200),].span(),
            100
        );
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('taker resource amount is 0', 'ENTRYPOINT_FAILED'))]
fn test_create_order_amount_take_0() {
    let (_world, maker_id, taker_id, trade_systems_dispatcher) = setup();

    trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100),].span(),
            taker_id,
            array![(ResourceTypes::STONE, 0),].span(),
            100
        );
}
