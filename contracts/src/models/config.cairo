use eternum::constants::{WORLD_CONFIG_ID};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use starknet::ContractAddress;

//
// GLOBAL CONFIGS
//

#[derive(Model, Copy, Drop, Serde)]
struct WorldConfig {
    #[key]
    config_id: u128,
    realm_l2_contract: ContractAddress,
}

#[derive(Model, Copy, Drop, Serde)]
struct LaborConfig {
    #[key]
    config_id: u128,
    base_labor_units: u64, // 86400 / 12    
    base_resources_per_cycle: u128, // (252 / 12) * 10 ** 18;
    base_food_per_cycle: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct TravelConfig {
    #[key]
    config_id: u128,
    free_transport_per_city: u128
}


#[derive(Model, Copy, Drop, Serde)]
struct RoadConfig {
    #[key]
    config_id: u128,
    fee_resource_type: u8,
    fee_amount: u128,
    speed_up_by: u64
}


#[derive(Model, Copy, Drop, Serde)]
struct BuildingConfig {
    #[key]
    config_id: u128,
    base_sqm: u128,
    workhut_cost: u128,
}

//
// ENTITY SPECIFIC CONFIGS
// We use component key to store the config id
//

#[derive(Model, Copy, Drop, Serde)]
struct BuildingCost {
    #[key]
    config_id: u128,
    #[key]
    building_cost_config_id: u128,
    resource_type: felt252,
    cost: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct BuildingTypeConfig {
    #[key]
    config_id: u128,
    #[key]
    building_type_config_id: u128,
    id: felt252,
    sqm: u128,
    resource_types_packed: u256,
    resource_types_count: u8,
}


// labor cost resources
#[derive(Model, Copy, Drop, Serde)]
struct LaborCostResources {
    #[key]
    resource_type_labor: felt252,
    resource_types_packed: u128,
    resource_types_count: u8,
}

// labor cost values
// mapping of resource_type for which we want to increase labor, resource_type that needs to be burned, value to be burned
#[derive(Model, Copy, Drop, Serde)]
struct LaborCostAmount {
    #[key]
    resource_type_labor: felt252,
    #[key]
    resource_type_cost: felt252,
    value: u128,
}

// capacity
// TODO: should rename into something that shows
// that it's a config for one specific entity type?
// and not the same as world config or labor config
// e.g. EntityTypeCapacityConfig?
#[derive(Model, Copy, Drop, Serde)]
struct CapacityConfig {
    #[key]
    config_id: u128,
    #[key]
    carry_capacity_config_id: u128,
    entity_type: u128,
    weight_gram: u128,
}

// speed
#[derive(Model, Copy, Drop, Serde)]
struct SpeedConfig {
    #[key]
    config_id: u128,
    #[key]
    speed_config_id: u128,
    entity_type: u128,
    sec_per_km: u16,
}

#[derive(Model, Copy, Drop, Serde)]
struct CombatConfig {
    #[key]
    config_id: u128,
    stealing_trial_count: u32
}

#[derive(Model, Copy, Drop, Serde)]
struct SoldierConfig {
    #[key]
    config_id: u128,
    resource_cost_id: u128,
    resource_cost_count: u32
}

#[derive(Model, Copy, Drop, Serde)]
struct HealthConfig {
    #[key]
    entity_type: u128,
    value: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct AttackConfig {
    #[key]
    entity_type: u128,
    value: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct DefenceConfig {
    #[key]
    entity_type: u128,
    value: u128,
}

// weight
#[derive(Model, Copy, Drop, Serde)]
struct WeightConfig {
    #[key]
    config_id: u128,
    #[key]
    weight_config_id: u128,
    entity_type: u128,
    weight_gram: u128,
}


trait WeightConfigTrait {
    fn get_weight(world: IWorldDispatcher, resource_type: u8, amount: u128 ) -> u128;
}

impl WeightConfigImpl of WeightConfigTrait {
    fn get_weight(world: IWorldDispatcher, resource_type: u8, amount: u128 ) -> u128 {
        let resource_weight_config 
            = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig);

        return resource_weight_config.weight_gram * amount;
    }
}

#[derive(Model, Copy, Drop, Serde)]
struct LevelingConfig {
    #[key]
    config_id: u128,
    resource_cost_id: u128,
    resource_cost_count: u32
}