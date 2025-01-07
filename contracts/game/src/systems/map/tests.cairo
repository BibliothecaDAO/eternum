use core::traits::TryInto;

use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
use s0_eternum::alias::ID;

use s0_eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, TickIds};

use s0_eternum::models::combat::{Battle};
use s0_eternum::models::combat::{Health, Troops};
use s0_eternum::models::config::{
    TickConfig, TickImpl, StaminaConfig, TravelStaminaCostConfig, CapacityConfig, CapacityConfigCategory
};
use s0_eternum::models::map::Tile;
use s0_eternum::models::movable::{Movable};
use s0_eternum::models::owner::{EntityOwner, Owner};
use s0_eternum::models::position::{Position, Coord, CoordTrait, Direction};
use s0_eternum::models::production::{Production, ProductionDeadline};
use s0_eternum::models::quantity::Quantity;

use s0_eternum::models::realm::Realm;
use s0_eternum::models::resources::{Resource, RESOURCE_PRECISION, ResourceFoodImpl};
use s0_eternum::models::stamina::Stamina;
use s0_eternum::models::structure::{Structure, StructureCategory, StructureCount,};
use s0_eternum::models::weight::Weight;

use s0_eternum::systems::combat::contracts::battle_systems::{
    battle_systems, IBattleContractDispatcher, IBattleContractDispatcherTrait, IBattlePillageContractDispatcher,
    IBattlePillageContractDispatcherTrait
};
use s0_eternum::systems::combat::contracts::troop_systems::{
    troop_systems, ITroopContractDispatcher, ITroopContractDispatcherTrait
};

use s0_eternum::systems::config::contracts::{
    config_systems, IMapConfigDispatcher, IMapConfigDispatcherTrait, IWeightConfigDispatcher,
    IWeightConfigDispatcherTrait, IStaminaConfigDispatcher, IStaminaConfigDispatcherTrait, IMercenariesConfigDispatcher,
    IMercenariesConfigDispatcherTrait,
};

use s0_eternum::systems::dev::contracts::resource::IResourceSystemsDispatcherTrait;

use s0_eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;

use s0_eternum::systems::map::contracts::{map_systems, IMapSystemsDispatcher, IMapSystemsDispatcherTrait};
use s0_eternum::systems::map::map_generation::map_generation_systems::{InternalMapGenerationSystemsImpl};

use s0_eternum::systems::transport::contracts::travel_systems::{
    travel_systems, ITravelSystemsDispatcher, ITravelSystemsDispatcherTrait
};

use s0_eternum::utils::testing::{
    world::{spawn_eternum},
    systems::{
        deploy_realm_systems, deploy_battle_systems, deploy_system, deploy_map_systems, deploy_dev_resource_systems,
        deploy_troop_systems, deploy_battle_pillage_systems
    },
    general::{spawn_realm, get_default_realm_pos, create_army_with_troops},
    config::{
        set_combat_config, set_stamina_config, set_capacity_config, set_speed_config, set_mercenaries_config,
        set_settlement_config, set_tick_config, set_map_config, set_weight_config, set_mine_production_config,
        set_travel_food_cost_config
    },
    constants::{
        MAP_EXPLORE_EXPLORATION_WHEAT_BURN_AMOUNT, MAP_EXPLORE_EXPLORATION_FISH_BURN_AMOUNT,
        EARTHEN_SHARD_PRODUCTION_AMOUNT_PER_TICK
    },
    config::set_travel_and_explore_stamina_cost_config
};

use starknet::contract_address_const;

const INITIAL_WHEAT_BALANCE: u128 = 500_000_000;
const INITIAL_FISH_BALANCE: u128 = 500_000_000;
const INITIAL_KNIGHT_BALANCE: u128 = 10_000_000;
const INITIAL_PALADIN_BALANCE: u128 = 10_000_000;
const INITIAL_CROSSBOWMAN_BALANCE: u128 = 10_000_000;

const TIMESTAMP: u64 = 10_000;

const TICK_INTERVAL_IN_SECONDS: u64 = 7_200;

#[test]
fn map_test_map_explore() {
    let (mut world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, _) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'realm_owner'>());

    let (initial_realm_wheat, initial_realm_fish) = ResourceFoodImpl::get(ref world, realm_entity_id);
    assert_eq!(initial_realm_wheat.balance, INITIAL_WHEAT_BALANCE, "wrong initial wheat balance");
    assert_eq!(initial_realm_fish.balance, INITIAL_FISH_BALANCE, "wrong initial wheat balance");

    starknet::testing::set_transaction_hash('hellothash');

    let mut army_position: Position = world.read_model(realm_army_unit_id);
    let mut army_coord: Coord = army_position.into();
    let explore_tile_direction: Direction = Direction::West;

    map_systems_dispatcher.explore(realm_army_unit_id, explore_tile_direction);

    let expected_explored_coord = army_coord.neighbor(explore_tile_direction);

    // ensure that Tile model is correct
    let explored_tile: Tile = world.read_model((expected_explored_coord.x, expected_explored_coord.y));
    assert_eq!(explored_tile.col, explored_tile.col, "wrong col");
    assert_eq!(explored_tile.row, explored_tile.row, "wrong row");
    assert_eq!(explored_tile.explored_by_id, realm_army_unit_id, "wrong realm owner");
    assert_eq!(explored_tile.explored_at, TIMESTAMP + TICK_INTERVAL_IN_SECONDS, "wrong exploration time");

    // ensure that the right amount of food was burnt
    let expected_wheat_balance = INITIAL_WHEAT_BALANCE
        - (MAP_EXPLORE_EXPLORATION_WHEAT_BURN_AMOUNT
            * (INITIAL_KNIGHT_BALANCE + INITIAL_PALADIN_BALANCE + INITIAL_CROSSBOWMAN_BALANCE));
    let expected_fish_balance = INITIAL_FISH_BALANCE
        - (MAP_EXPLORE_EXPLORATION_FISH_BURN_AMOUNT
            * (INITIAL_KNIGHT_BALANCE + INITIAL_PALADIN_BALANCE + INITIAL_CROSSBOWMAN_BALANCE));
    let (realm_wheat, realm_fish) = ResourceFoodImpl::get(ref world, realm_entity_id);
    assert_eq!(realm_wheat.balance, expected_wheat_balance, "wrong wheat balance");
    assert_eq!(realm_fish.balance, expected_fish_balance, "wrong wheat balance");

    let mut new_army_position: Position = world.read_model(realm_army_unit_id);
    let mut new_army_coord: Coord = new_army_position.into();
    assert_eq!(new_army_coord, expected_explored_coord);
}

#[test]
fn map_test_map_explore__mine_mercenaries_protector() {
    let (mut world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, battle_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'realm_owner'>());

    let (initial_realm_wheat, initial_realm_fish) = ResourceFoodImpl::get(ref world, realm_entity_id);
    assert_eq!(initial_realm_wheat.balance, INITIAL_WHEAT_BALANCE, "wrong initial wheat balance");
    assert_eq!(initial_realm_fish.balance, INITIAL_FISH_BALANCE, "wrong initial wheat balance");

    let explore_tile_direction: Direction = Direction::West;

    map_systems_dispatcher.explore(realm_army_unit_id, explore_tile_direction);

    let army_position: Position = world.read_model(realm_army_unit_id);

    let mine_entity_id = InternalMapGenerationSystemsImpl::create_shard_mine_structure(ref world, army_position.into());
    let mine_entity_owner: EntityOwner = world.read_model(mine_entity_id);
    assert_eq!(mine_entity_owner.entity_owner_id, mine_entity_id, "wrong initial owner");

    let seed = 'I AM SEED FOR THE DEV BANK'.into() - starknet::get_block_timestamp().into();

    let mercenary_entity_id = InternalMapGenerationSystemsImpl::add_mercenaries_to_structure(
        ref world, seed, mine_entity_id
    );

    let battle_entity_id = battle_systems_dispatcher.battle_start(realm_army_unit_id, mercenary_entity_id);
    let battle: Battle = world.read_model(battle_entity_id);
    let current_ts = starknet::get_block_timestamp();
    starknet::testing::set_block_timestamp(current_ts + battle.duration_left);

    battle_systems_dispatcher.battle_leave(battle_entity_id, realm_army_unit_id);
    battle_systems_dispatcher.battle_claim(realm_army_unit_id, mine_entity_id);

    let mine_owner: Owner = world.read_model(mine_entity_id);
    let mine_owner_address: starknet::ContractAddress = mine_owner.address;
    let realm_owner: Owner = world.read_model(realm_entity_id);
    let realm_owner_address: starknet::ContractAddress = realm_owner.address;

    assert_eq!(mine_owner_address, realm_owner_address, "wrong final owner");
}

#[test]
fn map_test_map_explore__mine_production_deadline() {
    let (mut world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, _battle_systems_dispatcher,) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());

    let (initial_realm_wheat, initial_realm_fish) = ResourceFoodImpl::get(ref world, realm_entity_id);
    assert_eq!(initial_realm_wheat.balance, INITIAL_WHEAT_BALANCE, "wrong initial wheat balance");
    assert_eq!(initial_realm_fish.balance, INITIAL_FISH_BALANCE, "wrong initial wheat balance");

    let explore_tile_direction: Direction = Direction::West;
    map_systems_dispatcher.explore(realm_army_unit_id, explore_tile_direction);

    let army_position: Position = world.read_model(realm_army_unit_id);
    let mine_entity_id = InternalMapGenerationSystemsImpl::create_shard_mine_structure(ref world, army_position.into());
    InternalMapGenerationSystemsImpl::add_production_deadline(ref world, 'randomness'.into(), mine_entity_id);
    let mine_earthen_shard_production_deadline: ProductionDeadline = world.read_model(mine_entity_id);

    let current_ts = starknet::get_block_timestamp();
    let min_deadline = current_ts
        + (100_000 * RESOURCE_PRECISION / EARTHEN_SHARD_PRODUCTION_AMOUNT_PER_TICK).try_into().unwrap();
    let max_deadline = current_ts
        + (10 * 100_000 * RESOURCE_PRECISION / EARTHEN_SHARD_PRODUCTION_AMOUNT_PER_TICK).try_into().unwrap();
    assert_ge!(mine_earthen_shard_production_deadline.deadline_tick, min_deadline);
    assert_le!(mine_earthen_shard_production_deadline.deadline_tick, max_deadline);
}


fn setup() -> (WorldStorage, ID, ID, IMapSystemsDispatcher, IBattleContractDispatcher) {
    let mut world = spawn_eternum();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let config_systems_address = deploy_system(ref world, "config_systems");

    set_combat_config(config_systems_address);
    set_capacity_config(config_systems_address);
    set_stamina_config(config_systems_address);
    set_speed_config(config_systems_address);
    set_mercenaries_config(config_systems_address);
    set_settlement_config(config_systems_address);
    set_tick_config(config_systems_address);
    set_map_config(config_systems_address);
    set_weight_config(config_systems_address);
    set_mine_production_config(config_systems_address);
    set_travel_and_explore_stamina_cost_config(config_systems_address);
    set_travel_food_cost_config(config_systems_address);

    world
        .write_model_test(@CapacityConfig { category: CapacityConfigCategory::Storehouse, weight_gram: 1_000_000_000 });

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'realm_owner'>());

    let battle_systems_dispatcher = deploy_battle_systems(ref world);
    let troop_systems_dispatcher = deploy_troop_systems(ref world);
    let map_systems_dispatcher = deploy_map_systems(ref world);

    let realm_position = get_default_realm_pos();
    let realm_entity_id = spawn_realm(ref world, 1, realm_position.into());

    deploy_dev_resource_systems(ref world)
        .mint(
            realm_entity_id,
            array![
                (ResourceTypes::WHEAT, INITIAL_WHEAT_BALANCE),
                (ResourceTypes::FISH, INITIAL_FISH_BALANCE),
                (ResourceTypes::KNIGHT, INITIAL_KNIGHT_BALANCE),
                (ResourceTypes::PALADIN, INITIAL_PALADIN_BALANCE),
                (ResourceTypes::CROSSBOWMAN, INITIAL_CROSSBOWMAN_BALANCE)
            ]
                .span()
        );

    let troops = Troops {
        knight_count: INITIAL_KNIGHT_BALANCE.try_into().unwrap(),
        paladin_count: INITIAL_PALADIN_BALANCE.try_into().unwrap(),
        crossbowman_count: INITIAL_CROSSBOWMAN_BALANCE.try_into().unwrap()
    };
    let realm_army_unit_id: ID = create_army_with_troops(
        ref world, troop_systems_dispatcher, realm_entity_id, troops, false
    );

    // ensure initial stamina is 0
    let realm_army_unit_stamina: Stamina = world.read_model(realm_army_unit_id);
    assert!(realm_army_unit_stamina.amount.is_zero(), "stamina should be zero");

    // move to next tick
    let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
    let current_ts = starknet::get_block_timestamp();
    starknet::testing::set_block_timestamp(current_ts + armies_tick_config.tick_interval_in_seconds);

    (world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, battle_systems_dispatcher)
}

