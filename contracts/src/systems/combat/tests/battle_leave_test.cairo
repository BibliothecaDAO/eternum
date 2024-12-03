use core::array::SpanTrait;

use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
use s0_eternum::alias::ID;
use s0_eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, TickIds};
use s0_eternum::models::combat::{Army, Troops, TroopsTrait, BattleSide, Protectee, Protector, Battle};
use s0_eternum::models::config::{
    TroopConfig, TickConfig, CapacityConfig, CapacityConfigCategory, SpeedConfig, SettlementConfig
};
use s0_eternum::models::movable::{Movable};
use s0_eternum::models::owner::{Owner, EntityOwner};
use s0_eternum::models::position::{Coord, Position};

use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceTrait, ResourceTypes, RESOURCE_PRECISION};
use s0_eternum::models::stamina::Stamina;
use s0_eternum::systems::config::contracts::config_systems;
use s0_eternum::systems::{
    realm::contracts::{realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait},
    combat::contracts::battle_systems::{battle_systems, IBattleContractDispatcher, IBattleContractDispatcherTrait},
    combat::contracts::troop_systems::{troop_systems, ITroopContractDispatcher, ITroopContractDispatcherTrait},
};
use s0_eternum::utils::testing::{
    config::{get_combat_config, set_capacity_config, set_settlement_config}, world::spawn_eternum,
    systems::{deploy_realm_systems, deploy_system, deploy_battle_systems, deploy_troop_systems},
    general::{mint, spawn_realm}
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

fn teleport(ref world: WorldStorage, entity_id: ID, coord: Coord) {
    world.write_model_test(@Position { entity_id, x: coord.x, y: coord.y, });
}


fn set_configurations(ref world: WorldStorage) {
    world.write_model_test(@get_combat_config());
    world
        .write_model_test(
            @TickConfig { config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: 1 }
        );
    world
        .write_model_test(
            @SpeedConfig {
                config_id: WORLD_CONFIG_ID,
                speed_config_id: ARMY_ENTITY_TYPE,
                entity_type: ARMY_ENTITY_TYPE,
                sec_per_km: 200
            }
        );
}

fn setup() -> (WorldStorage, IBattleContractDispatcher, ID, ID, ID, ID, ID, ID) {
    let mut world = spawn_eternum();
    set_configurations(ref world);
    let battle_system_dispatcher = deploy_battle_systems(ref world);
    let troop_system_dispatcher = deploy_troop_systems(ref world);

    let config_systems_address = deploy_system(ref world, "config_systems");
    set_capacity_config(config_systems_address);
    set_settlement_config(config_systems_address);

    starknet::testing::set_block_timestamp(DEFAULT_BLOCK_TIMESTAMP);

    /// CREATE PLAYER_1 REALM AND BUY ARMY TROOPS
    //////////////////////////////////////////////

    starknet::testing::set_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    let player_1_realm_id = spawn_realm(ref world, 1, Coord { x: 1, y: 1 });
    mint(
        ref world,
        player_1_realm_id,
        array![
            (ResourceTypes::KNIGHT, PLAYER_1_STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, PLAYER_1_STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, PLAYER_1_STARTING_PALADIN_COUNT),
        ]
            .span()
    );

    let player_1_army_id = troop_system_dispatcher.army_create(player_1_realm_id, false);
    mint(ref world, player_1_army_id, array![(ResourceTypes::GOLD, ARMY_GOLD_RESOURCE_AMOUNT),].span());

    let player_1_troops = Troops {
        knight_count: PLAYER_1_STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: PLAYER_1_STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: PLAYER_1_STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    troop_system_dispatcher.army_buy_troops(player_1_army_id, player_1_realm_id, player_1_troops);

    /// CREATE PLAYER_2 REALM AND BUY ARMY TROOPS
    //////////////////////////////////////////////

    starknet::testing::set_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    let player_2_realm_id = spawn_realm(ref world, 2, Coord { x: 2, y: 2 });
    mint(
        ref world,
        player_2_realm_id,
        array![
            (ResourceTypes::KNIGHT, PLAYER_2_STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, PLAYER_2_STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, PLAYER_2_STARTING_PALADIN_COUNT),
        ]
            .span()
    );

    let player_2_army_id = troop_system_dispatcher.army_create(player_2_realm_id, false);
    mint(ref world, player_2_army_id, array![(ResourceTypes::GOLD, ARMY_GOLD_RESOURCE_AMOUNT),].span());

    let player_2_troops = Troops {
        knight_count: PLAYER_2_STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: PLAYER_2_STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: PLAYER_2_STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    troop_system_dispatcher.army_buy_troops(player_2_army_id, player_2_realm_id, player_2_troops);

    /// CREATE PLAYER_3 REALM AND BUY ARMY TROOPS
    //////////////////////////////////////////////

    starknet::testing::set_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    let player_3_realm_id = spawn_realm(ref world, 3, Coord { x: 4, y: 4 });
    mint(
        ref world,
        player_3_realm_id,
        array![
            (ResourceTypes::KNIGHT, PLAYER_3_STARTING_KNIGHT_COUNT),
            (ResourceTypes::CROSSBOWMAN, PLAYER_3_STARTING_CROSSBOWMAN_COUNT),
            (ResourceTypes::PALADIN, PLAYER_3_STARTING_PALADIN_COUNT),
        ]
            .span()
    );

    let player_3_army_id = troop_system_dispatcher.army_create(player_3_realm_id, false);
    mint(ref world, player_3_army_id, array![(ResourceTypes::GOLD, ARMY_GOLD_RESOURCE_AMOUNT),].span());

    let player_3_troops = Troops {
        knight_count: PLAYER_3_STARTING_KNIGHT_COUNT.try_into().unwrap(),
        paladin_count: PLAYER_3_STARTING_PALADIN_COUNT.try_into().unwrap(),
        crossbowman_count: PLAYER_3_STARTING_CROSSBOWMAN_COUNT.try_into().unwrap(),
    };
    troop_system_dispatcher.army_buy_troops(player_3_army_id, player_3_realm_id, player_3_troops);

    // put player_1, player_2, player 3 army in the same location
    //////////////////////////////////////////////////////
    teleport(ref world, player_1_army_id, battle_coord());
    teleport(ref world, player_2_army_id, battle_coord());
    teleport(ref world, player_3_army_id, battle_coord());

    (
        world,
        battle_system_dispatcher,
        player_1_realm_id,
        player_2_realm_id,
        player_3_realm_id,
        player_1_army_id,
        player_2_army_id,
        player_3_army_id
    )
}


#[test]
fn combat_test_battle_leave_by_winner() {
    let (
        mut world,
        battle_system_dispatcher,
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
    let battle_id = battle_system_dispatcher.battle_start(player_1_army_id, player_2_army_id);
    // player 3 joins battle against player 1
    // so it's player 1 vs (player 2 & 3)
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    battle_system_dispatcher.battle_join(battle_id, BattleSide::Defence, player_3_army_id);

    let battle: Battle = world.read_model(battle_id);
    assert_ne!(battle.duration_left, 0);

    //////////// WARP TIME TO END OF BATTLE  ////////////////////
    starknet::testing::set_block_timestamp(battle.duration_left + DEFAULT_BLOCK_TIMESTAMP);

    //////////// LEAVE BATTLE  ////////////////////
    /// player 1 leaves battle after it has ended and they won
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_1_REALM_OWNER>());
    battle_system_dispatcher.battle_leave(battle_id, player_1_army_id);

    // ensure the player_1 took all the reward from the contest pot
    // the player_1's gold balance should now be triple since it took
    // (player_2 and player 3)'s gold balance after battle ended
    let player_1_gold_resource: Resource = ResourceImpl::get(ref world, (player_1_army_id, ResourceTypes::GOLD));
    assert_eq!(ARMY_GOLD_RESOURCE_AMOUNT * 3, player_1_gold_resource.balance);

    // ensure player_1's army troop count is correct
    let player_1_army: Army = world.read_model(player_1_army_id);
    assert_eq!(player_1_army.troops.count(), 8_976_000);

    // ensure the battle was updated correctly
    let battle: Battle = world.read_model(battle_id);
    assert_eq!(battle.duration_left, 0);

    assert_eq!(battle.attack_army_health.current, 0);
    assert_eq!(battle.attack_army.troops.count(), 0);
    assert_eq!(battle.attack_army_lifetime.troops.count(), 0);

    assert_eq!(battle.defence_army_health.current, 0);

    assert_eq!(battle.defence_army.troops.count(), 0);
    assert_eq!(battle.defence_army_lifetime.troops.count().into(), 204 * RESOURCE_PRECISION);
}


#[test]
fn combat_test_battle_leave_by_loser() {
    let (
        mut world,
        battle_system_dispatcher,
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
    let battle_id = battle_system_dispatcher.battle_start(player_1_army_id, player_2_army_id);
    // player 3 joins battle against player 1
    // so it's player 1 vs (player 2 & 3)
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_3_REALM_OWNER>());
    battle_system_dispatcher.battle_join(battle_id, BattleSide::Defence, player_3_army_id);

    let battle: Battle = world.read_model(battle_id);
    assert_ne!(battle.duration_left, 0);

    //////////// WARP TIME TO END OF BATTLE  ////////////////////
    starknet::testing::set_block_timestamp(battle.duration_left + DEFAULT_BLOCK_TIMESTAMP);

    //////////// LEAVE BATTLE  ////////////////////
    /// player 2 leaves battle after it has ended and they lost
    starknet::testing::set_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    starknet::testing::set_account_contract_address(contract_address_const::<PLAYER_2_REALM_OWNER>());
    battle_system_dispatcher.battle_leave(battle_id, player_2_army_id);

    // ensure the player_2 took no reward and lost balance
    let player_2_gold_resource: Resource = ResourceImpl::get(ref world, (player_2_army_id, ResourceTypes::GOLD));
    assert_eq!(0, player_2_gold_resource.balance);

    // ensure player_3's army troop count is correct
    let player_2_army: Army = world.read_model(player_2_army_id);
    assert_eq!(player_2_army.troops.count(), 0);
}

