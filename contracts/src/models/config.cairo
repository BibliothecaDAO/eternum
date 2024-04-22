use core::debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{WORLD_CONFIG_ID};
use eternum::utils::unpack::unpack_resource_types;

use starknet::ContractAddress;

//
// GLOBAL CONFIGS
//

#[derive(Model, Copy, Drop, Serde)]
struct WorldConfig {
    #[key]
    config_id: u128,
    admin_address: ContractAddress,
    realm_l2_contract: ContractAddress,
}

#[derive(Model, Copy, Drop, Serde)]
struct RealmFreeMintConfig {
    #[key]
    config_id: u128,
    detached_resource_id: u128,
    detached_resource_count: u32
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
    resource_cost_id: u128,
    resource_cost_count: u32,
    speed_up_by: u64
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
    stealing_trial_count: u32,
    wheat_burn_per_soldier: u128,
    fish_burn_per_soldier: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct SoldierConfig {
    #[key]
    config_id: u128,
    resource_cost_id: u128,
    resource_cost_count: u32,
    wheat_burn_per_soldier: u128,
    fish_burn_per_soldier: u128,
}

#[derive(Model, Copy, Drop, Serde)]
struct HealthConfig {
    #[key]
    entity_type: u128,
    resource_cost_id: u128,
    resource_cost_count: u32,
    max_value: u128, // max value for a single unit
}


#[derive(Model, Copy, Drop, Serde)]
struct AttackConfig {
    #[key]
    entity_type: u128,
    max_value: u128, // max value for a single unit
}


#[derive(Model, Copy, Drop, Serde)]
struct DefenceConfig {
    #[key]
    entity_type: u128,
    max_value: u128, // max value for a single unit
}


#[derive(Model, Copy, Drop, Serde)]
struct MapExploreConfig {
    #[key]
    config_id: u128,
    wheat_burn_amount: u128,
    fish_burn_amount: u128,
    reward_resource_amount: u128
}


#[derive(Model, Copy, Drop, Serde)]
struct TickConfig {
    #[key]
    config_id: u128,
    max_moves_per_tick: u8,
    tick_interval_in_seconds: u64
}


#[generate_trait]
impl TickImpl of TickTrait {
    fn get(world: IWorldDispatcher) -> TickConfig {
        let tick_config: TickConfig = get!(world, WORLD_CONFIG_ID, TickConfig);
        return tick_config;
    }

    fn interval(self: TickConfig) -> u64 {
        if self.tick_interval_in_seconds == 0 {
            return 1;
        }
        return self.tick_interval_in_seconds;
    }

    fn current(self: TickConfig) -> u64 {
        let now = starknet::get_block_timestamp();
        now / self.interval()
    }

    fn at(self: TickConfig, time: u64) -> u64 {
        time / self.interval()
    }

    fn after(self: TickConfig, time_spent: u64) -> u64 {
        (starknet::get_block_timestamp() + time_spent) / self.tick_interval_in_seconds
    }
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
    fn get_weight(world: IWorldDispatcher, resource_type: u8, amount: u128) -> u128;
}

impl WeightConfigImpl of WeightConfigTrait {
    fn get_weight(world: IWorldDispatcher, resource_type: u8, amount: u128) -> u128 {
        let resource_weight_config = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig);

        return resource_weight_config.weight_gram * amount;
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct LevelingConfig {
    #[key]
    config_id: u128,
    decay_interval: u64,
    max_level: u64,
    decay_scaled: u128,
    cost_percentage_scaled: u128,
    base_multiplier: u128,
    wheat_base_amount: u128,
    fish_base_amount: u128,
    // low tier resources
    resource_1_cost_id: u128,
    resource_1_cost_count: u32,
    // mid tier resources
    resource_2_cost_id: u128,
    resource_2_cost_count: u32,
    // high tier resources
    resource_3_cost_id: u128,
    resource_3_cost_count: u32
}

#[derive(Model, Clone, Drop, Serde)]
struct ProductionConfig {
    #[key]
    resource_type: u8,
    // production amount per tick
    amount: u128,
    // num materials required to produce this resource
    input_count: u128,
    // num different resources that this resource can produce
    output_count: u128
}


#[derive(Model, Copy, Drop, Serde)]
struct BankConfig {
    #[key]
    config_id: u128,
    lords_cost: u128,
    lp_fee_scaled: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct TroopConfig {
    #[key]
    config_id: u128,
    knight_health: u32,
    paladin_health: u32,
    crossbowman_health: u32,
    knight_strength: u32,
    paladin_strength: u32,
    crossbowman_strength: u32,
    advantage_percent: u32,
    disadvantage_percent: u32,
}


#[generate_trait]
impl TroopConfigImpl of TroopConfigTrait {
    fn get(world: IWorldDispatcher) -> TroopConfig {
        return get!(world, WORLD_CONFIG_ID, TroopConfig);
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct BattleConfig {
    #[key]
    entity_id: u128,
    max_tick_duration: u64,
}

#[generate_trait]
impl BattleConfigImpl of BattleConfigTrait {
    fn get(world: IWorldDispatcher) -> BattleConfig {
        return get!(world, WORLD_CONFIG_ID, BattleConfig);
    }
}
