use core::debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{
    WORLD_CONFIG_ID, BUILDING_CATEGORY_POPULATION_CONFIG_ID, RESOURCE_PRECISION,
    HYPERSTRUCTURE_CONFIG_ID, TickIds
};
use eternum::models::buildings::BuildingCategory;

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
struct RoadConfig {
    #[key]
    config_id: u128,
    resource_cost_id: u128,
    resource_cost_count: u32,
    speed_up_by: u64
}

#[derive(Model, Copy, Drop, Serde)]
struct HyperstructureResourceConfig {
    #[key]
    config_id: u128,
    #[key]
    resource_type: u8,
    amount_for_completion: u128,
}

// capacity
// TODO: should rename into something that shows
// that it's a config for one specific entity type?
// and not the same as world config 
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

#[generate_trait]
impl CapacityConfigImpl of CapacityConfigTrait {
    fn get(world: IWorldDispatcher, entity_type: u128) -> CapacityConfig {
        get!(world, (WORLD_CONFIG_ID, entity_type), CapacityConfig)
    }
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
struct MapExploreConfig {
    #[key]
    config_id: u128,
    wheat_burn_amount: u128,
    fish_burn_amount: u128,
    reward_resource_amount: u128,
    shards_mines_fail_probability: u128,
}


#[derive(Model, Copy, Drop, Serde)]
struct TickConfig {
    #[key]
    config_id: u128,
    #[key]
    tick_id: u8,
    tick_interval_in_seconds: u64
}

#[derive(Model, Copy, Drop, Serde)]
struct StaminaConfig {
    #[key]
    config_id: u128,
    #[key]
    unit_type: u8,
    max_stamina: u16,
}

#[generate_trait]
impl TickImpl of TickTrait {
    fn get_default_tick_config(world: IWorldDispatcher) -> TickConfig {
        let tick_config: TickConfig = get!(world, (WORLD_CONFIG_ID, TickIds::DEFAULT), TickConfig);
        return tick_config;
    }

    fn get_armies_tick_config(world: IWorldDispatcher) -> TickConfig {
        let tick_config: TickConfig = get!(world, (WORLD_CONFIG_ID, TickIds::ARMIES), TickConfig);
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

    fn next_tick_timestamp(self: TickConfig) -> u64 {
        self.current() + self.interval()
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

#[generate_trait]
impl WeightConfigImpl of WeightConfigTrait {
    fn get_weight(world: IWorldDispatcher, resource_type: u8, amount: u128) -> u128 {
        let resource_weight_config = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig);

        (resource_weight_config.weight_gram * amount) / RESOURCE_PRECISION
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
struct BuildingConfig {
    #[key]
    config_id: u128,
    #[key]
    category: BuildingCategory,
    #[key]
    resource_type: u8,
    resource_cost_id: u128,
    resource_cost_count: u32,
}

#[generate_trait]
impl BuildingConfigImpl of BuildingConfigTrait {
    fn get(
        world: IWorldDispatcher, category: BuildingCategory, resource_type: u8
    ) -> BuildingConfig {
        return get!(
            world,
            (
                WORLD_CONFIG_ID,
                Into::<BuildingCategory, felt252>::into(category),
                Into::<u8, felt252>::into(resource_type)
            ),
            BuildingConfig
        );
    }
}

#[derive(Model, Copy, Drop, Serde)]
struct TroopConfig {
    #[key]
    config_id: u128,
    health: u32,
    knight_strength: u8,
    paladin_strength: u8,
    crossbowman_strength: u16,
    advantage_percent: u16,
    disadvantage_percent: u16,
    // By setting the divisor to 8, the max health that can be taken from the weaker army
    // during pillage is 100 / 8 = 12.5% . Adjust this value to change that.
    //
    // The closer the armies are in strength and health, the closer they both 
    // get to losing 12.5% each. If an army is far stronger than the order, 
    // they lose a small precentage (it goes closer to 0% health loss) while the
    // weak army's loss is closer to 12.5% 
    pillage_health_divisor: u8
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
        get!(world, WORLD_CONFIG_ID, BattleConfig)
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct BuildingCategoryPopConfig {
    #[key]
    config_id: u128,
    #[key]
    building_category: BuildingCategory,
    population: u32, // adds to population
    capacity: u32, // increase capacity by this amount
}

#[derive(Model, Copy, Drop, Serde)]
struct PopulationConfig {
    #[key]
    config_id: u128,
    base_population: u32,
}

#[generate_trait]
impl BuildingCategoryPopulationConfigImpl of BuildingCategoryPopConfigTrait {
    fn get(world: IWorldDispatcher, building_id: BuildingCategory) -> BuildingCategoryPopConfig {
        get!(
            world, (BUILDING_CATEGORY_POPULATION_CONFIG_ID, building_id), BuildingCategoryPopConfig
        )
    }
}

#[generate_trait]
impl HyperstructureConfigImpl of HyperstructureConfigTrait {
    fn get(world: IWorldDispatcher, resource_id: u8) -> HyperstructureResourceConfig {
        get!(world, (HYPERSTRUCTURE_CONFIG_ID, resource_id), HyperstructureResourceConfig)
    }
}

#[derive(Model, Copy, Drop, Serde)]
struct HasClaimedStartingResources {
    #[key]
    entity_id: u128,
    #[key]
    config_id: u32,
    claimed: bool,
}
