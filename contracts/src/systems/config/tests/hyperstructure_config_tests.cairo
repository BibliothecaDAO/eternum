use eternum::models::hyperstructure::HyperStructure;
use eternum::models::resources::ResourceCost;
use eternum::models::combat::TownWatch;
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
    let hyperstructure_coord = Coord{ x:20, y:30 };
    let completion_cost = array![
        (ResourceTypes::STONE, 10_u128)
     ].span();


    // let world.uuid start from 1
    world.uuid();
    
    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
            hyperstructure_type,
            hyperstructure_coord,
            completion_cost,
        );

    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.hyperstructure_type == hyperstructure_type, 
            'wrong hyperstructure type value'
    );


    assert(hyperstructure.controlling_order == 0, 'wrong order');
    assert(hyperstructure.completed == false, 'wrong completed value');
    assert(hyperstructure.completion_cost_id != 0, 'wrong completion cost id');
    assert(hyperstructure.completion_resource_count == 1, 
            'wrong completion resource count'
    );

    // check that hyperstructure is in the right position
    let hyperstructure_position = get!(world, hyperstructure_id, Position);
    assert(hyperstructure_position.x == hyperstructure_coord.x, 'wrong x value');
    assert(hyperstructure_position.y == hyperstructure_coord.y, 'wrong y value');

    // check that completion cost is set correctly
    let completion_cost_stone 
        = get!(world, (hyperstructure.completion_cost_id, 0), ResourceCost);
    assert(completion_cost_stone.resource_type == ResourceTypes::STONE, 
            'wrong resource type'
    );
    assert(completion_cost_stone.amount == 10, 'wrong amount');


    // check that hyperstructure town watch was created
    let hyperstructure_town_watch = get!(world, hyperstructure_id, TownWatch);
    assert(hyperstructure_town_watch.town_watch_id != 0, 
            'town watch not created'
    );


    // check that hyperstructure town watch position is correct
    let town_watch_position 
        = get!(world, hyperstructure_town_watch.town_watch_id, Position);
    assert(town_watch_position.x == hyperstructure_coord.x, 'wrong hyp x value');
    assert(town_watch_position.y == hyperstructure_coord.y, 'wrong hyp y value');
}


