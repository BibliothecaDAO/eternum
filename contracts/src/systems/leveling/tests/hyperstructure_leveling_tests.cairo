
use eternum::constants::{ResourceTypes, HYPERSTRUCTURE_LEVELING_CONFIG_ID};
use eternum::models::resources::Resource;
use eternum::models::position::Coord;
use eternum::models::level::Level;
use eternum::models::position::Position;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IHyperstructureConfigDispatcher,
    IHyperstructureConfigDispatcherTrait,
};

use eternum::systems::config::interface::{
    ILevelingConfigDispatcher,
    ILevelingConfigDispatcherTrait,
};

use eternum::systems::leveling::contracts::leveling_systems;
use eternum::systems::leveling::interface::{
    ILevelingSystemsDispatcher,
    ILevelingSystemsDispatcherTrait,
};

use starknet::contract_address_const;

fn setup() -> (IWorldDispatcher, u128, ILevelingSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let level_config_dispatcher = ILevelingConfigDispatcher {
        contract_address: config_systems_address
    };


    // set labor auction
    let decay_scaled: u128 = 1844674407370955161;
    let base_multiplier: u128 = 25;
    // 25%
    let cost_percentage_scaled: u128 = 4611686018427387904;
    // half a day of average production
    let wheat_base_amount: u128 = 3780;
    // half a day of average production
    let fish_base_amount: u128 = 1260;
    let decay_interval = 604600;
    let max_level = 1000;

    // 3 tier resources
    let mut resource_1_costs = array![
            (ResourceTypes::WHEAT, 1000),
            (ResourceTypes::FISH, 1000) 
    ].span();
    let mut resource_2_costs = array![].span();
    let mut resource_3_costs = array![].span();

    level_config_dispatcher.set_leveling_config(
        world,
        HYPERSTRUCTURE_LEVELING_CONFIG_ID,
        decay_interval,
        max_level,
        decay_scaled,
        cost_percentage_scaled,
        base_multiplier,
        wheat_base_amount,
        fish_base_amount,
        resource_1_costs,
        resource_2_costs,
        resource_3_costs
    );

    let hyperstructure_type = 1_u8;
    let hyperstructure_coord = Coord{ x:20, y:30 };
    let hyperstructure_order = 3;

    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher {
        contract_address: config_systems_address
    };

    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
                world,
                hyperstructure_type,
                hyperstructure_coord,
                hyperstructure_order,
            );




    // mint 100_000 wheat and fish for the hyperstructure;
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::WHEAT,
            balance: 100_000
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::FISH,
            balance: 100_000
        },
    ));



    let leveling_systems_address 
        = deploy_system(leveling_systems::TEST_CLASS_HASH);
    let leveling_systems_dispatcher = ILevelingSystemsDispatcher {
        contract_address: leveling_systems_address
    };


    (world, hyperstructure_id, leveling_systems_dispatcher)
}


#[test]
#[available_gas(300000000000)]
fn test_level_up_hyperstructure() {
    let (world, hyperstructure_id, leveling_systems_dispatcher) = setup();

    let level = get!(world, (hyperstructure_id), Level);
    assert(level.level == 0, 'wrong level');

    // level up 
    leveling_systems_dispatcher.level_up_hyperstructure(
        world,
        hyperstructure_id,
    );

    let hyperstructure_wheat = get!(world, (hyperstructure_id, ResourceTypes::WHEAT), Resource);
    assert(
        hyperstructure_wheat.balance > 0 && hyperstructure_wheat.balance < 100_000, 
            'wrong wheat balance'
    );

    let hyperstructure_fish = get!(world, (hyperstructure_id, ResourceTypes::FISH), Resource);
    assert(
        hyperstructure_fish.balance > 0 && hyperstructure_fish.balance < 100_000, 
            'wrong fish balance'
    );
    
    let new_level = get!(world, (hyperstructure_id), Level);
    assert(new_level.level == 1, 'wrong level');
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('does not exist','ENTRYPOINT_FAILED' ))]
fn test_level_up__hyperstructure_does_not_exist() {
    let (world, _, leveling_systems_dispatcher) = setup();
    
    let hyperstructure_id = 999;// set arbitrary id

    // level up 
    leveling_systems_dispatcher.level_up_hyperstructure(
        world,
        hyperstructure_id,
    );
}
