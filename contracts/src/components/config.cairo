use starknet::ContractAddress;

//
// GLOBAL CONFIGS
//

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct WorldConfig {
    realm_l2_contract: ContractAddress, 
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct LaborConfig {
    base_labor_units: u64, // 86400 / 12    
    base_resources_per_cycle: u128, // (252 / 12) * 10 ** 18;
    base_food_per_cycle: u128,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct TravelConfig {
    free_transport_per_city: u128
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct BuildingConfig {
    base_sqm: u128,
    workhut_cost: u128,
}

//
// ENTITY SPECIFIC CONFIGS
//

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct BuildingCost {
    resource_type: felt252,
    cost: u128,
}

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct BuildingTypeConfig {
    id: felt252,
    sqm: u128,
    resource_types_packed: u256,
    resource_types_count: u8,
}


// labor cost resources
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct LaborCostResources {
    resource_type_labor: felt252,
    resource_types_packed: u128,
    resource_types_count: u8,
}

// labor cost values
// mapping of resource_type for which we want to increase labor, resource_type that needs to be burned, value to be burned
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct LaborCostAmount {
    resource_type_labor: felt252,
    resource_type_cost: felt252,
    value: u128,
}

// capacity
// TODO: should rename into something that shows
// that it's a config for one specific entity type?
// and not the same as world config or labor config
// e.g. EntityTypeCapacityConfig?
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct CapacityConfig {
    entity_type: u128,
    weight_gram: u128,
}

// speed
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct SpeedConfig {
    entity_type: u128,
    sec_per_km: u16,
}

// weight
#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct WeightConfig {
    entity_type: u128,
    weight_gram: u128,
}
