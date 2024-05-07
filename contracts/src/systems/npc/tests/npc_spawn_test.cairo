use eternum::alias::ID;
use eternum::constants::ResourceTypes;
use eternum::models::resources::Resource;
use eternum::models::labor::Labor;
use eternum::models::position::Position;
use eternum::models::npc::{Npc};

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
use eternum::systems::config::interface::{INpcConfigDispatcher, INpcConfigDispatcherTrait};

use eternum::systems::npc::contracts::npc_systems;
use eternum::systems::npc::interface::{INpcDispatcher, INpcDispatcherTrait,};


use debug::PrintTrait;

#[test]
#[available_gas(3000000000)]
fn test_spawning() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };

    // first argument is the spawn delay
    npc_config_dispatcher.set_spawn_config(world, 100);

    // set realm entity
    let realm_systems_address = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher
        .create(
            world,
            1, // realm id
            0x209, // resource_types_packed // 2,9 // stone and gold
            2, // resource_types_count
            5, // cities
            5, // harbors
            5, // rivers
            5, // regions
            1, // wonder
            1, // order
            99, // order_hyperstructure_id
            Position { x: 1, y: 1, entity_id: 1_u128 }, // position  
        // x needs to be > 470200 to get zone
        );

    let npc_systems_address = deploy_system(npc_systems::TEST_CLASS_HASH);
    let npc_dispatcher = INpcDispatcher { contract_address: npc_systems_address };

    let npc_id = npc_dispatcher.spawn_npc(world, realm_entity_id.into());

    let realm_entity_id: felt252 = realm_entity_id.into();

    let npc = get!(world, (npc_id), (Npc));

    assert(npc.entity_id == npc_id, 'should allow npc spawning');

    starknet::testing::set_block_timestamp(75);
    let maybe_new_npc = npc_dispatcher.spawn_npc(world, realm_entity_id.into());

    assert(maybe_new_npc == 0, 'should not allow npc spawning');

    starknet::testing::set_block_timestamp(120);
    let new_npc_id = npc_dispatcher.spawn_npc(world, realm_entity_id.into());
    let new_npc = get!(world, (new_npc_id), (Npc));

    assert(new_npc.entity_id == new_npc_id, 'should allow npc spawning');
}
