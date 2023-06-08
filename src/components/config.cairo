use starknet::ContractAddress;

#[derive(Component, Copy, Drop, Serde)]
struct WorldConfig {
    day_time: u128,
    vault_bp: u128,
    base_resources_per_day: u128, //252 * 10 ** 18 = 252000000000000000000
    vault_time: u128,
    lords_per_day: u128,
    tick_time: u128,
    realm_l2_contract: ContractAddress,
    free_transport_per_city: u128
}

#[derive(Component, Copy, Drop, Serde)]
struct BuildingCost {
    resource_type: felt252,
    cost: u128,
}

#[derive(Component, Copy, Drop, Serde)]
struct BuildingTypeConfig {
    id: felt252,
    sqm: u128,
    resource_types_packed: u256,
    resource_types_count: u8,
}

#[derive(Component, Copy, Drop, Serde)]
struct BuildingConfig {
    base_sqm: u128,
    workhut_cost: u128,
}

#[derive(Component, Copy, Drop, Serde)]
struct LaborConfig {
    base_labor_units: u128, // 86400 / 12    
    vault_percentage: u128, // 250 
    base_resources_per_cycle: u128, // (252 / 12) * 10 ** 18;
}

// labor cost resources
#[derive(Component, Copy, Drop, Serde)]
struct LaborCostResources {
    id: felt252,
    resource_types_packed: u128,
    resource_types_count: u8,
}

// labor cost values
// mapping of resource_type for which we want to increase labor, resource_type that needs to be burned, value to be burned
#[derive(Component, Copy, Drop, Serde)]
struct LaborCostAmount {
    id: felt252,
    resource_type: felt252,
    value: u128,
}


// capacity
// DISCUSS: entity_type allows us to link the config to an entity in the world
// DISCUSS: entity_type is a shared id for all entities of same type
// DISCUSS: so there's no difference between types for resources and types for buildings,
// DISCUSS: the difference is the components that compose them
// entity_type => CapacityConfig
#[derive(Component, Copy, Drop, Serde)]
struct CapacityConfig {
    entity_type: u128,
    weight_gram: u128,
}

#[derive(Component, Copy, Drop, Serde)]
struct SpeedConfig {
    entity_type: u128,
    km_per_hr: u128,
}

// weight
#[derive(Component, Copy, Drop, Serde)]
struct WeightConfig {
    entity_type: u128,
    weight_gram: u128,
}
