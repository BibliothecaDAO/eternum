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



fn setup() -> (IWorldDispatcher, u128, u128, Coord, IHyperstructureSystemsDispatcher) {
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
    let initialization_resources = array![
        (ResourceTypes::STONE, 10_u128), // 10 stone
        (ResourceTypes::WOOD, 13_u128)  // 13 wood
    ];
    let construction_resources = array![
        (ResourceTypes::STONE, 40_u128), // 40 stone
        (ResourceTypes::WOOD, 50_u128)  // 50 wood
    ];
    let hyperstructure_coord = Coord{ x:20, y:30 };


    // set labor configuration entity
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher {
        contract_address: config_systems_address
    };

    let hyperstructure_id 
        = hyperstructure_config_dispatcher.create_hyperstructure(
                world,
                hyperstructure_type,
                initialization_resources.span(),
                construction_resources.span(),
                hyperstructure_coord
            );


    let hyperstructure_systems_address 
        = deploy_system(hyperstructure_systems::TEST_CLASS_HASH);
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher{
        contract_address: hyperstructure_systems_address
    };

    (
        world, entity_id, hyperstructure_id, 
        hyperstructure_coord, hyperstructure_systems_dispatcher
    )

}



#[test]
#[available_gas(3000000000000)]  
fn test_initialize() {

    let (
        world, entity_id, hyperstructure_id, 
        hyperstructure_coord, hyperstructure_systems_dispatcher
        ) = setup();

    // update block timestamp
    starknet::testing::set_block_timestamp(1);

    // call initialize
    hyperstructure_systems_dispatcher.initialize(
        world,
        entity_id,
        hyperstructure_id
    );

    let hyperstructure = get!(world, hyperstructure_id, HyperStructure);
    assert(hyperstructure.initialized_at != 0, 'not initialized');

    let entity_stone_resource = get!(world, (entity_id, ResourceTypes::STONE), Resource);
    assert(entity_stone_resource.balance == 400 - 10 , 'wrong stone balance');

    let entity_wood_resource = get!(world, (entity_id, ResourceTypes::WOOD), Resource);
    assert(entity_wood_resource.balance == 400 - 13, 'wrong wood balance');

    let position = get!(world, hyperstructure_id, Position);
    assert(position.x == hyperstructure_coord.x, 'wrong x coord');
    assert(position.y == hyperstructure_coord.y, 'wrong y coord');
}


#[test]
#[available_gas(3000000000000)]  
#[should_panic(expected: ('wrong position','ENTRYPOINT_FAILED' ))]
fn test_wrong_position() {

    let (
        world, entity_id, hyperstructure_id, 
        _, hyperstructure_systems_dispatcher
        ) = setup();


    starknet::testing::set_contract_address(world.executor());
    set!(world, ( 
        Position {
            entity_id,
            x: 50,
            y: 60
        }
    ));


    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    
    // call initialize
    hyperstructure_systems_dispatcher.initialize(
        world,
        entity_id,
        hyperstructure_id
    );
  
}