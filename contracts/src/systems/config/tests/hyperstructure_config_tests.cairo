use eternum::constants::ResourceTypes;
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::resources::ResourceCost;
use eternum::models::position::{Position, Coord};

use eternum::systems::config::interface::{
    IHyperstructureConfigDispatcher, 
    IHyperstructureConfigDispatcherTrait
};
use eternum::systems::config::contracts::config_systems;

use eternum::utils::testing::{spawn_eternum, deploy_system};

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

    let construction_resources = array![
        (ResourceTypes::STONE, 40_u128), // 40 stone
        (ResourceTypes::WOOD, 50_u128)  // 50 wood
    ];
    let hyperstructure_coord = Coord{ x:20, y:30 };
    let hyperstructure_order = 3;
    let hyperstructure_max_level = 4;


    // let world.uuid start from 1
    world.uuid();
    
    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
            world,
            hyperstructure_type,
            construction_resources.span(),
            hyperstructure_coord,
            hyperstructure_order,
            hyperstructure_max_level
        );


    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.hyperstructure_type == hyperstructure_type, 
            'wrong hyperstructure type value'
    );
    assert(hyperstructure.order == 3, 'wrong order');
    assert(hyperstructure.max_level == 4, 'wrong max level');


    assert(hyperstructure.construction_resource_id != 0, 'wrong resource id');
    assert(hyperstructure.construction_resource_count == 2, 'wrong resource count');

    let hyperstructure_construction_stone_cost = get!(world, (hyperstructure.construction_resource_id, 0), ResourceCost);
    assert(hyperstructure_construction_stone_cost.amount == 40, 'wrong amount value');
    assert(hyperstructure_construction_stone_cost.resource_type == ResourceTypes::STONE, 
            'wrong resource_type value'
    );


    let hyperstructure_construction_wood_cost = get!(world, (hyperstructure.construction_resource_id, 1), ResourceCost);
    assert(hyperstructure_construction_wood_cost.amount == 50, 'wrong amount value');
    assert(hyperstructure_construction_wood_cost.resource_type == ResourceTypes::WOOD, 
            'wrong resource_type value'
    );


    // check that hyperstructure is in the right position
    let hyperstructure_position = get!(world, hyperstructure_id, Position);
    assert(hyperstructure_position.x == hyperstructure_coord.x, 'wrong x value');
    assert(hyperstructure_position.y == hyperstructure_coord.y, 'wrong y value');
}


