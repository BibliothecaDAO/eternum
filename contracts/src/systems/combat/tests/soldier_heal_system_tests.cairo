use eternum::models::position::Position;
use eternum::models::resources::{Resource};

use eternum::models::owner::{Owner};
use eternum::models::combat::{
    Health, Combat, Duty
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
        ISoldierSystemsDispatcher, ISoldierSystemsDispatcherTrait
};

use eternum::utils::testing::{spawn_eternum, deploy_system};

use eternum::constants::ResourceTypes;
use eternum::constants::SOLDIER_ENTITY_TYPE;

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};
use core::traits::Into;


fn setup() -> (IWorldDispatcher, u128, u128, ISoldierSystemsDispatcher) {
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
        world, SOLDIER_ENTITY_TYPE, array![
            // pay for a unit of health with the following
            (ResourceTypes::DEMONHIDE, 17)
        ].span(), 100
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

    let caller_position = Position { x: 100000, y: 200000, entity_id: 1_u128};

    let realm_id = 1;
    let resource_types_packed = 1;
    let resource_types_count = 1;
    let cities = 6;
    let harbors = 5;
    let rivers = 5;
    let regions = 5;
    let wonder = 1;
    let order = 1;

    // create caller's realm
    let caller_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id, contract_address_const::<'caller'>(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, caller_position.clone(),
    );

    starknet::testing::set_contract_address(world.executor());

    let caller_id = caller_realm_entity_id;
    
    set!(world, (Owner { entity_id: caller_id, address: contract_address_const::<'caller'>()}));

    set!(world, (Resource { entity_id: caller_id, resource_type: ResourceTypes::WHEAT, balance: 5000 }));
    set!(world, (Resource { entity_id: caller_id, resource_type: ResourceTypes::WOOD, balance: 5000 }));
    set!(world, (Resource { entity_id: caller_id, resource_type: ResourceTypes::DEMONHIDE, balance: 5000 }));

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    let combat_systems_address 
        = deploy_system(combat_systems::TEST_CLASS_HASH);
    let soldier_systems_dispatcher = ISoldierSystemsDispatcher {
        contract_address: combat_systems_address
    };
    

    // buy x soldiers
    let num_soldiers_bought = 2;
    soldier_systems_dispatcher.create_soldiers(
        world, caller_id, num_soldiers_bought
    );

    // detach 1 soldier from reserve
    let entity_combat = get!(world, caller_id, Combat);
    let realm_soldiers_reserve_id = entity_combat.soldiers_reserve_id;


    let num_detached_soldiers = 1;
    let detached_unit_id 
        = soldier_systems_dispatcher
            .detach_soldiers(
                world, realm_soldiers_reserve_id, 
                num_detached_soldiers
            );

    (world, caller_id, detached_unit_id, soldier_systems_dispatcher) 

}





#[test]
#[available_gas(3000000000000)]
fn test_heal_soldier() {

    let (world, caller_id, detached_unit_id, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(world.executor());

    // reduce the health of the first soldier by 40

    set!(world, (
        Health { 
            entity_id: detached_unit_id, 
            value: 60 
    }));


    // buy health for the first soldier

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    let health_bought = 40;
    soldier_systems_dispatcher.heal_soldiers(
        world, detached_unit_id, health_bought
    );


    // check that the soldier's health has been increased
    let soldier_health = get!(world, detached_unit_id, Health);
    assert(soldier_health.value == 100, 'wrong soldier health');

    // check that the caller's demonhide balance has been reduced
    let caller_demonhide_balance 
        = get!(world, (caller_id, ResourceTypes::DEMONHIDE), Resource);
    assert(
        caller_demonhide_balance.balance == 5000 - (17 * health_bought), 
        'wrong demonhide balance'
    );

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not unit owner','ENTRYPOINT_FAILED' ))]
fn test_not_unit_owner() {

    let (world, caller_id, detached_unit_id, soldier_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // reduce the health of the first soldier 
    let health_bought = 40;
    soldier_systems_dispatcher.heal_soldiers(
        world, detached_unit_id, health_bought
    );

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('max health exceeeded','ENTRYPOINT_FAILED' ))]
fn test_purchase_exceeds_max_health() {

    let (world, caller_id, detached_unit_id, soldier_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // reduce the health of the first soldier 

    // note that the soldier's max health is 100
    // and the current health is 100 so buying 
    // one more health will exceed the max health
    let health_bought = 1;
    soldier_systems_dispatcher.heal_soldiers(
        world, detached_unit_id, health_bought
    );

}
