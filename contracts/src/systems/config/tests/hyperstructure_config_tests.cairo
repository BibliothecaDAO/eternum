use eternum::models::hyperstructure::HyperStructure;
use eternum::models::resources::ResourceCost;
use eternum::models::position::{Position, Coord};
use eternum::models::config::LevelingConfig;

use eternum::systems::config::interface::{
    IHyperstructureConfigDispatcher, 
    IHyperstructureConfigDispatcherTrait,
    ILevelingConfigDispatcher,
    ILevelingConfigDispatcherTrait,
};
use eternum::systems::config::contracts::config_systems;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::HYPERSTRUCTURE_LEVELING_CONFIG_ID;
use eternum::constants::ResourceTypes;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};


fn setup() -> (IWorldDispatcher, IHyperstructureConfigDispatcher, ILevelingConfigDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);

    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher {
        contract_address: config_systems_address
    };

    let leveling_config_dispatcher = ILevelingConfigDispatcher {
        contract_address: config_systems_address
    };

    (world, hyperstructure_config_dispatcher, leveling_config_dispatcher)
}



#[test]
#[available_gas(3000000000000)]  
fn test_create_hyperstructure() {
    let (world, hyperstructure_config_dispatcher, leveling_config_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'entity'>()
    );

    let hyperstructure_type = 1_u8;


    let hyperstructure_coord = Coord{ x:20, y:30 };
    let hyperstructure_order = 3;


    // let world.uuid start from 1
    world.uuid();
    
    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
            world,
            hyperstructure_type,
            hyperstructure_coord,
            hyperstructure_order,
        );

    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.hyperstructure_type == hyperstructure_type, 
            'wrong hyperstructure type value'
    );
    assert(hyperstructure.controlling_order == 0, 'wrong order');

    // check that hyperstructure is in the right position
    let hyperstructure_position = get!(world, hyperstructure_id, Position);
    assert(hyperstructure_position.x == hyperstructure_coord.x, 'wrong x value');
    assert(hyperstructure_position.y == hyperstructure_coord.y, 'wrong y value');

    let tier_1_construction_resources = array![
        (ResourceTypes::STONE, 10_u128)
        ].span();
    
    let tier_2_construction_resources = array![
        // resources needed to be on level 2
        (ResourceTypes::STONE, 20_u128), 
        (ResourceTypes::WOOD, 30_u128)
        ].span();
        
    let tier_3_construction_resources = array![
        // resources needed to be on level 3
        (ResourceTypes::STONE, 30_u128), 
        (ResourceTypes::WOOD, 40_u128),
        (ResourceTypes::COAL, 50_u128)
        ].span();

    // set the leveling_config
    leveling_config_dispatcher.set_leveling_config(
            world,
            HYPERSTRUCTURE_LEVELING_CONFIG_ID,
            decay_interval: 0,
            max_level: 5,
            decay_scaled: 1000000000,
            cost_percentage_scaled: 1000000000,
            base_multiplier: 25,
            wheat_base_amount: 1,
            fish_base_amount: 2,
            resource_1_costs: tier_1_construction_resources,
            resource_2_costs: tier_2_construction_resources,
            resource_3_costs: tier_3_construction_resources,
    );

    //////////////////////////////////////////
    // check resources needed to reach each level

    let leveling_config 
        = get!(world, (HYPERSTRUCTURE_LEVELING_CONFIG_ID), LevelingConfig);

    assert(leveling_config.wheat_base_amount == 1, 'wrong fish');
    assert(leveling_config.fish_base_amount == 2, 'wrong wheat');

    // food
    assert(leveling_config.resource_1_cost_id != 0, 'wrong cost id');
    assert(leveling_config.resource_1_cost_count == 1, 'wrong cost length');

    // tier 1 resources
    assert(leveling_config.resource_1_cost_id != 0, 'wrong cost id');
    assert(leveling_config.resource_1_cost_count == 1, 'wrong cost length');

    // tier 2 resources
    assert(leveling_config.resource_2_cost_id != 0, 'wrong cost id');
    assert(leveling_config.resource_2_cost_count == 2, 'wrong cost length');
    
    // tier 3 resources
    assert(leveling_config.resource_3_cost_id != 0, 'wrong cost id');
    assert(leveling_config.resource_3_cost_count == 3, 'wrong cost length');
}


