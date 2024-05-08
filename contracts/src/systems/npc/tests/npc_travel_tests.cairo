use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::{
    models::{
        position::{Position, PositionIntoCoord, Coord}, npc::{Npc, RealmRegistry, Characteristics},
        movable::{ArrivalTime}
    },
    systems::{
        npc::{
            utils::{pedersen_hash_many, pack_characs}, contracts::npc_systems,
            interface::{INpcDispatcher, INpcDispatcherTrait,},
            tests::{
                npc_spawn_tests::{PUB_KEY, SPAWN_DELAY},
                utils::{
                    setup, spawn_npc_util, is_in_same_position, realms_have_correct_number_of_npcs
                }
            }
        },
        realm::{
            contracts::realm_systems,
            contracts::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,}
        },
        config::{
            contracts::{
                ITransportConfigDispatcher, ITransportConfigDispatcherTrait, INpcConfigDispatcher,
                INpcConfigDispatcherTrait
            },
        }
    },
    constants::{NPC_ENTITY_TYPE}
};

#[test]
#[available_gas(3000000000)]
fn test_npc_travel() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();
    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    assert(is_in_same_position(world, npc, to_realm_entity_id), 'npc not at correct position');

    assert(
        realms_have_correct_number_of_npcs(world, from_realm_entity_id, 0, to_realm_entity_id, 0),
        'incorrect number of residents'
    );
}

#[test]
#[available_gas(3000000000)]
fn test_npc_travel_twice() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();
    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.npc_travel(npc.entity_id, from_realm_entity_id);

    assert(is_in_same_position(world, npc, from_realm_entity_id), 'npc not at correct position');
    assert(
        realms_have_correct_number_of_npcs(world, from_realm_entity_id, 0, to_realm_entity_id, 0),
        'incorrect number of residents'
    );
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('not a realm', 'ENTRYPOINT_FAILED'))]
fn test_npc_travel_to_invalid_realm() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    npc_dispatcher.npc_travel(npc.entity_id, 1000);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('npc is traveling', 'ENTRYPOINT_FAILED'))]
fn test_npc_travel_while_traveling() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);
    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('already in dest realm', 'ENTRYPOINT_FAILED'))]
fn test_npc_travel_to_current_realm() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    npc_dispatcher.npc_travel(npc.entity_id, from_realm_entity_id);
}

#[test]
fn test_welcome_npc_success() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(npc.entity_id, to_realm_entity_id);

    assert(
        realms_have_correct_number_of_npcs(world, from_realm_entity_id, 0, to_realm_entity_id, 1),
        'incorrect number of residents'
    );
}

#[test]
#[should_panic(expected: ('Realm does not belong to player', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_wrong_caller() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    starknet::testing::set_contract_address(starknet::contract_address_const::<'wrong caller'>());
    npc_dispatcher.welcome_npc(npc.entity_id, to_realm_entity_id);
}

#[test]
#[should_panic(expected: ('into_realm_entity_id is 0', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_invalid_into_realm_entity_id() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(npc.entity_id, 0);
}

#[test]
#[should_panic(expected: ('npc_entity_id is 0', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_invalid_npc_entity_id() {
    let (world, npc_dispatcher, _from_realm_entity_id, to_realm_entity_id) = setup();

    npc_dispatcher.welcome_npc(0, to_realm_entity_id);
}

#[test]
#[should_panic(expected: ('npc not in into realm', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_invalid_npc_position() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(npc.entity_id, from_realm_entity_id);
}

#[test]
#[should_panic(expected: ('npc is traveling', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_still_traveling() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    npc_dispatcher.welcome_npc(npc.entity_id, to_realm_entity_id);
}


#[test]
#[should_panic(expected: ('npc is not at the gates', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_welcome_twice() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(npc.entity_id, to_realm_entity_id);
    npc_dispatcher.welcome_npc(npc.entity_id, to_realm_entity_id);
}

#[test]
#[should_panic(expected: ('too many npcs', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_too_many_residents() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let traveling_npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(traveling_npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, traveling_npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    let _npc = spawn_npc_util(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    let _npc = spawn_npc_util(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 1);
    let _npc = spawn_npc_util(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 2);
    let _npc = spawn_npc_util(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 3);
    let _npc = spawn_npc_util(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 4);

    npc_dispatcher.welcome_npc(traveling_npc.entity_id, to_realm_entity_id);
}

#[test]
fn test_kick_out_npc() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(npc.entity_id, to_realm_entity_id);

    npc_dispatcher.kick_out_npc(npc.entity_id);
    assert(
        realms_have_correct_number_of_npcs(world, from_realm_entity_id, 0, to_realm_entity_id, 0),
        'incorrect number of residents'
    );

    assert(is_in_same_position(world, npc, to_realm_entity_id), 'npc not at correct position');
}

#[test]
#[should_panic(expected: ('npc_entity_id is 0', 'ENTRYPOINT_FAILED'))]
fn test_kick_out_invalid_npc_entity_id() {
    let (world, npc_dispatcher, _from_realm_entity_id, _to_realm_entity_id) = setup();
    npc_dispatcher.kick_out_npc(0);
}

#[test]
#[should_panic(expected: ('invalid npc_entity_id', 'ENTRYPOINT_FAILED'))]
fn test_kick_out_non_existent_npc() {
    let (world, npc_dispatcher, _from_realm_entity_id, _to_realm_entity_id) = setup();
    npc_dispatcher.kick_out_npc(100);
}


#[test]
#[should_panic(expected: ('npc wasnt welcomed in any realm', 'ENTRYPOINT_FAILED'))]
fn test_kick_out_traveler_npc() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc_util(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(npc.entity_id, to_realm_entity_id);
    npc_dispatcher.kick_out_npc(npc.entity_id);
}
