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
    combat::contracts::{combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait},
};
use eternum::utils::testing::{
    config::{get_combat_config, set_capacity_config}, world::spawn_eternum,
    systems::{deploy_realm_systems, deploy_combat_systems, deploy_system}, general::mint
};

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


fn set_configurations(world: IWorldDispatcher) {
    set!(
        world,
        (
            get_combat_config(),
            TickConfig { config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: 1 },
            SettlementConfig {
                config_id: WORLD_CONFIG_ID,
                radius: 50,
                angle_scaled: 0,
                center: 2147483646,
                min_distance: 1,
                max_distance: 5,
                min_scaling_factor_scaled: 1844674407370955161,
                min_angle_increase: 30,
                max_angle_increase: 100,
            }
        )
    )
}

fn setup() -> (IWorldDispatcher, ICombatContractDispatcher, ID, ID) {
    let world = spawn_eternum();
    set_configurations(world);
    let realm_system_dispatcher = deploy_realm_systems(world);
    let combat_system_dispatcher = deploy_combat_systems(world);

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    set_capacity_config(config_systems_address);

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP);
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<REALMS_OWNER>());

    let realm_id = realm_system_dispatcher.create('Mysticora', 1, 1, 1, 1, 1, 1, 1, 1, 1);
    mint(
        world,
        realm_id,
        array![
            (ResourceTypes::KNIGHT, STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, STARTING_PALADIN_COUNT),
        ]
            .span()
    );
    let army_id = combat_system_dispatcher.army_create(realm_id, false);

    (world, combat_system_dispatcher, realm_id, army_id)
}


#[test]
fn combat_test_army_buy() {
    let (world, combat_systems_dispatcher, realm_id, army_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<REALMS_OWNER>());

    let troops = Troops {
        knight_count: STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    combat_systems_dispatcher.army_buy_troops(army_id, realm_id, troops);

    let army: Army = get!(world, army_id, Army);
    assert_eq!(army.troops.knight_count, STARTING_KNIGHT_COUNT.try_into().unwrap());
    assert_eq!(army.troops.paladin_count, STARTING_PALADIN_COUNT.try_into().unwrap());
    assert_eq!(army.troops.crossbowman_count, STARTING_CROSSBOWMAN_COUNT.try_into().unwrap());

    let knight_resource: Resource = ResourceCustomImpl::get(world, (realm_id, ResourceTypes::KNIGHT));
    let paladin_resource: Resource = ResourceCustomImpl::get(world, (realm_id, ResourceTypes::PALADIN));
    let crossbowman_resource: Resource = ResourceCustomImpl::get(world, (realm_id, ResourceTypes::CROSSBOWMAN));
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
    let (_world, combat_systems_dispatcher, realm_id, army_id) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<REALMS_OWNER>());

    let troops = Troops {
        knight_count: STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    combat_systems_dispatcher.army_buy_troops(army_id, realm_id, troops);
    combat_systems_dispatcher.army_buy_troops(army_id, realm_id, troops);
}
