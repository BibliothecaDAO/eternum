use eternum::models::resources::{Resource, ResourceChest};
use eternum::models::owner::Owner;
use eternum::models::position::{Position};
use eternum::models::weight::Weight;
use eternum::models::movable::{Movable, ArrivalTime};

use eternum::models::trade::{Trade, Status, TradeStatus};

use eternum::systems::trade::contracts::trade_systems::trade_systems;
use eternum::systems::trade::interface::{
    trade_systems_interface::{
        ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait
    },
};
use eternum::systems::resources::contracts::resource_systems::{
    InternalInventorySystemsImpl as inventory
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
use core::traits::Into;



fn setup() -> (IWorldDispatcher, u128, u128, u128, ITradeSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set travel configuration
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_travel_config(world, 10); // 10 free transport per city


    // set speed configuration 
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_speed_config(world, FREE_TRANSPORT_ENTITY_TYPE, 10); // 10km per sec


    // set weight configuration for stone
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::STONE.into(), 200); 
    

    // set weight configuration for gold
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::GOLD.into(), 200); 

    // set weight configuration for wood
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::WOOD.into(), 200); 

    // set weight configuration for silver
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(world, ResourceTypes::SILVER.into(), 200); 




    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // maker and taker are at the same location
    // so they can trade without transport
    let maker_position = Position { x: 100000, y: 1000000, entity_id: 1_u128};
    let taker_position = Position { x: 100000, y: 1000000, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    // create maker's realm
    let maker_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, maker_position.clone(),
    );
    // create taker's realm
    let taker_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, taker_position.clone(),
    );


    starknet::testing::set_contract_address(world.executor());

    let maker_id = maker_realm_entity_id;
    let taker_id = taker_realm_entity_id;
    
    set!(world, (Owner { entity_id: maker_id, address: contract_address_const::<'maker'>()}));
    set!(world, (Owner { entity_id: taker_id, address: contract_address_const::<'taker'>()}));

    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::STONE, balance: 100 }));
    set!(world, (Resource { entity_id: maker_id, resource_type: ResourceTypes::GOLD, balance: 100 }));

    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::WOOD, balance: 500 }));
    set!(world, (Resource { entity_id: taker_id, resource_type: ResourceTypes::SILVER, balance: 500 }));
    

    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );

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
    let caravan_systems_address 
        = deploy_system(caravan_systems::TEST_CLASS_HASH);
    let caravan_systems_dispatcher = ICaravanSystemsDispatcher {
        contract_address: caravan_systems_address
    };
    let maker_transport_id 
        = caravan_systems_dispatcher.create(world, maker_transport_units);



    let trade_systems_address 
        = deploy_system(trade_systems::TEST_CLASS_HASH);
    let trade_systems_dispatcher = ITradeSystemsDispatcher {
        contract_address: trade_systems_address
    };
    
    // create order
    starknet::testing::set_contract_address(contract_address_const::<'maker'>());

    // trade 100 stone and 100 gold for 200 wood and 200 silver
    let trade_id = trade_systems_dispatcher.create_order(
            world,
            maker_id,
            array![ResourceTypes::STONE, ResourceTypes::GOLD].span(),
            array![100, 100].span(),
            maker_transport_id,
            taker_id,
            array![ResourceTypes::WOOD, ResourceTypes::SILVER].span(),
            array![200, 200].span(),
            100
    );

    (world, trade_id, maker_id, taker_id, trade_systems_dispatcher)
}





#[test]
#[available_gas(3000000000000)]
fn test_cancel() {

    let (world, trade_id, maker_id, taker_id, trade_systems_dispatcher) 
        = setup();


    // cancel order 
    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );
    trade_systems_dispatcher
        .cancel_order(world, trade_id);

    let trade = get!(world, trade_id, Trade);

    // check that items the maker added to the taker's chest 
    // have been returned to the maker
    let taker_resource_chest_weight
        = get!(world, trade.taker_resource_chest_id, Weight);
    assert(taker_resource_chest_weight.value == 0, 'chest should be empty');

    // check that maker balance is correct
    let maker_stone_resource = get!(world, (maker_id, ResourceTypes::STONE), Resource);
    assert(maker_stone_resource.balance == 100, 'wrong maker balance');

    let maker_gold_resource = get!(world, (maker_id, ResourceTypes::GOLD), Resource);
    assert(maker_gold_resource.balance == 100, 'wrong maker balance');
    
    // check that transport is unblocked
    let transport_movable = get!(world, trade.maker_transport_id, Movable);
    assert(transport_movable.blocked == false,'wrong movable value');

    // check that trade status is cancelled
    let trade_status = get!(world, trade_id, Status);
    assert(trade_status.value == TradeStatus::CANCELLED,'wrong trade status');
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('trade must be open', 'ENTRYPOINT_FAILED' ))]
fn test_cancel_after_acceptance() {

    let (world, trade_id, maker_id, taker_id, trade_systems_dispatcher) 
        = setup();

    // accept order 
    starknet::testing::set_contract_address(
        contract_address_const::<'taker'>()
    );
    trade_systems_dispatcher
        .accept_order(world, taker_id, 0, trade_id);

    // cancel order 
    starknet::testing::set_contract_address(
        contract_address_const::<'maker'>()
    );
    trade_systems_dispatcher
        .cancel_order(world, trade_id);

}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('caller must be trade maker', 'ENTRYPOINT_FAILED' ))]
fn test_cancel_caller_not_maker() {

    let (world, trade_id, maker_id, taker_id, trade_systems_dispatcher) 
        = setup();

    // set caller to an unknown address
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // cancel order 
    trade_systems_dispatcher
        .cancel_order(world, trade_id);

}
