use eternum::models::position::Position;
use eternum::models::resources::{Resource, ResourceCost};
use eternum::models::config::{
    SpeedConfig, WeightConfig, CapacityConfig, 
    SoldierConfig, HealthConfig, AttackConfig, DefenceConfig
};
use eternum::models::movable::{Movable};
use eternum::models::inventory::Inventory;
use eternum::models::capacity::Capacity;
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::quantity::{Quantity, QuantityTrait};    
use eternum::models::combat::{
    Attack, Health, Defence, TownWatch
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


fn setup() -> (IWorldDispatcher, u128, ISoldierSystemsDispatcher) {
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
    let realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, order_hyperstructure_id,caller_position.clone(),
    );

    starknet::testing::set_contract_address(world.executor());

    
    set!(world, (Owner { entity_id: realm_entity_id, address: contract_address_const::<'caller'>()}));

    set!(world, (Resource { entity_id: realm_entity_id, resource_type: ResourceTypes::WHEAT, balance: 5000 }));
    set!(world, (Resource { entity_id: realm_entity_id, resource_type: ResourceTypes::WOOD, balance: 5000 }));

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    let combat_systems_address 
        = deploy_system(combat_systems::TEST_CLASS_HASH);
    let soldier_systems_dispatcher = ISoldierSystemsDispatcher {
        contract_address: combat_systems_address
    };
    

    (world, realm_entity_id, soldier_systems_dispatcher) 

}





#[test]
#[available_gas(3000000000000)]
fn test_create_soldier() {

    let (world, realm_entity_id, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // buy x soldiers
    let num_soldiers_bought = 15;
    let new_unit_id = soldier_systems_dispatcher.create_soldiers(
         world, realm_entity_id, num_soldiers_bought
    );


    // check that payment works correctly
    let caller_wheat_resource = get!(world, (realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(caller_wheat_resource.balance == 5000 - 40 * num_soldiers_bought, 'wrong wheat balance');

    let caller_wood_resource = get!(world, (realm_entity_id, ResourceTypes::WOOD), Resource);
    assert(caller_wood_resource.balance == 5000 - 40 * num_soldiers_bought, 'wrong wood balance');



    // check that the soldiers were created correctly
    let caller_position = get!(world, realm_entity_id, Position);
    
    let realm_new_unit_owner = get!(world, new_unit_id, Owner);
    assert(realm_new_unit_owner.address == contract_address_const::<'caller'>(), 'wrong owner');

    let realm_new_unit_entity_owner = get!(world, new_unit_id, EntityOwner);
    assert(
        realm_new_unit_entity_owner.entity_owner_id == realm_entity_id,
        'wrong owner'
    );


    let realm_new_unit_health = get!(world, new_unit_id, Health);
    assert(realm_new_unit_health.value == 100 * num_soldiers_bought, 'wrong health');

    let realm_new_unit_attack = get!(world, new_unit_id, Attack);
    assert(realm_new_unit_attack.value == 100 * num_soldiers_bought, 'wrong attack');

    let realm_new_unit_defence = get!(world, new_unit_id, Defence);
    assert(realm_new_unit_defence.value == 100 * num_soldiers_bought, 'wrong defence');

    let realm_new_unit_quantity = get!(world, new_unit_id, Quantity);
    assert(realm_new_unit_quantity.value == num_soldiers_bought, 'wrong quantity');

    let realm_new_unit_movable = get!(world, new_unit_id, Movable);
    assert(realm_new_unit_movable.sec_per_km == 55, 'wrong speed');

    let realm_new_unit_capacity = get!(world, new_unit_id, Capacity);
    assert(realm_new_unit_capacity.weight_gram == 44, 'wrong capacity');

    let realm_new_unit_position = get!(world, new_unit_id, Position);
    assert(realm_new_unit_position.x == caller_position.x, 'wrong position x');
    assert(realm_new_unit_position.y == caller_position.y, 'wrong position y');

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not realm owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, realm_entity_id, soldier_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // try to buy soldiers
    let num_soldiers_bought = 5;
    soldier_systems_dispatcher.create_soldiers(
        world, realm_entity_id, num_soldiers_bought
    );
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not a realm','ENTRYPOINT_FAILED' ))]
fn test_not_realm() {

    let (world, _, soldier_systems_dispatcher) = setup();

    let realm_entity_id = 99999;
    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // try to buy soldiers
    let num_soldiers_bought = 5;
    soldier_systems_dispatcher.create_soldiers(
        world, realm_entity_id, num_soldiers_bought
    );
}

