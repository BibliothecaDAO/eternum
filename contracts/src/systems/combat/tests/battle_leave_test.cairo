use core::array::SpanTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, TickIds};
use eternum::models::combat::{Army, Troops, TroopsTrait, BattleSide, Protectee, Protector, Battle};
use eternum::models::config::{TroopConfig, TickConfig, CapacityConfig, CapacityConfigCategory, SpeedConfig};
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
    systems::{deploy_realm_systems, deploy_system, deploy_combat_systems}, general::mint
};
use starknet::ContractAddress;
use starknet::contract_address_const;
use traits::Into;

const DEFAULT_BLOCK_TIMESTAMP: u64 = 3000;
const PLAYER_1_REALM_OWNER: felt252 = 'player_1_realm_owner';
const PLAYER_2_REALM_OWNER: felt252 = 'player_2_realm_owner';
const PLAYER_3_REALM_OWNER: felt252 = 'player_3_realm_owner';

// attack army has significantly less troops so that defeat is easy
const PLAYER_1_STARTING_KNIGHT_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const PLAYER_1_STARTING_PALADIN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;
const PLAYER_1_STARTING_CROSSBOWMAN_COUNT: u128 = 3_000 * RESOURCE_PRECISION;

const PLAYER_2_STARTING_KNIGHT_COUNT: u128 = 1 * RESOURCE_PRECISION;
const PLAYER_2_STARTING_PALADIN_COUNT: u128 = 1 * RESOURCE_PRECISION;
const PLAYER_2_STARTING_CROSSBOWMAN_COUNT: u128 = 100 * RESOURCE_PRECISION;


const PLAYER_3_STARTING_KNIGHT_COUNT: u128 = 1 * RESOURCE_PRECISION;
const PLAYER_3_STARTING_PALADIN_COUNT: u128 = 1 * RESOURCE_PRECISION;
const PLAYER_3_STARTING_CROSSBOWMAN_COUNT: u128 = 100 * RESOURCE_PRECISION;

const ARMY_GOLD_RESOURCE_AMOUNT: u128 = 5_000 * RESOURCE_PRECISION;

const PLAYER_1_REALM_COORD_X: u32 = 2;
const PLAYER_1_REALM_COORD_Y: u32 = 3;

const PLAYER_2_REALM_COORD_X: u32 = 4;
const PLAYER_2_REALM_COORD_Y: u32 = 5;

const PLAYER_3_REALM_COORD_X: u32 = 6;
const PLAYER_3_REALM_COORD_Y: u32 = 7;

const BATTLE_COORD_X: u32 = 8;
const BATTLE_COORD_Y: u32 = 9;

fn battle_coord() -> Coord {
    Coord { x: BATTLE_COORD_X, y: BATTLE_COORD_Y, }
}

fn teleport(world: IWorldDispatcher, entity_id: ID, coord: Coord) {
    set!(world, (Position { entity_id, x: coord.x, y: coord.y, }));
}


fn set_configurations(world: IWorldDispatcher) {
    set!(
        world,
        (
            get_combat_config(),
            TickConfig { config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: 1 },
            SpeedConfig {
                config_id: WORLD_CONFIG_ID,
                speed_config_id: ARMY_ENTITY_TYPE,
                entity_type: ARMY_ENTITY_TYPE,
                sec_per_km: 200
            }
        )
    )
}

fn setup() -> (IWorldDispatcher, ICombatContractDispatcher, ID, ID, ID, ID, ID, ID) {
    let world = spawn_eternum();
    set_configurations(world);
    let realm_system_dispatcher = deploy_realm_systems(world);
    let combat_system_dispatcher = deploy_combat_systems(world);

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    set_capacity_config(config_systems_address);

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP);

    /// CREATE PLAYER_1 REALM AND BUY ARMY TROOPS
    //////////////////////////////////////////////

    starknet::testing::set_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    let player_1_realm_id = realm_system_dispatcher
        .create(
            1, 1, 1, 1, 1, 1, 1, 1, 1, Position { entity_id: 0, x: PLAYER_1_REALM_COORD_X, y: PLAYER_1_REALM_COORD_Y }
        );
    mint(
        world,
        player_1_realm_id,
        array![
            (ResourceTypes::KNIGHT, PLAYER_1_STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, PLAYER_1_STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, PLAYER_1_STARTING_PALADIN_COUNT),
        ]
            .span()
    );

    let player_1_army_id = combat_system_dispatcher.army_create(player_1_realm_id, false);
    mint(world, player_1_army_id, array![(ResourceTypes::GOLD, ARMY_GOLD_RESOURCE_AMOUNT),].span());

    let player_1_troops = Troops {
        knight_count: PLAYER_1_STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: PLAYER_1_STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: PLAYER_1_STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    combat_system_dispatcher.army_buy_troops(player_1_army_id, player_1_realm_id, player_1_troops);

    /// CREATE PLAYER_2 REALM AND BUY ARMY TROOPS
    //////////////////////////////////////////////

    starknet::testing::set_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    let player_2_realm_id = realm_system_dispatcher
        .create(
            1, 1, 1, 1, 1, 1, 1, 1, 1, Position { entity_id: 0, x: PLAYER_2_REALM_COORD_X, y: PLAYER_2_REALM_COORD_Y }
        );
    mint(
        world,
        player_2_realm_id,
        array![
            (ResourceTypes::KNIGHT, PLAYER_2_STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, PLAYER_2_STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, PLAYER_2_STARTING_PALADIN_COUNT),
        ]
            .span()
    );

    let player_2_army_id = combat_system_dispatcher.army_create(player_2_realm_id, false);
    mint(world, player_2_army_id, array![(ResourceTypes::GOLD, ARMY_GOLD_RESOURCE_AMOUNT),].span());

    let player_2_troops = Troops {
        knight_count: PLAYER_2_STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: PLAYER_2_STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: PLAYER_2_STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    combat_system_dispatcher.army_buy_troops(player_2_army_id, player_2_realm_id, player_2_troops);

    /// CREATE PLAYER_3 REALM AND BUY ARMY TROOPS
    //////////////////////////////////////////////

    starknet::testing::set_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    let player_3_realm_id = realm_system_dispatcher
        .create(
            1, 1, 1, 1, 1, 1, 1, 1, 1, Position { entity_id: 0, x: PLAYER_3_REALM_COORD_X, y: PLAYER_3_REALM_COORD_Y }
        );
    mint(
        world,
        player_3_realm_id,
        array![
            (ResourceTypes::KNIGHT, PLAYER_3_STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, PLAYER_3_STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, PLAYER_3_STARTING_PALADIN_COUNT),
        ]
            .span()
    );

    let player_3_army_id = combat_system_dispatcher.army_create(player_3_realm_id, false);
    mint(world, player_3_army_id, array![(ResourceTypes::GOLD, ARMY_GOLD_RESOURCE_AMOUNT),].span());

    let player_3_troops = Troops {
        knight_count: PLAYER_3_STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: PLAYER_3_STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: PLAYER_3_STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    combat_system_dispatcher.army_buy_troops(player_3_army_id, player_3_realm_id, player_3_troops);

    // put player_1, player_2, player 3 army in the same location
    //////////////////////////////////////////////////////
    teleport(world, player_1_army_id, battle_coord());
    teleport(world, player_2_army_id, battle_coord());
    teleport(world, player_3_army_id, battle_coord());

    (
        world,
        combat_system_dispatcher,
        player_1_realm_id,
        player_2_realm_id,
        player_3_realm_id,
        player_1_army_id,
        player_2_army_id,
        player_3_army_id
    )
}


#[test]
fn test_battle_leave_by_winner() {
    let (
        world,
        combat_system_dispatcher,
        _player_1_realm_id,
        _player_2_realm_id,
        _player_3_realm_id,
        player_1_army_id,
        player_2_army_id,
        player_3_army_id
    ) =
        setup();

    //////////// START BATTLE ////////////////////
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());

    // player 1 starts battle against player 2
    let battle_id = combat_system_dispatcher.battle_start(player_1_army_id, player_2_army_id);
    // player 3 joins battle against player 1
    // so it's player 1 vs (player 2 & 3)
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    combat_system_dispatcher.battle_join(battle_id, BattleSide::Defence, player_3_army_id);

    let battle: Battle = get!(world, battle_id, Battle);
    assert_ne!(battle.duration_left, 0);

    //////////// WARP TIME TO END OF BATTLE  ////////////////////
    starknet::testing::set_block_timestamp(battle.duration_left + DEFAULT_BLOCK_TIMESTAMP);

    //////////// LEAVE BATTLE  ////////////////////
    /// player 1 leaves battle after it has ended and they won
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    combat_system_dispatcher.battle_leave(battle_id, player_1_army_id);

    // ensure the player_1 took all the reward from the contest pot
    // the player_1's gold balance should now be triple since it took
    // (player_2 and player 3)'s gold balance after battle ended
    let player_1_gold_resource: Resource = ResourceCustomImpl::get(world, (player_1_army_id, ResourceTypes::GOLD));
    assert_eq!(ARMY_GOLD_RESOURCE_AMOUNT * 3, player_1_gold_resource.balance);

    // ensure player_1's army troop count is correct
    let player_1_army: Army = get!(world, player_1_army_id, Army);
    assert_eq!(player_1_army.troops.count(), 8_745_000);

    // ensure the battle was updated correctly
    let battle: Battle = get!(world, battle_id, Battle);
    assert_eq!(battle.duration_left, 0);

    assert_eq!(battle.attack_army_health.current, 0);
    assert_eq!(battle.attack_army.troops.count(), 0);
    assert_eq!(battle.attack_army_lifetime.troops.count(), 0);

    assert_eq!(battle.defence_army_health.current, 0);

    assert_ne!(battle.defence_army.troops.count(), 0);
    assert_ne!(battle.defence_army_lifetime.troops.count(), 0);
}


#[test]
fn test_battle_leave_by_loser() {
    let (
        world,
        combat_system_dispatcher,
        _player_1_realm_id,
        _player_2_realm_id,
        _player_3_realm_id,
        player_1_army_id,
        player_2_army_id,
        player_3_army_id
    ) =
        setup();

    //////////// START BATTLE ////////////////////
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());

    // player 1 starts battle against player 2
    let battle_id = combat_system_dispatcher.battle_start(player_1_army_id, player_2_army_id);
    // player 3 joins battle against player 1
    // so it's player 1 vs (player 2 & 3)
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    combat_system_dispatcher.battle_join(battle_id, BattleSide::Defence, player_3_army_id);

    let battle: Battle = get!(world, battle_id, Battle);
    assert_ne!(battle.duration_left, 0);

    //////////// WARP TIME TO END OF BATTLE  ////////////////////
    starknet::testing::set_block_timestamp(battle.duration_left + DEFAULT_BLOCK_TIMESTAMP);

    //////////// LEAVE BATTLE  ////////////////////
    /// player 2 leaves battle after it has ended and they lost
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    combat_system_dispatcher.battle_leave(battle_id, player_2_army_id);

    // ensure the player_2 took no reward and lost balance
    let player_2_gold_resource: Resource = ResourceCustomImpl::get(world, (player_2_army_id, ResourceTypes::GOLD));
    assert_eq!(0, player_2_gold_resource.balance);

    // ensure player_3's army troop count is correct
    let player_2_army: Army = get!(world, player_2_army_id, Army);
    assert_eq!(player_2_army.troops.count(), 0);
}

