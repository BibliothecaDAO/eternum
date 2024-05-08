use dojo::world::{IWorldDispatcherTrait, IWorldDispatcher};
use eternum::{
    models::config::{WorldConfig, NpcConfig},
    systems::{
        config::{
            contracts::config_systems, interface::{INpcConfigDispatcher, INpcConfigDispatcherTrait}
        },
        npc::tests::npc_spawn_tests::{PUB_KEY, SPAWN_DELAY}
    },
    utils::testing::{spawn_eternum, deploy_system}, constants::{NPC_CONFIG_ID},
};

const NEW_PUB_KEY: felt252 = 0x111111111111111111111111111111111111111111111111111111111111111;
const MAX_NUM_RESIDENT_NPCS: u8 = 5;
const MAX_NUM_NATIVE_NPCS: u8 = 5;

#[test]
#[available_gas(3000000000)]
fn test_set_new_pub_key() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };

    npc_config_dispatcher
        .set_npc_config(world, SPAWN_DELAY, PUB_KEY, MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS);

    let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));
    assert(npc_config.spawn_delay == SPAWN_DELAY, 'wrong spawn_delay');
    assert(npc_config.pub_key == PUB_KEY, 'wrong pub_key');
    assert(
        npc_config.max_num_resident_npcs == MAX_NUM_RESIDENT_NPCS, 'wrong max_num_resident_npcs'
    );
    assert(npc_config.max_num_native_npcs == MAX_NUM_NATIVE_NPCS, 'wrong max_num_native_npcs');

    world.grant_owner(starknet::get_caller_address(), PUB_KEY);
    npc_config_dispatcher.set_npc_config(world, SPAWN_DELAY, NEW_PUB_KEY, 3, 3);

    let npc_config = get!(world, NPC_CONFIG_ID, (NpcConfig));
    assert(npc_config.spawn_delay == SPAWN_DELAY, 'wrong spawn_delay');
    assert(npc_config.pub_key == NEW_PUB_KEY, 'wrong pub_key');
    assert(npc_config.max_num_resident_npcs == 3, 'wrong max_num_resident_npcs');
    assert(npc_config.max_num_native_npcs == 3, 'wrong max_num_native_npcs');
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Not owner', 'ENTRYPOINT_FAILED'))]
fn test_set_new_pub_key_panic() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };

    npc_config_dispatcher
        .set_npc_config(world, SPAWN_DELAY, PUB_KEY, MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS);
    npc_config_dispatcher
        .set_npc_config(
            world, SPAWN_DELAY, NEW_PUB_KEY, MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS
        );
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Empty spawn_delay received', 'ENTRYPOINT_FAILED'))]
fn test_set_spawn_delay_panic() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };

    npc_config_dispatcher
        .set_npc_config(world, 0, PUB_KEY, MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Empty pub_key received', 'ENTRYPOINT_FAILED'))]
fn test_set_0_pub_key_panic() {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address };

    npc_config_dispatcher
        .set_npc_config(world, SPAWN_DELAY, 0, MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS);
}
