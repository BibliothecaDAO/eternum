use eternum::models::position::Position;
use eternum::models::resources::{Resource};
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

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    let caller_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, caller_position.clone(),
    );

    

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

    // buy 10 soldiers
    let num_soldiers_bought = 10;
    let new_unit_id = soldier_systems_dispatcher.create_soldiers(
        world, caller_id, num_soldiers_bought
    );

    (world, caller_id, new_unit_id, soldier_systems_dispatcher) 

}





#[test]
#[available_gas(3000000000000)]
fn test_detach_unit() {

    let (world, caller_id, unit_id, soldier_systems_dispatcher) 
        = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // detach 7 soldiers from unit
    let num_detached_soldiers = 7;
    let new_unit_id 
        = soldier_systems_dispatcher
            .detach_soldiers(
                world, unit_id, 
                num_detached_soldiers
            );

    // ensure the former unit is updated by checking some of its components
    let unit_owner = get!(world, unit_id, Owner);
    let unit_quantity = get!(world, unit_id, Quantity);
    let unit_health = get!(world, unit_id, Health);
    let unit_attack = get!(world, unit_id, Attack);
    let unit_defence = get!(world, unit_id, Defence);

    assert(
        unit_owner.address == contract_address_const::<'caller'>(), 
            'wrong owner address'
    );

    assert(
        unit_quantity.value == 10 - num_detached_soldiers, 
            'wrong quantity value'
    );

    assert(
        unit_health.value == 100 * (10 - num_detached_soldiers), 
            'wrong health value'
    );


    assert(
        unit_attack.value == 100 * (10 - num_detached_soldiers), 
            'wrong health value'
    );


    assert(
        unit_defence.value == 100 * (10 - num_detached_soldiers), 
            'wrong health value'
    );



    // ensure new unit values are accurate




    let caller_position = get!(world, caller_id, Position);
    let new_unit_owner = get!(world, new_unit_id, Owner);
    assert(
        new_unit_owner.address == contract_address_const::<'caller'>(), 
            'wrong owner'
    );

    let new_unit_entity_owner = get!(world, new_unit_id, EntityOwner);
    assert(
       new_unit_entity_owner.entity_owner_id == caller_id,
            'wrong entity owner'
    );

    let new_unit_health = get!(world, new_unit_id, Health);
    assert(new_unit_health.value == 100 * num_detached_soldiers.into(), 'wrong health');

    let new_unit_attack = get!(world, new_unit_id, Attack);
    assert(new_unit_attack.value == 100 * num_detached_soldiers.into(), 'wrong attack');

    let new_unit_defence = get!(world, new_unit_id, Defence);
    assert(new_unit_defence.value == 100 * num_detached_soldiers.into(), 'wrong defence');

    let new_unit_quantity = get!(world, new_unit_id, Quantity);
    assert(new_unit_quantity.value == num_detached_soldiers.into(), 'wrong quantity');

    let new_unit_position = get!(world, new_unit_id, Position);
    assert(
            new_unit_position.x == caller_position.x 
                && new_unit_position.y == caller_position.y,
                    'wrong position'
    );


    let new_unit_inventory = get!(world, new_unit_id, Inventory);
    assert(new_unit_inventory.items_key != 0, 'wrong inventory key');

    let new_unit_movable = get!(world, new_unit_id, Movable);
    assert(new_unit_movable.blocked == false, 'unit blocked');
    assert(
        new_unit_movable.sec_per_km == 55 ,
         'wrong speed'
        );
    assert(new_unit_movable.round_trip == false, 'wrong round_trip');
    assert(new_unit_movable.intermediate_coord_x == 0, 'wrong coord x');
    assert(new_unit_movable.intermediate_coord_y == 0, 'wrong coord y');


    let new_unit_carry_capacity = get!(world, new_unit_id, Capacity);
    assert(new_unit_carry_capacity.weight_gram == 44, 'wrong capacity');  
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not unit owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, _, unit_id, soldier_systems_dispatcher) 
        = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // detach 7 soldiers from unit
    let num_detached_soldiers = 7;
    soldier_systems_dispatcher
            .detach_soldiers(
                world, unit_id, 
                num_detached_soldiers
            );

}






#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not enough quantity','ENTRYPOINT_FAILED' ))]
fn test_single_soldier_detach() {
    
        let (world, _, unit_id, soldier_systems_dispatcher) 
            = setup();

        
        set!(world, (
            Quantity { 
                entity_id: unit_id, 
                value: 1
            }
        ));
    

        starknet::testing::set_contract_address(
            contract_address_const::<'caller'>()
        );


        // detach 7 soldiers from unit
        let num_detached_soldiers = 7;
        soldier_systems_dispatcher
                .detach_soldiers(
                    world, unit_id, 
                    num_detached_soldiers
                );

    
}
 


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('unit inventory not empty','ENTRYPOINT_FAILED' ))]
fn test_unit_has_items_in_inventory() {
            
    let (world, _, unit_id, soldier_systems_dispatcher) 
        = setup();

    
    set!(world, (
        Inventory {
            entity_id: unit_id,
            items_key: 1,
            items_count: 1
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );


    // detach 7 soldiers from unit
    let num_detached_soldiers = 7;
    soldier_systems_dispatcher
            .detach_soldiers(
                world, unit_id, 
                num_detached_soldiers
            );
}