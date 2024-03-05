use core::debug::PrintTrait;
use eternum::models::position::Position;
use eternum::models::metadata::ForeignKey;
use eternum::models::resources::{Resource, ResourceTrait, ResourceCost};
use eternum::models::level::Level;
use eternum::models::realm::Realm;
use eternum::models::order::Orders;
use eternum::models::config::{
    SpeedConfig, WeightConfig, CapacityConfig, CombatConfig,
    SoldierConfig, HealthConfig, AttackConfig, DefenceConfig, LevelingConfig
};
use eternum::models::movable::{Movable, ArrivalTime};
use eternum::models::inventory::Inventory;
use eternum::models::capacity::Capacity;
use eternum::models::hyperstructure::HyperStructure;
use eternum::models::weight::Weight;
use eternum::models::owner::{Owner, EntityOwner};
use eternum::models::quantity::{Quantity, QuantityTrait};    
use eternum::models::combat::{
    Attack,   
    Health, Defence, Duty, TownWatch
};

use eternum::systems::resources::tests::internal::inventory_transfer_between_inventories::internal_transfer_between_inventories_tests::InventoryTraitForTest;
use eternum::systems::resources::contracts::resource_systems::{
    InternalInventorySystemsImpl, 
};
use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ITransportConfigDispatcher, ITransportConfigDispatcherTrait,
    IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
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
use eternum::constants::{COMBAT_CONFIG_ID, SOLDIER_ENTITY_TYPE};
use eternum::constants::{REALM_LEVELING_CONFIG_ID, HYPERSTRUCTURE_LEVELING_CONFIG_ID};

use dojo::world::{ IWorldDispatcher, IWorldDispatcherTrait};

use starknet::contract_address_const;

use core::array::{ArrayTrait, SpanTrait};
use core::traits::Into;

const ATTACKER_STOLEN_RESOURCE_COUNT: u32 = 2;
const WHEAT_BURN_PER_SOLDIER_DURING_ATTACK: u128 = 100;
const FISH_BURN_PER_SOLDIER_DURING_ATTACK: u128 = 200;

const ATTACKER_SOLDIER_COUNT: u128 = 15;
const TARGET_SOLDIER_COUNT: u128 = 5;
const INITIAL_RESOURCE_BALANCE: u128 = 5000;


const TYPE_ONE_RESOURCE_TO_BE_STOLEN_FROM_TARGET: u8 = 12;
const TYPE_TWO_RESOURCE_TO_BE_STOLEN_FROM_TARGET: u8 = 14;

fn setup() -> (IWorldDispatcher, u128, u128, u128, u128, ICombatSystemsDispatcher) {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);    

    // set soldier cost configuration 
    let combat_config_dispatcher = ICombatConfigDispatcher {
        contract_address: config_systems_address
    };

    combat_config_dispatcher.set_combat_config(
        world,
        COMBAT_CONFIG_ID,
        ATTACKER_STOLEN_RESOURCE_COUNT,
        WHEAT_BURN_PER_SOLDIER_DURING_ATTACK,
        FISH_BURN_PER_SOLDIER_DURING_ATTACK,
    );

    combat_config_dispatcher.set_soldier_config(
        world,
        array![ 
            // pay for each soldier with the following
            (ResourceTypes::DRAGONHIDE, 40),
            (ResourceTypes::DEMONHIDE, 40),
        ].span(),
        WHEAT_BURN_PER_SOLDIER_DURING_ATTACK,
        FISH_BURN_PER_SOLDIER_DURING_ATTACK
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
    }.set_capacity_config(world, SOLDIER_ENTITY_TYPE, 440_000); 


    // set weight configuration for stolen resources
    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(
        world, TYPE_ONE_RESOURCE_TO_BE_STOLEN_FROM_TARGET.into(), 200); 

    IWeightConfigDispatcher {
        contract_address: config_systems_address
    }.set_weight_config(
        world, TYPE_TWO_RESOURCE_TO_BE_STOLEN_FROM_TARGET.into(), 200); 
      
    let realm_systems_address 
        = deploy_system(realm_systems::TEST_CLASS_HASH);
    let realm_systems_dispatcher = IRealmSystemsDispatcher {
        contract_address: realm_systems_address
    };

    let attacker_realm_entity_position = Position { x: 100000, y: 200000, entity_id: 1_u128};
    let target_realm_entity_position = Position { x: 200000, y: 100000, entity_id: 1_u128};

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
    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );
    let attacker_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, order, attacker_realm_entity_position.clone(),
        
    );

    // create target's realm
    starknet::testing::set_contract_address(
        contract_address_const::<'target'>()
    );

    let target_realm_entity_id = realm_systems_dispatcher.create(
        world, realm_id,
        resource_types_packed, resource_types_count, cities,
        harbors, rivers, regions, wonder, 0, target_realm_entity_position.clone(),
    );

    starknet::testing::set_contract_address(world.executor());

    starknet::testing::set_block_timestamp(1000);

    // set up leveling config 
    set!(world, (
        LevelingConfig {
            config_id: REALM_LEVELING_CONFIG_ID,
            decay_interval: 604800,
            max_level: 1000,
            wheat_base_amount: 0,
            fish_base_amount: 0,
            resource_1_cost_id: 0,
            resource_1_cost_count: 0,
            resource_2_cost_id: 0,
            resource_2_cost_count: 0,
            resource_3_cost_id: 0,
            resource_3_cost_count: 0,
            decay_scaled: 1844674407370955161,
            cost_percentage_scaled: 4611686018427387904,
            base_multiplier: 25
        }
    ));

    // set up attacker
    set!(world, (
        Owner { 
            entity_id: attacker_realm_entity_id, 
            address: contract_address_const::<'attacker'>()
        },
        Resource { 
            entity_id: attacker_realm_entity_id, 
            resource_type: ResourceTypes::DEMONHIDE, 
            balance: INITIAL_RESOURCE_BALANCE 
        },
        Resource { 
            entity_id: attacker_realm_entity_id, 
            resource_type: ResourceTypes::DRAGONHIDE, 
            balance: INITIAL_RESOURCE_BALANCE 
        },
    ));


    // set up target
    set!(world, (
        Owner { 
            entity_id: target_realm_entity_id, 
            address: contract_address_const::<'target'>()
        }
    ));

    // add resources to target
    let mut target_resource_demonhide = Resource { 
            entity_id: target_realm_entity_id, 
            resource_type: ResourceTypes::DEMONHIDE, 
            balance: INITIAL_RESOURCE_BALANCE 
        };
    target_resource_demonhide.save(world);


    let mut target_resource_dragonhide = Resource { 
            entity_id: target_realm_entity_id, 
            resource_type: ResourceTypes::DRAGONHIDE, 
            balance: INITIAL_RESOURCE_BALANCE 
        };
    target_resource_dragonhide.save(world);
    


    let mut target_resource_wheat = Resource { 
            entity_id: target_realm_entity_id, 
            resource_type: ResourceTypes::WHEAT, 
            balance: INITIAL_RESOURCE_BALANCE 
        };
    target_resource_wheat.save(world);
    

    let mut target_resource_fish = Resource { 
            entity_id: target_realm_entity_id, 
            resource_type: ResourceTypes::FISH, 
            balance: INITIAL_RESOURCE_BALANCE 
        };
    target_resource_fish.save(world);
    

    let mut target_resource_precalc_1= Resource { 
            entity_id: target_realm_entity_id, 
            resource_type: TYPE_ONE_RESOURCE_TO_BE_STOLEN_FROM_TARGET, 
            balance: INITIAL_RESOURCE_BALANCE 
        };
    target_resource_precalc_1.save(world);
    


    let mut target_resource_precalc_2 = Resource { 
            entity_id: target_realm_entity_id, 
            resource_type: TYPE_TWO_RESOURCE_TO_BE_STOLEN_FROM_TARGET, 
            balance: INITIAL_RESOURCE_BALANCE 
        };
    target_resource_precalc_2.save(world);
    


    let combat_systems_address 
        = deploy_system(combat_systems::TEST_CLASS_HASH);
    let soldier_systems_dispatcher = ISoldierSystemsDispatcher {
        contract_address: combat_systems_address
    };




    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    let attacker_combat = get!(world, attacker_realm_entity_id, TownWatch);
    let attacker_town_watch_id = attacker_combat.town_watch_id;
    

    // buy soldiers for attacker
    let attacker_unit_id = soldier_systems_dispatcher.create_soldiers(
         world, attacker_realm_entity_id, ATTACKER_SOLDIER_COUNT
    );


    // set attacker unit position to be at target realm

    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Position { 
            entity_id: attacker_unit_id, 
            x: target_realm_entity_position.x,
            y: target_realm_entity_position.y,
        }
    ));
    
        

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
#[available_gas(3000000000000)]
fn test_steal_success() {

    // the attacker attacks and successfully steals resources

    let (
        world, 
        attacker_realm_entity_id, attacker_unit_id,
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();
    
    starknet::testing::set_contract_address(world.executor());

    // make the target completely defenceless 
    // so that the attacker's victory is assured
    set!(world, (
        Defence {
            entity_id: target_town_watch_id,
            value: 0
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_town_watch_id
            );

    let attacker_unit_health = get!(world, attacker_unit_id, Health);
    let target_unit_health = get!(world, target_town_watch_id, Health);

    // ensure attacker's health is intact
    assert(
        attacker_unit_health.value == 100 * ATTACKER_SOLDIER_COUNT,
                'wrong health value'
    );

    // ensure that food was burned
    let target_realm_wheat_resource = get!(world, (target_realm_entity_id, ResourceTypes::WHEAT), Resource);
    assert(
        target_realm_wheat_resource.balance == INITIAL_RESOURCE_BALANCE - ( WHEAT_BURN_PER_SOLDIER_DURING_ATTACK * ATTACKER_SOLDIER_COUNT),
                'wrong wheat value'
    );

    let target_realm_fish_resource = get!(world, (target_realm_entity_id, ResourceTypes::FISH), Resource);
    assert(
        target_realm_fish_resource.balance == INITIAL_RESOURCE_BALANCE - ( FISH_BURN_PER_SOLDIER_DURING_ATTACK * ATTACKER_SOLDIER_COUNT),
                'wrong fish value'
    );

    // ensure stolen resources are added to attacker's inventory
    let attacker_inventory = get!(world, attacker_unit_id, Inventory);
    assert(attacker_inventory.items_count == 1, 'no inventory items');

    // check that attacker inventory has items
    let attacker_resource_chest_foreign_key
        = InternalInventorySystemsImpl::get_foreign_key(
            attacker_inventory, 0
            );
    let attacker_resource_chest_id 
        = get!(world, attacker_resource_chest_foreign_key, ForeignKey).entity_id; 

    // check that resource chest in inventory is filled
    let attacker_resource_chest_weight
        = get!(world, attacker_resource_chest_id, Weight);
    assert(attacker_resource_chest_weight.value > 0, 'wrong chest weight');


    // ensure target lost the resources
    let stolen_resource_types: Array<u8> = array![
        TYPE_ONE_RESOURCE_TO_BE_STOLEN_FROM_TARGET,
        TYPE_TWO_RESOURCE_TO_BE_STOLEN_FROM_TARGET,
    ];
    let mut index = 0;
    loop {
        if index == stolen_resource_types.len() {
            break;
        }
        let resource_type = *stolen_resource_types.at(index);
        let target_realm_resource 
            = get!(world, (target_realm_entity_id, resource_type), Resource);
        assert(
            target_realm_resource.balance < INITIAL_RESOURCE_BALANCE,
                'wrong target balance'
            );

        index += 1;
    };


    // ensure attacker is sent back home

    let attacker_realm_position = get!(world, attacker_realm_entity_id, Position);
    let attacker_unit_position = get!(world, attacker_unit_id, Position);
    assert(attacker_realm_position.x == attacker_unit_position.x 
            && attacker_realm_position.y == attacker_unit_position.y,
                'wrong position' 
    );

    let attacker_unit_arrival = get!(world, attacker_unit_id, ArrivalTime);
    assert(attacker_unit_arrival.arrives_at > 0, 'wrong arrival time');

}



#[test]
#[available_gas(3000000000000)]
fn test_steal_success_with_order_boost() {

    // the attacker attacks and successfully steals resources

    let (
        world, 
        attacker_realm_entity_id, attacker_unit_id, 
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();
    
    starknet::testing::set_contract_address(world.executor());

    // make the target completely defenceless 
    // so that the attacker's victory is assured
    set!(world, (
        Defence {
            entity_id: target_town_watch_id,
            value: 0
        }
    ));

    // boost hyperstructure level to 1
    set!(world, (
        Orders {
            order_id: 1,
            hyperstructure_count: 1
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_town_watch_id
            );

    let attacker_unit_health = get!(world, attacker_unit_id, Health);
    let target_unit_health = get!(world, target_town_watch_id, Health);

    // ensure attacker's health is intact
    assert(
        attacker_unit_health.value == 100 * ATTACKER_SOLDIER_COUNT,
                'wrong health value'
    );

    // ensure that food was burned
    let target_realm_wheat_resource = get!(world, (target_realm_entity_id, ResourceTypes::WHEAT), Resource);
    let wheat_expected_burn = WHEAT_BURN_PER_SOLDIER_DURING_ATTACK * ATTACKER_SOLDIER_COUNT;

    assert(
        target_realm_wheat_resource.balance 
            == INITIAL_RESOURCE_BALANCE - wheat_expected_burn,
                'wrong wheat value'
    );

    let target_realm_fish_resource = get!(world, (target_realm_entity_id, ResourceTypes::FISH), Resource);
    let fish_expected_burn = FISH_BURN_PER_SOLDIER_DURING_ATTACK * ATTACKER_SOLDIER_COUNT;

    assert(
        target_realm_fish_resource.balance 
            == INITIAL_RESOURCE_BALANCE - fish_expected_burn,
                'wrong fish value'
    );

    // ensure stolen resources are added to attacker's inventory
    let attacker_inventory = get!(world, attacker_unit_id, Inventory);
    assert(attacker_inventory.items_count == 1, 'no inventory items');

    // check that attacker inventory has items
    let attacker_resource_chest_foreign_key
        = InternalInventorySystemsImpl::get_foreign_key(
            attacker_inventory, 0
            );
    let attacker_resource_chest_id 
        = get!(world, attacker_resource_chest_foreign_key, ForeignKey).entity_id; 

    // check that resource chest in inventory is filled
    let attacker_resource_chest_weight
        = get!(world, attacker_resource_chest_id, Weight);
    assert(attacker_resource_chest_weight.value > 0, 'wrong chest weight');


    // ensure target lost the resources
    let stolen_resource_types: Array<u8> = array![
        TYPE_ONE_RESOURCE_TO_BE_STOLEN_FROM_TARGET,
        TYPE_TWO_RESOURCE_TO_BE_STOLEN_FROM_TARGET,
    ];
    let mut index = 0;
    loop {
        if index == stolen_resource_types.len() {
            break;
        }
        let resource_type = *stolen_resource_types.at(index);
        let target_realm_resource 
            = get!(world, (target_realm_entity_id, resource_type), Resource);
        assert(
            target_realm_resource.balance < INITIAL_RESOURCE_BALANCE,
                'wrong target balance'
            );

        index += 1;
    };


    // ensure attacker is sent back home

    let attacker_realm_position = get!(world, attacker_realm_entity_id, Position);
    let attacker_unit_position = get!(world, attacker_unit_id, Position);
    assert(attacker_realm_position.x == attacker_unit_position.x 
            && attacker_realm_position.y == attacker_unit_position.y,
                'wrong position' 
    );

    let attacker_unit_arrival = get!(world, attacker_unit_id, ArrivalTime);
    assert(attacker_unit_arrival.arrives_at > 0, 'wrong arrival time');

}




#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('not attacker owner','ENTRYPOINT_FAILED' ))]
fn test_not_owner() {

    let (
        world, 
        attacker_realm_entity_id, attacker_unit_id,
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set unknown contract address as caller
    starknet::testing::set_contract_address(
        contract_address_const::<'unknown'>()
    );

    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_town_watch_id
            );

}



#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('attacker is travelling','ENTRYPOINT_FAILED' ))]
fn test_attacker_in_transit() {

    let (
        world, 
        attacker_realm_entity_id, attacker_unit_id,
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set arrival time a future time
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        ArrivalTime { 
            entity_id: attacker_unit_id, 
            arrives_at: 1001 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_town_watch_id
            );

}


#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('attacker is dead','ENTRYPOINT_FAILED' ))]
fn test_attacker_dead() {

    let (
        world, 
        attacker_realm_entity_id, attacker_unit_id,
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set attacker health to 0
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Health { 
            entity_id: attacker_unit_id, 
            value: 0 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_town_watch_id
            );

}






#[test]
#[available_gas(3000000000000)]
#[should_panic(expected: ('position mismatch','ENTRYPOINT_FAILED' ))]
fn test_wrong_position() {

    let (
        world, 
        attacker_realm_entity_id, attacker_unit_id,
        target_realm_entity_id, target_town_watch_id, 
        combat_systems_dispatcher
    ) = setup();

    // set attacker position to a different position
    starknet::testing::set_contract_address(world.executor());
    set!(world, (
        Position { 
            entity_id: attacker_unit_id, 
            x: 100, y: 200 
        }
    ));


    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );


    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_town_watch_id
            );

}





#[test]
#[available_gas(3000000000000)]
fn test_steal_success_army_to_army() {

    // the attacker attacks and successfully steals resources

    let (world, attacker_realm_entity_id, attacker_unit_id, _, _ ,combat_systems_dispatcher ) 
        = setup();
    
    starknet::testing::set_contract_address(world.executor());


    let target_unit_id = 48445;
    // make both be at same location
    let attacker_unit_position = get!(world, attacker_unit_id, Position);
    let target_unit_position = Position {
        entity_id: target_unit_id, 
        x: attacker_unit_position.x,
        y: attacker_unit_position.y,
    };
    set!(world, (target_unit_position));


    let target_unit_loot_id = 1007;
    let mut target_unit_inventory = Inventory {
        entity_id: target_unit_id,
        items_key: 'some value',
        items_count: 0
    };

    let mut attacker_unit_inventory = Inventory {
        entity_id: attacker_unit_id,
        items_key: 'anor value',
        items_count: 0
    };

    set!(world, (attacker_unit_inventory, target_unit_inventory));

    // set attacker and defender capacity
    let attacker_capacity = Capacity {
        entity_id: attacker_unit_id,
        weight_gram: 500
    };

    let defender_capacity = Capacity {
        entity_id: target_unit_id,
        weight_gram: 500
    };
    set!(world, (attacker_capacity, defender_capacity));



    target_unit_inventory
        .add_test_item(world, target_unit_loot_id);




    set!(world, (
        Defence {
            entity_id: target_unit_id,
            value: 0
        }
    ));

    starknet::testing::set_contract_address(
        contract_address_const::<'attacker'>()
    );

    // steal from target
    combat_systems_dispatcher
        .steal(
            world, attacker_unit_id, target_unit_id
            );

    let attacker_unit_health = get!(world, attacker_unit_id, Health);

    // ensure attacker's health is intact
    assert(
        attacker_unit_health.value == 100 * ATTACKER_SOLDIER_COUNT,
                'wrong health value'
    );



    // ensure stolen resources are added to attacker's inventory
    let attacker_inventory = get!(world, attacker_unit_id, Inventory);
    assert(attacker_inventory.items_count == 1, 'no inventory items');

    // check that attacker inventory has items
    let attacker_resource_chest_foreign_key
        = InternalInventorySystemsImpl::get_foreign_key(
            attacker_inventory, 0
            );
    let attacker_resource_chest_id 
        = get!(world, attacker_resource_chest_foreign_key, ForeignKey).entity_id;
    assert_eq!(attacker_resource_chest_id, target_unit_loot_id); 

    // check that resource chest in inventory is filled
    let attacker_resource_chest_weight
        = get!(world, attacker_resource_chest_id, Weight);
    assert(attacker_resource_chest_weight.value > 0, 'wrong chest weight');

 

    // ensure attacker is sent back home

    let attacker_realm_position = get!(world, attacker_realm_entity_id, Position);
    let attacker_unit_position = get!(world, attacker_unit_id, Position);
    assert(attacker_realm_position.x == attacker_unit_position.x 
            && attacker_realm_position.y == attacker_unit_position.y,
                'wrong position' 
    );

    let attacker_unit_arrival = get!(world, attacker_unit_id, ArrivalTime);
    assert(attacker_unit_arrival.arrives_at > 0, 'wrong arrival time');

}

