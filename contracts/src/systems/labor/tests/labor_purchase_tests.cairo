use eternum::alias::ID;
use eternum::constants::ResourceTypes;
use eternum::models::resources::Resource;
use eternum::models::labor::Labor;
use eternum::models::position::Position;
use eternum::models::labor_auction::LaborAuction;

use eternum::systems::labor::utils::get_labor_resource_type;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ILaborConfigDispatcher,
    ILaborConfigDispatcherTrait,
};

use eternum::systems::labor::contracts::labor_systems;
use eternum::systems::labor::interface::{
    ILaborSystemsDispatcher,
    ILaborSystemsDispatcherTrait,
};


const _0_1: u128 = 1844674407370955161; // 0.1

fn setup(resource_type: u8) -> (IWorldDispatcher, u128, ILaborSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    starknet::testing::set_contract_address(world.executor());

    // set labor auction
    let zone: u8 = 5;
    let decay_constant: u128 = _0_1;
    let per_time_unit: u128 = 50;
    let price_update_interval: u128 = 10;
    labor_config_dispatcher.set_labor_auction(
        world,
        decay_constant,
        per_time_unit,
        price_update_interval
    );

    // set realm entity
    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };



    // create realm
    let realm_entity_id = realm_systems_dispatcher.create(
        world,
        1, // realm id
        starknet::get_contract_address(), // owner
        0x20309, // resource_types_packed // 2,3,9 // stone, coal, gold
        3, // resource_types_count
        5, // cities
        5, // harbors
        5, // rivers
        5, // regions
        1, // wonder
        1, // order
        Position { x: 500200, y: 1, entity_id: 1_u128 }, // position  
                // x needs to be > 470200 to get zone
    );

    // set labor configuration entity
    labor_config_dispatcher.set_labor_config(
        world,
        7200, // base_labor_units
        250, // base_resources_per_cycle
        21_000_000_000_000_000_000, // base_food_per_cycle
    );

    // set labor cost resource
    labor_config_dispatcher.set_labor_cost_resources(
        world,
        resource_type.into(),
        0x203, // resource_types_packed // 2,3 // stone and coal
        2, // resource_types_count // stone and coal
    );
    
    // set cost for gold in coal 
    labor_config_dispatcher.set_labor_cost_amount(
        world,
        resource_type.into(),
        ResourceTypes::COAL.into(),
        1_000,
    );

    // set cost for gold in stone
    labor_config_dispatcher.set_labor_cost_amount(
        world,
        resource_type.into(),
        ResourceTypes::STONE.into(),
        1_000,
    );

    // mint 100_000 coal for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::COAL,
            balance: 100_000
        }
    ));

    // mint 100_000 stone for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::STONE,
            balance: 100_000
        }
    ));

    let labor_systems_address 
        = deploy_system(labor_systems::TEST_CLASS_HASH);
    let labor_systems_dispatcher = ILaborSystemsDispatcher {
        contract_address: labor_systems_address
    };


    (world, realm_entity_id, labor_systems_dispatcher)
}




#[test]
#[available_gas(300000000000)]
fn test_purchase_labor_non_food() {
    let resource_type = ResourceTypes::GOLD;

    let (world, realm_entity_id, labor_systems_dispatcher) = setup(resource_type);

    // purchase labor
    labor_systems_dispatcher.purchase(
        world,
        realm_entity_id,
        resource_type,
        20 // labor_units
    );


    // assert resources are the right amount
    let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
    assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
    assert(coal_resource.balance == 79_790, 'failed resource amount');

    let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
    assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
    assert(stone_resource.balance == 79_790, 'failed resource amount');

    // assert labor resource is right amount
    let gold_labor_resource = get!(world, (realm_entity_id, resource_type + 28), Resource);
    assert(gold_labor_resource.balance == 20, 'wrong labor resource balance');

    let labor_auction = get!(world, 1, LaborAuction);
    assert(labor_auction.sold == 20, 'wrong labor auction sold');
}




#[test]
#[available_gas(300000000000)]
fn test_purchase_labor_food() {
    let resource_type = ResourceTypes::FISH;
    let (world, realm_entity_id, labor_systems_dispatcher) = setup(resource_type);

    // purchase labor
    labor_systems_dispatcher.purchase(
        world,
        realm_entity_id,
        resource_type,
        20 // labor_units
    );

    // assert resources are the right amount
    let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
    assert(coal_resource.resource_type == ResourceTypes::COAL, 'failed resource type');
    assert(coal_resource.balance == 79_790, 'failed resource amount');

    let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
    assert(stone_resource.resource_type == ResourceTypes::STONE, 'failed resource type');
    assert(stone_resource.balance == 79_790, 'failed resource amount');

    // assert labor resource is right amount
    let fish_labor_resource = get!(world, (realm_entity_id, resource_type - 3), Resource);
    assert(fish_labor_resource.balance == 20, 'wrong labor resource balance');

    let labor_auction = get!(world, 1, LaborAuction);
    assert(labor_auction.sold == 20, 'wrong labor auction sold');
}
