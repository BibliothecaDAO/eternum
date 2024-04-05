use eternum::models::resources::{Resource, ResourceChest};
use eternum::models::owner::Owner;
use eternum::models::position::Position;
use eternum::models::realm::Realm;
use eternum::models::map::Tile;

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IRealmFreeMintConfigDispatcher, IRealmFreeMintConfigDispatcherTrait,
};

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,};


use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::MAX_REALMS_PER_ADDRESS;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;
use core::array::{ArrayTrait, SpanTrait};

const TIMESTAMP: u64 = 1000;

const INITIAL_RESOURCE_1_TYPE: u8 = 1;
const INITIAL_RESOURCE_1_AMOUNT: u128 = 800;

const INITIAL_RESOURCE_2_TYPE: u8 = 2;
const INITIAL_RESOURCE_2_AMOUNT: u128 = 700;

fn setup() -> IWorldDispatcher {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);

    // set initially minted resources
    let initial_resources = array![
        (INITIAL_RESOURCE_1_TYPE, INITIAL_RESOURCE_1_AMOUNT),
        (INITIAL_RESOURCE_2_TYPE, INITIAL_RESOURCE_2_AMOUNT)
    ];

    IRealmFreeMintConfigDispatcher { contract_address: config_systems_address }
        .set_mint_config(initial_resources.span());

    world
}

#[test]
#[available_gas(3000000000000)]
fn test_realm_create() {
    let world = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    // create realm
    let realm_systems_address = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let position = Position { x: 20, y: 30, entity_id: 1_u128 };

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    starknet::testing::set_contract_address(contract_address_const::<'caller'>());

    let realm_entity_id = realm_systems_dispatcher
        .create(
            realm_id,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            position.clone(),
        );

    let realm_initial_resource_1 = get!(
        world, (realm_entity_id, INITIAL_RESOURCE_1_TYPE), Resource
    );
    assert(realm_initial_resource_1.balance == INITIAL_RESOURCE_1_AMOUNT, 'wrong mint 1 amount');

    let realm_initial_resource_2 = get!(
        world, (realm_entity_id, INITIAL_RESOURCE_2_TYPE), Resource
    );
    assert(realm_initial_resource_2.balance == INITIAL_RESOURCE_2_AMOUNT, 'wrong mint 2 amount');

    let realm_owner = get!(world, realm_entity_id, Owner);
    assert(realm_owner.address == contract_address_const::<'caller'>(), 'wrong realm owner');

    let realm = get!(world, realm_entity_id, Realm);
    assert(realm.realm_id == realm_id, 'wrong realm id');

    // ensure realm Tile is explored
    let tile: Tile = get!(world, (position.x, position.y), Tile);
    assert_eq!(tile.col, tile._col, "wrong col");
    assert_eq!(tile.row, tile._row, "wrong row");
    assert_eq!(tile.explored_by_id, realm_entity_id, "wrong realm owner");
    assert_eq!(tile.explored_at, TIMESTAMP, "wrong exploration time");
}


#[test]
#[available_gas(3000000000000)]
fn test_realm_create_equal_max_realms_per_address() {
    setup();

    // create realm
    let realm_systems_address = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let position = Position { x: 20, y: 30, entity_id: 1_u128 };

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    let mut index = 0;
    loop {
        if index == MAX_REALMS_PER_ADDRESS {
            break;
        }
        realm_systems_dispatcher
            .create(
                realm_id,
                resource_types_packed,
                resource_types_count,
                cities,
                harbors,
                rivers,
                regions,
                wonder,
                order,
                position.clone(),
            );

        index += 1;
    };
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('max num of realms settled', 'ENTRYPOINT_FAILED'))]
fn test_realm_create_greater_than_max_realms_per_address() {
    setup();

    // create realm
    let realm_systems_address = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let position = Position { x: 20, y: 30, entity_id: 1_u128 };

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    starknet::testing::set_contract_address(starknet::get_contract_address());

    let mut index = 0;
    loop {
        if index == MAX_REALMS_PER_ADDRESS + 1 {
            break;
        }
        realm_systems_dispatcher
            .create(
                realm_id,
                resource_types_packed,
                resource_types_count,
                cities,
                harbors,
                rivers,
                regions,
                wonder,
                order,
                position.clone(),
            );

        index += 1;
    };
}
