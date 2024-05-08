use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::{
    models::{
        position::{Position, Coord, PositionImpl, PositionIntoCoord,},
        npc::{Npc, RealmRegistry, Characteristics}
    },
    systems::{
        npc::{
            utils::{pack_characs}, contracts::{npc_systems},
            interface::{INpcDispatcher, INpcDispatcherTrait}, tests::{utils::{spawn_npc_util, setup}}
        },
        realm::{
            contracts::realm_systems,
            contracts::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,}
        },
        config::{
            contracts::config_systems, contracts::{INpcConfigDispatcher, INpcConfigDispatcherTrait}
        },
    },
    utils::testing::{spawn_eternum, deploy_system},
};


const PUB_KEY: felt252 = 0x141a26313bd3355fe4c4f3dda7e40dfb77ce54aea5f62578b4ec5aad8dd63b1;
const SPAWN_DELAY: u64 = 100;


#[test]
#[available_gas(3000000000)]
fn test_spawn_single() {
    let (world, npc_dispatcher, from_realm_entity_id, _to_realm_entity_id) = setup();
    let _npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('too early to spawn', 'ENTRYPOINT_FAILED'))]
fn test_spawn_too_early() {
    let (world, npc_dispatcher, from_realm_entity_id, _to_realm_entity_id) = setup();
    let _npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    let _npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, 10, 1);
}

#[test]
#[available_gas(3000000000)]
fn test_spawn_multiple() {
    let (world, npc_dispatcher, from_realm_entity_id, _to_realm_entity_id) = setup();

    let npc_0 = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    let npc_1 = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 1);

    let npc_2 = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 2);

    let npc_3 = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 3);

    let npc_4 = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 4);

    assert(npc_0.entity_id != npc_1.entity_id, 'same entity_id 0 1');
    assert(npc_0.entity_id != npc_2.entity_id, 'same entity_id 0 2');
    assert(npc_0.entity_id != npc_3.entity_id, 'same entity_id 0 3');
    assert(npc_0.entity_id != npc_4.entity_id, 'same entity_id 0 4');
    assert(npc_1.entity_id != npc_2.entity_id, 'same entity_id 1 2');
    assert(npc_1.entity_id != npc_3.entity_id, 'same entity_id 1 3');
    assert(npc_1.entity_id != npc_4.entity_id, 'same entity_id 1 4');
    assert(npc_2.entity_id != npc_3.entity_id, 'same entity_id 2 3');
    assert(npc_2.entity_id != npc_4.entity_id, 'same entity_id 2 4');
    assert(npc_3.entity_id != npc_4.entity_id, 'same entity_id 3 4');
}


#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('max num npcs spawned', 'ENTRYPOINT_FAILED'))]
fn test_spawn_more_than_five() {
    let (world, npc_dispatcher, from_realm_entity_id, _to_realm_entity_id) = setup();

    let mut i = 0;
    loop {
        if (i == 10) {
            break;
        }

        let _npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, i);
        i += 1;
    }
}


#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('Invalid signature', 'ENTRYPOINT_FAILED'))]
fn test_invalid_trait() {
    let (world, npc_dispatcher, from_realm_entity_id, _to_realm_entity_id) = setup();

    let characs = pack_characs(Characteristics { age: 30, role: 10, sex: 1, });
    let r_sign = 0x6a43f62142ac80f794378d1298d429b77c068cba42f884b1856f2087cdaf0c6;
    let s_sign = 0x1171a4553f2b9d6a053f4e60c35b5c329931c7b353324f03f7ec5055f48f1ec;

    // 'brave' -> 'Brave'
    npc_dispatcher
        .spawn_npc(
            from_realm_entity_id, characs, 'Brave', 'John', array![r_sign, s_sign].span()
        );
}
