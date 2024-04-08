use eternum::alias::ID;
use eternum::models::position::Coord;

use dojo::world::IWorldDispatcher;

#[dojo::interface]
trait IWorldConfig {
    fn set_world_config(
        admin_address: starknet::ContractAddress, realm_l2_contract: starknet::ContractAddress
    );
}


#[dojo::interface]
trait IRealmFreeMintConfig {
    fn set_mint_config(resources: Span<(u8, u128)>);
}


#[dojo::interface]
trait IWeightConfig {
    fn set_weight_config(entity_type: u128, weight_gram: u128);
}

#[dojo::interface]
trait ICapacityConfig {
    fn set_capacity_config(entity_type: u128, weight_gram: u128);
}


#[dojo::interface]
trait ITickConfig {
    fn set_tick_config(max_moves_per_tick: u8, tick_interval_in_seconds: u64);
}


#[dojo::interface]
trait ICombatConfig {
    fn set_combat_config(
        config_id: u128,
        stealing_trial_count: u32,
        wheat_burn_per_soldier: u128,
        fish_burn_per_soldier: u128,
    );

    fn set_soldier_config(
        resource_costs: Span<(u8, u128)>, wheat_burn_per_soldier: u128, fish_burn_per_soldier: u128
    );

    fn set_health_config(entity_type: u128, resource_costs: Span<(u8, u128)>, max_value: u128);

    fn set_attack_config(entity_type: u128, max_value: u128);

    fn set_defence_config(entity_type: u128, max_value: u128);
}


#[dojo::interface]
trait ILaborConfig {
    fn set_labor_cost_resources(
        resource_type_labor: felt252, resource_types_packed: u128, resource_types_count: u8
    );

    fn set_labor_cost_amount(
        resource_type_labor: felt252, resource_type_cost: felt252, resource_type_value: u128
    );

    fn set_labor_config(
        base_labor_units: u64, base_resources_per_cycle: u128, base_food_per_cycle: u128
    );

    fn set_labor_auction(decay_constant: u128, per_time_unit: u128, price_update_interval: u128);
}

#[dojo::interface]
trait ITransportConfig {
    fn set_road_config(resource_costs: Span<(u8, u128)>, speed_up_by: u64);

    fn set_speed_config(entity_type: u128, sec_per_km: u16);

    fn set_travel_config(free_transport_per_city: u128);
}


#[dojo::interface]
trait IHyperstructureConfig {
    fn create_hyperstructure(
        hyperstructure_type: u8, coord: Coord, completion_cost: Span<(u8, u128)>
    ) -> ID;
}

#[dojo::interface]
trait ILevelingConfig {
    fn set_leveling_config(
        config_id: u128,
        decay_interval: u64,
        max_level: u64,
        decay_scaled: u128,
        cost_percentage_scaled: u128,
        base_multiplier: u128,
        wheat_base_amount: u128,
        fish_base_amount: u128,
        resource_1_costs: Span<(u8, u128)>,
        resource_2_costs: Span<(u8, u128)>,
        resource_3_costs: Span<(u8, u128)>,
    );
}

#[dojo::interface]
trait IBankConfig {
    fn create_bank(coord: Coord, swap_cost_resources: Span<(u8, Span<(u8, u128)>)>) -> ID;


    fn set_bank_auction(
        bank_id: u128,
        bank_swap_resource_cost_keys: Span<(u8, u32)>,
        decay_constant: u128,
        per_time_unit: u128,
        price_update_interval: u128,
    );
}

#[dojo::interface]
trait IBuildingsConfig {
    fn set_labor_buildings_config(
        level_multiplier: u128,
        level_discount_mag: u128,
        resources_category_1: u128,
        resources_category_1_count: u8,
        resources_category_2: u128,
        resources_category_2_count: u8,
        resources_category_3: u128,
        resources_category_3_count: u8,
        resources_category_4: u128,
        resources_category_4_count: u8,
        building_category_1_resource_costs: Span<(u8, u128)>,
        building_category_2_resource_costs: Span<(u8, u128)>,
        building_category_3_resource_costs: Span<(u8, u128)>,
        building_category_4_resource_costs: Span<(u8, u128)>,
    );
}


#[dojo::interface]
trait IMapConfig {
    fn set_exploration_config(
        wheat_burn_amount: u128, fish_burn_amount: u128, reward_resource_amount: u128
    );
}


#[dojo::interface]
trait IProductionConfig {
    fn set_production_config(
        resource_type: u8,
        amount: u128,
        cost: Span<(u8, u128)>
    );
}