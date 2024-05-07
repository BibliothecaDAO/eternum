use core::array::{ArrayTrait, SpanTrait};
use core::traits::Into;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::constants::ResourceTypes;
use eternum::constants::{
    DONKEY_ENTITY_TYPE, REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_CONFIG_ID
};
use eternum::models::config::{LevelingConfig};
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::inventory::Inventory;
use eternum::models::level::{Level};
use eternum::models::metadata::ForeignKey;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::order::{Orders, OrdersTrait};
use eternum::models::owner::Owner;
use eternum::models::position::{Position, Coord};
use eternum::models::realm::Realm;
use eternum::models::resources::{Resource, ResourceChest};
use eternum::models::road::Road;

use eternum::models::trade::{Trade, Status, TradeStatus};
use eternum::models::weight::Weight;

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait, IWeightConfigDispatcher,
    IWeightConfigDispatcherTrait, ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait,
};

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,};
use eternum::systems::resources::contracts::resource_systems::{
    InternalInventorySystemsImpl as inventory
};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait},
};


use eternum::systems::transport::contracts::{
    transport_unit_systems::transport_unit_systems, caravan_systems::caravan_systems
};

use eternum::systems::transport::interface::{
    caravan_systems_interface::{ICaravanSystemsDispatcher, ICaravanSystemsDispatcherTrait},
    transport_unit_systems_interface::{
        ITransportUnitSystemsDispatcher, ITransportUnitSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;
use starknet::testing::pop_log_raw;


fn setup(
    direct_trade: bool
) -> (IWorldDispatcher, u128, u128, u128, u128, ITradeSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

    // set travel configuration
    ITransportConfigDispatcher { contract_address: config_systems_address }
        .set_travel_config(10); // 10 free transport per city

    // set speed configuration 
    ITransportConfigDispatcher { contract_address: config_systems_address }
        .set_speed_config(DONKEY_ENTITY_TYPE, 10); // 10km per sec

    // set road config
    ITransportConfigDispatcher { contract_address: config_systems_address }
        .set_road_config(
            array![ // pay for each soldier with the following
            (ResourceTypes::STONE, 9000),].span(),
            2
        );

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

    let realm_systems_address = deploy_system(world, realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let maker_position = Position { x: 100000, y: 200000, entity_id: 1_u128 };
    let taker_position = Position { x: 200000, y: 1000000, entity_id: 1_u128 };

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 0;

    // create maker's realm
    let maker_realm_entity_id = realm_systems_dispatcher
        .create(
            realm_id,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            maker_position.clone(),
        );
    // create taker's realm
    let taker_realm_entity_id = realm_systems_dispatcher
        .create(
            realm_id,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            taker_position.clone(),
        );

    let maker_id = maker_realm_entity_id;
    let taker_id = taker_realm_entity_id;

    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>() }));
    set!(world, (Owner { entity_id: taker_id, address: contract_address_const::<'taker'>() }));

    set!(
        world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::STONE, balance: 100 })
    );
    set!(
        world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::GOLD, balance: 100 })
    );

    set!(
        world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::WOOD, balance: 500 })
    );
    set!(
        world,
        (Resource { entity_id: taker_id, resource_type: ResourceTypes::SILVER, balance: 500 })
    );

    starknet::testing::set_contract_address(contract_address_const::<'maker'>());

    // create two free transport unit for maker realm
    let transport_unit_systems_address = deploy_system(
        world, transport_unit_systems::TEST_CLASS_HASH
    );
    let transport_unit_systems_dispatcher = ITransportUnitSystemsDispatcher {
        contract_address: transport_unit_systems_address
    };
    let maker_first_free_transport_unit_id = transport_unit_systems_dispatcher
        .create_free_unit(maker_id, 10);
    let maker_second_free_transport_unit_id = transport_unit_systems_dispatcher
        .create_free_unit(maker_id, 10);
    let maker_transport_units: Array<u128> = array![
        maker_first_free_transport_unit_id, maker_second_free_transport_unit_id
    ];

    // create maker caravan
    let caravan_systems_address = deploy_system(world, caravan_systems::TEST_CLASS_HASH);
    let caravan_systems_dispatcher = ICaravanSystemsDispatcher {
        contract_address: caravan_systems_address
    };
    let maker_transport_id = caravan_systems_dispatcher.create(maker_transport_units);

    let trade_systems_address = deploy_system(world, trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher {
        contract_address: trade_systems_address
    };

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    if direct_trade {
        taker_id
    } else {
        0
    };

    // trade 100 stone and 100 gold for 200 wood and 200 silver
    let trade_id = trade_systems_dispatcher
        .create_order(
            maker_id,
            array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100),].span(),
            maker_transport_id,
            taker_id,
            array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200),].span(),
            100
        );

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());

    // create two free transport unit for taker realm
    let taker_first_free_transport_unit_id = transport_unit_systems_dispatcher
        .create_free_unit(taker_id, 10);
    let taker_second_free_transport_unit_id = transport_unit_systems_dispatcher
        .create_free_unit(taker_id, 10);
    let taker_transport_units: Array<u128> = array![
        taker_first_free_transport_unit_id, taker_second_free_transport_unit_id
    ];

    // create taker caravan
    let taker_transport_id = caravan_systems_dispatcher.create(taker_transport_units);

    (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher)
}


#[test]
#[available_gas(3000000000000)]
fn test_accept_without_taker_transport_id() {
    let (world, trade_id, maker_id, taker_id, _, trade_systems_dispatcher) = setup(false);

    // let maker and taker be at the same location

    let maker_position = get!(world, maker_id, Position);
    set!(world, (Position { entity_id: taker_id, x: maker_position.x, y: maker_position.y, }));

    // accept order 
    starknet::testing::set_contract_address(contract_address_const::<'taker'>());
    trade_systems_dispatcher.accept_order(taker_id, 0, trade_id);

    // check that maker balance is correct
    let maker_stone_resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
    assert(maker_stone_resource.balance == 0, 'wrong maker balance');

    let maker_gold_resource = get!(world, (maker_id, ResourceTypes::GOLD), Resource);
    assert(maker_gold_resource.balance == 0, 'wrong maker balance');

    let maker_wood_resource = get!(world, (maker_id, ResourceTypes::WOOD), Resource);
    assert(maker_wood_resource.balance == 200, 'wrong maker balance');

    let maker_silver_resource = get!(world, (maker_id, ResourceTypes::SILVER), Resource);
    assert(maker_silver_resource.balance == 200, 'wrong maker balance');

    // check that taker balance is correct
    let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
    assert(taker_stone_resource.balance == 100, 'wrong taker balance');

    let taker_gold_resource = get!(world, (taker_id, ResourceTypes::GOLD), Resource);
    assert(taker_gold_resource.balance == 100, 'wrong taker balance');

    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == 0, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    // check that taker resource chest is  empty
    let taker_resource_chest_weight = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value == 0, 'chest should be empty');

    // check that maker resource chest is  empty
    let maker_resource_chest_weight = get!(world, trade.maker_resource_chest_id, Weight);
    assert(maker_resource_chest_weight.value == 0, 'chest should be empty');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('position mismatch', 'ENTRYPOINT_FAILED'))]
fn test_accept_without_taker_transport_id_wrong_position() {
    // when there is no provided taker_tansport_id, 
    // maker and taker must be in the same position
    let (_, trade_id, _, taker_id, _, trade_systems_dispatcher) = setup(false);

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, 0, trade_id);
}


#[test]
#[available_gas(3000000000000)]
fn test_accept_order_free_trade() {
    let (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(
        false
    );

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == taker_transport_id, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    ///// Check Maker Data ///////
    //////////////////////////////

    // check that maker resource chest is filled
    let maker_resource_chest_weight = get!(world, trade.maker_resource_chest_id, Weight);
    assert(maker_resource_chest_weight.value != 0, 'chest should be filled');

    // check maker resource chest is locked
    let maker_resource_chest = get!(world, trade.maker_resource_chest_id, ResourceChest);
    assert(maker_resource_chest.locked_until == 8000000, 'wrong chest locked_until');

    // check that the maker's resource chest was 
    // added their transport's inventory
    let maker_transport_inventory = get!(world, trade.maker_transport_id, Inventory);
    assert(maker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(maker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.maker_resource_chest_id, 'chest not in inventory');

    // check maker transport movable
    let maker_transport_movable = get!(world, trade.maker_transport_id, Movable);
    assert(maker_transport_movable.blocked == false, 'maker transport not blocked');

    let maker_position = get!(world, maker_id, Position);
    let taker_position = get!(world, taker_id, Position);

    assert(maker_transport_movable.intermediate_coord_x == taker_position.x, 'wrong position x');

    assert(maker_transport_movable.intermediate_coord_y == taker_position.y, 'wrong position y');

    assert(maker_transport_movable.round_trip == true, 'wrong position y');

    // check maker transport arrival time
    let maker_transport_arrival_time = get!(world, trade.maker_transport_id, ArrivalTime);
    assert(maker_transport_arrival_time.arrives_at == 8000000 * 2, 'wrong arrival time');

    // check maker transport position
    let maker_transport_position = get!(world, trade.maker_transport_id, Position);
    assert(maker_transport_position.x == maker_position.x, 'wrong maker position');
    assert(maker_transport_position.y == maker_position.y, 'wrong maker position');

    ///// Check Taker Data ///////
    //////////////////////////////

    // check that taker resource chest is filled
    let taker_resource_chest_weight = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value != 0, 'chest should be filled');

    // check taker resource chest is locked
    let taker_resource_chest = get!(world, trade.taker_resource_chest_id, ResourceChest);
    assert(taker_resource_chest.locked_until == 8000000, 'wrong chest locked_until');

    // check that the taker's resource chest was 
    // added their transport's inventory
    let taker_transport_inventory = get!(world, trade.taker_transport_id, Inventory);
    assert(taker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(taker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.taker_resource_chest_id, 'chest not in inventory');

    // check taker transport movable
    let taker_transport_movable = get!(world, trade.taker_transport_id, Movable);
    assert(taker_transport_movable.blocked == false, 'taker transport not blocked');

    assert(taker_transport_movable.intermediate_coord_x == maker_position.x, 'wrong position x');

    assert(taker_transport_movable.intermediate_coord_y == maker_position.y, 'wrong position y');

    assert(taker_transport_movable.round_trip == true, 'wrong position y');

    // check taker transport arrival time
    let taker_transport_arrival_time = get!(world, trade.taker_transport_id, ArrivalTime);
    assert(taker_transport_arrival_time.arrives_at == 8000000 * 2, 'wrong arrival time');

    // check taker transport position
    let taker_transport_position = get!(world, trade.taker_transport_id, Position);
    assert(taker_transport_position.x == taker_position.x, 'wrong taker position');
    assert(taker_transport_position.y == taker_position.y, 'wrong taker position');
}


#[test]
#[available_gas(3000000000000)]
fn test_accept_order_direct_trade() {
    let (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(
        true
    );

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == taker_transport_id, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    ///// Check Maker Data ///////
    //////////////////////////////

    // check that maker resource chest is filled
    let maker_resource_chest_weight = get!(world, trade.maker_resource_chest_id, Weight);
    assert(maker_resource_chest_weight.value != 0, 'chest should be filled');

    // check maker resource chest is locked
    let maker_resource_chest = get!(world, trade.maker_resource_chest_id, ResourceChest);
    assert(maker_resource_chest.locked_until == 8000000, 'wrong chest locked_until');

    // check that the maker's resource chest was 
    // added their transport's inventory
    let maker_transport_inventory = get!(world, trade.maker_transport_id, Inventory);
    assert(maker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(maker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.maker_resource_chest_id, 'chest not in inventory');

    // check maker transport movable
    let maker_transport_movable = get!(world, trade.maker_transport_id, Movable);
    assert(maker_transport_movable.blocked == false, 'maker transport not blocked');

    let maker_position = get!(world, maker_id, Position);
    let taker_position = get!(world, taker_id, Position);

    assert(maker_transport_movable.intermediate_coord_x == taker_position.x, 'wrong position x');

    assert(maker_transport_movable.intermediate_coord_y == taker_position.y, 'wrong position y');

    assert(maker_transport_movable.round_trip == true, 'wrong position y');

    // check maker transport arrival time
    let maker_transport_arrival_time = get!(world, trade.maker_transport_id, ArrivalTime);
    assert(maker_transport_arrival_time.arrives_at == 8000000 * 2, 'wrong arrival time');

    // check maker transport position
    let maker_transport_position = get!(world, trade.maker_transport_id, Position);
    assert(maker_transport_position.x == maker_position.x, 'wrong maker position');
    assert(maker_transport_position.y == maker_position.y, 'wrong maker position');

    ///// Check Taker Data ///////
    //////////////////////////////

    // check that taker resource chest is filled
    let taker_resource_chest_weight = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value != 0, 'chest should be filled');

    // check taker resource chest is locked
    let taker_resource_chest = get!(world, trade.taker_resource_chest_id, ResourceChest);
    assert(taker_resource_chest.locked_until == 8000000, 'wrong chest locked_until');

    // check that the taker's resource chest was 
    // added their transport's inventory
    let taker_transport_inventory = get!(world, trade.taker_transport_id, Inventory);
    assert(taker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(taker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.taker_resource_chest_id, 'chest not in inventory');

    // check taker transport movable
    let taker_transport_movable = get!(world, trade.taker_transport_id, Movable);
    assert(taker_transport_movable.blocked == false, 'taker transport not blocked');

    assert(taker_transport_movable.intermediate_coord_x == maker_position.x, 'wrong position x');

    assert(taker_transport_movable.intermediate_coord_y == maker_position.y, 'wrong position y');

    assert(taker_transport_movable.round_trip == true, 'wrong position y');

    // check taker transport arrival time
    let taker_transport_arrival_time = get!(world, trade.taker_transport_id, ArrivalTime);
    assert(taker_transport_arrival_time.arrives_at == 8000000 * 2, 'wrong arrival time');

    // check taker transport position
    let taker_transport_position = get!(world, trade.taker_transport_id, Position);
    assert(taker_transport_position.x == taker_position.x, 'wrong taker position');
    assert(taker_transport_position.y == taker_position.y, 'wrong taker position');
}

#[test]
#[available_gas(3000000000000)]
fn test_accept_order_with_realm_travel_bonus() {
    let (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(
        true
    );

    let caller_address = starknet::get_contract_address();

    // set maker and taker levels
    set!(
        world,
        (
            Level { entity_id: maker_id, level: 12, valid_until: 100_000 },
            Level { entity_id: taker_id, level: 12, valid_until: 100_000 }
        )
    );

    set!(
        world,
        (
            LevelingConfig {
                config_id: REALM_LEVELING_CONFIG_ID,
                decay_interval: 604800,
                max_level: 1000,
                wheat_base_amount: 0,
                fish_base_amount: 0,
                resource_1_cost_id: 0,
                resource_1_cost_count: 0,
                resource_2_cost_id: 0,
                resource_2_cost_count: 0,
                resource_3_cost_id: 0,
                resource_3_cost_count: 0,
                decay_scaled: 1844674407370955161,
                cost_percentage_scaled: 4611686018427387904,
                base_multiplier: 25
            },
        )
    );
    starknet::testing::set_contract_address(caller_address);

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == taker_transport_id, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    ///// Check Maker Data ///////
    //////////////////////////////

    // check that maker resource chest is filled
    let maker_resource_chest_weight = get!(world, trade.maker_resource_chest_id, Weight);
    assert(maker_resource_chest_weight.value != 0, 'chest should be filled');

    // check maker resource chest is locked
    let maker_resource_chest = get!(world, trade.maker_resource_chest_id, ResourceChest);
    assert(maker_resource_chest.locked_until == 5442176, 'wrong chest locked_until');

    // check that the maker's resource chest was 
    // added their transport's inventory
    let maker_transport_inventory = get!(world, trade.maker_transport_id, Inventory);
    assert(maker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(maker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.maker_resource_chest_id, 'chest not in inventory');

    // check maker transport movable
    let maker_transport_movable = get!(world, trade.maker_transport_id, Movable);
    assert(maker_transport_movable.blocked == false, 'maker transport not blocked');

    let maker_position = get!(world, maker_id, Position);
    let taker_position = get!(world, taker_id, Position);

    assert(maker_transport_movable.intermediate_coord_x == taker_position.x, 'wrong position x');

    assert(maker_transport_movable.intermediate_coord_y == taker_position.y, 'wrong position y');

    assert(maker_transport_movable.round_trip == true, 'wrong position y');

    // check maker transport arrival time
    let maker_transport_arrival_time = get!(world, trade.maker_transport_id, ArrivalTime);
    assert(maker_transport_arrival_time.arrives_at == 5442176 * 2, 'wrong arrival time');

    // check maker transport position
    let maker_transport_position = get!(world, trade.maker_transport_id, Position);
    assert(maker_transport_position.x == maker_position.x, 'wrong maker position');
    assert(maker_transport_position.y == maker_position.y, 'wrong maker position');

    ///// Check Taker Data ///////
    //////////////////////////////

    // check that taker resource chest is filled
    let taker_resource_chest_weight = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value != 0, 'chest should be filled');

    // check taker resource chest is locked
    let taker_resource_chest = get!(world, trade.taker_resource_chest_id, ResourceChest);
    assert(taker_resource_chest.locked_until == 5442176, 'wrong chest locked_until');

    // check that the taker's resource chest was 
    // added their transport's inventory
    let taker_transport_inventory = get!(world, trade.taker_transport_id, Inventory);
    assert(taker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(taker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.taker_resource_chest_id, 'chest not in inventory');

    // check taker transport movable
    let taker_transport_movable = get!(world, trade.taker_transport_id, Movable);
    assert(taker_transport_movable.blocked == false, 'taker transport not blocked');

    assert(taker_transport_movable.intermediate_coord_x == maker_position.x, 'wrong position x');

    assert(taker_transport_movable.intermediate_coord_y == maker_position.y, 'wrong position y');

    assert(taker_transport_movable.round_trip == true, 'wrong position y');

    // check taker transport arrival time
    let taker_transport_arrival_time = get!(world, trade.taker_transport_id, ArrivalTime);
    assert(taker_transport_arrival_time.arrives_at == 5442176 * 2, 'wrong arrival time');

    // check taker transport position
    let taker_transport_position = get!(world, trade.taker_transport_id, Position);
    assert(taker_transport_position.x == taker_position.x, 'wrong taker position');
    assert(taker_transport_position.y == taker_position.y, 'wrong taker position');
}


#[test]
#[available_gas(3000000000000)]
fn test_accept_order_with_realm_and_order_travel_bonus() {
    let (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(
        true
    );

    let caller_address = starknet::get_contract_address();

    // set maker and taker realm level
    set!(
        world,
        (
            Level { entity_id: maker_id, level: 12, valid_until: 100_000 },
            Level { entity_id: taker_id, level: 12, valid_until: 100_000 }
        )
    );

    // set order hyperstructure count. 
    // we assume here that they have the same order
    let order_id = 0; // set in setup fn 

    set!(world, (Orders { order_id: order_id, hyperstructure_count: 1 }));

    set!(
        world,
        (
            LevelingConfig {
                config_id: REALM_LEVELING_CONFIG_ID,
                decay_interval: 604800,
                max_level: 1000,
                wheat_base_amount: 0,
                fish_base_amount: 0,
                resource_1_cost_id: 0,
                resource_1_cost_count: 0,
                resource_2_cost_id: 0,
                resource_2_cost_count: 0,
                resource_3_cost_id: 0,
                resource_3_cost_count: 0,
                decay_scaled: 1844674407370955161,
                cost_percentage_scaled: 4611686018427387904,
                base_multiplier: 25
            },
        )
    );
    starknet::testing::set_contract_address(caller_address);

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == taker_transport_id, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    ///// Check Maker Data ///////
    //////////////////////////////

    // check that maker resource chest is filled
    let maker_resource_chest_weight = get!(world, trade.maker_resource_chest_id, Weight);
    assert(maker_resource_chest_weight.value != 0, 'chest should be filled');

    // check maker resource chest is locked
    let maker_resource_chest = get!(world, trade.maker_resource_chest_id, ResourceChest);

    assert(maker_resource_chest.locked_until == 4353741, 'wrong chest locked_until');

    // check that the maker's resource chest was 
    // added their transport's inventory
    let maker_transport_inventory = get!(world, trade.maker_transport_id, Inventory);
    assert(maker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(maker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.maker_resource_chest_id, 'chest not in inventory');

    // check maker transport movable
    let maker_transport_movable = get!(world, trade.maker_transport_id, Movable);
    assert(maker_transport_movable.blocked == false, 'maker transport not blocked');

    let maker_position = get!(world, maker_id, Position);
    let taker_position = get!(world, taker_id, Position);

    assert(maker_transport_movable.intermediate_coord_x == taker_position.x, 'wrong position x');

    assert(maker_transport_movable.intermediate_coord_y == taker_position.y, 'wrong position y');

    assert(maker_transport_movable.round_trip == true, 'wrong position y');

    // check maker transport arrival time
    let maker_transport_arrival_time = get!(world, trade.maker_transport_id, ArrivalTime);

    assert(maker_transport_arrival_time.arrives_at == 4353741 * 2, 'wrong arrival time');

    // check maker transport position
    let maker_transport_position = get!(world, trade.maker_transport_id, Position);
    assert(maker_transport_position.x == maker_position.x, 'wrong maker position');
    assert(maker_transport_position.y == maker_position.y, 'wrong maker position');

    ///// Check Taker Data ///////
    //////////////////////////////

    // check that taker resource chest is filled
    let taker_resource_chest_weight = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value != 0, 'chest should be filled');

    // check taker resource chest is locked
    let taker_resource_chest = get!(world, trade.taker_resource_chest_id, ResourceChest);
    assert(taker_resource_chest.locked_until == 4353741, 'wrong chest locked_until');

    // check that the taker's resource chest was 
    // added their transport's inventory
    let taker_transport_inventory = get!(world, trade.taker_transport_id, Inventory);
    assert(taker_transport_inventory.items_count == 1, 'wrong item count');

    let inventory_resource_chest_key = inventory::get_foreign_key(taker_transport_inventory, 0);
    let foreign_key = get!(world, inventory_resource_chest_key, ForeignKey);
    assert(foreign_key.entity_id == trade.taker_resource_chest_id, 'chest not in inventory');

    // check taker transport movable
    let taker_transport_movable = get!(world, trade.taker_transport_id, Movable);
    assert(taker_transport_movable.blocked == false, 'taker transport not blocked');

    assert(taker_transport_movable.intermediate_coord_x == maker_position.x, 'wrong position x');

    assert(taker_transport_movable.intermediate_coord_y == maker_position.y, 'wrong position y');

    assert(taker_transport_movable.round_trip == true, 'wrong position y');

    // check taker transport arrival time
    let taker_transport_arrival_time = get!(world, trade.taker_transport_id, ArrivalTime);
    assert(taker_transport_arrival_time.arrives_at == 4353741 * 2, 'wrong arrival time');

    // check taker transport position
    let taker_transport_position = get!(world, trade.taker_transport_id, Position);
    assert(taker_transport_position.x == taker_position.x, 'wrong taker position');
    assert(taker_transport_position.y == taker_position.y, 'wrong taker position');
}

#[test]
#[available_gas(3000000000000)]
fn test_accept_order_with_road() {
    let (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(
        false
    );

    // create road from maker to taker
    let maker_coord: Coord = get!(world, maker_id, Position).into();
    let taker_coord: Coord = get!(world, taker_id, Position).into();
    set!(
        world,
        (Road {
            start_coord_x: maker_coord.x,
            start_coord_y: maker_coord.y,
            end_coord_x: taker_coord.x,
            end_coord_y: taker_coord.y,
            usage_count: 2
        })
    );

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == taker_transport_id, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    // check maker transport arrival time
    let maker_transport_arrival_time = get!(world, trade.maker_transport_id, ArrivalTime);
    assert(maker_transport_arrival_time.arrives_at == 8000000, 'wrong arrival time');

    // check taker transport arrival time
    let taker_transport_arrival_time = get!(world, trade.taker_transport_id, ArrivalTime);
    assert(taker_transport_arrival_time.arrives_at == 8000000, 'wrong arrival time');

    let road = get!(world, (maker_coord.x, maker_coord.y, taker_coord.x, taker_coord.y), Road);
    assert(road.usage_count == 0, 'wrong usage count');
}


#[test]
#[available_gas(3000000000000)]
fn test_emitted_order_accepted() {
    let (world, trade_id, maker_id, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(
        false
    );

    // accept order 
    trade_systems_dispatcher.accept_order(world, taker_id, taker_transport_id, trade_id);

    // check that taker balance is correct
    let taker_wood_resource = get!(world, (taker_id, ResourceTypes::WOOD), Resource);
    assert(taker_wood_resource.balance == 300, 'wrong taker balance');

    let taker_silver_resource = get!(world, (taker_id, ResourceTypes::SILVER), Resource);
    assert(taker_silver_resource.balance == 300, 'wrong taker balance');

    let trade = get!(world, trade_id, Trade);
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_transport_id == taker_transport_id, 'wrong taker transport id');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::ACCEPTED, 'wrong trade status');

    let order_accepted_hash = 0x20e86edfa14c93309aa6559742e993d42d48507f3bf654a12d77a54f10f8945;

    let mut found = false;
    loop {
        let mut event_option = pop_log_raw(world.contract_address);
        match event_option {
            Option::Some(val) => {
                let (mut keys, mut data) = val;

                let event_selector = *keys.at(0);

                if (event_selector != order_accepted_hash) {
                    continue;
                }

                found = true;

                let trade_id = (*keys.at(1));
                let maker_realm_entity_id = (*data.at(0));
                let maker_realm_id = (*data.at(1));

                let taker_realm_entity_id = (*data.at(2));
                let taker_realm_id = (*data.at(3));

                let maker_resources_len = (*data.at(4));
                let maker_0_type = (*data.at(5));
                let maker_0_amount = (*data.at(6));
                let maker_1_type = (*data.at(7));
                let maker_1_amount = (*data.at(8));

                let taker_resources_len = (*data.at(9));
                let taker_0_type = (*data.at(10));
                let taker_0_amount = (*data.at(11));
                let taker_1_type = (*data.at(12));
                let taker_1_amount = (*data.at(13));

                let timestamp = (*data.at(14));

                assert(maker_realm_entity_id == maker_id.into(), 'wrong maker_id');
                assert(maker_realm_id == 1, 'wrong maker_realm_id');

                assert(taker_realm_entity_id == taker_id.into(), 'wrong taker_id');
                assert(taker_realm_id == 1, 'wrong taker_realm_id');

                assert(maker_resources_len == 2, 'wrong maker resources len');
                assert(maker_0_type == (ResourceTypes::STONE).into(), 'wrong maker 0 type');
                assert(maker_0_amount == 100, 'wrong maker 0 amount');
                assert(maker_1_type == (ResourceTypes::GOLD).into(), 'wrong maker 1 type');
                assert(maker_1_amount == 100, 'wrong maker 1 amount');

                assert(taker_resources_len == 2, 'wrong taker resources len');
                assert(taker_0_type == (ResourceTypes::WOOD).into(), 'wrong taker 0 type');
                assert(taker_0_amount == 200, 'wrong taker 0 type');
                assert(taker_1_type == (ResourceTypes::SILVER).into(), 'wrong taker 1 type');
                assert(taker_1_amount == 200, 'wrong taker 1 amount');

                assert(timestamp == 0, 'wrong timestamp');
                break;
            },
            Option::None => {
                break;
            },
        }
    };
    assert(found == true, 'OrderAccepted not found');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not the taker', 'ENTRYPOINT_FAILED'))]
fn test_not_trade_taker_id() {
    let (world, trade_id, _, _, taker_transport_id, trade_systems_dispatcher) = setup(true);

    // the setup states the trade is a direct offer
    // so here we are checking to see that the person 
    // who wants to accept is the intended recepient

    let taker_id = 9999; // set arbitrarily
    set!(
        world,
        (Owner { entity_id: taker_id, address: contract_address_const::<'takers_other_realm'>() })
    );

    // create order with a caller that isnt the owner of maker_id
    starknet::testing::set_contract_address(contract_address_const::<'takers_other_realm'>());

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not owned by caller', 'ENTRYPOINT_FAILED'))]
fn test_caller_not_taker() {
    let (_, trade_id, _, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(true);

    // create order with a caller that isnt the owner of taker_id
    starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not caravan owner', 'ENTRYPOINT_FAILED'))]
fn test_caller_not_owner_of_transport_id() {
    let (_, trade_id, _, taker_id, _, trade_systems_dispatcher) = setup(true);

    let taker_transport_id = 9999; // set arbitrarily

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('mismatched positions', 'ENTRYPOINT_FAILED'))]
fn test_different_transport_position() {
    let (world, trade_id, _, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(true);

    // set an arbitrary position

    set!(world, Position { entity_id: taker_id, x: 999, y: 999 });

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('transport has not arrived', 'ENTRYPOINT_FAILED'))]
fn test_transport_in_transit() {
    let (world, trade_id, _, taker_id, taker_transport_id, trade_systems_dispatcher) = setup(true);

    // set arrival time to some time in future

    set!(
        world,
        ArrivalTime {
            entity_id: taker_transport_id, arrives_at: starknet::get_block_timestamp() + 40
        }
    );

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());
    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not enough capacity', 'ENTRYPOINT_FAILED'))]
fn test_transport_not_enough_capacity() {
    let (world, trade_id, _, taker_id, _, trade_systems_dispatcher) = setup(true);

    //          note
    // all previous tests passed because they didn't have 
    // free transport capacity set and when the value is 0, 
    // capacity is unlimited

    // set capacity for transport to a very low amount
    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    ICapacityConfigDispatcher { contract_address: config_systems_address }
        .set_capacity_config(DONKEY_ENTITY_TYPE, 1);

    // create two free transport unit for taker realm
    let transport_unit_systems_address = deploy_system(
        world, transport_unit_systems::TEST_CLASS_HASH
    );
    let transport_unit_systems_dispatcher = ITransportUnitSystemsDispatcher {
        contract_address: transport_unit_systems_address
    };
    let taker_first_free_transport_unit_id = transport_unit_systems_dispatcher
        .create_free_unit(taker_id, 10);
    let taker_second_free_transport_unit_id = transport_unit_systems_dispatcher
        .create_free_unit(taker_id, 10);

    let taker_transport_units: Array<u128> = array![
        taker_first_free_transport_unit_id, taker_second_free_transport_unit_id
    ];

    // create taker caravan

    starknet::testing::set_contract_address(contract_address_const::<'taker'>());
    let caravan_systems_address = deploy_system(world, caravan_systems::TEST_CLASS_HASH);
    let caravan_systems_dispatcher = ICaravanSystemsDispatcher {
        contract_address: caravan_systems_address
    };

    let taker_transport_id = caravan_systems_dispatcher.create(taker_transport_units);

    // accept order 
    trade_systems_dispatcher.accept_order(taker_id, taker_transport_id, trade_id);
}
