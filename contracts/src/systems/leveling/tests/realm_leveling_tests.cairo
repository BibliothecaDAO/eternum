use eternum::constants::{ResourceTypes, REALM_LEVELING_CONFIG_ID};
use eternum::models::resources::Resource;
use eternum::models::level::Level;
use eternum::models::position::Position;

use eternum::utils::testing::{spawn_eternum, deploy_system};

use core::traits::Into;
use core::option::OptionTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{IRealmSystemsDispatcher, IRealmSystemsDispatcherTrait,};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ILevelingConfigDispatcher, ILevelingConfigDispatcherTrait,
};

use eternum::systems::leveling::contracts::leveling_systems;
use eternum::systems::leveling::interface::{
    ILevelingSystemsDispatcher, ILevelingSystemsDispatcherTrait,
};

use starknet::contract_address_const;

fn setup() -> (IWorldDispatcher, u128, ILevelingSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let level_config_dispatcher = ILevelingConfigDispatcher {
        contract_address: config_systems_address
    };

    // set labor auction
    let decay_scaled: u128 = 1844674407370955161;
    let base_multiplier: u128 = 25;
    // 25%
    let cost_percentage_scaled: u128 = 4611686018427387904;
    // half a day of average production
    let wheat_base_amount: u128 = 3780;
    // half a day of average production
    let fish_base_amount: u128 = 1260;
    let decay_interval = 604600;
    let max_level = 1000;

    // 3 tier resources
    let mut resource_1_costs = array![(ResourceTypes::WHEAT, 1000), (ResourceTypes::FISH, 1000)]
        .span();
    let mut resource_2_costs = array![].span();
    let mut resource_3_costs = array![].span();

    level_config_dispatcher
        .set_leveling_config(
            REALM_LEVELING_CONFIG_ID,
            decay_interval,
            max_level,
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
    let realm_systems_address = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    // create realm

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
            Position { x: 500200, y: 1, entity_id: 1_u128 }, // position  
        // x needs to be > 470200 to get zone

        );

    // mint 100_000 wheat and fish for the realm;
    set!(
        world,
        (
            Resource {
                entity_id: realm_entity_id, resource_type: ResourceTypes::WHEAT, balance: 100_000
            },
            Resource {
                entity_id: realm_entity_id, resource_type: ResourceTypes::FISH, balance: 100_000
            },
        )
    );

    let leveling_systems_address = deploy_system(leveling_systems::TEST_CLASS_HASH);
    let leveling_systems_dispatcher = ILevelingSystemsDispatcher {
        contract_address: leveling_systems_address
    };

    (world, realm_entity_id, leveling_systems_dispatcher)
}


#[test]
#[available_gas(300000000000)]
fn test_level_up_realm() {
    let (world, realm_entity_id, leveling_systems_dispatcher) = setup();

    let level = get!(world, (realm_entity_id), Level);
    assert(level.level == 0, 'wrong level');

    // level up 
    leveling_systems_dispatcher.level_up_realm(realm_entity_id,);

    let realm_wheat = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(realm_wheat.balance > 0 && realm_wheat.balance < 100_000, 'wrong wheat balance');

    let realm_fish = get!(world, (realm_entity_id, ResourceTypes::FISH), Resource);
    assert(realm_fish.balance > 0 && realm_fish.balance < 100_000, 'wrong fish balance');

    let new_level = get!(world, (realm_entity_id), Level);
    assert(new_level.level == 1, 'wrong level');
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('not realm owner', 'ENTRYPOINT_FAILED'))]
fn test_level_up__not_realm_owner() {
    let (_, realm_entity_id, leveling_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(contract_address_const::<'unknown'>());

    // level up 
    leveling_systems_dispatcher.level_up_realm(realm_entity_id,);
}


#[test]
#[available_gas(300000000000)]
#[should_panic(expected: ('not a realm', 'ENTRYPOINT_FAILED'))]
fn test_level_up__not_realm() {
    let (_, _, leveling_systems_dispatcher) = setup();

    // set abritrary realm entity id
    let realm_entity_id = 8888888;

    // level up 
    leveling_systems_dispatcher.level_up_realm(realm_entity_id,);
}
