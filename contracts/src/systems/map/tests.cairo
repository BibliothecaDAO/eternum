use core::traits::TryInto;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, TickIds};

use eternum::models::capacity::Capacity;
use eternum::models::combat::{Battle};
use eternum::models::combat::{Health, Troops};
use eternum::models::config::{TickConfig, TickImpl, StaminaConfig};
use eternum::models::map::Tile;
use eternum::models::movable::{Movable};
use eternum::models::owner::{EntityOwner, Owner};
use eternum::models::position::{Position, Coord, CoordTrait, Direction};
use eternum::models::quantity::Quantity;
use eternum::models::realm::Realm;
use eternum::models::resources::{Resource, ResourceFoodImpl};
use eternum::models::stamina::Stamina;
use eternum::models::structure::{Structure, StructureCategory, StructureCount,};
use eternum::models::weight::Weight;

use eternum::systems::combat::contracts::{combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait};

use eternum::systems::config::contracts::{
    config_systems, IRealmFreeMintConfigDispatcher, IRealmFreeMintConfigDispatcherTrait, IMapConfigDispatcher,
    IMapConfigDispatcherTrait, IWeightConfigDispatcher, IWeightConfigDispatcherTrait, IStaminaConfigDispatcher,
    IStaminaConfigDispatcherTrait, IMercenariesConfigDispatcher, IMercenariesConfigDispatcherTrait,
};

use eternum::systems::dev::contracts::resource::IResourceSystemsDispatcherTrait;

use eternum::systems::map::contracts::map_systems::InternalMapSystemsImpl;

use eternum::systems::map::contracts::{map_systems, IMapSystemsDispatcher, IMapSystemsDispatcherTrait};

use eternum::systems::transport::contracts::travel_systems::{
    travel_systems, ITravelSystemsDispatcher, ITravelSystemsDispatcherTrait
};

use eternum::utils::testing::{
    world::{spawn_eternum},
    systems::{
        deploy_realm_systems, deploy_combat_systems, deploy_system, deploy_map_systems, deploy_dev_resource_systems
    },
    general::{spawn_realm, get_default_realm_pos, create_army_with_troops},
    config::{
        set_combat_config, set_stamina_config, set_capacity_config, set_speed_config, set_mercenaries_config,
        set_tick_config, set_exploration_config, set_weight_config
    },
    constants::{MAP_EXPLORE_WHEAT_BURN_AMOUNT, MAP_EXPLORE_FISH_BURN_AMOUNT}
};

use starknet::contract_address_const;

const INITIAL_WHEAT_BALANCE: u128 = 1_000_000;
const INITIAL_FISH_BALANCE: u128 = 1_000_000;
const INITIAL_KNIGHT_BALANCE: u128 = 100_000_000;

const TIMESTAMP: u64 = 10_000;

const TICK_INTERVAL_IN_SECONDS: u64 = 7_200;

#[test]
fn test_map_explore() {
    let (world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, _) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'realm_owner'>());

    let (initial_realm_wheat, initial_realm_fish) = ResourceFoodImpl::get(world, realm_entity_id);
    assert_eq!(initial_realm_wheat.balance, INITIAL_WHEAT_BALANCE, "wrong initial wheat balance");
    assert_eq!(initial_realm_fish.balance, INITIAL_FISH_BALANCE, "wrong initial wheat balance");

    starknet::testing::set_transaction_hash('hellothash');

    let mut army_coord: Coord = get!(world, realm_army_unit_id, Position).into();
    let explore_tile_direction: Direction = Direction::West;

    map_systems_dispatcher.explore(realm_army_unit_id, explore_tile_direction);

    let expected_explored_coord = army_coord.neighbor(explore_tile_direction);

    // ensure that Tile model is correct
    let explored_tile: Tile = get!(world, (expected_explored_coord.x, expected_explored_coord.y), Tile);
    assert_eq!(explored_tile.col, explored_tile.col, "wrong col");
    assert_eq!(explored_tile.row, explored_tile.row, "wrong row");
    assert_eq!(explored_tile.explored_by_id, realm_army_unit_id, "wrong realm owner");
    assert_eq!(explored_tile.explored_at, TIMESTAMP + TICK_INTERVAL_IN_SECONDS, "wrong exploration time");

    // ensure that the right amount of food was burnt
    let expected_wheat_balance = INITIAL_WHEAT_BALANCE - MAP_EXPLORE_WHEAT_BURN_AMOUNT;
    let expected_fish_balance = INITIAL_FISH_BALANCE - MAP_EXPLORE_FISH_BURN_AMOUNT;
    let (realm_wheat, realm_fish) = ResourceFoodImpl::get(world, realm_entity_id);
    assert_eq!(realm_wheat.balance, expected_wheat_balance, "wrong wheat balance");
    assert_eq!(realm_fish.balance, expected_fish_balance, "wrong wheat balance");

    let mut new_army_coord: Coord = get!(world, realm_army_unit_id, Position).into();
    assert_eq!(new_army_coord, expected_explored_coord);
}

#[test]
fn test_mercenaries_protector() {
    let (world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, combat_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'realm_owner'>());

    let (initial_realm_wheat, initial_realm_fish) = ResourceFoodImpl::get(world, realm_entity_id);
    assert_eq!(initial_realm_wheat.balance, INITIAL_WHEAT_BALANCE, "wrong initial wheat balance");
    assert_eq!(initial_realm_fish.balance, INITIAL_FISH_BALANCE, "wrong initial wheat balance");

    let mut _army_coord: Coord = get!(world, realm_army_unit_id, Position).into();
    let explore_tile_direction: Direction = Direction::West;

    map_systems_dispatcher.explore(realm_army_unit_id, explore_tile_direction);

    let army_position = get!(world, realm_army_unit_id, Position).into();

    let _army_health = get!(world, realm_army_unit_id, Health);

    let mine_entity_id = InternalMapSystemsImpl::create_shard_mine_structure(world, army_position);
    let mine_entity_owner = get!(world, mine_entity_id, EntityOwner);
    assert_eq!(mine_entity_owner.entity_owner_id, mine_entity_id, "wrong initial owner");

    let mercenary_entity_id = InternalMapSystemsImpl::add_mercenaries_to_shard_mine(
        world, mine_entity_id, army_position
    );

    let battle_entity_id = combat_systems_dispatcher.battle_start(realm_army_unit_id, mercenary_entity_id);

    starknet::testing::set_block_timestamp(99999);

    combat_systems_dispatcher.battle_leave(battle_entity_id, realm_army_unit_id);
    combat_systems_dispatcher.battle_claim(realm_army_unit_id, mine_entity_id);

    let mine_owner_address = get!(world, mine_entity_id, Owner).address;
    let realm_owner_address = get!(world, realm_entity_id, Owner).address;
    assert_eq!(mine_owner_address, realm_owner_address, "wrong final owner");
}

fn setup() -> (IWorldDispatcher, ID, ID, IMapSystemsDispatcher, ICombatContractDispatcher) {
    let world = spawn_eternum();

    starknet::testing::set_block_timestamp(TIMESTAMP);

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);

    set_combat_config(config_systems_address);
    set_capacity_config(config_systems_address);
    set_stamina_config(config_systems_address);
    set_speed_config(config_systems_address);
    set_mercenaries_config(config_systems_address);
    set_tick_config(config_systems_address);
    set_exploration_config(config_systems_address);
    set_weight_config(config_systems_address);

    starknet::testing::set_contract_address(contract_address_const::<'realm_owner'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'realm_owner'>());

    let realm_systems_dispatcher = deploy_realm_systems(world);
    let combat_systems_dispatcher = deploy_combat_systems(world);
    let map_systems_dispatcher = deploy_map_systems(world);

    let realm_position = get_default_realm_pos();
    let realm_entity_id = spawn_realm(world, realm_systems_dispatcher, realm_position);

    deploy_dev_resource_systems(world)
        .mint(
            realm_entity_id,
            array![
                (ResourceTypes::WHEAT, INITIAL_WHEAT_BALANCE),
                (ResourceTypes::FISH, INITIAL_FISH_BALANCE),
                (ResourceTypes::KNIGHT, INITIAL_KNIGHT_BALANCE)
            ]
                .span()
        );

    let troops = Troops {
        knight_count: INITIAL_KNIGHT_BALANCE.try_into().unwrap(), paladin_count: 0, crossbowman_count: 0
    };
    let realm_army_unit_id: ID = create_army_with_troops(
        world, combat_systems_dispatcher, realm_entity_id, troops, false
    );

    // ensure initial stamina is 0
    let realm_army_unit_stamina: Stamina = get!(world, realm_army_unit_id, Stamina);
    assert!(realm_army_unit_stamina.amount.is_zero(), "stamina should be zero");

    // move to next tick
    let armies_tick_config = TickImpl::get_armies_tick_config(world);
    let current_ts = starknet::get_block_timestamp();
    starknet::testing::set_block_timestamp(current_ts + armies_tick_config.tick_interval_in_seconds);

    (world, realm_entity_id, realm_army_unit_id, map_systems_dispatcher, combat_systems_dispatcher)
}

