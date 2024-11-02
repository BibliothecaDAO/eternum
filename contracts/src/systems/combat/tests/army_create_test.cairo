use core::array::SpanTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, TickIds};
use eternum::models::combat::{Army, Troops, BattleSide, Protectee, Protector};
use eternum::models::config::{TroopConfig, TickConfig, CapacityConfig, CapacityConfigCategory, SettlementConfig};
use eternum::models::movable::{Movable};
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::position::{Coord, Position};

use eternum::models::resources::{Resource, ResourceCustomImpl, ResourceCustomTrait, ResourceTypes, RESOURCE_PRECISION};
use eternum::models::stamina::Stamina;
use eternum::systems::config::contracts::config_systems;
use eternum::systems::{
    realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::troop_systems::{troop_systems, ITroopContractDispatcher, ITroopContractDispatcherTrait},
};
use eternum::utils::testing::{
    config::get_combat_config, world::spawn_eternum, systems::deploy_realm_systems, systems::deploy_troop_systems,
    general::{mint, get_default_realm_pos, spawn_realm}
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use traits::Into;


use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};


const DEFAULT_BLOCK_TIMESTAMP: u64 = 3000;
const REALMS_OWNER: felt252 = 'realms_owner';
const STARTING_KNIGHT_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const STARTING_PALADIN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const STARTING_CROSSBOWMAN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;

fn set_configurations(ref world: WorldStorage) {
    world.write_model_test(@get_combat_config());
    world.write_model_test(@TickConfig { config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: 1 });
    world.write_model_test(@CapacityConfig { category: CapacityConfigCategory::Army, weight_gram: 300000, });
    world.write_model_test(@SettlementConfig {
        config_id: WORLD_CONFIG_ID,
        radius: 50,
        angle_scaled: 0,
        center: 2147483646,
        min_distance: 1,
        max_distance: 5,
        min_scaling_factor_scaled: 1844674407370955161,
        min_angle_increase: 30,
        max_angle_increase: 100,
    });
}

fn setup() -> (WorldStorage, ITroopContractDispatcher, ID,) {
    let mut world = spawn_eternum();
    set_configurations(ref world);
    let troop_system_dispatcher = deploy_troop_systems(world);

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
            .span()
    );

    (world, troop_system_dispatcher, realm_id,)
}


#[test]
fn combat_test_army_create___attacking_army() {
    let (mut world, troop_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    let army_id = troop_systems_dispatcher.army_create(realm_id, false);

    let realm_position: Position = world.read_model(realm_id);

    let army: Army = world.read_model(army_id);
    assert_eq!(army.troops, Troops { knight_count: 0, paladin_count: 0, crossbowman_count: 0 });
    assert_eq!(army.battle_id, 0);
    assert_eq!(army.battle_side, BattleSide::None);

    let army_entity_owner: EntityOwner = world.read_model(army_id);
    assert_eq!(army_entity_owner.entity_owner_id, realm_id);

    let army_position: Position =  world.read_model(army_id);
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
    let (_, troop_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<'someone_else'>());
    troop_systems_dispatcher.army_create(realm_id, false);
}


#[test]
#[should_panic(expected: ("entity 900 is not a structure", 'ENTRYPOINT_FAILED'))]
fn combat_test_army_create__only_structure_can_create_army() {
    let (_, troop_systems_dispatcher, _realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<0>());
    troop_systems_dispatcher.army_create(900, false);
}


#[test]
fn combat_test_army_create___defending_army() {
    let (mut world, troop_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    let army_id = troop_systems_dispatcher.army_create(realm_id, true);

    let realm_position: Position =  world.read_model(realm_id);

    let army: Army =  world.read_model(army_id);
    assert_eq!(army.troops, Troops { knight_count: 0, paladin_count: 0, crossbowman_count: 0 });
    assert_eq!(army.battle_id, 0);
    assert_eq!(army.battle_side, BattleSide::None);

    let army_entity_owner: EntityOwner =  world.read_model(army_id);
    assert_eq!(army_entity_owner.entity_owner_id, realm_id);

    let army_position: Position =  world.read_model(army_id);
    assert_eq!(army_position.x, realm_position.x);
    assert_eq!(army_position.y, realm_position.y);

    let army_stamina: Stamina =  world.read_model(army_id);
    assert_eq!(army_stamina.last_refill_tick, 0);

    let army_movable: Movable =  world.read_model(army_id);
    assert_eq!(army_movable.start_coord_x, 0);
    assert_eq!(army_movable.start_coord_y, 0);

    let army_protectee: Protectee =  world.read_model(army_id);
    assert_eq!(army_protectee.protectee_id, realm_id);

    let structure_protector: Protector =  world.read_model(army_id);
    assert_eq!(structure_protector.army_id, army_id);
}


#[test]
#[should_panic(expected: ("Structure 1 already has a defensive army", 'ENTRYPOINT_FAILED'))]
fn combat_test_army_create_defensive_army__only_one_defensive_army() {
    let (_, troop_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    troop_systems_dispatcher.army_create(realm_id, true);
    troop_systems_dispatcher.army_create(realm_id, true);
}
