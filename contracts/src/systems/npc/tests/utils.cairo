use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::{
    models::{
        position::{Position, Coord, PositionImpl, PositionIntoCoord,},
        npc::{Npc, RealmRegistry, Characteristics}
    },
    systems::{
        npc::{
            utils::{pack_characs}, tests::npc_spawn_tests::{PUB_KEY, SPAWN_DELAY},
            contracts::npc_systems, interface::{INpcDispatcher, INpcDispatcherTrait}
        },
        config::{
            contracts::config_systems,
            interface::{
                ITransportConfigDispatcher, ITransportConfigDispatcherTrait, INpcConfigDispatcher,
                INpcConfigDispatcherTrait
            },
            tests::npc_config_tests::{MAX_NUM_RESIDENT_NPCS, MAX_NUM_NATIVE_NPCS}
        },
        realm::{
            contracts::realm_systems,
            interface::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,}
        },
    },
    utils::testing::{spawn_eternum, deploy_system}, constants::{NPC_ENTITY_TYPE},
};


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

fn spawn_npc_util(
    world: IWorldDispatcher,
    realm_entity_id: u128,
    npc_dispatcher: INpcDispatcher,
    time_increment: u64,
    current_num_of_npcs: u8
) -> Npc {
    let current_time = starknet::get_block_timestamp();
    starknet::testing::set_block_timestamp(current_time + time_increment);

    let characs = pack_characs(Characteristics { age: 30, role: 10, sex: 1, });
    let r_sign = 0x6a43f62142ac80f794378d1298d429b77c068cba42f884b1856f2087cdaf0c6;
    let s_sign = 0x1171a4553f2b9d6a053f4e60c35b5c329931c7b353324f03f7ec5055f48f1ec;

    let entity_id = npc_dispatcher
        .spawn_npc(world, realm_entity_id, characs, 'brave', 'John', array![r_sign, s_sign].span());

    assert(entity_id != 0, 'entity id is zero');

    let npc = get!(world, entity_id, (Npc));

    assert(npc.entity_id != 0, 'npc.entity_id is zero');

    let realm_registry = get!(world, realm_entity_id, (RealmRegistry));
    assert(
        realm_registry.num_resident_npcs == current_num_of_npcs + 1, 'wrong number of residents'
    );
    assert(realm_registry.num_native_npcs == current_num_of_npcs + 1, 'wrong number of natives');

    let npc_position = get!(world, npc.entity_id, (Position));
    let npc_coords: Coord = npc_position.into();
    let realm_position = get!(world, realm_entity_id, (Position));

    assert(npc_coords == realm_position.into(), 'npc at wrong position');

    npc
}

fn is_in_same_position(world: IWorldDispatcher, npc: Npc, realm_entity_id: u128) -> bool {
    let npc_position = get!(world, npc.entity_id, (Position));
    let npc_coord: Coord = npc_position.into();
    let realm_position = get!(world, realm_entity_id, (Position));
    return (npc_coord == realm_position.into());
}

fn realms_have_correct_number_of_npcs(
    world: IWorldDispatcher,
    realm_one_entity_id: u128,
    num_residents_realm_one_expected: u8,
    realm_two_entity_id: u128,
    num_residents_realm_two_expected: u8
) -> bool {
    let realm_one_registry = get!(world, realm_one_entity_id, (RealmRegistry));
    let realm_two_registry = get!(world, realm_two_entity_id, (RealmRegistry));

    return (realm_one_registry.num_resident_npcs == num_residents_realm_one_expected
        && realm_two_registry.num_resident_npcs == num_residents_realm_two_expected);
}
