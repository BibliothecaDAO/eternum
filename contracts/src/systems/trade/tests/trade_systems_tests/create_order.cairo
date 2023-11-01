use eternum::models::resources::{Resource, ResourceChest};
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::weight::Weight;
use eternum::models::movable::{Movable, ArrivalTime};

use eternum::models::trade::{Trade, Status, TradeStatus};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{
        ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
    },
};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
    ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait,
};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};


use eternum::systems::transport::contracts::{
    transport_unit_systems::transport_unit_systems, 
    caravan_systems::caravan_systems
};

use eternum::systems::transport::interface::{
    caravan_systems_interface::{
        ICaravanSystemsDispatcher,ICaravanSystemsDispatcherTrait
    },
    transport_unit_systems_interface::{
        ITransportUnitSystemsDispatcher,ITransportUnitSystemsDispatcherTrait
    },
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};




fn setup() -> (IWorldDispatcher, u128, u128, u128, ITradeSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set travel configuration
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_travel_config(world, 10); // 5 free transport per city

    // set weight configuration for stone
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::STONE.into(), 200); 

    // set weight configuration for gold
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::GOLD.into(), 200); 


    // create maker's realm
    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let position = Position { x: 20, y: 30, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    let realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, position.clone(),
    );


    starknet::testing::set_contract_address(world.executor());

    let maker_id = realm_entity_id;
    let taker_id = 12_u128;
    
    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>()}));

    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::STONE, balance: 100 }));
    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::GOLD, balance: 100 }));

    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::STONE, balance: 500 }));
    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::GOLD, balance: 500 }));
    

    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );

    // create two free transport unit for the realm
    let transport_unit_systems_address 
        = deploy_system(transport_unit_systems::TEST_CLASS_HASH);
    let transport_unit_systems_dispatcher = ITransportUnitSystemsDispatcher {
        contract_address: transport_unit_systems_address
    };
    let first_free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, maker_id, 10
        );
    let second_free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, maker_id, 10
        );
    let transport_units: Array<u128> = array![
        first_free_transport_unit_id,
        second_free_transport_unit_id
    ];


    // create maker caravan
    let caravan_systems_address 
        = deploy_system(caravan_systems::TEST_CLASS_HASH);
    let caravan_systems_dispatcher = ICaravanSystemsDispatcher {
        contract_address: caravan_systems_address
    };
    let maker_transport_id 
        = caravan_systems_dispatcher.create(world, transport_units);



    let trade_systems_address 
        = deploy_system(trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher {
        contract_address: trade_systems_address
    };

    (world, maker_id, maker_transport_id, taker_id,trade_systems_dispatcher)
}




#[test]
#[available_gas(3000000000000)]
fn test_create_order() {

    let (world, maker_id, maker_transport_id, taker_id,trade_systems_dispatcher) 
        = setup();

    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![200, 200].span(),
            100
    );

    // check maker balances
    let maker_stone_resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
    assert(maker_stone_resource.balance == 0, 'Balance should be 0');

    let maker_gold_resource = get!(world, (maker_id, ResourceTypes::GOLD), Resource);
    assert(maker_gold_resource.balance == 0, 'Balance should be 0');

    // check that taker balance is unmodified
    let taker_stone_resource = get!(world, (taker_id, ResourceTypes::STONE), Resource);
    assert(taker_stone_resource.balance == 500, 'Balance should be 500');

    let taker_gold_resource = get!(world, (taker_id, ResourceTypes::GOLD), Resource);
    assert(taker_gold_resource.balance == 500, 'Balance should be 500');


    let trade = get!(world, trade_id, Trade);
    assert(trade.maker_id == maker_id, 'wrong maker id');
    assert(trade.maker_resource_chest_id != 0, 'wrong maker chest id');
    assert(trade.maker_transport_id != 0, 'wrong maker transport id');
    assert(trade.taker_id == taker_id, 'wrong taker id');
    assert(trade.taker_resource_chest_id != 0, 'wrong taker chest id');
    assert(trade.taker_transport_id == 0, 'wrong taker transport id');
    assert(trade.expires_at == 100, 'expires at is wrong');

    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::OPEN,'wrong trade status');

    // check that maker transport is blocked
    let caravan_movable = get!(world, maker_transport_id, Movable);
    assert(caravan_movable.blocked, 'maker transport not blocked');

    // check maker resource chest resource count
    let maker_resource_chest 
        = get!(world, trade.maker_resource_chest_id, ResourceChest);
    assert(maker_resource_chest.resources_count == 2, 'wrong resource count');


    // check that maker resource chest is empty
    let maker_resource_chest_weight
        = get!(world, trade.maker_resource_chest_id, Weight);
    assert(maker_resource_chest_weight.value == 0, 'chest should be empty');
    
    
    // check taker resource chest resource count
    let taker_resource_chest 
        = get!(world, trade.taker_resource_chest_id, ResourceChest);
    assert(taker_resource_chest.resources_count == 2, 'wrong resource count');


    // check that taker resource chest is filled
    let taker_resource_chest_weight
        = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value != 0, 'chest should be filled');

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('caller not maker', 'ENTRYPOINT_FAILED' ))]
fn test_caller_not_maker() {
    let (world, maker_id, maker_transport_id, taker_id,trade_systems_dispatcher) 
        = setup();

    // create order with a caller that isnt the owner of maker_id
    starknet::testing::set_contract_address(
        contract_address_const::<'some_unknown'>()
    );
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![200, 200].span(),
            100
    );
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not caravan owner', 'ENTRYPOINT_FAILED' ))]
fn test_caller_not_owner_of_transport_id() {
    let (world, maker_id, maker_transport_id, taker_id,trade_systems_dispatcher) 
        = setup();
    
    let maker_transport_id = 99999; // set some arbitray value

    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![200, 200].span(),
            100
    );
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('mismatched positions', 'ENTRYPOINT_FAILED' ))]
fn test_different_transport_position() {
    let (world, maker_id, maker_transport_id, taker_id,trade_systems_dispatcher) 
        = setup();

    // set an arbitrary position
    starknet::testing::set_contract_address(world.executor());
    set!(world, Position {
        entity_id: maker_id,
        x: 999,
        y: 999
    });

    
    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![200, 200].span(),
            100
    );
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('transport has not arrived', 'ENTRYPOINT_FAILED' ))]
fn test_transport_in_transit() {
    let (world, maker_id, maker_transport_id, taker_id, trade_systems_dispatcher) 
        = setup();

    // set arrival time to some time in future
    starknet::testing::set_contract_address(world.executor());
    set!(world, ArrivalTime {
        entity_id: maker_transport_id,
        arrives_at: starknet::get_block_timestamp() + 40
    });

    
    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![200, 200].span(),
            100
    );
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not enough capacity', 'ENTRYPOINT_FAILED' ))]
fn test_transport_not_enough_capacity() {

    let (world, maker_id, _, taker_id, trade_systems_dispatcher) 
        = setup();


    //          note
    // all previous tests passed because they didn't have 
    // free transport capacity set and when the value is 0, 
    // capacity is unlimited


    // set capacity for transport to a very low amount
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH); 
    ICapacityConfigDispatcher {
        contract_address: config_systems_address
    }.set_capacity_config(world, FREE_TRANSPORT_ENTITY_TYPE, 1); 

    // create two free transport unit for maker realm
    let transport_unit_systems_address 
        = deploy_system(transport_unit_systems::TEST_CLASS_HASH);
    let transport_unit_systems_dispatcher = ITransportUnitSystemsDispatcher {
        contract_address: transport_unit_systems_address
    };
    let maker_first_free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, maker_id, 10
        );
    let maker_second_free_transport_unit_id 
        = transport_unit_systems_dispatcher.create_free_unit(
            world, maker_id, 10
        );

    let maker_transport_units: Array<u128> = array![
        maker_first_free_transport_unit_id,
        maker_second_free_transport_unit_id
    ];

    // create maker caravan

    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );
    let caravan_systems_address 
        = deploy_system(caravan_systems::TEST_CLASS_HASH);
    let caravan_systems_dispatcher = ICaravanSystemsDispatcher {
        contract_address: caravan_systems_address
    };

    let maker_transport_id 
        = caravan_systems_dispatcher.create(world, maker_transport_units);

    
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![200, 200].span(),
            100
    );
}