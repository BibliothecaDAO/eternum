use eternum::alias::ID;
use eternum::constants::ResourceTypes;
use eternum::models::resources::Resource;
use eternum::models::labor::Labor;
use eternum::models::position::Position;
use eternum::systems::labor::utils::get_labor_resource_type;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ILaborConfigDispatcher,
    ILaborConfigDispatcherTrait,
};

use eternum::systems::labor::contracts::labor_systems;
use eternum::systems::labor::interface::{
    ILaborSystemsDispatcher,
    ILaborSystemsDispatcherTrait,
};


fn setup() -> (IWorldDispatcher, ID, ILaborSystemsDispatcher) {
    let world = spawn_eternum();

    // set labor configuration entity
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    labor_config_dispatcher.set_labor_config(
        world,
        7200, // base_labor_units
        250, // base_resources_per_cycle
        21_000_000_000_000_000_000, // base_food_per_cycle
    );


    // set realm entity
    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        starknet::get_contract_address(), // owner
        0x20309, // resource_types_packed // 2,3,9 // stone, coal, gold
        3, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        1, // order
        Position { x: 500200, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone
    );


    let labor_systems_address 
        = deploy_system(labor_systems::TEST_CLASS_HASH);
    let labor_systems_dispatcher = ILaborSystemsDispatcher {
        contract_address: labor_systems_address
    };
    
    (world, realm_entity_id, labor_systems_dispatcher)
}




#[test]
#[available_gas(300000000000)]
fn test_build_labor_non_food() {
    let (world, realm_entity_id, labor_systems_dispatcher) = setup();

    let player_address = starknet::get_contract_address();

    let resource_type = ResourceTypes::GOLD;

    // set block timestamp in order to harvest labor
    // initial ts = 0
    let ts = 10_000;
    starknet::testing::set_block_timestamp(ts);

    let labor_resource_type = get_labor_resource_type(resource_type);

    // switch to executor to set storage directly
    starknet::testing::set_contract_address(world.executor());
    set!(
        world,
        Resource {
            entity_id: realm_entity_id,
            resource_type: labor_resource_type,
            balance: 40
        }
    );
    starknet::testing::set_contract_address(player_address);

    // build labor for gold
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        1, // multiplier
    );


    // assert labor is right amount
    let gold_labor = get!(world, (realm_entity_id, resource_type), Labor);
    assert(gold_labor.balance == ts + (7_200 * 20), 'wrong gold labor balance');
    assert(gold_labor.last_harvest == ts, 'wrong gold labor last harvest');
    assert(gold_labor.multiplier == 1, 'wrong gold multiplier');

    let gold_resource_type = get!(world, (realm_entity_id, labor_resource_type), Resource);
    assert(gold_resource_type.balance == 20, 'wrong labor resource');
}


#[test]
#[available_gas(300000000000)]
fn test_build_labor_food() {
    let (world, realm_entity_id, labor_systems_dispatcher) = setup();

    let caller_address = starknet::get_contract_address();
    let resource_type = ResourceTypes::WHEAT;

    // set block timestamp in order to harvest labor
    // initial ts = 0
    let ts = 10_000;
    starknet::testing::set_block_timestamp(ts);

    let labor_resource_type = get_labor_resource_type(resource_type);

    // switch to executor to set storage directly
    starknet::testing::set_contract_address(world.executor());
    set!(
        world,
        Resource {
            entity_id: realm_entity_id,
            resource_type: labor_resource_type,
            balance: 100
        }
    );
    starknet::testing::set_contract_address(caller_address);

    // build labor for wheat
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        1, // multiplier
    );

    // assert labor is right amount
    let wheat_labor = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Labor);

    assert(wheat_labor.balance == ts + (7_200 * 20), 'wrong wheat labor balance');
    assert(wheat_labor.last_harvest == ts, 'wrong wheat labor last harvest');
    assert(wheat_labor.multiplier == 1, 'wrong wheat multiplier');

    let labor_resource = get!(world, (realm_entity_id, labor_resource_type), Resource);

    assert(labor_resource.balance == 80, 'wrong labor resource');

    //------------------------------------------
    //
    // Test harvest when multiplier is different
    //
    //------------------------------------------

    // set block timestamp in order to harvest labor
    starknet::testing::set_block_timestamp(20_000);

    // build labor again but with different multiplier
    // call build labor system
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        2, // multiplier
    );

    let labor_resource = get!(world, (realm_entity_id, labor_resource_type), Resource);
    assert(labor_resource.balance == 40, 'wrong labor resource');

    // check food
    let (wheat_resource, wheat_labor) = get!(
        world, (realm_entity_id, ResourceTypes::WHEAT), (Resource, Labor)
    );
    assert(wheat_resource.resource_type == ResourceTypes::WHEAT, 'failed resource type');
    // left to harvest = 134_000 / 4 = 33_500
    assert(
        wheat_resource.balance == ((10000_u128 + 33500_u128) / 7200_u128)
            * 21000000000000000000_u128,
        'failed wheat resource amount'
    );

    // timestamp + labor_per_unit * labor_units
    // 154000 is previous balance
    // 7200 * 20 is added balance
    // 154000 - 20000 is unharvested balance
    assert(
        wheat_labor.balance == 154000 + 7200 * 20 - (154000 - 20000),
        'wrong wheat labor balance'
    );
    assert(wheat_labor.last_harvest == 20_000, 'wrong wheat labor last harvest');
    assert(wheat_labor.multiplier == 2, 'wrong wheat multiplier');
}


#[test]
#[available_gas(300000000000)]
fn test_build_labor_after_completed() {
    let (world, realm_entity_id, labor_systems_dispatcher) = setup();

    let caller_address = starknet::get_contract_address();

    let resource_type = ResourceTypes::GOLD;

    // set block timestamp in order to harvest labor
    // initial ts = 0
    let ts = 10_000;
    starknet::testing::set_block_timestamp(ts);

    let labor_resource_type = get_labor_resource_type(resource_type);

    // switch to executor to set storage directly
    starknet::testing::set_contract_address(world.executor());
    set!(
        world,
        Resource {
            entity_id: realm_entity_id,
            resource_type: labor_resource_type,
            balance: 40
        }
    );
    
    set!(
        world,
        Labor {
            entity_id: realm_entity_id,
            resource_type,
            balance: 9_000,
            last_harvest: 1_000,
            multiplier: 1,
        }
    );
    starknet::testing::set_contract_address(caller_address);

    // build labor for gold
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        1, // multiplier
    );


    // // assert labor is right amount
    let gold_labor = get!(world, (realm_entity_id, resource_type), Labor);
    assert(gold_labor.balance == ts + (7_200 * 20), 'wrong gold labor balance');
    assert(gold_labor.last_harvest == 2_000, 'wrong gold labor last harvest');
    assert(gold_labor.multiplier == 1, 'wrong gold multiplier');

    let gold_resource_type = get!(world, (realm_entity_id, labor_resource_type), Resource);
    assert(gold_resource_type.balance == 20, 'wrong labor resource');
}

