use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{INpcConfigDispatcher, INpcConfigDispatcherTrait};

use dojo::world::{IWorldDispatcherTrait, IWorldDispatcher};

use eternum::models::config::WorldConfig;
use eternum::models::config::NpcConfig;


const pub_key: felt252 = 0x141a26313bd3355fe4c4f3dda7e40dfb77ce54aea5f62578b4ec5aad8dd63b1;
const new_pub_key: felt252 = 0x111111111111111111111111111111111111111111111111111111111111111;
const spawn_delay: u128 = 100;


#[test]
#[available_gas(3000000000)]
fn test_set_new_pub_key() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };
    
    npc_config_dispatcher.set_npc_config(world, spawn_delay, pub_key);
    world.grant_owner(starknet::get_caller_address(), pub_key);
    npc_config_dispatcher.set_npc_config(world, spawn_delay, new_pub_key);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Not owner', 'ENTRYPOINT_FAILED'))]
fn test_set_new_pub_key_panic() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };
    
    npc_config_dispatcher.set_npc_config(world, spawn_delay, pub_key);
    npc_config_dispatcher.set_npc_config(world, spawn_delay, new_pub_key);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Empty spawn_delay received', 'ENTRYPOINT_FAILED'))]
fn test_set_spawn_delay_panic() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };
    
    npc_config_dispatcher.set_npc_config(world, 0, pub_key);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Empty pub_key received', 'ENTRYPOINT_FAILED'))]
fn test_set_0_pub_key_panic() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };
    
    npc_config_dispatcher.set_npc_config(world, spawn_delay, 0);
}