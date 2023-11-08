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
        world, realm_id, starknet::get_contract_address(), // owner
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, caller_position.clone(),
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

    // buy 5 soldiers
    let num_soldiers_bought = 5;
    let mut soldier_ids: Span<u128>
        = soldier_systems_dispatcher.create_soldiers(
            world, caller_id, num_soldiers_bought
        );
    

    (world, caller_id, soldier_ids, soldier_systems_dispatcher) 

}





#[test]
#[available_gas(3000000000000)]
fn test_group_and_deploy_soldier_to_attack() {

    let (world, caller_id, soldier_ids, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );




    // deploy 2 soldiers with attack duty
    let mut deployed_soldier_ids = array![];
    let deployed_soldiers_count = 2;
    let mut index = 0;

    loop {
        if index == deployed_soldiers_count {
            break;
        }
        deployed_soldier_ids
            .append(*soldier_ids.at(index));
        index += 1;
    };
    let group_id 
        = soldier_systems_dispatcher
            .group_and_deploy_soldiers(
                world, caller_id, 
                deployed_soldier_ids.span(), 
                Duty::Attack
            );


    let caller_position = get!(world, caller_id, Position);
    let group_owner = get!(world, group_id, Owner);
    assert(
        group_owner.address == contract_address_const::<'caller'>(), 
            'wrong owner'
    );

    let group_entity_owner = get!(world, group_id, EntityOwner);
    assert(
        group_entity_owner.entity_owner_id == caller_id,
            'wrong entity owner'
    );

    let group_health = get!(world, group_id, Health);
    assert(group_health.value == 100 * deployed_soldiers_count.into(), 'wrong health');

    let group_attack = get!(world, group_id, Attack);
    assert(group_attack.value == 100 * deployed_soldiers_count.into(), 'wrong attack');

    let group_defence = get!(world, group_id, Defence);
    assert(group_defence.value == 100 * deployed_soldiers_count.into(), 'wrong defence');

    let group_quantity = get!(world, group_id, Quantity);
    assert(group_quantity.value == deployed_soldiers_count.into(), 'wrong quantity');

    let group_position = get!(world, group_id, Position);
    assert(
            group_position.x == caller_position.x 
                && group_position.y == caller_position.y,
                    'wrong position'
    );


    let group_inventory = get!(world, group_id, Inventory);
    assert(group_inventory.items_key != 0, 'wrong inventory key');

    let group_movable = get!(world, group_id, Movable);
    assert(group_movable.blocked == false, 'group blocked');
    assert(
        group_movable.sec_per_km == 55 ,
         'wrong speed'
        );
    assert(group_movable.round_trip == false, 'wrong round_trip');
    assert(group_movable.intermediate_coord_x == 0, 'wrong coord x');
    assert(group_movable.intermediate_coord_y == 0, 'wrong coord y');


    let group_carry_capacity = get!(world, group_id, Capacity);
    assert(group_carry_capacity.weight_gram == 44, 'wrong capacity');  
}


#[test]
#[available_gas(3000000000000)]
fn test_group_and_deploy_soldier_to_defend() {

    let (world, caller_id, soldier_ids, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );


    // deploy 2 soldiers to watch tower
    let mut deployed_soldier_ids = array![];
    let deployed_soldiers_count = 2;
    let mut index = 0;

    loop {
        if index == deployed_soldiers_count {
            break;
        }
        deployed_soldier_ids
            .append(*soldier_ids.at(index));
        index += 1;
    };
    let group_id 
        = soldier_systems_dispatcher
            .group_and_deploy_soldiers(
                world, caller_id, 
                deployed_soldier_ids.span(), 
                Duty::Defence
            );

    
    let realm_town_watch = get!(world, caller_id, TownWatch);
    assert(realm_town_watch.town_watch_id == group_id, 'wrong group id');


    let caller_position = get!(world, caller_id, Position);
    let group_owner = get!(world, group_id, Owner);
    assert(
        group_owner.address == contract_address_const::<'caller'>(), 
            'wrong owner'
    );

    let group_entity_owner = get!(world, group_id, EntityOwner);
    assert(
        group_entity_owner.entity_owner_id == caller_id,
            'wrong entity owner'
    );

    let group_health = get!(world, group_id, Health);
    assert(group_health.value == 100 * deployed_soldiers_count.into(), 'wrong health');

    let group_attack = get!(world, group_id, Attack);
    assert(group_attack.value == 100 * deployed_soldiers_count.into(), 'wrong attack');

    let group_defence = get!(world, group_id, Defence);
    assert(group_defence.value == 100 * deployed_soldiers_count.into(), 'wrong defence');

    let group_quantity = get!(world, group_id, Quantity);
    assert(group_quantity.value == deployed_soldiers_count.into(), 'wrong quantity');

    let group_position = get!(world, group_id, Position);
    assert(
            group_position.x == caller_position.x 
                && group_position.y == caller_position.y,
                    'wrong position'
    );

    // defenders should not have inventory
    let group_inventory = get!(world, group_id, Inventory);
    assert(group_inventory.items_key == 0, 'wrong inventory key');

    // defenders should not be able to carry resources
    let group_carry_capacity = get!(world, group_id, Capacity);
    assert(group_carry_capacity.weight_gram == 0,  'wrong capacity'); 

    // defenders should not be able to move
    let group_movable = get!(world, group_id, Movable);
    assert(group_movable.blocked == true, 'group not blocked');
    assert(group_movable.sec_per_km == 0 ,'wrong speed');
 
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not realm owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, caller_id, soldier_ids, soldier_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // try to group soldiers
    soldier_systems_dispatcher
        .group_and_deploy_soldiers(
            world, caller_id, 
            soldier_ids, 
            Duty::Attack
        );
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not a realm','ENTRYPOINT_FAILED' ))]
fn test_not_realm() {

    let (world, _, soldier_ids, soldier_systems_dispatcher) = setup();

    let caller_id = 99999;
    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // try to group soldiers
    soldier_systems_dispatcher
        .group_and_deploy_soldiers(
            world, caller_id, 
            soldier_ids, 
            Duty::Attack
        );
}

