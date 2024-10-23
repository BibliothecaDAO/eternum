use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::MAX_REALMS_PER_ADDRESS;

use eternum::constants::ResourceTypes;
use eternum::models::map::Tile;
use eternum::models::owner::Owner;

use eternum::models::position::{Position, Coord};
use eternum::models::realm::{Realm, RealmCustomTrait};
use eternum::models::resources::DetachedResource;
use eternum::models::resources::Resource;

use eternum::systems::config::contracts::{config_systems, IQuestConfigDispatcher, IQuestConfigDispatcherTrait};
use eternum::systems::realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait};

use eternum::utils::map::biomes::Biome;

use eternum::utils::testing::{
    world::spawn_eternum, systems::{deploy_system, deploy_realm_systems, deploy_hyperstructure_systems},
    general::{
        spawn_realm, get_default_realm_pos, generate_realm_positions, spawn_hyperstructure,
        get_default_hyperstructure_coord
    },
    config::{set_combat_config, set_capacity_config, set_realm_level_config, set_settlement_config}
};
use starknet::contract_address_const;

const TIMESTAMP: u64 = 1000;

const INITIAL_RESOURCE_1_TYPE: u8 = 1;
const INITIAL_RESOURCE_1_AMOUNT: u128 = 800;

const INITIAL_RESOURCE_2_TYPE: u8 = 2;
const INITIAL_RESOURCE_2_AMOUNT: u128 = 700;

const QUEST_ID: ID = 1;

fn setup() -> (IWorldDispatcher, IRealmSystemsDispatcher) {
    let world = spawn_eternum();

    let realm_systems_dispatcher = deploy_realm_systems(world);

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

    set_capacity_config(config_systems_address);
    set_realm_level_config(config_systems_address);
    set_settlement_config(config_systems_address);

    // set initially minted resources
    let initial_resources = array![
        (INITIAL_RESOURCE_1_TYPE, INITIAL_RESOURCE_1_AMOUNT), (INITIAL_RESOURCE_2_TYPE, INITIAL_RESOURCE_2_AMOUNT)
    ];

    let quest_reward_config_dispatcher = IQuestConfigDispatcher { contract_address: config_systems_address };

    quest_reward_config_dispatcher.set_quest_reward_config(quest_id: QUEST_ID, resources: initial_resources.span());

    (world, realm_systems_dispatcher)
}

#[test]
#[available_gas(3000000000000)]
fn realm_test_realm_create() {
    let (world, _realm_systems_dispatcher) = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let realm_id = 1;
    starknet::testing::set_contract_address(contract_address_const::<'caller'>());

    let realm_entity_id = spawn_realm(world, realm_id, get_default_realm_pos().into());

    let position = get!(world, realm_entity_id, Position);

    let realm_owner = get!(world, realm_entity_id, Owner);
    assert(realm_owner.address == contract_address_const::<'caller'>(), 'wrong realm owner');

    let realm = get!(world, realm_entity_id, Realm);
    assert(realm.realm_id == realm_id, 'wrong realm id');

    // ensure realm Tile is explored
    let tile: Tile = get!(world, (position.x, position.y), Tile);
    assert_eq!(tile.col, tile.col, "wrong col");
    assert_eq!(tile.row, tile.row, "wrong row");
    assert_eq!(tile.explored_by_id, realm_entity_id, "wrong realm owner");
    assert_eq!(tile.explored_at, TIMESTAMP, "wrong exploration time");
}


#[test]
#[available_gas(3000000000000)]
fn realm_test_claim_quest_reward() {
    let (world, realm_systems_dispatcher) = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());
    realm_systems_dispatcher.quest_claim(QUEST_ID, realm_entity_id);

    let realm_initial_resource_1 = get!(world, (realm_entity_id, INITIAL_RESOURCE_1_TYPE), Resource);
    assert(realm_initial_resource_1.balance == INITIAL_RESOURCE_1_AMOUNT, 'wrong mint 1 amount');

    let realm_initial_resource_2 = get!(world, (realm_entity_id, INITIAL_RESOURCE_2_TYPE), Resource);
    assert(realm_initial_resource_2.balance == INITIAL_RESOURCE_2_AMOUNT, 'wrong mint 2 amount');
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('quest already completed', 'ENTRYPOINT_FAILED'))]
fn realm_test_claim_quest_reward_twice() {
    let (world, realm_systems_dispatcher) = setup();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    realm_systems_dispatcher.quest_claim(QUEST_ID, realm_entity_id);
    realm_systems_dispatcher.quest_claim(QUEST_ID, realm_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Entity is not a realm', 'ENTRYPOINT_FAILED'))]
fn realm_test_claim_quest_reward__not_realm() {
    let (world, realm_systems_dispatcher) = setup();

    let hyperstructure_systems_dispatcher = deploy_hyperstructure_systems(world);

    starknet::testing::set_contract_address(contract_address_const::<'caller'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'caller'>());

    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    let hyperstructure_entity_id = spawn_hyperstructure(
        world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord()
    );

    realm_systems_dispatcher.quest_claim(QUEST_ID, hyperstructure_entity_id);
}

#[test]
#[available_gas(3000000000000)]
fn realm_test_upgrade_level_success() {
    let (world, realm_systems_dispatcher) = setup();

    // Spawn a realm
    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    // Add required resources for upgrade
    let required_resources = array![(ResourceTypes::WHEAT, 100), (ResourceTypes::WOOD, 100),];
    for (resource_type, amount) in required_resources
        .span() {
            let mut resource = get!(world, (realm_entity_id, *resource_type), Resource);
            resource.balance += *amount;
            set!(world, (resource));
        };

    // Upgrade level
    realm_systems_dispatcher.upgrade_level(realm_entity_id);

    // Check if level increased
    let realm = get!(world, realm_entity_id, Realm);
    assert(realm.level == 1, 'Realm level should be 1');

    // Check if resources were consumed
    for (resource_type, _amount) in required_resources
        .span() {
            let resource = get!(world, (realm_entity_id, *resource_type), Resource);
            assert(resource.balance == 0, 'Resource should be consumed');
        }
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn realm_test_upgrade_level_not_owner() {
    let (world, realm_systems_dispatcher) = setup();

    // Spawn a realm
    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    // Set a different caller
    starknet::testing::set_contract_address(contract_address_const::<'not_owner'>());

    // Attempt to upgrade level
    realm_systems_dispatcher.upgrade_level(realm_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('Entity is not a realm', 'ENTRYPOINT_FAILED'))]
fn realm_test_upgrade_level_not_realm() {
    let (_world, realm_systems_dispatcher) = setup();

    // Use a non-existent entity ID
    let non_realm_entity_id = 12345;

    // Attempt to upgrade level
    realm_systems_dispatcher.upgrade_level(non_realm_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('realm is already at max level', 'ENTRYPOINT_FAILED'))]
fn realm_test_upgrade_level_max_level() {
    let (world, realm_systems_dispatcher) = setup();

    // Spawn a realm
    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    // Set realm to max level
    let mut realm = get!(world, realm_entity_id, Realm);
    realm.level = realm.max_level(world);
    set!(world, (realm));

    // Attempt to upgrade level
    realm_systems_dispatcher.upgrade_level(realm_entity_id);
}

#[test]
#[available_gas(3000000000000)]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 5, resource type: WHEAT, balance: 0). deduction: 100",
        'ENTRYPOINT_FAILED'
    )
)]
fn realm_test_upgrade_level_insufficient_resources() {
    let (world, realm_systems_dispatcher) = setup();

    // Spawn a realm
    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    // Attempt to upgrade level without adding resources
    realm_systems_dispatcher.upgrade_level(realm_entity_id);
}

#[test]
#[available_gas(3000000000000)]
fn realm_test_upgrade_level_multiple_times() {
    let (world, realm_systems_dispatcher) = setup();

    // Spawn a realm
    let realm_entity_id = spawn_realm(world, 1, get_default_realm_pos().into());

    // Add more than enough resources for multiple upgrades
    let required_resources = array![
        (ResourceTypes::WHEAT, 1000),
        (ResourceTypes::WOOD, 1000),
        (ResourceTypes::STONE, 1000),
        (ResourceTypes::FISH, 1000),
        (ResourceTypes::COAL, 1000),
        (ResourceTypes::IRONWOOD, 1000),
    ];
    for (resource_type, amount) in required_resources
        .span() {
            let mut resource = get!(world, (realm_entity_id, *resource_type), Resource);
            resource.balance += *amount;
            set!(world, (resource));
        };

    // Upgrade level multiple times
    realm_systems_dispatcher.upgrade_level(realm_entity_id);
    realm_systems_dispatcher.upgrade_level(realm_entity_id);
    realm_systems_dispatcher.upgrade_level(realm_entity_id);

    // Check if level increased correctly
    let realm = get!(world, realm_entity_id, Realm);
    assert(realm.level == 3, 'Realm level should be 3');

    // Check if resources were consumed correctly
    let resource_types = array![
        ResourceTypes::WHEAT,
        ResourceTypes::WOOD,
        ResourceTypes::STONE,
        ResourceTypes::FISH,
        ResourceTypes::COAL,
        ResourceTypes::IRONWOOD
    ];
    for resource_type in resource_types
        .span() {
            let resource = get!(world, (realm_entity_id, *resource_type), Resource);
            assert!(resource.balance < 1000, "Resource should be partially consumed");
            assert!(resource.balance > 0, "Resource should not be fully consumed");
        }
}
