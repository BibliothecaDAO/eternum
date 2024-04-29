use dojo::world::IWorldDispatcher;
use eternum::alias::ID;
use eternum::models::buildings::BuildingCategory;
use eternum::models::config::TroopConfig;
use eternum::models::position::Coord;

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
    fn set_bank_config(lords_cost: u128, lp_fee_scaled: u128);
}


#[dojo::interface]
trait IMapConfig {
    fn set_exploration_config(
        wheat_burn_amount: u128, fish_burn_amount: u128, reward_resource_amount: u128
    );
}


#[dojo::interface]
trait IProductionConfig {
    fn set_production_config(resource_type: u8, amount: u128, cost: Span<(u8, u128)>);
}

#[dojo::interface]
trait ITroopConfig {
    fn set_troop_config(troop_config: TroopConfig);
}
#[dojo::interface]
trait IBuildingConfig {
    fn set_building_config(
        building_category: BuildingCategory,
        building_resource_type: u8,
        cost_of_building: Span<(u8, u128)>
    );
}

#[dojo::interface]
trait IPopulationConfig {
    fn set_population_config(building_category: BuildingCategory, population: u32, capacity: u32);
}
