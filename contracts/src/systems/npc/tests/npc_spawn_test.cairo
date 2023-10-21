use eternum::alias::ID;
use eternum::constants::ResourceTypes;
use eternum::models::resources::Resource;
use eternum::models::labor::Labor;
use eternum::models::position::Position;
use eternum::models::npc::{Npc, Sex};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};


use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    INpcConfigDispatcher,
    INpcConfigDispatcherTrait
};

use eternum::systems::npc::contracts::npc_systems;
use eternum::systems::npc::interface::{
    INpcDispatcher,
    INpcDispatcherTrait,
};


use debug::PrintTrait;

#[test]
#[available_gas(3000000000)]
fn test_spawning() {

    let world = spawn_eternum();
    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher {
        contract_address: config_systems_address
    };

    // first argument is the spawn delay
    npc_config_dispatcher.set_spawn_config(world, 100);

    // set realm entity
    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        starknet::get_contract_address(), // owner
        0x209, // resource_types_packed // 2,9 // stone and gold
        2, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        1, // order
        Position { x: 1, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone
    );


    let npc_address 
        = deploy_system(npc_systems::TEST_CLASS_HASH);
    let npc_dispatcher = INpcDispatcher {
        contract_address: npc_address
    };

    let npc_id = npc_dispatcher.spawn_npc(world, realm_entity_id.into());
    

    let realm_entity_id: felt252 = realm_entity_id.into();

    let npc = get!(world, (realm_entity_id, npc_id), (Npc));

    assert(npc.entity_id == npc_id, 'should allow npc spawning');

    starknet::testing::set_block_timestamp(75);
    let maybe_new_npc = npc_dispatcher.spawn_npc(world, realm_entity_id.into());

    assert(maybe_new_npc == 0, 'should not allow npc spawning');

    starknet::testing::set_block_timestamp(120);
    let new_npc_id = npc_dispatcher.spawn_npc(world, realm_entity_id.into());
    let new_npc = get!(world, (realm_entity_id, new_npc_id), (Npc));

    assert(new_npc.entity_id == new_npc_id, 'should allow npc spawning');

    let mut new_mood = new_npc.mood;

    new_mood += 10;

    // what's that? a change of mood?
    npc_dispatcher.change_mood(world, realm_entity_id.into(), new_npc.entity_id, new_mood);

    // but did we... REALLY... change?
    let changed_npc = get!(world, (realm_entity_id, new_npc.entity_id), (Npc));

    assert(changed_npc.mood == new_mood, 'true change of mood brah');
    


}
