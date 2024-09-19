use core::array::SpanTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, TickIds};
use eternum::models::combat::{Army, Troops, BattleSide, Protectee, Protector};
use eternum::models::config::{
    TroopConfig, TickConfig, CapacityConfig, CapacityConfigCategory, SettlementConfig
};
use eternum::models::movable::{Movable};
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::position::{Coord, Position};

use eternum::models::resources::{
    Resource, ResourceCustomImpl, ResourceCustomTrait, ResourceTypes, RESOURCE_PRECISION
};
use eternum::models::stamina::Stamina;
use eternum::systems::config::contracts::config_systems;
use eternum::systems::{
    realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::{combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait},
};
use eternum::utils::testing::{
    config::get_combat_config, world::spawn_eternum, systems::deploy_realm_systems,
    systems::deploy_combat_systems, general::mint
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
            TickConfig {
                config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: 1
            },
            CapacityConfig { category: CapacityConfigCategory::Army, weight_gram: 300000, },
            SettlementConfig {
                config_id: WORLD_CONFIG_ID,
                radius: 50,
                angle_scaled: 0,
                center: 2147483646,
                min_distance: 1,
                max_distance: 5,
                min_scaling_factor_scaled: 1844674407370955161,
                min_radius_increase: 30,
                max_radius_increase: 100,
            }
        )
    )
}

fn setup() -> (IWorldDispatcher, ICombatContractDispatcher, ID,) {
    let world = spawn_eternum();
    set_configurations(world);
    let realm_system_dispatcher = deploy_realm_systems(world);
    let combat_system_dispatcher = deploy_combat_systems(world);

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

    (world, combat_system_dispatcher, realm_id,)
}


#[test]
fn test_army_create___attacking_army() {
    let (world, combat_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<REALMS_OWNER>());
    let army_id = combat_systems_dispatcher.army_create(realm_id, false);

    let army: Army = get!(world, army_id, Army);
    assert_eq!(army.troops, Troops { knight_count: 0, paladin_count: 0, crossbowman_count: 0 });
    assert_eq!(army.battle_id, 0);
    assert_eq!(army.battle_side, BattleSide::None);

    let army_entity_owner: EntityOwner = get!(world, army_id, EntityOwner);
    assert_eq!(army_entity_owner.entity_owner_id, realm_id);

    let army_position: Position = get!(world, army_id, Position);
    assert_eq!(army_position.x, REALM_COORD_X);
    assert_eq!(army_position.y, REALM_COORD_Y);

    let army_stamina: Stamina = get!(world, army_id, Stamina);
    assert_ne!(army_stamina.last_refill_tick, 0);

    let army_movable: Movable = get!(world, army_id, Movable);
    assert_eq!(army_movable.start_coord_x, REALM_COORD_X);
    assert_eq!(army_movable.start_coord_y, REALM_COORD_Y);
}

#[test]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn test_army_create_not_owner() {
    let (_, combat_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<'someone_else'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'someone_else'>());
    combat_systems_dispatcher.army_create(realm_id, false);
}


#[test]
#[should_panic(expected: ("entity 900 is not a structure", 'ENTRYPOINT_FAILED'))]
fn test_army_create__only_structure_can_create_army() {
    let (_, combat_systems_dispatcher, _realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<0>());
    starknet::testing::set_account_contract_address(contract_address_const::<0>());
    combat_systems_dispatcher.army_create(900, false);
}


#[test]
fn test_army_create___defending_army() {
    let (world, combat_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<REALMS_OWNER>());
    let army_id = combat_systems_dispatcher.army_create(realm_id, true);

    let army: Army = get!(world, army_id, Army);
    assert_eq!(army.troops, Troops { knight_count: 0, paladin_count: 0, crossbowman_count: 0 });
    assert_eq!(army.battle_id, 0);
    assert_eq!(army.battle_side, BattleSide::None);

    let army_entity_owner: EntityOwner = get!(world, army_id, EntityOwner);
    assert_eq!(army_entity_owner.entity_owner_id, realm_id);

    let army_position: Position = get!(world, army_id, Position);
    assert_eq!(army_position.x, REALM_COORD_X);
    assert_eq!(army_position.y, REALM_COORD_Y);

    let army_stamina: Stamina = get!(world, army_id, Stamina);
    assert_eq!(army_stamina.last_refill_tick, 0);

    let army_movable: Movable = get!(world, army_id, Movable);
    assert_eq!(army_movable.start_coord_x, 0);
    assert_eq!(army_movable.start_coord_y, 0);

    let army_protectee: Protectee = get!(world, army_id, Protectee);
    assert_eq!(army_protectee.protectee_id, realm_id);

    let structure_protector: Protector = get!(world, realm_id, Protector);
    assert_eq!(structure_protector.army_id, army_id);
}


#[test]
#[should_panic(expected: ("Structure 1 already has a defensive army", 'ENTRYPOINT_FAILED'))]
fn test_army_create_defensive_army__only_one_defensive_army() {
    let (_, combat_systems_dispatcher, realm_id,) = setup();
    starknet::testing::set_contract_address(contract_address_const::<REALMS_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<REALMS_OWNER>());
    combat_systems_dispatcher.army_create(realm_id, true);
    combat_systems_dispatcher.army_create(realm_id, true);
}
