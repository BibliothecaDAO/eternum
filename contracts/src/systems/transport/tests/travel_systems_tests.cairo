use core::serde::Serde;

use core::traits::Into;
use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
use s0_eternum::alias::ID;
use s0_eternum::constants::LevelIndex;
use s0_eternum::constants::{REALM_LEVELING_CONFIG_ID, WORLD_CONFIG_ID};

use s0_eternum::constants::{ResourceTypes, TickIds};
use s0_eternum::models::combat::{Army, BattleSide, Troops};
use s0_eternum::models::config::{TickConfig, MapConfig, StaminaConfig, StaminaRefillConfig, LevelingConfig, TickImpl};
use s0_eternum::models::map::Tile;
use s0_eternum::models::movable::{Movable, ArrivalTime};
use s0_eternum::models::order::{Orders, OrdersTrait};
use s0_eternum::models::owner::{Owner, EntityOwner};
use s0_eternum::models::position::CoordTrait;
use s0_eternum::models::position::{Coord, Position, Direction};
use s0_eternum::models::realm::Realm;
use s0_eternum::models::resources::{Resource, ResourceCost};

use s0_eternum::systems::config::contracts::{config_systems, ILevelingConfigDispatcher, ILevelingConfigDispatcherTrait};

use s0_eternum::systems::transport::contracts::travel_systems::{
    travel_systems, ITravelSystemsDispatcher, ITravelSystemsDispatcherTrait
};

use s0_eternum::utils::testing::{
    world::spawn_eternum, systems::deploy_system,
    constants::{MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT, MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT},
    config::{set_travel_and_explore_stamina_cost_config, set_travel_food_cost_config}
};
use starknet::contract_address_const;

fn setup() -> (WorldStorage, ID, ID, Position, Coord, ITravelSystemsDispatcher) {
    let mut world = spawn_eternum();

    let config_systems_address = deploy_system(ref world, "config_systems");
    set_travel_and_explore_stamina_cost_config(config_systems_address);

    // set as executor

    let travelling_entity_id: ID = 11;
    let realm_entity_id: ID = 99;
    let travelling_entity_position = Position { x: 100_000, y: 200_000, entity_id: travelling_entity_id.into() };

    world.write_model_test(@travelling_entity_position);
    world
        .write_model_test(
            @Owner { address: contract_address_const::<'travelling_entity'>(), entity_id: travelling_entity_id.into() }
        );
    world
        .write_model_test(
            @Owner { address: contract_address_const::<'travelling_entity'>(), entity_id: realm_entity_id.into() }
        );
    world.write_model_test(@EntityOwner { entity_id: travelling_entity_id.into(), entity_owner_id: realm_entity_id });

    let destination_coord = Coord { x: 900_000, y: 100_000 };

    // make destination coord explored
    let mut destination_tile: Tile = world.read_model((destination_coord.x, destination_coord.y));
    destination_tile.explored_by_id = 800;
    destination_tile.explored_at = 78671;
    world.write_model_test(@destination_tile);

    let travel_systems_address = deploy_system(ref world, "travel_systems");
    let travel_systems_dispatcher = ITravelSystemsDispatcher { contract_address: travel_systems_address };

    (
        world,
        realm_entity_id,
        travelling_entity_id,
        travelling_entity_position,
        destination_coord,
        travel_systems_dispatcher
    )
}


#[test]
#[available_gas(30000000000000)]
fn transport_test_travel() {
    let (mut world, _realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    world
        .write_model_test(
            @Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: false,
                round_trip: false,
                start_coord_x: 0,
                start_coord_y: 0,
                intermediate_coord_x: 0,
                intermediate_coord_y: 0,
            }
        );

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);

    // verify arrival time and position of travelling_entity
    let travelling_entity_arrival_time: ArrivalTime = world.read_model(travelling_entity_id);
    let new_travelling_entity_position: Position = world.read_model(travelling_entity_id);

    assert(travelling_entity_arrival_time.arrives_at == 8500000, 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');
}

#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn transport_test_not_owner() {
    let (_, _, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'not_owner'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity has no speed', 'ENTRYPOINT_FAILED'))]
fn transport_test_no_speed() {
    let (_, _, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity is blocked', 'ENTRYPOINT_FAILED'))]
fn transport_test_blocked() {
    let (mut world, _realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    world
        .write_model_test(
            @Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: true,
                round_trip: false,
                start_coord_x: 0,
                start_coord_y: 0,
                intermediate_coord_x: 0,
                intermediate_coord_y: 0,
            }
        );

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity is in transit', 'ENTRYPOINT_FAILED'))]
fn transport_test_in_transit() {
    let (mut world, _realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    world
        .write_model_test(
            @Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: false,
                round_trip: false,
                start_coord_x: 0,
                start_coord_y: 0,
                intermediate_coord_x: 0,
                intermediate_coord_y: 0,
            }
        );
    world.write_model_test(@ArrivalTime { entity_id: travelling_entity_id.into(), arrives_at: 100 });

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


///////////////////////////////////////////////
/////           TRAVEL HEX
///////////////////////////////////////////////

const TICK_INTERVAL_IN_SECONDS: u64 = 200;
const MAX_STAMINA: u16 = 30;
const ORIGINAL_WHEAT_BALANCE: u128 = 1000;
const ORIGINAL_FISH_BALANCE: u128 = 1000;

fn setup_hex_travel() -> (WorldStorage, ID, Position, ITravelSystemsDispatcher) {
    let mut world = spawn_eternum();

    let config_systems_address = deploy_system(ref world, "config_systems");
    set_travel_and_explore_stamina_cost_config(config_systems_address);
    set_travel_food_cost_config(config_systems_address);

    // set tick config
    let tick_config = TickConfig {
        config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: TICK_INTERVAL_IN_SECONDS
    };
    world.write_model_test(@tick_config);

    world
        .write_model_test(
            @StaminaRefillConfig {
                config_id: WORLD_CONFIG_ID, amount_per_tick: MAX_STAMINA, start_boost_tick_count: 0,
            }
        );

    world
        .write_model_test(
            @StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type: ResourceTypes::KNIGHT, max_stamina: MAX_STAMINA, }
        );

    world
        .write_model_test(
            @StaminaConfig {
                config_id: WORLD_CONFIG_ID, unit_type: ResourceTypes::CROSSBOWMAN, max_stamina: MAX_STAMINA,
            }
        );

    world
        .write_model_test(
            @StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type: ResourceTypes::PALADIN, max_stamina: MAX_STAMINA, }
        );

    world
        .write_model_test(
            @MapConfig { config_id: WORLD_CONFIG_ID, reward_resource_amount: 100, shards_mines_fail_probability: 0 }
        );
    // change time such that we will be in the third tick
    starknet::testing::set_block_timestamp(tick_config.next_tick_timestamp());

    let travelling_entity_id: ID = 11;
    let owner_entity_id: ID = 12;
    let travelling_entity_position = Position { x: 100_000, y: 200_000, entity_id: travelling_entity_id };

    world.write_model_test(@travelling_entity_position);
    world
        .write_model_test(
            @Army {
                entity_id: travelling_entity_id,
                troops: Troops { knight_count: 1, paladin_count: 0, crossbowman_count: 0, },
                battle_id: 0,
                battle_side: BattleSide::None
            }
        );

    world
        .write_model_test(
            @Resource {
                entity_id: owner_entity_id, resource_type: ResourceTypes::WHEAT, balance: ORIGINAL_WHEAT_BALANCE
            }
        );

    world
        .write_model_test(
            @Resource {
                entity_id: owner_entity_id, resource_type: ResourceTypes::WHEAT, balance: ORIGINAL_WHEAT_BALANCE
            }
        );
    world
        .write_model_test(
            @Resource { entity_id: owner_entity_id, resource_type: ResourceTypes::FISH, balance: ORIGINAL_FISH_BALANCE }
        );

    world
        .write_model_test(
            @Owner { address: contract_address_const::<'travelling_entity'>(), entity_id: owner_entity_id.into() }
        );

    world.write_model_test(@EntityOwner { entity_id: travelling_entity_id, entity_owner_id: owner_entity_id });

    world
        .write_model_test(
            @Movable {
                entity_id: travelling_entity_id,
                sec_per_km: 10,
                blocked: false,
                round_trip: false,
                start_coord_x: 0,
                start_coord_y: 0,
                intermediate_coord_x: 0,
                intermediate_coord_y: 0,
            }
        );

    let travel_systems_address = deploy_system(ref world, "travel_systems");
    let travel_systems_dispatcher = ITravelSystemsDispatcher { contract_address: travel_systems_address };

    (world, travelling_entity_id, travelling_entity_position, travel_systems_dispatcher)
}


fn get_and_explore_destination_tiles(
    ref world: WorldStorage, start_coord: Coord, mut directions: Span<Direction>
) -> Coord {
    let mut destination = start_coord;
    loop {
        match directions.pop_front() {
            Option::Some(direction) => {
                destination = destination.neighbor(*direction);

                let mut destination_tile: Tile = world.read_model((destination.x, destination.y));
                destination_tile.explored_by_id = 800;
                destination_tile.explored_at = 78671;
                world.write_model_test(@destination_tile);
            },
            Option::None => { break; },
        }
    };

    return destination;
}


#[test]
#[available_gas(30000000000000)]
fn transport_test_travel_hex() {
    let (mut world, travelling_entity_id, travelling_entity_position, travel_systems_dispatcher) = setup_hex_travel();

    // make destination tile explored
    let travel_directions = array![Direction::East, Direction::East, Direction::East].span();
    let current_coord: Coord = travelling_entity_position.into();
    let destination_coord: Coord = get_and_explore_destination_tiles(ref world, current_coord, travel_directions);

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel_hex(travelling_entity_id, travel_directions);

    let new_travelling_entity_position: Position = world.read_model(travelling_entity_id);
    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');

    let travelling_entity_owner: EntityOwner = world.read_model(travelling_entity_id);
    let travelling_entity_owner_id = travelling_entity_owner.entity_owner_id;
    let travelling_entity_wheat: Resource = world.read_model((travelling_entity_owner_id, ResourceTypes::WHEAT));
    assert_eq!(
        travelling_entity_wheat.balance,
        ORIGINAL_WHEAT_BALANCE - (MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT * travel_directions.len().into())
    );
    let travelling_entity_fish: Resource = world.read_model((travelling_entity_owner_id, ResourceTypes::FISH));
    assert_eq!(
        travelling_entity_fish.balance,
        ORIGINAL_FISH_BALANCE - (MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT * travel_directions.len().into())
    );
}


#[test]
#[should_panic(expected: ('tile not explored', 'ENTRYPOINT_FAILED'))]
fn transport_test_travel_hex__destination_tile_not_explored() {
    let (_, travelling_entity_id, _, travel_systems_dispatcher) = setup_hex_travel();

    let travel_directions = array![Direction::East].span();
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel_hex(travelling_entity_id, travel_directions);
}


#[test]
#[should_panic(expected: ('not enough stamina', 'ENTRYPOINT_FAILED'))]
fn transport_test_travel_hex__exceed_max_stamina() {
    let (mut world, travelling_entity_id, travelling_entity_position, travel_systems_dispatcher) = setup_hex_travel();

    // max hex moves per tick is 30 /5 = 6 so we try to travel 7 hexes
    let travel_directions = array![
        Direction::East,
        Direction::East,
        Direction::East,
        Direction::East,
        Direction::East,
        Direction::East,
        Direction::East,
    ]
        .span();
    let current_coord: Coord = travelling_entity_position.into();
    // explore destination coord
    get_and_explore_destination_tiles(ref world, current_coord, travel_directions);

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel_hex(travelling_entity_id, travel_directions);
}
