use traits::Into;
use option::OptionTrait;
use starknet::contract_address_const;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::{
    models::{position::Position, npc::{Npc, RealmRegistry, Characteristics}},
    systems::{
        npc::{
            utils::{pedersen_hash_many, pack_characs}, contracts::npc_systems,
            interface::{INpcDispatcher, INpcDispatcherTrait,},
            tests::{npc_spawn_tests::{PUB_KEY, SPAWN_DELAY}, utils::{setup, spawn_npc_util}},
        },
        realm::{
            contracts::realm_systems,
            interface::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,}
        },
        config::{
            contracts::config_systems, interface::{INpcConfigDispatcher, INpcConfigDispatcherTrait},
            tests::npc_config_tests::{MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS}
        }
    },
    utils::testing::{spawn_eternum, deploy_system}
};


const pub_key: felt252 = 0x141a26313bd3355fe4c4f3dda7e40dfb77ce54aea5f62578b4ec5aad8dd63b1;
const spawn_delay: u128 = 100;


#[test]
#[should_panic(expected: ('Realm does not belong to player', 'ENTRYPOINT_FAILED',))]
#[available_gas(3000000000)]
fn test_spawn_ownership() {
    let (world, npc_dispatcher, from_realm_entity_id, _to_realm_entity_id) = setup();

    let _npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    let _npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 1);
}

#[test]
#[available_gas(3000000000)]
fn test_pedersen_many() {
    let data = array!['John', 'brave', 1];
    let hash = pedersen_hash_many(data.span());
    assert(hash == 0x7cb6a9b994128df852f2ae08a6d7c1b0f570bc749b5f40e7d85bce44e0cdf3a, 'wrong hash');
    let data = array!['John', 'brave'];
    let hash = pedersen_hash_many(data.span());
    assert(hash == 0x43f3ad5517d8743d71b73c7fde3b85800cccd7623acd0af411a6b1d3128b018, 'wrong hash');
    let data = array![0, 1, 2];
    let hash = pedersen_hash_many(data.span());
    assert(hash == 0x19a8a65406fe866c6e53b0c5002e50b3cba62a836f41e75e15303ad2dd1ce5c, 'wrong hash');

    let data = array![];
    let hash = pedersen_hash_many(data.span());
    assert(
        hash == 0x49ee3eba8c1600700ee1b87eb599f16716b0b1022947733551fde4050ca6804,
        'wrong hash empty'
    );
}
