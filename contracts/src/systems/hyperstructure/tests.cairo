use eternum::models::position::{Coord, Position};
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::owner::Owner;
use eternum::models::level::Level;
use eternum::models::config::LevelingConfig;

use eternum::systems::hyperstructure::contracts::hyperstructure_systems;
use eternum::systems::hyperstructure::interface::{
    IHyperstructureSystemsDispatcher,
    IHyperstructureSystemsDispatcherTrait,
};
use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IHyperstructureConfigDispatcher,
    IHyperstructureConfigDispatcherTrait,
};

use eternum::constants::{ResourceTypes, HYPERSTRUCTURE_LEVELING_CONFIG_ID};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::ArrayTrait;
use core::traits::TryInto;
use core::option::OptionTrait;



fn setup() -> (IWorldDispatcher, u128, u128, IHyperstructureSystemsDispatcher) {
    let world = spawn_eternum();

    let entity_id: u128 = 44;

    starknet::testing::set_contract_address(world.executor());
    set!(world, ( 
        Owner { entity_id, address: contract_address_const::<'entity'>()},
        Resource {
            entity_id,
            resource_type: ResourceTypes::STONE,
            balance: 400
        },
        Resource {
            entity_id,
            resource_type: ResourceTypes::WOOD,
            balance: 400
        },
        Position {
            entity_id,
            x: 20,
            y: 30
        }
    ));


    starknet::testing::set_contract_address(contract_address_const::<'entity'>());


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


    // set labor configuration entity
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher {
        contract_address: config_systems_address
    };

    // let world.uuid start from 1
    world.uuid();

    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
                world,
                hyperstructure_type,
                hyperstructure_coord,
                hyperstructure_order,
            );

    let hyperstructure_systems_address 
        = deploy_system(hyperstructure_systems::TEST_CLASS_HASH);
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher{
        contract_address: hyperstructure_systems_address
    };

    (world, entity_id, hyperstructure_id, hyperstructure_systems_dispatcher)

}

#[test]
#[available_gas(3000000000000)]  
fn test_upgrade_by_one_level() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher
    ) = setup();

    starknet::testing::set_contract_address(world.executor());
    set!(world, ( 
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::STONE,
            balance: 10
        }
    ));
    set!(world, (
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
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
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        }
    ));
    
    // upgrade by 1 levels
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);

    let level = get!(world, hyperstructure_id, Level);
    assert(level.level == 1, 'incorrect level');
}




#[test]
#[available_gas(3000000000000)]  
fn test_upgrade_by_two_levels() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher) = setup();

    set!(world, (
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
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
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        }
    ));
    

    starknet::testing::set_contract_address(world.executor());
    set!(world, ( 
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::STONE,
            balance: 20
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::WOOD,
            balance: 30
        }   
    ));
    
    // upgrade by 2 levels
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);

    let level = get!(world, hyperstructure_id, Level);
    assert(level.level == 2, 'incorrect level');
}


#[test]
#[available_gas(3000000000000)]  
fn test_upgrade_by_three_levels() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(world.executor());


    set!(world, (
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
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
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        }
    ));

    set!(world, ( 
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::STONE,
            balance: 30
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::WOOD,
            balance: 40
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::COAL,
            balance: 50
        },
    ));

    
    
    // upgrade by 3 levels
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);


    let level = get!(world, hyperstructure_id, Level);
    assert(level.level == 3, 'incorrect level');
}


#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('not enough wheat','ENTRYPOINT_FAILED' ))]
fn test_upgrade_by_one_level_fail() {
    // test fails because the hyperstructure does not have
    // enough wheat to upgrade
    
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher
    ) = setup();

    starknet::testing::set_contract_address(world.executor());
    set!(world, ( 
    Resource {
        entity_id: hyperstructure_id,
        resource_type: ResourceTypes::WHEAT,
        balance: 500
    },
    Resource {
        entity_id: hyperstructure_id,
        resource_type: ResourceTypes::FISH,
        balance: 1000
    }, 
    ));

    set!(world, (
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
            decay_interval: 604800,
            max_level: 3,
            wheat_base_amount: 1000,
            fish_base_amount: 1000,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        }
    ));

    
    // upgrade by 1 level
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
}



#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('reached max level','ENTRYPOINT_FAILED' ))]
fn test_upgrade_past_max_level() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher
    ) = setup();

    starknet::testing::set_contract_address(world.executor());
    set!(world, ( 
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::STONE,
            balance: 30
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::WOOD,
            balance: 40
        }, 
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::COAL,
            balance: 50
        }, 
    ));

    set!(world, (
        LevelingConfig {
            config_id: HYPERSTRUCTURE_LEVELING_CONFIG_ID,
            decay_interval: 604800,
            max_level: 3,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            base_multiplier: 25,
            cost_percentage_scaled: 4611686018427387904
        }
    ));
    
    // upgrade by 3 levels
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);

    // assert level 3 
    let level = get!(world, (hyperstructure_id), Level);
    assert(level.level == 3, 'wrong level');

    // upgrade to level 4
    // should fail here
    hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
}



// TODO: update downgrade function and make this work 
//#[test]
//#[available_gas(3000000000000)]  
//fn test_downgrade_by_two_levels() {
    //let (
        //world, entity_id, hyperstructure_id, 
        //hyperstructure_systems_dispatcher) = setup();

    //starknet::testing::set_contract_address(world.executor());
    //set!(world, ( 
        //Resource {
            //entity_id: hyperstructure_id,
            //resource_type: ResourceTypes::STONE,
            //balance: 20
        //},
        //Resource {
            //entity_id: hyperstructure_id,
            //resource_type: ResourceTypes::WOOD,
            //balance: 30
        //}   
    //));


    //// upgrade by 2 levels
    //hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    //hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);

    //let level = get!(world, hyperstructure_id, Level);
    //assert(level.level == 2, 'incorrect upgraded level');

    //// downgrade by 2 levels
    //set!(world, ( 
        //Resource {
            //entity_id: hyperstructure_id,
            //resource_type: ResourceTypes::STONE,
            //balance: 0
        //},
        //Resource {
            //entity_id: hyperstructure_id,
            //resource_type: ResourceTypes::WOOD,
            //balance: 0
        //}   
    //));

    //hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);
    //hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);

    //let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    //assert(hyperstructure.level == 0, 'incorrect downgraded level');
//}


//#[test]
//#[available_gas(3000000000000)]  
//#[should_panic(expected: ('can not downgrade','ENTRYPOINT_FAILED' ))]
//fn test_downgrade_by_one_level_fail() { 
   //let (
        //world, entity_id, hyperstructure_id, 
        //hyperstructure_systems_dispatcher
    //) = setup();

    //starknet::testing::set_contract_address(world.executor());
    //set!(world, ( 
        //Resource {
            //entity_id: hyperstructure_id,
            //resource_type: ResourceTypes::STONE,
            //balance: 20
        //},
        //Resource {
            //entity_id: hyperstructure_id,
            //resource_type: ResourceTypes::WOOD,
            //balance: 30
        //}   
    //));

    //// upgrade by 2 levels
    //hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);
    //hyperstructure_systems_dispatcher.level_up(world, hyperstructure_id);

    //// try downgrade by 1 levels
    //hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);
//}



#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('least level reached','ENTRYPOINT_FAILED' ))]
fn test_downgrade_past_least_level() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher
    ) = setup();    
    
    // downgrade by 1 level
    hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);
}
