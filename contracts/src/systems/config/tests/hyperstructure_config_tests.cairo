use core::array::{ArrayTrait, SpanTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::constants::ResourceTypes;
use eternum::models::config::LevelingConfig;
use eternum::models::position::{Position, Coord};
use eternum::models::resources::ResourceCost;
use eternum::systems::config::contracts::config_systems;

use eternum::systems::config::contracts::{
    IHyperstructureConfigDispatcher, IHyperstructureConfigDispatcherTrait, ILevelingConfigDispatcher,
    ILevelingConfigDispatcherTrait,
};

use eternum::utils::testing::{world::spawn_eternum, systems::deploy_system};

use starknet::contract_address::contract_address_const;


fn setup() -> (IWorldDispatcher, IHyperstructureConfigDispatcher) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

    let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher { contract_address: config_systems_address };

    (world, hyperstructure_config_dispatcher)
}
// #[test]
// #[available_gas(3000000000000)]
// fn config_test_create_hyperstructure() {
//     // let (world, _) = setup();

//     // starknet::testing::set_contract_address(contract_address_const::<'entity'>());

//     // let hyperstructure_type = 1_u8;
//     // let hyperstructure_coord = Coord { x: 20, y: 30 };
//     // let completion_cost = array![(ResourceTypes::STONE, 10_u128)].span();

//     // // let world.uuid start from 1
//     // world.dispatcher.uuid();
// }


