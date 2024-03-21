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
            tests::npc_spawn_tests::{spawn_npc, PUB_KEY, SPAWN_DELAY}
        },
        realm::{
            contracts::realm_systems,
            interface::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,}
        },
        config::{
            contracts::config_systems,
            interface::{
                ITransportConfigDispatcher, ITransportConfigDispatcherTrait, INpcConfigDispatcher,
                INpcConfigDispatcherTrait
            },
            tests::npc_config_tests::{MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS}
        }
    },
    utils::testing::{spawn_eternum, deploy_system}, constants::{NPC_ENTITY_TYPE}
};

use debug::PrintTrait;

fn setup() -> (IWorldDispatcher, INpcDispatcher, u128, u128) {
    let world = spawn_eternum();
    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let npc_config_dispatcher = INpcConfigDispatcher { contract_address: config_systems_address }
        .set_npc_config(world, SPAWN_DELAY, PUB_KEY, MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS);
    ITransportConfigDispatcher { contract_address: config_systems_address }
        .set_speed_config(world, NPC_ENTITY_TYPE, 55); // 10km per sec

    let realm_systems_address = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };
    // use it once so the from_realm_entity_id isn't 0
    world.uuid();
    let from_realm_entity_id = realm_systems_dispatcher
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
            Position { x: 1000, y: 1000, entity_id: 1_u128 }, // position
        // x needs to be > 470200 to get zone
        );

    let to_realm_entity_id = realm_systems_dispatcher
        .create(
            world,
            2, // realm id
            0x209, // resource_types_packed // 2,9 // stone and gold
            2, // resource_types_count
            5, // cities
            5, // harbors
            5, // rivers
            5, // regions
            1, // wonder
            1, // order
            Position { x: 100_000, y: 100_000, entity_id: 1_u128 }, // position  
        // x needs to be > 470200 to get zone
        );

    let npc_address = deploy_system(npc_systems::TEST_CLASS_HASH);
    let npc_dispatcher = INpcDispatcher { contract_address: npc_address };
    (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id)
}

#[test]
#[available_gas(3000000000)]
fn test_npc_travel() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();
    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_position = get!(world, npc.entity_id, (Position));
    let npc_coord: Coord = npc_position.into();
    let realm_position = get!(world, to_realm_entity_id, (Position));
    assert(npc_coord == realm_position.into(), 'npc not at correct position');

    let source_realm_registry = get!(world, from_realm_entity_id, (RealmRegistry));
    let dest_realm_registry = get!(world, to_realm_entity_id, (RealmRegistry));

    assert(source_realm_registry.num_resident_npcs == 0, 'invalid residents source');
    assert(dest_realm_registry.num_resident_npcs == 0, 'invalid residents dest');
}

#[test]
#[available_gas(3000000000)]
fn test_npc_travel_twice() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();
    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_position = get!(world, npc.entity_id, (Position));
    let npc_coord: Coord = npc_position.into();
    let realm_position = get!(world, to_realm_entity_id, (Position));
    assert(npc_coord == realm_position.into(), 'npc not at correct position');

    let source_realm_registry = get!(world, from_realm_entity_id, (RealmRegistry));
    let dest_realm_registry = get!(world, to_realm_entity_id, (RealmRegistry));

    assert(source_realm_registry.num_resident_npcs == 0, 'invalid residents source');
    assert(dest_realm_registry.num_resident_npcs == 0, 'invalid residents dest');

    // 2nd npc_travel
    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);
    npc_dispatcher.npc_travel(world, npc.entity_id, from_realm_entity_id);

    let npc_position = get!(world, npc.entity_id, (Position));
    let npc_coord: Coord = npc_position.into();
    let realm_position = get!(world, from_realm_entity_id, (Position));
    assert(npc_coord == realm_position.into(), 'npc not at correct position');

    let source_realm_registry = get!(world, to_realm_entity_id, (RealmRegistry));
    let dest_realm_registry = get!(world, from_realm_entity_id, (RealmRegistry));

    assert(source_realm_registry.num_resident_npcs == 0, 'invalid residents source');
    assert(dest_realm_registry.num_resident_npcs == 0, 'invalid residents dest');
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('not a realm', 'ENTRYPOINT_FAILED'))]
fn test_npc_travel_to_invalid_realm() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    npc_dispatcher.npc_travel(world, npc.entity_id, 1000);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('npc is traveling', 'ENTRYPOINT_FAILED'))]
fn test_npc_travel_while_traveling() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);
    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);
}

#[test]
#[available_gas(3000000000)]
#[should_panic(expected: ('already in dest realm', 'ENTRYPOINT_FAILED'))]
fn test_npc_travel_to_current_realm() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    npc_dispatcher.npc_travel(world, npc.entity_id, from_realm_entity_id);
}

#[test]
fn test_welcome_npc_success() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(world, npc.entity_id, to_realm_entity_id);

    let source_realm_registry = get!(world, from_realm_entity_id, (RealmRegistry));
    let dest_realm_registry = get!(world, to_realm_entity_id, (RealmRegistry));

    assert(source_realm_registry.num_resident_npcs == 0, 'invalid residents source');
    assert(dest_realm_registry.num_resident_npcs == 1, 'invalid residents dest');
}

#[test]
#[should_panic(expected: ('Realm does not belong to player', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_wrong_caller() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    starknet::testing::set_contract_address(starknet::contract_address_const::<'wrong caller'>());
    npc_dispatcher.welcome_npc(world, npc.entity_id, to_realm_entity_id);
}

#[test]
#[should_panic(expected: ('into_realm_entity_id is 0', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_invalid_into_realm_entity_id() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(world, npc.entity_id, 0);
}

#[test]
#[should_panic(expected: ('npc_entity_id is 0', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_invalid_npc_entity_id() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    npc_dispatcher.welcome_npc(world, 0, to_realm_entity_id);
}

#[test]
#[should_panic(expected: ('npc not in into realm', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_invalid_npc_position() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(world, npc.entity_id, from_realm_entity_id);
}

#[test]
#[should_panic(expected: ('npc is traveling', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_still_traveling() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    npc_dispatcher.welcome_npc(world, npc.entity_id, to_realm_entity_id);
}


#[test]
#[should_panic(expected: ('npc is not at the gates', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_welcome_twice() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    npc_dispatcher.welcome_npc(world, npc.entity_id, to_realm_entity_id);
    npc_dispatcher.welcome_npc(world, npc.entity_id, to_realm_entity_id);
}

#[test]
#[should_panic(expected: ('too many npcs', 'ENTRYPOINT_FAILED'))]
fn test_welcome_npc_too_many_residents() {
    let (world, npc_dispatcher, from_realm_entity_id, to_realm_entity_id) = setup();

    let traveling_npc = spawn_npc(world, from_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);

    npc_dispatcher.npc_travel(world, traveling_npc.entity_id, to_realm_entity_id);

    let npc_arrival_time = get!(world, traveling_npc.entity_id, (ArrivalTime)).arrives_at;
    starknet::testing::set_block_timestamp(npc_arrival_time);

    let npc = spawn_npc(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 0);
    let npc = spawn_npc(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 1);
    let npc = spawn_npc(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 2);
    let npc = spawn_npc(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 3);
    let npc = spawn_npc(world, to_realm_entity_id, npc_dispatcher, SPAWN_DELAY, 4);

    npc_dispatcher.welcome_npc(world, traveling_npc.entity_id, to_realm_entity_id);
}
