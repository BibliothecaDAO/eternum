use core::array::{ArrayTrait, SpanTrait};
use core::traits::Into;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

use eternum::constants::ResourceTypes;
use eternum::constants::{DONKEY_ENTITY_TYPE, REALM_LEVELING_CONFIG_ID};
use eternum::models::config::{LevelingConfig, CapacityConfig, CapacityConfigCategory};
use eternum::models::level::{Level};
use eternum::models::metadata::ForeignKey;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::order::{Orders, OrdersCustomTrait};
use eternum::models::owner::Owner;
use eternum::models::position::{Position, Coord};
use eternum::models::realm::Realm;
use eternum::models::resources::Resource;

use eternum::models::trade::{Trade, Status, TradeStatus};
use eternum::models::weight::Weight;

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait, IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
    ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait,
};

use eternum::systems::dev::contracts::resource::IResourceSystemsDispatcherTrait;

use eternum::systems::trade::contracts::trade_systems::{
    trade_systems, ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
};
use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems, deploy_dev_resource_systems},
    general::{spawn_realm}, config::{set_capacity_config, set_settlement_config}
};

use starknet::contract_address_const;


fn setup(direct_trade: bool) -> (IWorldDispatcher, ID, ID, ID, ITradeSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let dev_resource_systems = deploy_dev_resource_systems(world);

    set_settlement_config(config_systems_address);
    set_capacity_config(config_systems_address);

    // set speed configuration
    ITransportConfigDispatcher { contract_address: config_systems_address }
        .set_speed_config(DONKEY_ENTITY_TYPE, 10); // 10km per sec

    // set donkey capacity weight_gram
    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(CapacityConfig { category: CapacityConfigCategory::Donkey, weight_gram: 1_000_000, });

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

    let maker_position = Position { x: 100000, y: 200000, entity_id: 1 };
    let taker_position = Position { x: 200000, y: 1000000, entity_id: 1 };

    let realm_systems_dispatcher = deploy_realm_systems(world);
    let maker_realm_entity_id = spawn_realm(world, realm_systems_dispatcher, maker_position);
    let taker_realm_entity_id = spawn_realm(world, realm_systems_dispatcher, taker_position);

    let maker_id = maker_realm_entity_id;
    let taker_id = taker_realm_entity_id;

    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>() }));
    set!(world, (Owner { entity_id: taker_id, address: contract_address_const::<'taker'>() }));

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

    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());

    let trade_systems_address = deploy_system(world, trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher { contract_address: trade_systems_address };

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());
    if direct_trade {
        taker_id
    } else {
        0
    };

    // trade 100 stone and 100 gold for 200 wood and 200 silver
    // let trade_id = 0;
    let trade_id = trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            taker_id,
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span(),
            100
        );

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());

    (world, trade_id, maker_id, taker_id, trade_systems_dispatcher)
}


#[test]
#[available_gas(3000000000000)]
fn test_accept_order_free_trade() {
    let (world, trade_id, _, taker_id, trade_systems_dispatcher) = setup(false);

    // accept order
    trade_systems_dispatcher
        .accept_order(
            taker_id,
            trade_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span()
        );

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');
}

#[test]
#[available_gas(3000000000000)]
fn test_accept_order_direct_trade() {
    let (world, trade_id, _, taker_id, trade_systems_dispatcher) = setup(true);

    // accept order
    trade_systems_dispatcher
        .accept_order(
            taker_id,
            trade_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span()
        );

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not the taker', 'ENTRYPOINT_FAILED'))]
fn test_not_trade_taker_id() {
    let (world, trade_id, _, _, trade_systems_dispatcher) = setup(true);

    // the setup states the trade is a direct offer
    // so here we are checking to see that the person
    // who wants to accept is the intended recepient

    let taker_id = 9999; // set arbitrarily
    set!(world, (Owner { entity_id: taker_id, address: contract_address_const::<'takers_other_realm'>() }));

    // create order with a caller that isnt the owner of maker_id
    starknet::testing::set_contract_address(contract_address_const::<'takers_other_realm'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'takers_other_realm'>());

    // accept order
    trade_systems_dispatcher
        .accept_order(
            taker_id,
            trade_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span()
        );
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not owned by caller', 'ENTRYPOINT_FAILED'))]
fn test_caller_not_taker() {
    let (_, trade_id, _, taker_id, trade_systems_dispatcher) = setup(true);

    // create order with a caller that isnt the owner of taker_id
    starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'some_unknown'>());

    // accept order
    trade_systems_dispatcher
        .accept_order(
            taker_id,
            trade_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span()
        );
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 4, resource type: DONKEY, balance: 0). deduction: 1000",
        'ENTRYPOINT_FAILED'
    )
)]
fn test_transport_not_enough_donkey_capacity() {
    let (world, trade_id, _, taker_id, trade_systems_dispatcher) = setup(true);

    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::DONKEY, balance: 0 }));

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'taker'>());

    // accept order
    trade_systems_dispatcher
        .accept_order(
            taker_id,
            trade_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span()
        );
}

