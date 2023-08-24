// components
use eternum::components::owner::{owner, Owner};
use eternum::components::realm::{realm, Realm};
use eternum::components::resources::{resource, Resource};
use eternum::components::position::{position, Position};
use eternum::components::capacity::{capacity, Capacity};
use eternum::components::metadata::{meta_data, MetaData};
use eternum::components::age::{age, Age};
use eternum::components::labor::{labor, Labor};
use eternum::components::resources::{vault, Vault};
use eternum::components::metadata::{foreign_key, ForeignKey};
use eternum::components::trade::{fungible_entities, FungibleEntities};
use eternum::components::config::{
    world_config, WorldConfig,
    speed_config, SpeedConfig,
    capacity_config, CapacityConfig,
    travel_config, TravelConfig,
    labor_config, LaborConfig,
    labor_cost_amount, LaborCostAmount,
    labor_cost_resources, LaborCostResources,
    weight_config, WeightConfig 
};
use eternum::components::quantity::{
    quantity, Quantity, 
    quantity_tracker, QuantityTracker
};
use eternum::components::movable::{
    movable, Movable, 
    arrival_time, ArrivalTime
};
use eternum::components::caravan::{
    caravan, Caravan,
    caravan_members, CaravanMembers,
};
use eternum::components::trade::{
    status, Status, 
    trade, Trade,
    order_resource, OrderResource,
};

// constants
use eternum::constants::FREE_TRANSPORT_ENTITY_TYPE;


// systems
use eternum::systems::test::create_realm::CreateRealm;
use eternum::systems::caravan::create_free_transport_unit::CreateFreeTransportUnit;
use eternum::systems::caravan::create_caravan::CreateCaravan;
use eternum::systems::config::speed_config::SetSpeedConfig;
use eternum::systems::config::travel_config::SetTravelConfig;
use eternum::systems::config::capacity_config::SetCapacityConfig;
use eternum::systems::config::world_config::SetWorldConfig;
use eternum::systems::caravan::utils::{GetAverageSpeed, GetQuantity};
use eternum::systems::order::make_fungible_order::MakeFungibleOrder;
use eternum::systems::order::take_fungible_order::TakeFungibleOrder;
use eternum::systems::order::attach_caravan::AttachCaravan;
use eternum::systems::order::claim_fungible_order::ClaimFungibleOrder;
use eternum::systems::labor::build_labor::BuildLabor;
use eternum::systems::config::labor_config::SetLaborConfig;
use eternum::systems::config::labor_config::SetLaborCostResources;
use eternum::systems::config::labor_config::SetLaborCostAmount;
use eternum::systems::config::weight_config::SetWeightConfig;
use eternum::systems::test::mint_resources::MintResources;
use eternum::systems::labor::harvest_labor::HarvestLabor;

use dojo::{executor::executor, world::{world, IWorldDispatcher, IWorldDispatcherTrait}};
use dojo::test_utils::spawn_test_world;

use starknet::{
    syscalls::deploy_syscall,
    class_hash::Felt252TryIntoClassHash, 
    get_caller_address, ClassHash
};

use traits::{Into, TryInto};
use result::ResultTrait;
use array::ArrayTrait;
use option::OptionTrait;
use serde::Serde;



// used to spawn a test world with all the components and systems registered
fn spawn_eternum() -> IWorldDispatcher {

    let mut components = array![
        owner::TEST_CLASS_HASH,
        movable::TEST_CLASS_HASH,
        quantity::TEST_CLASS_HASH,
        realm::TEST_CLASS_HASH,
        speed_config::TEST_CLASS_HASH,
        capacity_config::TEST_CLASS_HASH,
        world_config::TEST_CLASS_HASH,
        meta_data::TEST_CLASS_HASH,
        quantity_tracker::TEST_CLASS_HASH,
        position::TEST_CLASS_HASH,
        capacity::TEST_CLASS_HASH,
        arrival_time::TEST_CLASS_HASH,
        caravan_members::TEST_CLASS_HASH,
        caravan::TEST_CLASS_HASH,
        foreign_key::TEST_CLASS_HASH,
        trade::TEST_CLASS_HASH,
        fungible_entities::TEST_CLASS_HASH,
        order_resource::TEST_CLASS_HASH,
        resource::TEST_CLASS_HASH,
        status::TEST_CLASS_HASH,
        age::TEST_CLASS_HASH,
        travel_config::TEST_CLASS_HASH,
        labor::TEST_CLASS_HASH,
        labor_config::TEST_CLASS_HASH,
        labor_cost_amount::TEST_CLASS_HASH,
        labor_cost_resources::TEST_CLASS_HASH,
        vault::TEST_CLASS_HASH,
        weight_config::TEST_CLASS_HASH
    ];

    
    let mut systems = array![
        GetAverageSpeed::TEST_CLASS_HASH,
        CreateFreeTransportUnit::TEST_CLASS_HASH,
        CreateCaravan::TEST_CLASS_HASH,
        SetSpeedConfig::TEST_CLASS_HASH,
        SetCapacityConfig::TEST_CLASS_HASH,
        SetWorldConfig::TEST_CLASS_HASH,
        CreateRealm::TEST_CLASS_HASH,
        GetQuantity::TEST_CLASS_HASH,
        MakeFungibleOrder::TEST_CLASS_HASH,
        TakeFungibleOrder::TEST_CLASS_HASH,
        AttachCaravan::TEST_CLASS_HASH,
        ClaimFungibleOrder::TEST_CLASS_HASH,
        SetTravelConfig::TEST_CLASS_HASH,
        BuildLabor::TEST_CLASS_HASH,
        SetLaborConfig::TEST_CLASS_HASH,
        SetLaborCostResources::TEST_CLASS_HASH,
        SetLaborCostAmount::TEST_CLASS_HASH,
        MintResources::TEST_CLASS_HASH,
        HarvestLabor::TEST_CLASS_HASH,
        SetWeightConfig::TEST_CLASS_HASH
    ];
    

    spawn_test_world(components, systems)

}


fn setup_eternum() -> (IWorldDispatcher, felt252) {

        let world = spawn_eternum();

        // set realm entity
        let position = Position { x: 20, y: 30, entity_id: 1_u128};
        let mut create_realm_calldata = Default::default();

        Serde::serialize(@1, ref create_realm_calldata); // realm id
        Serde::serialize(@starknet::get_caller_address(), ref create_realm_calldata); // owner
        Serde::serialize(@1, ref create_realm_calldata); // resource_types_packed
        Serde::serialize(@1, ref create_realm_calldata); // resource_types_count
        Serde::serialize(@6, ref create_realm_calldata); // cities
        Serde::serialize(@5, ref create_realm_calldata); // harbors
        Serde::serialize(@5, ref create_realm_calldata); // rivers
        Serde::serialize(@5, ref create_realm_calldata); // regions
        Serde::serialize(@1, ref create_realm_calldata); // wonder
        Serde::serialize(@1, ref create_realm_calldata); // order
        Serde::serialize(@position, ref create_realm_calldata); // position

        let create_realm_result = world.execute('CreateRealm', create_realm_calldata);
        let realm_entity_id = *create_realm_result[0];


        // set speed configuration 
        let mut set_speed_conf_calldata =  Default::default();
        Serde::serialize(@FREE_TRANSPORT_ENTITY_TYPE, ref set_speed_conf_calldata);
        Serde::serialize(@10, ref set_speed_conf_calldata); // 10km per sec
        world.execute('SetSpeedConfig', set_speed_conf_calldata);

        // set travel configuration
        let mut set_travel_conf_calldata = Default::default();
        Serde::serialize(@10, ref set_travel_conf_calldata); // free transport per city
        world.execute('SetTravelConfig', set_travel_conf_calldata);

        // set capacity configuration
        let mut set_capacity_conf_calldata = Default::default();
        Serde::serialize(@FREE_TRANSPORT_ENTITY_TYPE, ref set_capacity_conf_calldata);
        Serde::serialize(@200_000, ref set_capacity_conf_calldata); // 200_000 grams ==  200 kg
        world.execute('SetCapacityConfig', set_capacity_conf_calldata);

        (world, realm_entity_id)
    }