use core::array::{ArrayTrait, SpanTrait};
use core::traits::Into;
use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
use eternum::alias::ID;
use eternum::constants::DONKEY_ENTITY_TYPE;

use eternum::constants::ResourceTypes;
use eternum::models::config::CapacityConfig;
use eternum::models::config::CapacityConfigCategory;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::owner::Owner;
use eternum::models::position::{Position};
use eternum::models::resources::Resource;
use eternum::models::trade::{Trade, Status, TradeStatus};
use eternum::models::weight::Weight;

use eternum::systems::config::contracts::{
    config_systems, ITransportConfigDispatcher, ITransportConfigDispatcherTrait, IWeightConfigDispatcher,
    IWeightConfigDispatcherTrait, ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait
};

use eternum::systems::trade::contracts::trade_systems::{
    trade_systems, ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
};

use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems}, general::{spawn_realm},
    config::{set_capacity_config, set_settlement_config}
};
use starknet::contract_address_const;


fn setup() -> (WorldStorage, ID, ID, ID, ITradeSystemsDispatcher) {
    let mut world = spawn_eternum();
    world.dispatcher.uuid();

    let config_systems_address = deploy_system(ref world, "config_systems");

    set_settlement_config(config_systems_address);
    set_capacity_config(config_systems_address);

    // set speed configuration
    ITransportConfigDispatcher { contract_address: config_systems_address }
        .set_speed_config(DONKEY_ENTITY_TYPE, 10); // 10km per sec

    // set weight configuration for stone
    IWeightConfigDispatcher { contract_address: config_systems_address }
        .set_weight_config(ResourceTypes::STONE.into(), 200);

    // set weight configuration for gold
    IWeightConfigDispatcher { contract_address: config_systems_address }
        .set_weight_config(ResourceTypes::GOLD.into(), 200);

    // set weight configuration for wood
    IWeightConfigDispatcher { contract_address: config_systems_address }
        .set_weight_config(ResourceTypes::WOOD.into(), 200);

    // set weight configuration for silver
    IWeightConfigDispatcher { contract_address: config_systems_address }
        .set_weight_config(ResourceTypes::SILVER.into(), 200);

    // set donkey capacity weight_gram
    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(CapacityConfig { category: CapacityConfigCategory::Donkey, weight_gram: 1_000_000, });

    // maker and taker are at the same location
    // so they can trade without transport
    let maker_position = Position { x: 100000, y: 2000000, entity_id: 1 };
    let taker_position = Position { x: 200000, y: 1000000, entity_id: 1 };

    let maker_realm_entity_id = spawn_realm(ref world, 1, maker_position.into());
    let taker_realm_entity_id = spawn_realm(ref world, 2, taker_position.into());

    let maker_id = maker_realm_entity_id;
    let taker_id = taker_realm_entity_id;

    world.write_model_test(@Owner { entity_id: maker_id, address: contract_address_const::<'maker'>() });
    world.write_model_test(@Owner { entity_id: taker_id, address: contract_address_const::<'taker'>() });

    //
    world.write_model_test(@Resource { entity_id: maker_id, resource_type: ResourceTypes::STONE, balance: 100 });
    world.write_model_test(@Resource { entity_id: maker_id, resource_type: ResourceTypes::GOLD, balance: 100 });
    world.write_model_test(@Resource { entity_id: maker_id, resource_type: ResourceTypes::DONKEY, balance: 20_000 });

    //
    world.write_model_test(@Resource { entity_id: taker_id, resource_type: ResourceTypes::WOOD, balance: 500 });
    world.write_model_test(@Resource { entity_id: taker_id, resource_type: ResourceTypes::SILVER, balance: 500 });
    world.write_model_test(@Resource { entity_id: taker_id, resource_type: ResourceTypes::DONKEY, balance: 20_000 });

    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());

    let trade_systems_address = deploy_system(ref world, "trade_systems");
    let trade_systems_dispatcher = ITradeSystemsDispatcher { contract_address: trade_systems_address };

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());

    // trade 100 stone and 100 gold for 200 wood and 200 silver
    let trade_id = trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            taker_id,
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span(),
            100
        );

    (world, trade_id, maker_id, taker_id, trade_systems_dispatcher)
}


#[test]
#[available_gas(3000000000000)]
fn trade_test_cancel() {
    let (mut world, trade_id, maker_id, _, trade_systems_dispatcher) = setup();

    // cancel order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());
    trade_systems_dispatcher
        .cancel_order(trade_id, array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span());

    // check that maker balance is correct
    let maker_stone_resource: Resource = world.read_model((maker_id, ResourceTypes::STONE));
    assert(maker_stone_resource.balance == 100, 'wrong maker balance');

    let maker_gold_resource: Resource = world.read_model((maker_id, ResourceTypes::GOLD));
    assert(maker_gold_resource.balance == 100, 'wrong maker balance');

    // check that trade status is cancelled
    let trade_status: Status = world.read_model(trade_id);
    assert(trade_status.value == TradeStatus::CANCELLED, 'wrong trade status');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('trade must be open', 'ENTRYPOINT_FAILED'))]
fn trade_test_cancel_after_acceptance() {
    let (mut world, trade_id, _, _, trade_systems_dispatcher) = setup();

    // accept order

    world.write_model_test(@Status { trade_id, value: TradeStatus::ACCEPTED, });

    // cancel order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());
    trade_systems_dispatcher
        .cancel_order(trade_id, array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span());
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('caller must be trade maker', 'ENTRYPOINT_FAILED'))]
fn trade_test_cancel_caller_not_maker() {
    let (_, trade_id, _, _, trade_systems_dispatcher) = setup();

    // set caller to an unknown address
    starknet::testing::set_contract_address(contract_address_const::<'unknown'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'unknown'>());

    // cancel order
    trade_systems_dispatcher
        .cancel_order(trade_id, array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span());
}
