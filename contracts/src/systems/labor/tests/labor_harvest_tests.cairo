use eternum::alias::ID;
use eternum::constants::ResourceTypes;
use eternum::models::resources::Resource;
use eternum::models::labor::Labor;
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::level::Level;
use eternum::models::position::Position;
use eternum::models::realm::Realm;
use eternum::models::config::LevelingConfig;

use eternum::constants::{
    REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_CONFIG_ID
};
use eternum::constants::LevelIndex;


use eternum::systems::labor::utils::get_labor_resource_type;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{
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



#[test]
#[available_gas(3000000000)]
fn test_harvest_labor_non_food() {

    let world = spawn_eternum();

    // set labor configuration entity
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    let base_labor_units = 7200;
    let base_resources_per_cycle = 250;
    let base_food_per_cycle = 21_000_000_000_000_000_000;
    labor_config_dispatcher.set_labor_config(
        world,
        base_labor_units,
        base_resources_per_cycle,
        base_food_per_cycle
    );


    // set realm entity
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        0x209, // resource_types_packed // 2,9 // stone and gold
        2, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        0, // order
        9, // order hyperstructure id
        Position { x: 1, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone

    );


    let labor_systems_address 
        = deploy_system(labor_systems::TEST_CLASS_HASH);
    let labor_systems_dispatcher = ILaborSystemsDispatcher {
        contract_address: labor_systems_address
    };


    let player_address = starknet::get_caller_address();
    let resource_type = ResourceTypes::GOLD;
    // set initial block timestamp
    let last_harvest_ts = 1000;
    starknet::testing::set_block_timestamp(last_harvest_ts);

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
    

    // update block timestamp to harvest labor
    let current_harvest_ts = 40_000;
    starknet::testing::set_block_timestamp(current_harvest_ts);


    // harvest labor for gold
    labor_systems_dispatcher.harvest(
        world,
        realm_entity_id,
        resource_type
    );


    let (gold_labor_after_harvest, gold_resource_after_harvest) = get!(
        world, (realm_entity_id, resource_type), (Labor, Resource)
    );
    // get labor after harvest = current labor balance + remainder from division by 7200
    assert(gold_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
    assert(gold_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

    let last_harvest_ts: u128 = last_harvest_ts.into();
    let current_harvest_ts: u128 = current_harvest_ts.into();
    let labor_per_unit: u128 = base_labor_units.into();
    let base_resources_per_cycle: u128 = base_resources_per_cycle.into();

    let generated_labor = current_harvest_ts
        - last_harvest_ts; // because current_harvest_ts < balance
    let mut generated_units = generated_labor / labor_per_unit;
    let generated_resources = generated_units * base_resources_per_cycle;

    // verify resource is right amount
    assert(
        gold_resource_after_harvest.balance == generated_resources, 'failed resource amount'
    );
}



#[test]
#[available_gas(3000000000)]
fn test_harvest_labor_plus_realm_and_hyperstructure_bonus_for_non_food() {

    let world = spawn_eternum();

    // set labor configuration entity
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    let base_labor_units = 7200;
    let base_resources_per_cycle = 250;
    let base_food_per_cycle = 21_000_000_000_000_000_000;
    labor_config_dispatcher.set_labor_config(
        world,
        base_labor_units,
        base_resources_per_cycle,
        base_food_per_cycle
    );


    // set realm entity
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        0x209, // resource_types_packed // 2,9 // stone and gold
        2, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        0, // order
        9, // order hyperstructure id
        Position { x: 1, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone
            
    );


    let labor_systems_address 
        = deploy_system(labor_systems::TEST_CLASS_HASH);
    let labor_systems_dispatcher = ILaborSystemsDispatcher {
        contract_address: labor_systems_address
    };


    let player_address = starknet::get_caller_address();
    let resource_type = ResourceTypes::GOLD;
    // set initial block timestamp
    let last_harvest_ts = 1000;
    starknet::testing::set_block_timestamp(last_harvest_ts);

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

    let hyperstructure_id 
        = get!(world, realm_entity_id, Realm).order_hyperstructure_id;

    set!(world, (
        Level {
            entity_id: realm_entity_id,
            level: LevelIndex::RESOURCE.into() + 4,
            valid_until: 10000000000000000000,
        },
        LevelingConfig {
            config_id: REALM_LEVELING_CONFIG_ID,
            decay_interval: 0,
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
            cost_percentage_scaled: 0,
            base_multiplier: 25
        },
        HyperStructure { 
            entity_id: hyperstructure_id,
            hyperstructure_type: 0,
            controlling_order: 0,
            completed: false,
            completion_cost_id: 0,
            completion_resource_count: 0
        },
        Level {
            entity_id: hyperstructure_id,
            level: LevelIndex::RESOURCE.into(),
            valid_until: 10000000000000000000,
        },
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
            decay_interval: 0,
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
            cost_percentage_scaled: 0,
            base_multiplier: 25
        },

    ));
    starknet::testing::set_contract_address(player_address);

    // build labor for gold
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        1, // multiplier
    );
    

    // update block timestamp to harvest labor
    let current_harvest_ts = 40_000;
    starknet::testing::set_block_timestamp(current_harvest_ts);


    // harvest labor for gold
    labor_systems_dispatcher.harvest(
        world,
        realm_entity_id,
        resource_type
    );


    let (gold_labor_after_harvest, gold_resource_after_harvest) = get!(
        world, (realm_entity_id, resource_type), (Labor, Resource)
    );
    // get labor after harvest = current labor balance + remainder from division by 7200
    assert(gold_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
    assert(gold_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

    let last_harvest_ts: u128 = last_harvest_ts.into();
    let current_harvest_ts: u128 = current_harvest_ts.into();
    let labor_per_unit: u128 = base_labor_units.into();
    let base_resources_per_cycle: u128 = base_resources_per_cycle.into();

    let generated_labor = current_harvest_ts
        - last_harvest_ts; // because current_harvest_ts < balance
    let mut generated_units = generated_labor / labor_per_unit;
    let realm_bonus = 125; 
    let hyperstructure_bonus = 125;
    let generated_resources = generated_units * base_resources_per_cycle * realm_bonus * hyperstructure_bonus / 10000;

    // verify resource is right amount
    assert(
        gold_resource_after_harvest.balance == generated_resources, 'failed resource amount'
    );
}


#[test]
#[available_gas(3000000000)]
fn test_harvest_labor_food() {
    let world = spawn_eternum();


    // set labor configuration entity
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    let base_labor_units = 7200;
    let base_resources_per_cycle = 250;
    let base_food_per_cycle = 21_000_000_000_000_000_000;
    labor_config_dispatcher.set_labor_config(
        world,
        base_labor_units,
        base_resources_per_cycle,
        base_food_per_cycle
    );


    // set realm entity
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        0x1, // resource_types_packed // 1 // wheat
        1, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        0, // order
        9, // order hyperstructure id

        Position { x: 1, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone

    );


    let labor_systems_address 
        = deploy_system(labor_systems::TEST_CLASS_HASH);
    let labor_systems_dispatcher = ILaborSystemsDispatcher {
        contract_address: labor_systems_address
    };


    let player_address = starknet::get_caller_address();
    let resource_type = ResourceTypes::WHEAT;

    // set initial block timestamp
    let last_harvest_ts = 1000;
    starknet::testing::set_block_timestamp(last_harvest_ts);

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

    // build labor for wheat
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        1, // multiplier
    );

    // update block timestamp to harvest labor
    let current_harvest_ts = 40_000;
    starknet::testing::set_block_timestamp(current_harvest_ts);

    // harvest labor for wheat
    labor_systems_dispatcher.harvest(
        world,
        realm_entity_id,
        resource_type
    );


    let (wheat_labor_after_harvest, wheat_resource_after_harvest) = get!(
        world, (realm_entity_id, resource_type), (Labor, Resource)
    );
    // get labor after harvest = current labor balance + remainder from division by 7200
    assert(wheat_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
    assert(wheat_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

    let last_harvest_ts: u128 = last_harvest_ts.into();
    let current_harvest_ts: u128 = current_harvest_ts.into();
    let labor_per_unit: u128 = base_labor_units.into();
    let base_food_per_cycle: u128 = base_food_per_cycle.into();

    let generated_labor = current_harvest_ts
        - last_harvest_ts; // because current_harvest_ts < balance
    let mut generated_units = generated_labor / labor_per_unit;
    let generated_resources = generated_units * base_food_per_cycle;

    // verify resource is right amount
    assert(
        wheat_resource_after_harvest.balance == generated_resources, 'failed resource amount'
    );
}





#[test]
#[available_gas(3000000000)]
fn test_harvest_labor_plus_realm_and_hyperstructure_bonus_for_food() {

    let world = spawn_eternum();

    // set labor configuration entity
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    let base_labor_units = 7200;
    let base_resources_per_cycle = 250;
    let base_food_per_cycle = 21_000_000_000_000_000_000;
    labor_config_dispatcher.set_labor_config(
        world,
        base_labor_units,
        base_resources_per_cycle,
        base_food_per_cycle
    );


    // set realm entity
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        0x209, // resource_types_packed // 2,9 // stone and gold
        2, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        0, // order
        9, // order hyperstructure id
        Position { x: 1, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone

    );


    let labor_systems_address 
        = deploy_system(labor_systems::TEST_CLASS_HASH);
    let labor_systems_dispatcher = ILaborSystemsDispatcher {
        contract_address: labor_systems_address
    };


    let player_address = starknet::get_caller_address();
    let resource_type = ResourceTypes::WHEAT;
    // set initial block timestamp
    let last_harvest_ts = 1000;
    starknet::testing::set_block_timestamp(last_harvest_ts);

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

    let order_hyperstructure_id = get!(world, realm_entity_id, Realm).order_hyperstructure_id;

    set!(world, (
        Level {
            entity_id: realm_entity_id,
            level: LevelIndex::FOOD.into() + 4,
            valid_until: 10000000000000000000,
        },
        LevelingConfig {
            config_id: REALM_LEVELING_CONFIG_ID,
            decay_interval: 0,
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
            cost_percentage_scaled: 0,
            base_multiplier: 25
        },
        HyperStructure { 
            entity_id: order_hyperstructure_id,
            hyperstructure_type: 0,
            controlling_order: 0,
            completed: false,
            completion_cost_id: 0,
            completion_resource_count: 0
        },
        Level {
            entity_id: order_hyperstructure_id,
            level: LevelIndex::FOOD.into(),
            valid_until: 10000000000000000000,
        },
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
            decay_interval: 0,
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
            cost_percentage_scaled: 0,
            base_multiplier: 25
        },

    ));
    starknet::testing::set_contract_address(player_address);

    // build labor for wheat
    labor_systems_dispatcher.build(
        world,
        realm_entity_id,
        resource_type,
        20, // labor_units
        1, // multiplier
    );

    // update block timestamp to harvest labor
    let current_harvest_ts = 40_000;
    starknet::testing::set_block_timestamp(current_harvest_ts);

    // harvest labor for wheat
    labor_systems_dispatcher.harvest(
        world,
        realm_entity_id,
        resource_type
    );


    let (wheat_labor_after_harvest, wheat_resource_after_harvest) = get!(
        world, (realm_entity_id, resource_type), (Labor, Resource)
    );
    // get labor after harvest = current labor balance + remainder from division by 7200
    assert(wheat_labor_after_harvest.balance == 145000 + 3000, 'wrong labor balance');
    assert(wheat_labor_after_harvest.last_harvest == current_harvest_ts, 'wrong last harvest');

    let last_harvest_ts: u128 = last_harvest_ts.into();
    let current_harvest_ts: u128 = current_harvest_ts.into();
    let labor_per_unit: u128 = base_labor_units.into();
    let base_food_per_cycle: u128 = base_food_per_cycle.into();

    let generated_labor = current_harvest_ts
        - last_harvest_ts; // because current_harvest_ts < balance
    let mut generated_units = generated_labor / labor_per_unit;
    let realm_bonus = 125; 
    let hyperstructure_bonus = 125;
    let generated_resources = generated_units * base_food_per_cycle * realm_bonus * hyperstructure_bonus / 10000;
    
    // verify resource is right amount
    assert(
        wheat_resource_after_harvest.balance == generated_resources, 'failed resource amount'
    );
}

