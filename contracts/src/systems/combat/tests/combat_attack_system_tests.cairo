use eternum::models::position::Position;
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::config::{
    SpeedConfig, WeightConfig, CapacityConfig, 
    SoldierConfig, HealthConfig, AttackConfig, DefenceConfig
};
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::order::Orders;
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

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{
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
        ].span(),
        100,
        200
    );

    // set soldiers starting attack, defence and health
    combat_config_dispatcher.set_attack_config(
        world, SOLDIER_ENTITY_TYPE, 100
    );
    combat_config_dispatcher.set_defence_config(
        world, SOLDIER_ENTITY_TYPE, 100
    );
    combat_config_dispatcher.set_health_config(
        world, SOLDIER_ENTITY_TYPE, array![].span(), 100
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
        = deploy_system(realm_systems::TEST_CLASS_HASH);
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
    let order = 0;

    // create attacker's realm
    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    let attacker_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order,
        attacker_realm_entity_position.clone(),
    );

    // create target's realm
    // note: we are setting the same position for both realms
    //        for ease of testing
    starknet::testing::set_contract_address(
        contract_address_const::<'target'>()
    );
    let target_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order,
        attacker_realm_entity_position.clone(),
    );

    

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
    let attacker_unit_id = soldier_systems_dispatcher.create_soldiers(
         world, attacker_realm_entity_id, ATTACKER_SOLDIER_COUNT
    );


    
        

    starknet::testing::set_contract_address(
        contract_address_const::<'target'>()
    );

    let target_combat = get!(world, target_realm_entity_id, TownWatch);
    let target_town_watch_id = target_combat.town_watch_id;
    
    // buy soldiers for target
    let target_unit_id = soldier_systems_dispatcher.create_soldiers(
         world, target_realm_entity_id, TARGET_SOLDIER_COUNT
    );

    
    // add target unit to town watch
    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            target_town_watch_id, 
            array![
                (target_unit_id, TARGET_SOLDIER_COUNT),
            ].span()
        );

    
    let combat_systems_dispatcher = ICombatSystemsDispatcher {
        contract_address: combat_systems_address
    };
    (
        world, 
        attacker_realm_entity_id, attacker_unit_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) 

}





#[test]
fn test_attack() {

    let (
        world, 
        _, attacker_unit_id, 
        _, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();
    
    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    // attack target
    combat_systems_dispatcher
        .attack(
            world, 
            array![attacker_unit_id].span(),
            target_town_watch_id
        );

    let attacker_unit_health = get!(world, attacker_unit_id, Health);
    let target_unit_health = get!(world, target_town_watch_id, Health);
   

    assert!(
        attacker_unit_health.value < 100
            * ATTACKER_SOLDIER_COUNT || target_unit_health.value < 100
            * TARGET_SOLDIER_COUNT,
        "wrong health value"
    );
}


#[test]
#[should_panic(expected: ('not attacker owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (
        world, 
        _, attacker_unit_id, 
        _, target_town_watch_id, 
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
            array![attacker_unit_id].span(),
            target_town_watch_id
        );

}




#[test]
#[should_panic(expected: ('attacker is travelling','ENTRYPOINT_FAILED' ))]
fn test_attacker_in_transit() {

    let (
        world, 
        _, attacker_unit_id, 
        _, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set arrival time a future time
    
    set!(world, (
        ArrivalTime { 
            entity_id: attacker_unit_id, 
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
            array![attacker_unit_id].span(),
            target_town_watch_id
        );

}


#[test]
#[should_panic(expected: ('attacker is dead','ENTRYPOINT_FAILED' ))]
fn test_attacker_dead() {

    let (
        world, 
        _, attacker_unit_id, 
        _, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set attacker health to 0
    
    set!(world, (
        Health { 
            entity_id: attacker_unit_id, 
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
            array![attacker_unit_id].span(),
            target_town_watch_id
        );

}


#[test]
#[should_panic(expected: ('target is dead','ENTRYPOINT_FAILED' ))]
fn test_target_dead() {

    let (
        world, 
        _, attacker_unit_id, 
        _, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set target health to 0
    
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
            array![attacker_unit_id].span(),
            target_town_watch_id
        );

}



#[test]
#[should_panic(expected: ('position mismatch','ENTRYPOINT_FAILED' ))]
fn test_wrong_position() {

    let (
        world, 
        _, attacker_unit_id, 
        _, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set attacker position to a different position
    
    set!(world, (
        Position { 
            entity_id: attacker_unit_id, 
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
            array![attacker_unit_id].span(),
            target_town_watch_id
        );

}






