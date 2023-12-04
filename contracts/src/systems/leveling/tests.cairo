use eternum::constants::ResourceTypes;
use eternum::models::resources::Resource;
use eternum::models::level::Level;
use eternum::models::position::Position;

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
    ILevelingConfigDispatcher,
    ILevelingConfigDispatcherTrait,
};

use eternum::systems::leveling::contracts::leveling_systems;
use eternum::systems::leveling::interface::{
    ILevelingSystemsDispatcher,
    ILevelingSystemsDispatcherTrait,
};

fn setup() -> (IWorldDispatcher, u128, ILevelingSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);
    let level_config_dispatcher = ILevelingConfigDispatcher {
        contract_address: config_systems_address
    };

    starknet::testing::set_contract_address(world.executor());

    // set labor auction
    let decay_scaled: u128 = 1844674407370955161;
    let base_multiplier: u128 = 25;
    // 25%
    let cost_percentage_scaled: u128 = 4611686018427387904;
    // half a day of average production
    let wheat_base_amount: u128 = 3780;
    // half a day of average production
    let fish_base_amount: u128 = 1260;
    
    // 3 tier resources
    let mut resource_1_costs = array![(1, 1000), (2, 1000)].span();
    let mut resource_2_costs = array![(3, 1000), (4, 1000)].span();
    let mut resource_3_costs = array![(5, 1000), (6, 1000)].span();

    level_config_dispatcher.set_leveling_config(
        world,
        decay_scaled,
        cost_percentage_scaled,
        base_multiplier,
        wheat_base_amount,
        fish_base_amount,
        resource_1_costs,
        resource_2_costs,
        resource_3_costs
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

    // mint 100_000 wheat for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::WHEAT,
            balance: 100_000
        }
    ));

    // mint 100_000 fish for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::FISH,
            balance: 100_000
        }
    ));

    // mint 100_000 wood for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::WOOD,
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

    // mint 100_000 coal for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::COAL,
            balance: 100_000
        }
    ));

    // mint 100_000 copper for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::COPPER,
            balance: 100_000
        }
    ));


    // mint 100_000 obsidian for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::OBSIDIAN,
            balance: 100_000
        }
    ));

    // mint 100_000 silver for the realm;
    set!(world, (
        Resource {
            entity_id: realm_entity_id,
            resource_type: ResourceTypes::SILVER,
            balance: 100_000
        }
    ));


    let leveling_systems_address 
        = deploy_system(leveling_systems::TEST_CLASS_HASH);
    let leveling_systems_dispatcher = ILevelingSystemsDispatcher {
        contract_address: leveling_systems_address
    };


    (world, realm_entity_id, leveling_systems_dispatcher)
}


#[test]
#[available_gas(300000000000)]
fn test_level_up() {
    let (world, realm_entity_id, leveling_systems_dispatcher) = setup();

    let level = get!(world, (realm_entity_id), Level);
    assert(level.level == 0, 'wrong level');

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );
    
    // assert resources are the right amount
    let wheat_resource = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(wheat_resource.balance == 96220, 'failed resource amount');

    let fish_resource = get!(world, (realm_entity_id, ResourceTypes::FISH), Resource);
    assert(fish_resource.balance == 98740, 'failed resource amount');

    let wood_resource = get!(world, (realm_entity_id, ResourceTypes::WOOD), Resource);
    assert(wood_resource.balance == 100000, 'failed resource amount');

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 1, 'wrong level');

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    // assert resources are the right amount
    let wheat_resource = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(wheat_resource.balance == 96220, 'failed resource amount');

    let fish_resource = get!(world, (realm_entity_id, ResourceTypes::FISH), Resource);
    assert(fish_resource.balance == 98740, 'failed resource amount');

    let wood_resource = get!(world, (realm_entity_id, ResourceTypes::WOOD), Resource);
    assert(wood_resource.balance == 99000, 'failed resource amount');

    let stone_resource = get!(world, (realm_entity_id, ResourceTypes::STONE), Resource);
    assert(stone_resource.balance == 99000, 'failed resource amount');

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 2, 'wrong level');

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let coal_resource = get!(world, (realm_entity_id, ResourceTypes::COAL), Resource);
    assert(coal_resource.balance == 99000, 'failed resource amount');

    let copper_resource = get!(world, (realm_entity_id, ResourceTypes::COPPER), Resource);
    assert(copper_resource.balance == 99000, 'failed resource amount');

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 3, 'wrong level');    

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let obsidian_resource = get!(world, (realm_entity_id, ResourceTypes::OBSIDIAN), Resource);
    assert(obsidian_resource.balance == 99000, 'failed resource amount');

    let silver_resource = get!(world, (realm_entity_id, ResourceTypes::SILVER), Resource);
    assert(silver_resource.balance == 99000, 'failed resource amount');

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 4, 'wrong level');    

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let wheat_resource = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(wheat_resource.balance == 91495, 'failed resource amount');

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 5, 'wrong level');    

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 6, 'wrong level');    

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 7, 'wrong level');    

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 8, 'wrong level');    

    // level up 
    leveling_systems_dispatcher.level_up(
        world,
        realm_entity_id,
    );

    let level = get!(world, realm_entity_id, Level);
    assert(level.level == 9, 'wrong level');    

    let wheat_resource = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(wheat_resource.balance == 85599, 'failed resource amount');

    let silver_resource = get!(world, (realm_entity_id, ResourceTypes::SILVER), Resource);
    assert(silver_resource.balance == 97750, 'failed resource amount');
}