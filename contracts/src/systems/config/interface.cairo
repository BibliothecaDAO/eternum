use eternum::alias::ID;
use eternum::models::position::Coord;

use dojo::world::IWorldDispatcher;

#[starknet::interface]
trait IWorldConfig<TContractState> {
    fn set_world_config(
        self: @TContractState, world: IWorldDispatcher, 
        admin_address: starknet::ContractAddress,
        realm_l2_contract: starknet::ContractAddress
    );
}


#[starknet::interface]
trait IRealmFreeMintConfig<TContractState> {
    fn set_mint_config(
        self: @TContractState, world: IWorldDispatcher, resources: Span<(u8, u128)>
    );
}


#[starknet::interface]
trait IWeightConfig<TContractState> {
    fn set_weight_config(
        self: @TContractState, world: IWorldDispatcher, 
        entity_type: u128,  weight_gram: u128
    );
}

#[starknet::interface]
trait ICapacityConfig<TContractState> {
    fn set_capacity_config(
        self: @TContractState, world: IWorldDispatcher, 
        entity_type: u128, weight_gram: u128
    );
}


#[starknet::interface]
trait ICombatConfig<TContractState> {
    fn set_combat_config(
        self: @TContractState, 
        world: IWorldDispatcher, 
        config_id: u128, 
        stealing_trial_count: u32,
        wheat_burn_per_soldier: u128,
        fish_burn_per_soldier: u128,
    );

    fn set_soldier_config(
        self: @TContractState, 
        world: IWorldDispatcher, 
        resource_costs: Span<(u8, u128)>,
        wheat_burn_per_soldier: u128,
        fish_burn_per_soldier: u128
    );

    fn set_health_config(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_type: u128, 
        resource_costs: Span<(u8, u128)>,
        max_value: u128
    );

    fn set_attack_config(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_type: u128, 
        max_value: u128
    );

    fn set_defence_config(
        self: @TContractState, 
        world: IWorldDispatcher, 
        entity_type: u128, 
        max_value: u128
    );
}


#[starknet::interface]
trait ILaborConfig<TContractState> {
    fn set_labor_cost_resources(
        self: @TContractState, world: IWorldDispatcher, 
        resource_type_labor: felt252, resource_types_packed: u128, resource_types_count: u8
    );

    fn set_labor_cost_amount(
        self: @TContractState, world: IWorldDispatcher, 
        resource_type_labor: felt252, resource_type_cost: felt252, resource_type_value: u128
    );

    fn set_labor_config(
        self: @TContractState, world: IWorldDispatcher, 
        base_labor_units: u64, base_resources_per_cycle: u128, base_food_per_cycle: u128
    );

    fn set_labor_auction(
        self: @TContractState, world: IWorldDispatcher, 
        decay_constant: u128, per_time_unit: u128, price_update_interval: u128
    );
}

#[starknet::interface]
trait ITransportConfig<TContractState> {
    
    fn set_road_config(
        self: @TContractState, world: IWorldDispatcher, 
        resource_costs: Span<(u8, u128)>,
        speed_up_by: u64
    );

    fn set_speed_config(
        self: @TContractState, world: IWorldDispatcher, 
        entity_type: u128, sec_per_km: u16
    );

    fn set_travel_config(
        self: @TContractState, world: IWorldDispatcher, free_transport_per_city: u128
    );

}


#[starknet::interface]
trait IHyperstructureConfig<TContractState> {
    fn create_hyperstructure(
        self: @TContractState, world: IWorldDispatcher,
        hyperstructure_type: u8, coord: Coord, completion_cost: Span<(u8, u128)>
    ) -> ID;
}

#[starknet::interface]
trait ILevelingConfig<TContractState> {
    fn set_leveling_config(
        self: @TContractState, 
        world: IWorldDispatcher,
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

#[starknet::interface]
trait IBankConfig<TContractState> {
    fn create_bank(
        self: @TContractState,
        world: IWorldDispatcher,
        coord: Coord,
        swap_cost_resources: Span<(u8, Span<(u8, u128)>)>
    ) -> ID ;


    fn set_bank_auction(
        self: @TContractState,
        world: IWorldDispatcher,
        bank_id: u128,
        bank_swap_resource_cost_keys: Span<(u8, u32)>,
        decay_constant: u128,
        per_time_unit: u128,
        price_update_interval: u128,
    );
}