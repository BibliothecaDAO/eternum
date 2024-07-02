use core::array::{ArrayTrait, SpanTrait};
use dojo::test_utils::spawn_test_world;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{MAX_REALMS_PER_ADDRESS, ResourceTypes};

use eternum::models::capacity::{capacity, Capacity};
use eternum::models::config::{
    world_config, WorldConfig, speed_config, SpeedConfig, capacity_config, CapacityConfig,
    weight_config, WeightConfig, road_config, RoadConfig, hyperstructure_resource_config,
    HyperstructureResourceConfig, stamina_config, StaminaConfig, tick_config, TickConfig,
    TroopConfig, MercenariesConfig
};
use eternum::models::hyperstructure::{Progress, progress, Contribution, contribution};
use eternum::models::map::Tile;
use eternum::models::metadata::{entity_metadata, EntityMetadata};
use eternum::models::metadata::{foreign_key, ForeignKey};
use eternum::models::movable::{movable, Movable, arrival_time, ArrivalTime};
use eternum::models::owner::{owner, Owner};
use eternum::models::position::{position, Position, Coord, CoordTrait};
use eternum::models::quantity::{quantity, Quantity, quantity_tracker, QuantityTracker};
use eternum::models::realm::{realm, Realm};
use eternum::models::resources::{resource, Resource};
use eternum::models::resources::{resource_cost, ResourceCost};
use eternum::models::road::{road, Road};
use eternum::models::trade::{status, Status, trade, Trade,};
use eternum::models::combat::{Troops};

use eternum::systems::hyperstructure::contracts::{
    hyperstructure_systems, IHyperstructureSystems, IHyperstructureSystemsDispatcher,
    IHyperstructureSystemsDispatcherTrait
};

use eternum::systems::realm::contracts::{
    realm_systems, IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait
};

use eternum::systems::combat::contracts::{
    combat_systems, ICombatContractDispatcher, ICombatContractDispatcherTrait
};

use eternum::systems::config::contracts::{ITroopConfigDispatcher, ITroopConfigDispatcherTrait};

use eternum::utils::map::biomes::Biome;

use starknet::{syscalls::deploy_syscall, ClassHash, ContractAddress};

// used to spawn a test world with all the models and systems registered
fn spawn_eternum() -> IWorldDispatcher {
    let mut models = array![
        owner::TEST_CLASS_HASH,
        movable::TEST_CLASS_HASH,
        quantity::TEST_CLASS_HASH,
        realm::TEST_CLASS_HASH,
        speed_config::TEST_CLASS_HASH,
        capacity_config::TEST_CLASS_HASH,
        world_config::TEST_CLASS_HASH,
        entity_metadata::TEST_CLASS_HASH,
        quantity_tracker::TEST_CLASS_HASH,
        position::TEST_CLASS_HASH,
        capacity::TEST_CLASS_HASH,
        arrival_time::TEST_CLASS_HASH,
        foreign_key::TEST_CLASS_HASH,
        trade::TEST_CLASS_HASH,
        resource::TEST_CLASS_HASH,
        resource_cost::TEST_CLASS_HASH,
        status::TEST_CLASS_HASH,
        weight_config::TEST_CLASS_HASH,
        road::TEST_CLASS_HASH,
        road_config::TEST_CLASS_HASH,
        progress::TEST_CLASS_HASH,
        contribution::TEST_CLASS_HASH,
        hyperstructure_resource_config::TEST_CLASS_HASH,
        stamina_config::TEST_CLASS_HASH,
        tick_config::TEST_CLASS_HASH,
    ];

    spawn_test_world(models)
}


fn deploy_system(world: IWorldDispatcher, class_hash_felt: felt252) -> ContractAddress {
    let contract_address = world
        .deploy_contract(class_hash_felt, class_hash_felt.try_into().unwrap(), array![].span());

    contract_address
}

fn deploy_realm_systems(world: IWorldDispatcher) -> IRealmSystemsDispatcher {
    let realm_systems_address = deploy_system(world, realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    realm_systems_dispatcher
}

fn deploy_hyperstructure_systems(world: IWorldDispatcher) -> IHyperstructureSystemsDispatcher {
    let hyperstructure_systems_address = deploy_system(
        world, hyperstructure_systems::TEST_CLASS_HASH
    );
    let hyperstructure_systems_dispatcher = IHyperstructureSystemsDispatcher {
        contract_address: hyperstructure_systems_address
    };

    hyperstructure_systems_dispatcher
}

fn deploy_combat_systems(world: IWorldDispatcher) -> ICombatContractDispatcher {
    let combat_systems_address = deploy_system(world, combat_systems::TEST_CLASS_HASH);
    let combat_systems_dispatcher = ICombatContractDispatcher {
        contract_address: combat_systems_address
    };
    combat_systems_dispatcher
}

fn set_default_troop_config(config_systems_address: ContractAddress) {
    let troop_config = TroopConfig {
        config_id: 0,
        health: 7_200,
        knight_strength: 1,
        paladin_strength: 1,
        crossbowman_strength: 1,
        advantage_percent: 1000,
        disadvantage_percent: 1000,
        pillage_health_divisor: 8,
    };
    ITroopConfigDispatcher { contract_address: config_systems_address }
        .set_troop_config(troop_config);
}

fn get_default_realm_pos() -> Position {
    Position { entity_id: 1, x: 100, y: 100 }
}

fn generate_realm_positions() -> Array<Position> {
    let mut positions = ArrayTrait::<Position>::new();
    let start_pos = get_default_realm_pos();

    let mut count = 0;
    while (count < MAX_REALMS_PER_ADDRESS + 1) {
        positions
            .append(
                Position {
                    x: start_pos.x + count.into(),
                    y: start_pos.y + count.into(),
                    entity_id: start_pos.entity_id + count.into()
                }
            );
        count += 1;
    };

    positions
}

fn get_default_hyperstructure_coord() -> Coord {
    Coord { x: 0, y: 0 }
}

fn get_default_mercenary_config() -> (Troops, Span<(u8, u128)>) {
    (Troops { knight_count: 1, paladin_count: 0, crossbowman_count: 0 }, array![(ResourceTypes::WOOD, 1000), (ResourceTypes::DIAMONDS, 1000)].span())
}

fn explore_tile(world: IWorldDispatcher, explorer_id: u128, coords: Coord) {
    set!(
        world,
        Tile {
            _col: coords.x,
            _row: coords.y,
            col: coords.x,
            row: coords.y,
            explored_by_id: explorer_id,
            explored_at: 0,
            biome: Biome::Beach
        }
    );
}

fn spawn_realm(
    world: IWorldDispatcher, realm_systems_dispatcher: IRealmSystemsDispatcher, position: Position
) -> u128 {
    let realm_entity_id = realm_systems_dispatcher
        .create(
            1, // realm id
            0x20309, // resource_types_packed // 2,3,9 // stone, coal, gold
            3, // resource_types_count
            5, // cities
            5, // harbors
            5, // rivers
            5, // regions
            1, // wonder
            1, // order
            position // position
        );

    realm_entity_id
}

fn spawn_hyperstructure(
    world: IWorldDispatcher,
    hyperstructure_systems_dispatcher: IHyperstructureSystemsDispatcher,
    realm_entity_id: u128,
    coord: Coord
) -> u128 {
    explore_tile(world, realm_entity_id, coord);

    let hyperstructure_entity_id = hyperstructure_systems_dispatcher.create(realm_entity_id, coord);

    hyperstructure_entity_id
}

