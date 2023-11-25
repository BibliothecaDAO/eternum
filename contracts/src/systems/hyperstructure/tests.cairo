use eternum::models::position::{Coord, Position};
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::owner::Owner;

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

use eternum::constants::ResourceTypes;

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

    let construction_resources = array![
        (ResourceTypes::STONE, 40_u128), // 40 stone
        (ResourceTypes::WOOD, 50_u128)  // 50 wood
    ];
    let hyperstructure_coord = Coord{ x:20, y:30 };
    let hyperstructure_order = 3;
    let hyperstructure_max_level = 4;


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
                construction_resources.span(),
                hyperstructure_coord,
                hyperstructure_order,
                hyperstructure_max_level
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
fn test_upgrade_by_two_levels() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher) = setup();

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
            balance: 25
        }   
    ));

    
    
    // upgrade by 2 levels
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);


    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.level == 2, 'incorrect level');
}


#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('not enough resources','ENTRYPOINT_FAILED' ))]
fn test_upgrade_by_one_level_fail() {
    // test fails because the hyperstructure does not have
    // enough resources to upgrade
    
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher
    ) = setup();

    
    
    // upgrade by 1 level
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
}



#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('max level reached','ENTRYPOINT_FAILED' ))]
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
            balance: 40
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::WOOD,
            balance: 50
        }   
    ));

    
    
    // upgrade by 5 levels
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
}



#[test]
#[available_gas(3000000000000)]  
fn test_downgrade_by_two_levels() {
    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher) = setup();

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
            balance: 25
        }   
    ));


    // upgrade by 2 levels
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);

    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.level == 2, 'incorrect upgraded level');

    // downgrade by 2 levels
    set!(world, ( 
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::STONE,
            balance: 0
        },
        Resource {
            entity_id: hyperstructure_id,
            resource_type: ResourceTypes::WOOD,
            balance: 0
        }   
    ));

    hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);

    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.level == 0, 'incorrect downgraded level');
}


#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('can not downgrade','ENTRYPOINT_FAILED' ))]
fn test_downgrade_by_one_level_fail() { 
   let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_systems_dispatcher
    ) = setup();

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
            balance: 25
        }   
    ));

    // upgrade by 2 levels
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);
    hyperstructure_systems_dispatcher.upgrade_level(world, hyperstructure_id);

    // try downgrade by 1 levels
    hyperstructure_systems_dispatcher.downgrade_level(world, hyperstructure_id);
}



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
