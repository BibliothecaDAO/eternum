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
    Health, Defence
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
    

    (world, caller_id, soldier_systems_dispatcher) 

}





#[test]
#[available_gas(3000000000000)]
fn test_create_soldier() {

    let (world, caller_id, soldier_systems_dispatcher) = setup();

    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // buy x soldiers
    let num_soldiers_bought = 2;
    let mut soldier_ids: Span<u128>
        = soldier_systems_dispatcher.create_soldiers(
            world, caller_id, num_soldiers_bought
        );

    assert(soldier_ids.len().into() == num_soldiers_bought, 'wrong num soldiers');

    // check that payment works correctly
    let caller_wheat_resource = get!(world, (caller_id, ResourceTypes::WHEAT), Resource);
    assert(caller_wheat_resource.balance == 5000 - 40 * num_soldiers_bought, 'wrong wheat balance');

    let caller_wood_resource = get!(world, (caller_id, ResourceTypes::WOOD), Resource);
    assert(caller_wood_resource.balance == 5000 - 40 * num_soldiers_bought, 'wrong wood balance');


    let caller_position = get!(world, caller_id, Position);

    loop {
        match soldier_ids.pop_front() {
            Option::Some(soldier_id) => {
                
                let soldier_id = * soldier_id;
                let soldier_owner = get!(world, soldier_id, Owner);
                assert(
                    soldier_owner.address == contract_address_const::<'caller'>(), 
                        'wrong owner'
                );

                let soldier_entity_owner = get!(world, soldier_id, EntityOwner);
                assert(
                    soldier_entity_owner.entity_owner_id == caller_id,
                      'wrong entity owner'
                );

                let soldier_health = get!(world, soldier_id, Health);
                assert(soldier_health.value == 100, 'wrong health');

                let soldier_attack = get!(world, soldier_id, Attack);
                assert(soldier_attack.value == 100, 'wrong attack');

                let soldier_defence = get!(world, soldier_id, Defence);
                assert(soldier_defence.value == 100, 'wrong defence');

                let soldier_quantity = get!(world, soldier_id, Quantity);
                assert(soldier_quantity.value == 1, 'wrong quantity');

                let soldier_position = get!(world, soldier_id, Position);
                assert(
                        soldier_position.x == caller_position.x 
                            && soldier_position.y == caller_position.y,
                                'wrong position'
                );


                let soldier_inventory = get!(world, soldier_id, Inventory);
                assert(soldier_inventory.items_key != 0, 'wrong inventory key');

                let soldier_movable = get!(world, soldier_id, Movable);
                assert(soldier_movable.blocked == false, 'soldier blocked');
                assert(soldier_movable.sec_per_km == 55, 'wrong speed');
                assert(soldier_movable.round_trip == false, 'wrong round_trip');
                assert(soldier_movable.intermediate_coord_x == 0, 'wrong coord x');
                assert(soldier_movable.intermediate_coord_y == 0, 'wrong coord y');


                let soldier_carry_capacity = get!(world, soldier_id, Capacity);
                assert(soldier_carry_capacity.weight_gram == 44, 'wrong capacity');  
            },

            Option::None => {break;}
        };
    };
}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not realm owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (world, caller_id, soldier_systems_dispatcher) = setup();

    // set unknown caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // try to buy soldiers
    let num_soldiers_bought = 5;
    soldier_systems_dispatcher.create_soldiers(
        world, caller_id, num_soldiers_bought
    );
}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not a realm','ENTRYPOINT_FAILED' ))]
fn test_not_realm() {

    let (world, _, soldier_systems_dispatcher) = setup();

    let caller_id = 99999;
    starknet::testing::set_contract_address(
        contract_address_const::<'caller'>()
    );

    // try to buy soldiers
    let num_soldiers_bought = 5;
    soldier_systems_dispatcher.create_soldiers(
        world, caller_id, num_soldiers_bought
    );
}

