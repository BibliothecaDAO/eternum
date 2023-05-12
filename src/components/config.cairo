use starknet::ContractAddress;

#[derive(Component)]
struct WorldConfig {
    day_time: u128,
    vault_bp: u128,
    base_resources_per_day: u128, //252 * 10 ** 18 = 252000000000000000000
    vault_time: u128,
    lords_per_day: u128,
    tick_time: u128,
    realm_l2_contract: ContractAddress,
}

#[derive(Component)]
struct BuildingCost {
    resource_type: felt252,
    cost: u128,
}

#[derive(Component)]
struct BuildingTypeConfig {
    id: felt252,
    sqm: u128,
    resource_types_packed: u256,
    resource_types_count: u8,
}

#[derive(Component)]
struct BuildingConfig {
    base_sqm: u128,
    workhut_cost: u128,
}

#[derive(Component)]
struct LaborConfig {
    base_labor_units: u128, // 86400 / 12    
    vault_percentage: u128, // 250 
    base_resources_per_cycle: u128, // (252 / 12) * 10 ** 18;
}

// labor cost resources
#[derive(Component)]
struct LaborCostResources {
    id: felt252,
    resource_types_packed: u128,
    resource_types_count: u8,
}

// labor cost values
// mapping of resource_type for which we want to increase labor, resource_type that needs to be burned, value to be burned
#[derive(Component)]
struct LaborCostAmount {
    id: felt252,
    resource_type: felt252,
    value: u128,
}
