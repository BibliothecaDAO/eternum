use eternum::models::position::Position;
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::config::{
    SpeedConfig, WeightConfig, CapacityConfig, 
    SoldierConfig, HealthConfig, AttackConfig, DefenceConfig
};
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::inventory::Inventory;
use eternum::models::capacity::Capacity;
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::quantity::{Quantity, QuantityTrait};    
use eternum::models::combat::{
    Attack,   
    Health, Defence, Duty, TownWatch
};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait,
    ICombatConfigDispatcher, ICombatConfigDispatcherTrait
};

use eternum::systems::test::contracts::realm::test_realm_systems;
use eternum::systems::test::interface::realm::{
    IRealmSystemsDispatcher,
    IRealmSystemsDispatcherTrait,
};


use eternum::systems::combat::contracts::{
        combat_systems
};

use eternum::systems::combat::interface::{
        ISoldierSystemsDispatcher, ISoldierSystemsDispatcherTrait,
        ICombatSystemsDispatcher, ICombatSystemsDispatcherTrait,
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::SOLDIER_ENTITY_TYPE;

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};
use core::traits::Into;

const ATTACKER_SOLDIER_COUNT: u128 = 15;
const TARGET_SOLDIER_COUNT: u128 = 5;

fn setup() -> (IWorldDispatcher, u128, u128, u128, u128, ICombatSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set soldier cost configuration 
    let combat_config_dispatcher = ICombatConfigDispatcher {
        contract_address: config_systems_address
    };
    combat_config_dispatcher.set_soldier_config(
        world,
        array![ 
            // pay for each soldier with the following
            (ResourceTypes::WOOD, 40),
            (ResourceTypes::WHEAT, 40),
        ].span()
    );

    // set soldiers starting attack, defence and health
    combat_config_dispatcher.set_attack_config(
        world, SOLDIER_ENTITY_TYPE, 100
    );
    combat_config_dispatcher.set_defence_config(
        world, SOLDIER_ENTITY_TYPE, 100
    );
    combat_config_dispatcher.set_health_config(
        world, SOLDIER_ENTITY_TYPE, 100
    );

    // set soldier speed configuration 
    ITransportConfigDispatcher {
        contract_address: config_systems_address
    }.set_speed_config(world, SOLDIER_ENTITY_TYPE, 55); // 10km per sec
    

    // set soldier carry capacity configuration 
    ICapacityConfigDispatcher {
        contract_address: config_systems_address
    }.set_capacity_config(world, SOLDIER_ENTITY_TYPE, 44); 



    let realm_systems_address 
        = deploy_system(test_realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let attacker_realm_entity_position = Position { x: 100000, y: 200000, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    // create attacker's realm
    let attacker_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, attacker_realm_entity_position.clone(),
    );

    // create target's realm
    // note: we are setting the same position for both realms
    //        for ease of testing
    let target_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, attacker_realm_entity_position.clone(),
    );

    starknet::testing::set_contract_address(world.executor());

    // set up attacker
    set!(world, (Owner { entity_id: attacker_realm_entity_id, address: contract_address_const::<'attacker'>()}));
    set!(world, (Resource { entity_id: attacker_realm_entity_id, resource_type: ResourceTypes::WHEAT, balance: 5000 }));
    set!(world, (Resource { entity_id: attacker_realm_entity_id, resource_type: ResourceTypes::WOOD, balance: 5000 }));


    // set up target
    set!(world, (Owner { entity_id: target_realm_entity_id, address: contract_address_const::<'target'>()}));
    set!(world, (Resource { entity_id: target_realm_entity_id, resource_type: ResourceTypes::WHEAT, balance: 5000 }));
    set!(world, (Resource { entity_id: target_realm_entity_id, resource_type: ResourceTypes::WOOD, balance: 5000 }));


    let combat_systems_address 
        = deploy_system(combat_systems::TEST_CLASS_HASH);
    let soldier_systems_dispatcher = ISoldierSystemsDispatcher {
        contract_address: combat_systems_address
    };

    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    // buy soldiers for attacker
    let soldier_ids: Span<u128>
        = soldier_systems_dispatcher.create_soldiers(
            world, attacker_realm_entity_id, ATTACKER_SOLDIER_COUNT
        );

    
    // deploy attacker soldiers for attacking
    let attacker_group_id 
        = soldier_systems_dispatcher
            .group_and_deploy_soldiers(
                world, attacker_realm_entity_id, 
                soldier_ids, 
                Duty::Attack
            );

    starknet::testing::set_contract_address(
        contract_address_const::<'target'>()
    );

    // buy soldiers for target
    let soldier_ids: Span<u128>
        = soldier_systems_dispatcher.create_soldiers(
            world, target_realm_entity_id, TARGET_SOLDIER_COUNT
        );


    // deploy target's soldiers for defence
    let target_town_watch_id 
        = soldier_systems_dispatcher
                .group_and_deploy_soldiers(
                    world, target_realm_entity_id, 
                    soldier_ids, 
                    Duty::Defence
                );

    
    let combat_systems_dispatcher = ICombatSystemsDispatcher {
        contract_address: combat_systems_address
    };
    (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) 

}





#[test]
#[available_gas(3000000000000)]
fn test_attack() {

    let (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();
    
    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_group_id].span(), 
            target_realm_entity_id
        );

    let attacker_group_health = get!(world, attacker_group_id, Health);
    let target_group_health = get!(world, target_town_watch_id, Health);
   

    assert(
        attacker_group_health.value < 100 * ATTACKER_SOLDIER_COUNT 
            || target_group_health.value < 100 * TARGET_SOLDIER_COUNT,
                'wrong health value'
    );

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not attacker owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set unknown contract address as caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_group_id].span(), 
            target_realm_entity_id
        );

}




#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('attacker is travelling','ENTRYPOINT_FAILED' ))]
fn test_attacker_in_transit() {

    let (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set arrival time a future time
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        ArrivalTime { 
            entity_id: attacker_group_id, 
            arrives_at: 1 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_group_id].span(), 
            target_realm_entity_id
        );

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('attacker is dead','ENTRYPOINT_FAILED' ))]
fn test_attacker_dead() {

    let (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set attacker health to 0
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Health { 
            entity_id: attacker_group_id, 
            value: 0 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_group_id].span(), 
            target_realm_entity_id
        );

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('target is dead','ENTRYPOINT_FAILED' ))]
fn test_target_dead() {

    let (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set target health to 0
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Health { 
            entity_id: target_town_watch_id, 
            value: 0 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_group_id].span(), 
            target_realm_entity_id
        );

}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('position mismatch','ENTRYPOINT_FAILED' ))]
fn test_wrong_position() {

    let (
        world, 
        attacker_realm_entity_id, attacker_group_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set attacker position to a different position
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Position { 
            entity_id: attacker_group_id, 
            x: 100, y: 200 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_group_id].span(), 
            target_realm_entity_id
        );

}






