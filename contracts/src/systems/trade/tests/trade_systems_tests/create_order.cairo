use core::array::{ArrayTrait, SpanTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

use eternum::constants::{ResourceTypes, DONKEY_ENTITY_TYPE};

use eternum::models::{
    movable::{Movable, ArrivalTime}, owner::Owner, position::Position, resources::{Resource, ResourceCustomImpl},
    trade::{Trade, Status, TradeStatus}, weight::Weight, config::CapacityConfig, config::CapacityConfigCategory
};

use eternum::systems::config::contracts::{
    config_systems, ITransportConfigDispatcher, ITransportConfigDispatcherTrait, IWeightConfigDispatcher,
    IWeightConfigDispatcherTrait, ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait
};

use eternum::systems::dev::contracts::resource::IResourceSystemsDispatcherTrait;

use eternum::systems::trade::contracts::trade_systems::{
    trade_systems, ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
};


use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems, deploy_dev_resource_systems},
    general::{spawn_realm, get_default_realm_pos},
    config::{set_capacity_config, set_settlement_config, set_weight_config}
};
use starknet::contract_address_const;


fn setup() -> (IWorldDispatcher, ID, ID, ITradeSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let dev_resource_systems = deploy_dev_resource_systems(world);
    let realm_systems_dispatcher = deploy_realm_systems(world);

    set_settlement_config(config_systems_address);
    set_capacity_config(config_systems_address);
    set_weight_config(config_systems_address);

    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, get_default_realm_pos());

    let maker_id = realm_entity_id;
    let taker_id = 12;

    dev_resource_systems
        .mint(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100), (ResourceTypes::DONKEY, 20_000)].span()
        );
    dev_resource_systems
        .mint(
            taker_id,
            array![(ResourceTypes::STONE, 500), (ResourceTypes::GOLD, 500), (ResourceTypes::DONKEY, 20_000)].span()
        );

    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>() }));
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());
    let trade_systems_address = deploy_system(world, trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher { contract_address: trade_systems_address };

    (world, maker_id, taker_id, trade_systems_dispatcher)
}


#[test]
#[available_gas(3000000000000)]
fn test_create_order() {
    let (world, maker_id, taker_id, trade_systems_dispatcher) = setup();

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());
    let trade_id = trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            taker_id,
            array![(ResourceTypes::STONE, 200), (ResourceTypes::GOLD, 200),].span(),
            100
        );

    // check maker balances
    let maker_stone_balance = ResourceCustomImpl::get(world, (maker_id, ResourceTypes::STONE)).balance;
    assert(maker_stone_balance == 0, 'm stone balance should be 0');

    let maker_gold_balance = ResourceCustomImpl::get(world, (maker_id, ResourceTypes::GOLD)).balance;
    assert(maker_gold_balance == 0, 'm gold balance should be 0');

    // check that taker balance is unmodified
    let taker_stone_balance = ResourceCustomImpl::get(world, (taker_id, ResourceTypes::STONE)).balance;
    assert(taker_stone_balance == 500, 't stone balance should be 500');

    let taker_gold_balance = ResourceCustomImpl::get(world, (taker_id, ResourceTypes::GOLD)).balance;
    assert(taker_gold_balance == 500, 't gold balance should be 500');

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
    starknet::testing::set_account_contract_address(contract_address_const::<'some_unknown'>());
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
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 1, resource type: DONKEY, balance: 0). deduction: 1000",
        'ENTRYPOINT_FAILED'
    )
)]
fn test_transport_not_enough_capacity() {
    let (world, maker_id, taker_id, trade_systems_dispatcher) = setup();

    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::DONKEY, balance: 0 }));
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());

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
