use core::array::ArrayTrait;
use core::clone::Clone;


use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;

use eternum::constants::{ROAD_CONFIG_ID, ResourceTypes};
use eternum::models::config::RoadConfig;
use eternum::models::owner::Owner;
use eternum::models::position::{Coord};
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::road::{Road, RoadCustomImpl};
use eternum::systems::transport::contracts::road_systems::{
    road_systems, IRoadSystemsDispatcher, IRoadSystemsDispatcherTrait
};

use eternum::utils::testing::{world::spawn_eternum, systems::deploy_system};

use starknet::contract_address_const;


fn setup() -> (IWorldDispatcher, IRoadSystemsDispatcher) {
    let world = spawn_eternum();

    let road_systems_address = deploy_system(world, road_systems::TEST_CLASS_HASH);
    let road_systems_dispatcher = IRoadSystemsDispatcher { contract_address: road_systems_address };

    (world, road_systems_dispatcher)
}


#[test]
#[available_gas(3000000000000)]
fn test_create() {
    let (world, road_systems_dispatcher) = setup();

    let entity_id: ID = 44;

    set!(
        world,
        (
            Owner { entity_id: entity_id, address: contract_address_const::<'entity'>() },
            Resource { entity_id: entity_id, resource_type: ResourceTypes::STONE, balance: 400 },
            ResourceCost { entity_id: 1, index: 0, resource_type: ResourceTypes::STONE, amount: 10, },
            RoadConfig { config_id: ROAD_CONFIG_ID, resource_cost_id: 1, resource_cost_count: 1, speed_up_by: 2 }
        )
    );

    let start_coord = @Coord { x: 20, y: 30 };
    let end_coord = @Coord { x: 40, y: 50 };

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    road_systems_dispatcher
        .create(entity_id, *end_coord, // end first because order should not matter
         *start_coord, 33);

    let road = RoadCustomImpl::get(world, *start_coord, *end_coord);
    assert(road.usage_count == 33, 'usage count should be 33');

    let entity_fee_resource = get!(world, (entity_id, ResourceTypes::STONE), Resource);
    assert(entity_fee_resource.balance == 400 - (33 * 10), 'stone balance should be 70');
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('entity id not owned by caller', 'ENTRYPOINT_FAILED'))]
fn test_not_entity() {
    let (world, road_systems_dispatcher) = setup();

    let entity_id: ID = 44;
    let start_coord = Coord { x: 20, y: 30 };
    let end_coord = Coord { x: 40, y: 50 };
    set!(
        world,
        (
            Owner { entity_id: entity_id, address: contract_address_const::<'entity'>() },
            Road {
                start_coord_x: start_coord.x,
                start_coord_y: start_coord.y,
                end_coord_x: end_coord.x,
                end_coord_y: end_coord.y,
                usage_count: 44
            }
        )
    );

    // call as unknown address
    starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());
    road_systems_dispatcher.create(entity_id, end_coord, // end first because order should not matter
     start_coord, 1);
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(
    expected: (
        "not enough resources, Resource (entity id: 44, resource type: STONE, balance: 400). deduction: 500",
        'ENTRYPOINT_FAILED'
    )
)]
fn test_insufficient_balance() {
    let (world, road_systems_dispatcher) = setup();

    let entity_id: ID = 44;

    set!(
        world,
        (
            Owner { entity_id: entity_id, address: contract_address_const::<'entity'>() },
            Resource { entity_id: entity_id, resource_type: ResourceTypes::STONE, balance: 400 },
            ResourceCost { entity_id: 1, index: 0, resource_type: ResourceTypes::STONE, amount: 10, },
            RoadConfig { config_id: ROAD_CONFIG_ID, resource_cost_id: 1, resource_cost_count: 1, speed_up_by: 2 }
        )
    );

    let start_coord = Coord { x: 20, y: 30 };
    let end_coord = Coord { x: 40, y: 50 };

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    road_systems_dispatcher.create(entity_id, end_coord, start_coord, 50 // 50 * 10 > 400
    );
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('road already exists', 'ENTRYPOINT_FAILED'))]
fn test_already_exists() {
    let (world, road_systems_dispatcher) = setup();

    let entity_id: ID = 44;
    let start_coord = Coord { x: 20, y: 30 };
    let end_coord = Coord { x: 40, y: 50 };
    set!(
        world,
        (
            Owner { entity_id: entity_id, address: contract_address_const::<'entity'>() },
            Road {
                start_coord_x: start_coord.x,
                start_coord_y: start_coord.y,
                end_coord_x: end_coord.x,
                end_coord_y: end_coord.y,
                usage_count: 44
            }
        )
    );

    starknet::testing::set_contract_address(contract_address_const::<'entity'>());
    road_systems_dispatcher.create(entity_id, end_coord, start_coord, 1);
}
