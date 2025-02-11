use core::array::SpanTrait;


use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
use s1_eternum::alias::ID;
use s1_eternum::constants::{ARMY_ENTITY_TYPE, WORLD_CONFIG_ID};
use s1_eternum::models::config::{CapacityCategory, CapacityConfig, SettlementConfig, TickConfig, TroopConfig};
use s1_eternum::models::movable::{Movable};
use s1_eternum::models::owner::{EntityOwner, Owner};
use s1_eternum::models::position::{Coord, Position};

use s1_eternum::models::resource::resource::{RESOURCE_PRECISION, Resource, ResourceImpl, ResourceTrait, ResourceTypes};
use s1_eternum::models::stamina::Stamina;
use s1_eternum::systems::config::contracts::config_systems;
use s1_eternum::systems::{
    combat::contracts::troop_systems::{ITroopContractDispatcher, ITroopContractDispatcherTrait, troop_systems},
    realm::contracts::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait, realm_systems},
};
use s1_eternum::utils::testing::{
    config::{get_combat_config, set_settlement_config}, general::{get_default_realm_pos, mint, spawn_realm},
    systems::deploy_realm_systems, systems::{deploy_system, deploy_troop_systems}, world::spawn_eternum,
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use traits::Into;


const DEFAULT_BLOCK_TIMESTAMP: u64 = 3000;
const REALMS_OWNER: felt252 = 'realms_owner';
const STARTING_KNIGHT_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const STARTING_PALADIN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const STARTING_CROSSBOWMAN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;

fn set_configurations(ref world: WorldStorage) {
    world.write_model_test(@get_combat_config());
    world
        .write_model_test(
            @TickConfig { config_id: WORLD_CONFIG_ID, tick_interval_in_seconds: 1 },
        );
    world.write_model_test(@CapacityConfig { category: CapacityCategory::Army, weight_gram: 300_000 });
}

fn setup() -> (WorldStorage, ITroopContractDispatcher, ID) {
    let mut world = spawn_eternum();
    set_configurations(ref world);
    let troop_system_dispatcher = deploy_troop_systems(ref world);

    let config_systems_address = deploy_system(ref world, "config_systems");
    set_settlement_config(config_systems_address);

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP);
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());

    let realm_id = spawn_realm(ref world, 1, get_default_realm_pos().into());
    mint(
        ref world,
        realm_id,
        array![
            (ResourceTypes::KNIGHT, STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, STARTING_PALADIN_COUNT),
        ]
            .span(),
    );

    (world, troop_system_dispatcher, realm_id)
}


#[test]
fn combat_test_army_create___attacking_army() {
    let (mut world, troop_systems_dispatcher, realm_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    let army_id = troop_systems_dispatcher.army_create(realm_id, false);

    let realm_position: Position = world.read_model(realm_id);

    let army: Army = world.read_model(army_id);
    assert_eq!(army.troops, Troops { knight_count: 0, paladin_count: 0, crossbowman_count: 0 });
    assert_eq!(army.battle_id, 0);
    assert_eq!(army.battle_side, BattleSide::None);

    let army_entity_owner: EntityOwner = world.read_model(army_id);
    assert_eq!(army_entity_owner.entity_owner_id, realm_id);

    let army_position: Position = world.read_model(army_id);
    assert_eq!(army_position.x, realm_position.x);
    assert_eq!(army_position.y, realm_position.y);

    let army_stamina: Stamina = world.read_model(army_id);
    assert_ne!(army_stamina.last_refill_tick, 0);

    let army_movable: Movable = world.read_model(army_id);
    assert_eq!(army_movable.start_coord_x, realm_position.x);
    assert_eq!(army_movable.start_coord_y, realm_position.y);
}

#[test]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn combat_test_army_create_not_owner() {
    let (_, troop_systems_dispatcher, realm_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<'someone_else'>());
    troop_systems_dispatcher.army_create(realm_id, false);
}


#[test]
#[should_panic(expected: ("entity 900 is not a structure", 'ENTRYPOINT_FAILED'))]
fn combat_test_army_create__only_structure_can_create_army() {
    let (_, troop_systems_dispatcher, _realm_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<0>());
    troop_systems_dispatcher.army_create(900, false);
}


#[test]
fn combat_test_army_create___defending_army() {
    let (mut world, troop_systems_dispatcher, realm_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    let army_id = troop_systems_dispatcher.army_create(realm_id, true);

    let realm_position: Position = world.read_model(realm_id);

    let army: Army = world.read_model(army_id);
    assert_eq!(army.troops, Troops { knight_count: 0, paladin_count: 0, crossbowman_count: 0 });
    assert_eq!(army.battle_id, 0);
    assert_eq!(army.battle_side, BattleSide::None);

    let army_entity_owner: EntityOwner = world.read_model(army_id);
    assert_eq!(army_entity_owner.entity_owner_id, realm_id);

    let army_position: Position = world.read_model(army_id);
    assert_eq!(army_position.x, realm_position.x);
    assert_eq!(army_position.y, realm_position.y);

    let army_stamina: Stamina = world.read_model(army_id);
    assert_eq!(army_stamina.last_refill_tick, 0);

    let army_movable: Movable = world.read_model(army_id);
    assert_eq!(army_movable.start_coord_x, 0);
    assert_eq!(army_movable.start_coord_y, 0);

    let army_protectee: Protectee = world.read_model(army_id);
    assert_eq!(army_protectee.protectee_id, realm_id);

    let structure_protector: Protector = world.read_model(realm_id);
    assert_eq!(structure_protector.army_id, army_id);
}


#[test]
#[should_panic(expected: ("Structure 1 already has a defensive army", 'ENTRYPOINT_FAILED'))]
fn combat_test_army_create_defensive_army__only_one_defensive_army() {
    let (_, troop_systems_dispatcher, realm_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    troop_systems_dispatcher.army_create(realm_id, true);
    troop_systems_dispatcher.army_create(realm_id, true);
}
