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
    config::{get_combat_config, set_capacity_config}, world::spawn_eternum,
    systems::{deploy_realm_systems, deploy_troop_systems, deploy_system},
    general::{mint, get_default_realm_pos, spawn_realm}
};

use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};

use starknet::ContractAddress;
use starknet::contract_address_const;
use traits::Into;

const DEFAULT_BLOCK_TIMESTAMP: u64 = 3000;
const REALMS_OWNER: felt252 = 'realms_owner';
const STARTING_KNIGHT_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const STARTING_PALADIN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const STARTING_CROSSBOWMAN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;

const REALM_COORD_X: u32 = 2;
const REALM_COORD_Y: u32 = 3;


fn set_configurations(ref world: WorldStorage) {
    world.write_model_test(@get_combat_config());
    world.write_model_test(@TickConfig { config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: 1 });
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

fn setup() -> (WorldStorage, ITroopContractDispatcher, ID, ID) {
    let mut world = spawn_eternum();
    set_configurations(ref world);
    let troop_system_dispatcher = deploy_troop_systems(world);

    let config_systems_address = deploy_system(ref world, config_systems::TEST_CLASS_HASH);
    set_capacity_config(config_systems_address);

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
    let army_id = troop_system_dispatcher.army_create(realm_id, false);

    (world, troop_system_dispatcher, realm_id, army_id)
}


#[test]
fn combat_test_army_buy() {
    let (mut world, troop_systems_dispatcher, realm_id, army_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());

    let troops = Troops {
        knight_count: STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    troop_systems_dispatcher.army_buy_troops(army_id, realm_id, troops);

    let army: Army = world.read_model(army_id);
    assert_eq!(army.troops.knight_count, STARTING_KNIGHT_COUNT.try_into().unwrap());
    assert_eq!(army.troops.paladin_count, STARTING_PALADIN_COUNT.try_into().unwrap());
    assert_eq!(army.troops.crossbowman_count, STARTING_CROSSBOWMAN_COUNT.try_into().unwrap());

    let knight_resource: Resource = ResourceCustomImpl::get(ref world, (realm_id, ResourceTypes::KNIGHT));
    let paladin_resource: Resource = ResourceCustomImpl::get(ref world, (realm_id, ResourceTypes::PALADIN));
    let crossbowman_resource: Resource = ResourceCustomImpl::get(ref world, (realm_id, ResourceTypes::CROSSBOWMAN));
    assert_eq!(knight_resource.balance, 0);
    assert_eq!(paladin_resource.balance, 0);
    assert_eq!(crossbowman_resource.balance, 0);
}


#[test]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 1, resource type: KNIGHT, balance: 0). deduction: 3000000",
        'ENTRYPOINT_FAILED'
    )
)]
fn combat_test_army_buy__not_enough_resources() {
    let (_world, troop_systems_dispatcher, realm_id, army_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());

    let troops = Troops {
        knight_count: STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    troop_systems_dispatcher.army_buy_troops(army_id, realm_id, troops);
    troop_systems_dispatcher.army_buy_troops(army_id, realm_id, troops);
}
