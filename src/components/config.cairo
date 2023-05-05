use array::ArrayTrait;
use traits::Into;
use traits::TryInto;
use eternum::constants::RESOURCE_IDS_PACKED_SIZE;
use eternum::constants::PRIME;
use traits::BitAnd;
use starknet::ContractAddress;

#[derive(Component)]
struct WorldConfig {
    day_unix: u128,
    vault_bp: u128,
    base_resources_per_day: u128, //252 * 10 ** 18 = 252000000000000000000
    vault_unix: u128,
    lords_per_day: u128,
    tick_time: u128,
    realm_l2_contract: ContractAddress,
}

#[derive(Component)]
struct BuildingCost {
    resource_id: felt252,
    cost: u128,
}

#[derive(Component)]
struct BuildingTypeConfig {
    id: felt252,
    sqm: u128,
    resource_ids_packed: u256,
    resource_ids_count: u8,
}

#[derive(Component)]
struct BuildingConfig {
    base_sqm: u128,
    workhut_cost: u128,
}

#[derive(Component)]
struct LaborConf {
    base_labor_units: u128, // 86400 / 12    
    vault_percentage: u128, // 250 
    base_resources_per_cycle: u128, // (252 / 12) * 10 ** 18;
}

// labor cost resources
#[derive(Component)]
struct LaborCR {
    id: felt252,
    resource_ids_packed: u128,
    resource_ids_count: u8,
}

// labor cost values
// @dev struct names need to be small to fit into max bytes (long prefixes are added in dojo)
// mapping of resource_id for which we want to increase labor, resource_id that needs to be burned, value to be burned
#[derive(Component)]
struct LaborCV {
    id: felt252,
    resource_id: felt252,
    value: u128,
}
