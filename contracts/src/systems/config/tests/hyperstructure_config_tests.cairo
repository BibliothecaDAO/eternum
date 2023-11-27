use eternum::models::hyperstructure::HyperStructure;
use eternum::models::resources::ResourceCost;
use eternum::models::position::{Position, Coord};
use eternum::models::config::LevelingConfig;

use eternum::systems::config::interface::{
    IHyperstructureConfigDispatcher, 
    IHyperstructureConfigDispatcherTrait
};
use eternum::systems::config::contracts::config_systems;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::HYPERSTRUCTURE_CONFIG_ID;
use eternum::constants::ResourceTypes;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};


fn setup() -> (IWorldDispatcher, IHyperstructureConfigDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);

    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher {
        contract_address: config_systems_address
    };

    (world, hyperstructure_config_dispatcher)
}



#[test]
#[available_gas(3000000000000)]  
fn test_create_hyperstructure() {
    let (world, hyperstructure_config_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'entity'>()
    );

    let hyperstructure_type = 1_u8;

    let level_construction_resources = array![
        array![
            // resources needed to be on level 1
            (ResourceTypes::STONE, 10_u128), 
        ].span(),
        array![
            // resources needed to be on level 2
            (ResourceTypes::STONE, 20_u128), 
            (ResourceTypes::WOOD, 30_u128)
        ].span(),
        array![
            // resources needed to be on level 3
            (ResourceTypes::STONE, 30_u128), 
            (ResourceTypes::WOOD, 40_u128),
            (ResourceTypes::COAL, 50_u128)
        ].span(),
    ];

    let hyperstructure_coord = Coord{ x:20, y:30 };
    let hyperstructure_order = 3;


    // let world.uuid start from 1
    world.uuid();
    
    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
            world,
            hyperstructure_type,
            level_construction_resources.span(),
            hyperstructure_coord,
            hyperstructure_order,
        );


    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.hyperstructure_type == hyperstructure_type, 
            'wrong hyperstructure type value'
    );
    assert(hyperstructure.order == 3, 'wrong order');

    // check that hyperstructure is in the right position
    let hyperstructure_position = get!(world, hyperstructure_id, Position);
    assert(hyperstructure_position.x == hyperstructure_coord.x, 'wrong x value');
    assert(hyperstructure_position.y == hyperstructure_coord.y, 'wrong y value');

    //////////////////////////////////////////
    // check resources needed to reach level 1
    let first_level_construction_resources_config 
        = get!(world, (HYPERSTRUCTURE_CONFIG_ID, 1 - 1 ), LevelingConfig);

    assert(first_level_construction_resources_config.resource_cost_id != 0, 'wrong resource id');
    assert(first_level_construction_resources_config.resource_cost_count == 1, 'wrong resource count');

    let first_level_construction_stone_cost 
        = get!(world, (first_level_construction_resources_config.resource_cost_id, 0), ResourceCost);
    assert(first_level_construction_stone_cost.amount == 10, 'wrong amount value');
    assert(first_level_construction_stone_cost.resource_type == ResourceTypes::STONE, 
            'wrong resource_type value'
    );


    //////////////////////////////////////////
    // check resources needed to reach level 2

    let second_level_construction_resources_config 
        = get!(world, (HYPERSTRUCTURE_CONFIG_ID, 2 - 1 ), LevelingConfig);

    assert(second_level_construction_resources_config.resource_cost_id != 0, 'wrong resource id');
    assert(second_level_construction_resources_config.resource_cost_count == 2, 'wrong resource count');

    let second_level_construction_stone_cost 
        = get!(world, (second_level_construction_resources_config.resource_cost_id, 0), ResourceCost);
    assert(second_level_construction_stone_cost.amount == 20, 'wrong amount value');
    assert(second_level_construction_stone_cost.resource_type == ResourceTypes::STONE, 
            'wrong resource_type value'
    );


    let second_level_construction_wood_cost 
        = get!(world, (second_level_construction_resources_config.resource_cost_id, 1), ResourceCost);
    assert(second_level_construction_wood_cost.amount == 30, 'wrong amount value');
    assert(second_level_construction_wood_cost.resource_type == ResourceTypes::WOOD, 
            'wrong resource_type value'
    );



    //////////////////////////////////////////
    // check resources needed to reach level 3
    let third_level_construction_resources_config 
        = get!(world, (HYPERSTRUCTURE_CONFIG_ID, 3 - 1 ), LevelingConfig);

    assert(third_level_construction_resources_config.resource_cost_id != 0, 'wrong resource id');
    assert(third_level_construction_resources_config.resource_cost_count == 3, 'wrong resource count');

    let third_level_construction_stone_cost 
        = get!(world, (third_level_construction_resources_config.resource_cost_id, 0), ResourceCost);
    assert(third_level_construction_stone_cost.amount == 30, 'wrong amount value');
    assert(third_level_construction_stone_cost.resource_type == ResourceTypes::STONE, 
            'wrong resource_type value'
    );


    let third_level_construction_wood_cost 
        = get!(world, (third_level_construction_resources_config.resource_cost_id, 1), ResourceCost);
    assert(third_level_construction_wood_cost.amount == 40, 'wrong amount value');
    assert(third_level_construction_wood_cost.resource_type == ResourceTypes::WOOD, 
            'wrong resource_type value'
    );

    let third_level_construction_coal_cost 
        = get!(world, (third_level_construction_resources_config.resource_cost_id, 2), ResourceCost);
    assert(third_level_construction_coal_cost.amount == 50, 'wrong amount value');
    assert(third_level_construction_coal_cost.resource_type == ResourceTypes::COAL, 
            'wrong resource_type value'
    );

}


