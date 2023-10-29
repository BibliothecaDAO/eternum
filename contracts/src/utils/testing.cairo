// models
use eternum::models::owner::{owner, Owner};
use eternum::models::realm::{realm, Realm};
use eternum::models::resources::{resource, Resource};
use eternum::models::resources::{resource_cost, ResourceCost};
use eternum::models::position::{position, Position};
use eternum::models::capacity::{capacity, Capacity};
use eternum::models::metadata::{entity_metadata, EntityMetadata};
use eternum::models::age::{age, Age};
use eternum::models::labor::{labor, Labor};
use eternum::models::metadata::{foreign_key, ForeignKey};
use eternum::models::road::{road, Road};
use eternum::models::labor_auction::{labor_auction, LaborAuction};
use eternum::models::hyperstructure::{hyper_structure, HyperStructure};


use eternum::models::config::{
    world_config, WorldConfig,
    speed_config, SpeedConfig,
    capacity_config, CapacityConfig,
    travel_config, TravelConfig,
    labor_config, LaborConfig,
    labor_cost_amount, LaborCostAmount,
    labor_cost_resources, LaborCostResources,
    weight_config, WeightConfig,
    road_config, RoadConfig

};
use eternum::models::quantity::{
    quantity, Quantity, 
    quantity_tracker, QuantityTracker
};
use eternum::models::movable::{
    movable, Movable, 
    arrival_time, ArrivalTime
};
use eternum::models::caravan::{
    caravan_members, CaravanMembers,
};
use eternum::models::trade::{
    status, Status, 
    trade, Trade,
};


use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use dojo::test_utils::spawn_test_world;

use starknet::{
    syscalls::deploy_syscall,ClassHash, ContractAddress
};



// used to spawn a test world with all the models and systems registered
fn spawn_eternum() -> IWorldDispatcher {

    let mut models = array![
        owner::TEST_CLASS_HASH,
        movable::TEST_CLASS_HASH,
        quantity::TEST_CLASS_HASH,
        realm::TEST_CLASS_HASH,
        speed_config::TEST_CLASS_HASH,
        capacity_config::TEST_CLASS_HASH,
        world_config::TEST_CLASS_HASH,
        entity_metadata::TEST_CLASS_HASH,
        quantity_tracker::TEST_CLASS_HASH,
        position::TEST_CLASS_HASH,
        capacity::TEST_CLASS_HASH,
        arrival_time::TEST_CLASS_HASH,
        caravan_members::TEST_CLASS_HASH,
        foreign_key::TEST_CLASS_HASH,
        trade::TEST_CLASS_HASH,
        resource::TEST_CLASS_HASH,
        resource_cost::TEST_CLASS_HASH,
        status::TEST_CLASS_HASH,
        age::TEST_CLASS_HASH,
        travel_config::TEST_CLASS_HASH,
        labor::TEST_CLASS_HASH,
        labor_config::TEST_CLASS_HASH,
        labor_cost_amount::TEST_CLASS_HASH,
        labor_cost_resources::TEST_CLASS_HASH,
        weight_config::TEST_CLASS_HASH,
        road::TEST_CLASS_HASH,
        labor_auction::TEST_CLASS_HASH,
        road_config::TEST_CLASS_HASH,
        hyper_structure::TEST_CLASS_HASH,
    ];

    spawn_test_world(models)

}



fn deploy_system(class_hash_felt: felt252) -> ContractAddress {
    let (system_contract_address, _) = deploy_syscall(
        class_hash_felt.try_into().unwrap(), 0, array![].span(), false
    ).unwrap();

    system_contract_address
}