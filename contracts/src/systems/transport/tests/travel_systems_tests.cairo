use core::serde::Serde;

use core::traits::Into;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::LevelIndex;
use eternum::constants::{REALM_LEVELING_CONFIG_ID, WORLD_CONFIG_ID};

use eternum::constants::{ResourceTypes, TickIds};
use eternum::models::combat::{Army, BattleSide, Troops};
use eternum::models::config::{TickConfig, MapConfig, StaminaConfig, StaminaRefillConfig, LevelingConfig, TickImpl};
use eternum::models::level::Level;
use eternum::models::map::Tile;
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::order::{Orders, OrdersCustomTrait};
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::position::CoordTrait;
use eternum::models::position::{Coord, Position, Direction};
use eternum::models::realm::Realm;
use eternum::models::resources::{Resource, ResourceCost};

use eternum::systems::config::contracts::{config_systems, ILevelingConfigDispatcher, ILevelingConfigDispatcherTrait};

use eternum::systems::transport::contracts::travel_systems::{
    travel_systems, ITravelSystemsDispatcher, ITravelSystemsDispatcherTrait
};

use eternum::utils::testing::{
    world::spawn_eternum, systems::deploy_system,
    constants::{MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT, MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT}
};
use starknet::contract_address_const;

fn setup() -> (IWorldDispatcher, ID, ID, Position, Coord, ITravelSystemsDispatcher) {
    let world = spawn_eternum();

    // set as executor

    let travelling_entity_id: ID = 11;
    let realm_entity_id: ID = 99;
    let travelling_entity_position = Position { x: 100_000, y: 200_000, entity_id: travelling_entity_id.into() };

    set!(world, (travelling_entity_position));
    set!(
        world,
        (
            Owner { address: contract_address_const::<'travelling_entity'>(), entity_id: travelling_entity_id.into() },
            Owner { address: contract_address_const::<'travelling_entity'>(), entity_id: realm_entity_id.into() },
            EntityOwner { entity_id: travelling_entity_id.into(), entity_owner_id: realm_entity_id }
        )
    );

    let destination_coord = Coord { x: 900_000, y: 100_000 };

    // make destination coord explored
    let mut destination_tile: Tile = get!(world, (destination_coord.x, destination_coord.y), Tile);
    destination_tile.explored_by_id = 800;
    destination_tile.explored_at = 78671;
    set!(world, (destination_tile));

    let travel_systems_address = deploy_system(world, travel_systems::TEST_CLASS_HASH);
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
fn test_travel() {
    let (world, _realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    set!(
        world,
        (Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
            start_coord_x: 0,
            start_coord_y: 0,
            intermediate_coord_x: 0,
            intermediate_coord_y: 0,
        })
    );

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);

    // verify arrival time and position of travelling_entity
    let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
    let new_travelling_entity_position = get!(world, travelling_entity_id, Position);

    assert(travelling_entity_arrival_time.arrives_at == 8500000, 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');
}

#[test]
#[available_gas(30000000000000)]
fn test_travel_with_realm_bonus() {
    let (world, realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    ///////////////////////////////
    // create realm and set level
    ///////////////////////////////

    set!(
        world,
        (
            EntityOwner { entity_id: travelling_entity_id.into(), entity_owner_id: realm_entity_id },
            Realm {
                entity_id: realm_entity_id,
                realm_id: 0,
                resource_types_packed: 0,
                resource_types_count: 0,
                cities: 76,
                harbors: 0,
                rivers: 0,
                regions: 0,
                wonder: 0,
                order: 0,
            },
            Level { entity_id: realm_entity_id, level: LevelIndex::TRAVEL.into() + 4, valid_until: 10000000, },
            LevelingConfig {
                config_id: REALM_LEVELING_CONFIG_ID,
                decay_interval: 0,
                max_level: 1000,
                wheat_base_amount: 0,
                fish_base_amount: 0,
                resource_1_cost_id: 0,
                resource_1_cost_count: 0,
                resource_2_cost_id: 0,
                resource_2_cost_count: 0,
                resource_3_cost_id: 0,
                resource_3_cost_count: 0,
                decay_scaled: 1844674407370955161,
                cost_percentage_scaled: 0,
                base_multiplier: 25
            }
        )
    );

    set!(
        world,
        (Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
            start_coord_x: 0,
            start_coord_y: 0,
            intermediate_coord_x: 0,
            intermediate_coord_y: 0,
        })
    );

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);

    // verify arrival time and position of travelling_entity
    let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
    let new_travelling_entity_position = get!(world, travelling_entity_id, Position);
    assert(travelling_entity_arrival_time.arrives_at == 6800000, 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');
}

#[test]
#[available_gas(30000000000000)]
fn test_travel_with_realm_and_order_bonus() {
    let (world, realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    ///////////////////////////////
    // create realm and set level
    ///////////////////////////////

    let realm_order_id: u8 = 1;

    set!(
        world,
        (
            EntityOwner { entity_id: travelling_entity_id.into(), entity_owner_id: realm_entity_id },
            Realm {
                entity_id: realm_entity_id,
                realm_id: 0,
                resource_types_packed: 0,
                resource_types_count: 0,
                cities: 76,
                harbors: 0,
                rivers: 0,
                regions: 0,
                wonder: 0,
                order: realm_order_id.into(),
            },
            Level { entity_id: realm_entity_id, level: LevelIndex::TRAVEL.into() + 4, valid_until: 10000000, },
            LevelingConfig {
                config_id: REALM_LEVELING_CONFIG_ID,
                decay_interval: 0,
                max_level: 1000,
                wheat_base_amount: 0,
                fish_base_amount: 0,
                resource_1_cost_id: 0,
                resource_1_cost_count: 0,
                resource_2_cost_id: 0,
                resource_2_cost_count: 0,
                resource_3_cost_id: 0,
                resource_3_cost_count: 0,
                decay_scaled: 1844674407370955161,
                cost_percentage_scaled: 0,
                base_multiplier: 25
            }
        )
    );

    ///////////////////////////////////////
    //  set order level
    ///////////////////////////////////////

    set!(
        world,
        (
            EntityOwner { entity_id: travelling_entity_id.into(), entity_owner_id: realm_entity_id },
            Orders { order_id: realm_order_id.into(), hyperstructure_count: 1 }
        )
    );

    set!(
        world,
        (Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
            start_coord_x: 0,
            start_coord_y: 0,
            intermediate_coord_x: 0,
            intermediate_coord_y: 0,
        })
    );

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);

    // verify arrival time and position of travelling_entity
    let travelling_entity_arrival_time = get!(world, travelling_entity_id, ArrivalTime);
    let new_travelling_entity_position = get!(world, travelling_entity_id, Position);

    assert(travelling_entity_arrival_time.arrives_at == 5440000, 'arrival time not correct');

    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
fn test_not_owner() {
    let (_, _, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'not_owner'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity has no speed', 'ENTRYPOINT_FAILED'))]
fn test_no_speed() {
    let (_, _, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity is blocked', 'ENTRYPOINT_FAILED'))]
fn test_blocked() {
    let (world, _realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    set!(
        world,
        (Movable {
            entity_id: travelling_entity_id.into(),
            sec_per_km: 10,
            blocked: true,
            round_trip: false,
            start_coord_x: 0,
            start_coord_y: 0,
            intermediate_coord_x: 0,
            intermediate_coord_y: 0,
        })
    );

    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel(travelling_entity_id.into(), destination_coord);
}


#[test]
#[available_gas(30000000000000)]
#[should_panic(expected: ('entity is in transit', 'ENTRYPOINT_FAILED'))]
fn test_in_transit() {
    let (world, _realm_entity_id, travelling_entity_id, _, destination_coord, travel_systems_dispatcher) = setup();

    set!(
        world,
        (
            Movable {
                entity_id: travelling_entity_id.into(),
                sec_per_km: 10,
                blocked: false,
                round_trip: false,
                start_coord_x: 0,
                start_coord_y: 0,
                intermediate_coord_x: 0,
                intermediate_coord_y: 0,
            },
            ArrivalTime { entity_id: travelling_entity_id.into(), arrives_at: 100 }
        )
    );

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

fn setup_hex_travel() -> (IWorldDispatcher, ID, Position, ITravelSystemsDispatcher) {
    let world = spawn_eternum();

    // set tick config
    let tick_config = TickConfig {
        config_id: WORLD_CONFIG_ID, tick_id: TickIds::ARMIES, tick_interval_in_seconds: TICK_INTERVAL_IN_SECONDS
    };
    set!(world, (tick_config));

    set!(world, (StaminaRefillConfig { config_id: WORLD_CONFIG_ID, amount_per_tick: MAX_STAMINA }));

    set!(
        world,
        (StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type: ResourceTypes::KNIGHT, max_stamina: MAX_STAMINA, })
    );

    set!(
        world,
        (StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type: ResourceTypes::CROSSBOWMAN, max_stamina: MAX_STAMINA, })
    );

    set!(
        world,
        (StaminaConfig { config_id: WORLD_CONFIG_ID, unit_type: ResourceTypes::PALADIN, max_stamina: MAX_STAMINA, })
    );

    set!(
        world,
        (MapConfig {
            config_id: WORLD_CONFIG_ID,
            explore_wheat_burn_amount: 100,
            explore_fish_burn_amount: 100,
            travel_wheat_burn_amount: 1,
            travel_fish_burn_amount: 1,
            reward_resource_amount: 100,
            shards_mines_fail_probability: 0
        })
    );
    // change time such that we will be in the third tick
    starknet::testing::set_block_timestamp(tick_config.next_tick_timestamp());

    let travelling_entity_id: ID = 11;
    let owner_entity_id: ID = 12;
    let travelling_entity_position = Position { x: 100_000, y: 200_000, entity_id: travelling_entity_id };

    set!(world, (travelling_entity_position));
    set!(
        world,
        (Army {
            entity_id: travelling_entity_id,
            troops: Troops { knight_count: 1, paladin_count: 0, crossbowman_count: 0, },
            battle_id: 0,
            battle_side: BattleSide::None
        })
    );
    set!(
        world,
        (
            Resource {
                entity_id: owner_entity_id, resource_type: ResourceTypes::WHEAT, balance: ORIGINAL_WHEAT_BALANCE
            },
            Resource { entity_id: owner_entity_id, resource_type: ResourceTypes::FISH, balance: ORIGINAL_FISH_BALANCE }
        )
    );

    set!(
        world,
        (
            Owner { address: contract_address_const::<'travelling_entity'>(), entity_id: owner_entity_id.into() },
            EntityOwner { entity_id: travelling_entity_id, entity_owner_id: owner_entity_id },
        )
    );

    set!(
        world,
        (Movable {
            entity_id: travelling_entity_id,
            sec_per_km: 10,
            blocked: false,
            round_trip: false,
            start_coord_x: 0,
            start_coord_y: 0,
            intermediate_coord_x: 0,
            intermediate_coord_y: 0,
        })
    );

    let travel_systems_address = deploy_system(world, travel_systems::TEST_CLASS_HASH);
    let travel_systems_dispatcher = ITravelSystemsDispatcher { contract_address: travel_systems_address };

    (world, travelling_entity_id, travelling_entity_position, travel_systems_dispatcher)
}


fn get_and_explore_destination_tiles(
    world: IWorldDispatcher, start_coord: Coord, mut directions: Span<Direction>
) -> Coord {
    let mut destination = start_coord;
    loop {
        match directions.pop_front() {
            Option::Some(direction) => {
                destination = destination.neighbor(*direction);

                let mut destination_tile: Tile = get!(world, (destination.x, destination.y), Tile);
                destination_tile.explored_by_id = 800;
                destination_tile.explored_at = 78671;
                set!(world, (destination_tile));
            },
            Option::None => { break; },
        }
    };

    return destination;
}


#[test]
#[available_gas(30000000000000)]
fn test_travel_hex() {
    let (world, travelling_entity_id, travelling_entity_position, travel_systems_dispatcher) = setup_hex_travel();

    // make destination tile explored
    let travel_directions = array![Direction::East, Direction::East, Direction::East].span();
    let current_coord: Coord = travelling_entity_position.into();
    let destination_coord: Coord = get_and_explore_destination_tiles(world, current_coord, travel_directions);

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel_hex(travelling_entity_id, travel_directions);

    let new_travelling_entity_position = get!(world, travelling_entity_id, Position);
    assert(new_travelling_entity_position.x == destination_coord.x, 'coord x is not correct');
    assert(new_travelling_entity_position.y == destination_coord.y, 'coord y is not correct');

    let travelling_entity_owner_id = get!(world, travelling_entity_id, EntityOwner).entity_owner_id;
    let travelling_entity_wheat = get!(world, (travelling_entity_owner_id, ResourceTypes::WHEAT), Resource);
    assert_eq!(
        travelling_entity_wheat.balance,
        ORIGINAL_WHEAT_BALANCE - (MAP_EXPLORE_TRAVEL_WHEAT_BURN_AMOUNT * travel_directions.len().into())
    );
    let travelling_entity_fish = get!(world, (travelling_entity_owner_id, ResourceTypes::FISH), Resource);
    assert_eq!(
        travelling_entity_fish.balance,
        ORIGINAL_FISH_BALANCE - (MAP_EXPLORE_TRAVEL_FISH_BURN_AMOUNT * travel_directions.len().into())
    );
}


#[test]
#[should_panic(expected: ('tile not explored', 'ENTRYPOINT_FAILED'))]
fn test_travel_hex__destination_tile_not_explored() {
    let (_, travelling_entity_id, _, travel_systems_dispatcher) = setup_hex_travel();

    let travel_directions = array![Direction::East].span();
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel_hex(travelling_entity_id, travel_directions);
}


#[test]
#[should_panic(expected: ('not enough stamina', 'ENTRYPOINT_FAILED'))]
fn test_travel_hex__exceed_max_stamina() {
    let (world, travelling_entity_id, travelling_entity_position, travel_systems_dispatcher) = setup_hex_travel();

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
    get_and_explore_destination_tiles(world, current_coord, travel_directions);

    // travelling entity travels
    starknet::testing::set_contract_address(contract_address_const::<'travelling_entity'>());
    travel_systems_dispatcher.travel_hex(travelling_entity_id, travel_directions);
}
