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

use eternum::systems::realm::contracts::realm_systems;
use eternum::systems::realm::interface::{
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


fn setup() -> (IWorldDispatcher, u128, Span<u128>, ISoldierSystemsDispatcher) {
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
    let order_hyperstructure_id = world.uuid().into();
    
    // create caller's realm
    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );
    let caller_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, order_hyperstructure_id,caller_position.clone(),
    );

    starknet::testing::set_contract_address(world.executor());

    let caller_id = caller_realm_entity_id;
    
    set!(world, (Owner { entity_id: caller_id, address: contract_address_const::<'caller'>()}));

    set!(world, (Resource { entity_id: caller_id, resource_type: ResourceTypes::WHEAT, balance: 5000 }));
    set!(world, (Resource { entity_id: caller_id, resource_type: ResourceTypes::WOOD, balance: 5000 }));

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    let combat_systems_address 
        = deploy_system(combat_systems::TEST_CLASS_HASH);
    let soldier_systems_dispatcher = ISoldierSystemsDispatcher {
        contract_address: combat_systems_address
    };

    // create 2 soldiers
    let new_unit_id_1 = soldier_systems_dispatcher.create_soldiers(
        world, caller_id, 2
    );

    // create another 2 soldiers
    let new_unit_id_2 = soldier_systems_dispatcher.create_soldiers(
        world, caller_id, 2
    );


    let new_units = array![
        new_unit_id_1,
        new_unit_id_2
    ];


    (world, caller_id, new_units.span(), soldier_systems_dispatcher) 

}





#[test]
#[available_gas(3000000000000)]
fn test_merge_to_town_watch() {

    let (world, caller_id, new_units, soldier_systems_dispatcher) = setup();

    let entity_combat = get!(world, caller_id, TownWatch);
    let caller_town_watch_id = entity_combat.town_watch_id;


    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );


    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            caller_town_watch_id, 
            array![
                (*new_units.at(0), 2),
            ].span()
        );

    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            caller_town_watch_id, 
            array![
                (*new_units.at(1), 2),
            ].span()
        );


    let first_new_unit_health = get!(world, *new_units.at(0), Health);
    assert(first_new_unit_health.value == 0, 'wrong health');

    let first_new_unit_attack = get!(world, *new_units.at(0), Attack);
    assert(first_new_unit_attack.value == 0, 'wrong attack');

    let first_new_unit_defence = get!(world, *new_units.at(0), Defence);
    assert(first_new_unit_defence.value == 0, 'wrong defence');

    let first_new_unit_quantity = get!(world, *new_units.at(0), Quantity);
    assert(first_new_unit_quantity.value == 0, 'wrong quantity');



    let second_new_unit_health = get!(world, *new_units.at(1), Health);
    assert(second_new_unit_health.value == 0, 'wrong health');

    let second_new_unit_attack = get!(world, *new_units.at(1), Attack);
    assert(second_new_unit_attack.value == 0, 'wrong attack');

    let second_new_unit_defence = get!(world, *new_units.at(1), Defence);
    assert(second_new_unit_defence.value == 0, 'wrong defence');

    let second_new_unit_quantity = get!(world, *new_units.at(1), Quantity);
    assert(second_new_unit_quantity.value == 0, 'wrong quantity');


    // check that the merged unit has the correct values 
    let caller_position = get!(world, caller_id, Position);
    let unit_owner = get!(world, caller_town_watch_id, Owner);
    assert(
        unit_owner.address == contract_address_const::<'caller'>(), 
            'wrong owner'
    );

    let unit_entity_owner = get!(world, caller_town_watch_id, EntityOwner);
    assert(
        unit_entity_owner.entity_owner_id == caller_id,
            'wrong entity owner'
    );

    let unit_health = get!(world, caller_town_watch_id, Health);
    assert(unit_health.value == 100 * 2 * 2, 'wrong health');

    let unit_attack = get!(world, caller_town_watch_id, Attack);
    assert(unit_attack.value == 100 * 2 * 2, 'wrong attack');

    let unit_defence = get!(world, caller_town_watch_id, Defence);
    assert(unit_defence.value == 100 * 2 * 2, 'wrong defence');

    let unit_quantity = get!(world, caller_town_watch_id, Quantity);
    assert(unit_quantity.value == 2 * 2, 'wrong quantity');

    let unit_position = get!(world, caller_town_watch_id, Position);
    assert(
            unit_position.x == caller_position.x 
                && unit_position.y == caller_position.y,
                    'wrong position'
    );


    let unit_movable = get!(world, caller_town_watch_id, Movable);
    assert(
        // the speed would still be 0 because town watch can't move
        unit_movable.sec_per_km == 0, 
         'wrong speed'
        );

    let unit_carry_capacity = get!(world, caller_town_watch_id, Capacity);
    assert(unit_carry_capacity.weight_gram == 44, 'wrong capacity');  
}



#[test]
#[available_gas(3000000000000)]
fn test_merge_to_raider() {

    let (world, caller_id, new_units, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );


    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            *new_units.at(0), 
            array![
                (*new_units.at(1), 2),
            ].span()
        );



    let second_new_unit_health = get!(world, *new_units.at(1), Health);
    assert(second_new_unit_health.value == 0, 'wrong health');

    let second_new_unit_attack = get!(world, *new_units.at(1), Attack);
    assert(second_new_unit_attack.value == 0, 'wrong attack');

    let second_new_unit_defence = get!(world, *new_units.at(1), Defence);
    assert(second_new_unit_defence.value == 0, 'wrong defence');

    let second_new_unit_quantity = get!(world, *new_units.at(1), Quantity);
    assert(second_new_unit_quantity.value == 0, 'wrong quantity');


        // check that the merged unit has the correct values 
    let caller_position = get!(world, caller_id, Position);
    let unit_owner = get!(world, *new_units.at(0), Owner);
    assert(
        unit_owner.address == contract_address_const::<'caller'>(), 
            'wrong owner'
    );

    let unit_entity_owner = get!(world, *new_units.at(0), EntityOwner);
    assert(
        unit_entity_owner.entity_owner_id == caller_id,
            'wrong entity owner'
    );

    let unit_health = get!(world, *new_units.at(0), Health);
    assert(unit_health.value == 100 * 2 * 2, 'wrong health');

    let unit_attack = get!(world, *new_units.at(0), Attack);
    assert(unit_attack.value == 100 * 2 * 2, 'wrong attack');

    let unit_defence = get!(world, *new_units.at(0), Defence);
    assert(unit_defence.value == 100 * 2 * 2, 'wrong defence');

    let unit_quantity = get!(world, *new_units.at(0), Quantity);
    assert(unit_quantity.value == 2 * 2, 'wrong quantity');

    let unit_position = get!(world, *new_units.at(0), Position);
    assert(
            unit_position.x == caller_position.x 
                && unit_position.y == caller_position.y,
                    'wrong position'
    );


    let unit_movable = get!(world, *new_units.at(0), Movable);
    assert(
        unit_movable.sec_per_km == 55 ,
         'wrong speed'
        );

    let unit_carry_capacity = get!(world, *new_units.at(0), Capacity);
    assert(unit_carry_capacity.weight_gram == 44, 'wrong capacity');  
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not unit owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, caller_id, new_units, soldier_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // try to unit soldiers
    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            *new_units.at(0), 
            array![
                (*new_units.at(1), 2),
            ].span()
        );
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not owned by realm','ENTRYPOINT_FAILED' ))]
fn test_not_realm() {

    let (world, caller_id, new_units, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        EntityOwner {
            entity_id: *new_units.at(0),
            entity_owner_id: 9999999

        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // try to unit soldiers
    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            *new_units.at(0), 
            array![
                (*new_units.at(1), 2),
            ].span()
        );
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('unit is travelling','ENTRYPOINT_FAILED' ))]
fn test_travelling_unit() {

    let (world, caller_id, new_units, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        ArrivalTime {
            entity_id: *new_units.at(0),
            arrives_at: 1
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // try to unit soldiers
    soldier_systems_dispatcher
        .merge_soldiers(
            world, 
            *new_units.at(0), 
            array![
                (*new_units.at(1), 2),
            ].span()
        );
}

