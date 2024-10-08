use core::integer::BoundedU128;
use cubit::f128::math::comp::{max as fixed_max};
use cubit::f128::math::trig::{cos as fixed_cos, sin as fixed_sin};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use debug::PrintTrait;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{
    WORLD_CONFIG_ID, BUILDING_CATEGORY_POPULATION_CONFIG_ID, RESOURCE_PRECISION, HYPERSTRUCTURE_CONFIG_ID, TickIds,
    split_resources_and_probs, ResourceTypes
};
use eternum::models::buildings::BuildingCategory;
use eternum::models::capacity::{CapacityCategory, CapacityCategoryCustomImpl, CapacityCategoryCustomTrait};
use eternum::models::combat::Troops;
use eternum::models::owner::{EntityOwner, EntityOwnerCustomTrait};
use eternum::models::position::{Coord};
use eternum::models::quantity::Quantity;

use eternum::models::resources::{ResourceFoodImpl};
use eternum::models::weight::Weight;
use eternum::utils::math::{max, min};
use eternum::utils::random;

use starknet::ContractAddress;

//
// GLOBAL CONFIGS
//

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldConfig {
    #[key]
    config_id: ID,
    admin_address: ContractAddress,
    realm_l2_contract: ContractAddress,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct RealmFreeMintConfig {
    #[key]
    config_id: ID,
    detached_resource_id: ID,
    detached_resource_count: u32
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureResourceConfig {
    #[key]
    config_id: ID,
    #[key]
    resource_type: u8,
    amount_for_completion: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
struct HyperstructureConfig {
    #[key]
    config_id: ID,
    time_between_shares_change: u64,
    points_per_cycle: u128,
    points_for_win: u128,
    points_on_completion: u128,
}

// capacity
#[derive(PartialEq, Copy, Drop, Serde, Introspect)]
enum CapacityConfigCategory {
    None,
    Structure,
    Donkey,
    Army,
    Storehouse,
}

impl CapacityConfigCategoryIntoFelt252 of Into<CapacityConfigCategory, felt252> {
    fn into(self: CapacityConfigCategory) -> felt252 {
        match self {
            CapacityConfigCategory::None => 0,
            CapacityConfigCategory::Structure => 1,
            CapacityConfigCategory::Donkey => 2,
            CapacityConfigCategory::Army => 3,
            CapacityConfigCategory::Storehouse => 4,
        }
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct CapacityConfig {
    #[key]
    category: CapacityConfigCategory,
    weight_gram: u128,
}


#[generate_trait]
impl CapacityConfigCustomImpl of CapacityConfigCustomTrait {
    fn get(world: IWorldDispatcher, category: CapacityConfigCategory) -> CapacityConfig {
        get!(world, category, CapacityConfig)
    }

    fn get_from_entity(world: IWorldDispatcher, entity_id: ID) -> CapacityConfig {
        let capacity_category = CapacityCategoryCustomImpl::assert_exists_and_get(world, entity_id);
        return get!(world, capacity_category.category, CapacityConfig);
    }

    fn assert_can_carry(self: CapacityConfig, quantity: Quantity, weight: Weight) {
        assert!(self.can_carry(quantity, weight), "entity {} capacity not enough", weight.entity_id);
    }

    fn can_carry(self: CapacityConfig, quantity: Quantity, weight: Weight) -> bool {
        let quantity_value = if quantity.value == 0 {
            1
        } else {
            quantity.value
        };
        if self.is_capped() {
            let entity_total_weight_capacity = self.weight_gram * (quantity_value / RESOURCE_PRECISION);
            if entity_total_weight_capacity < weight.value {
                return false;
            };
        };
        return true;
    }

    fn is_capped(self: CapacityConfig) -> bool {
        self.weight_gram != BoundedU128::max()
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct TravelStaminaCostConfig {
    #[key]
    config_id: ID,
    #[key]
    travel_type: u8,
    cost: u16,
}

// speed
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct SpeedConfig {
    #[key]
    config_id: ID,
    #[key]
    speed_config_id: ID,
    entity_type: ID,
    sec_per_km: u16,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct MapConfig {
    #[key]
    config_id: ID,
    reward_resource_amount: u128,
    // weight of fail
    // the higher, the less likely to find a mine
    // weight of sucess = 1000
    // ex: if set to 5000
    shards_mines_fail_probability: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct SettlementConfig {
    #[key]
    config_id: ID,
    // starting value radius
    // starting value angle (precision 100)
    angle_scaled: u128,
    center: u32,
    // always positive
    min_scaling_factor_scaled: u128,
    // initial radius in precision 100
    radius: u32,
    // min/max radius changes in precision 100
    min_distance: u32,
    max_distance: u32,
    // radius incrase in precision 100
    min_angle_increase: u64,
    max_angle_increase: u64,
}

#[generate_trait]
impl SettlementConfigImpl of SettlementConfigTrait {
    fn get_scaling_factor(ref self: SettlementConfig) -> Fixed {
        let max_radius_fixed = FixedTrait::new_unscaled(self.center.into() * 100, false);
        let radius_fixed = FixedTrait::new_unscaled(self.radius.into(), false);
        // very small at first and then grows
        let scaling_factor_fixed = (max_radius_fixed - radius_fixed) / max_radius_fixed;
        let min_scaling_factor_fixed = FixedTrait::new(self.min_scaling_factor_scaled, false);
        fixed_max(scaling_factor_fixed, min_scaling_factor_fixed)
    }

    fn get_step_size(ref self: SettlementConfig, scaling_factor: Fixed) -> u32 {
        let min_distance_fixed = FixedTrait::new_unscaled(self.min_distance.into(), false);
        let max_distance_fixed = FixedTrait::new_unscaled(self.max_distance.into(), false);
        let range = max_distance_fixed - min_distance_fixed;
        let scaled_range = scaling_factor * range;
        let step_size_fixed = min_distance_fixed + scaled_range;
        step_size_fixed.try_into().unwrap() + 100
    }

    fn get_radius_increase(ref self: SettlementConfig, step_size: u32, block_timestamp: u64) -> u32 {
        (block_timestamp % (step_size.into() / 100) * 100 + self.min_distance.into()).try_into().unwrap()
    }

    fn get_angle_increase(ref self: SettlementConfig, step_size: u32, block_timestamp: u64) -> Fixed {
        FixedTrait::new_unscaled(
            (block_timestamp % (self.max_angle_increase - self.min_angle_increase) + self.min_angle_increase).into(),
            false
        )
            / FixedTrait::new_unscaled(100, false)
    }

    fn increase_angle(ref self: SettlementConfig, angle_increase: Fixed) -> Fixed {
        self.angle_scaled += angle_increase.mag;
        FixedTrait::new(self.angle_scaled, false)
    }

    fn compute_coords(ref self: SettlementConfig, angle: Fixed) -> Coord {
        let cos = fixed_cos(angle);
        let sin = fixed_sin(angle);

        let x = FixedTrait::new_unscaled(self.center.into(), false)
            + cos * FixedTrait::new_unscaled(self.radius.into(), false) / FixedTrait::new_unscaled(100, false);
        let y = FixedTrait::new_unscaled(self.center.into(), false)
            + sin * FixedTrait::new_unscaled(self.radius.into(), false) / FixedTrait::new_unscaled(100, false);

        return Coord { x: x.try_into().unwrap(), y: y.try_into().unwrap() };
    }

    fn get_next_settlement_coord(ref self: SettlementConfig, block_timestamp: u64) -> Coord {
        let scaling_factor = Self::get_scaling_factor(ref self);
        let step_size = Self::get_step_size(ref self, scaling_factor);
        let radius_increase = Self::get_radius_increase(ref self, step_size, block_timestamp);
        self.radius += radius_increase;
        let angle_increase = Self::get_angle_increase(ref self, step_size, block_timestamp);
        let new_angle_fixed = Self::increase_angle(ref self, angle_increase);
        Self::compute_coords(ref self, new_angle_fixed)
    }
}

#[generate_trait]
impl MapConfigImpl of MapConfigTrait {
    fn random_reward(world: IWorldDispatcher) -> Span<(u8, u128)> {
        let (resource_types, resources_probs) = split_resources_and_probs();
        let reward_resource_id: u8 = *random::choices(resource_types, resources_probs, array![].span(), 1, true).at(0);

        let explore_config: MapConfig = get!(world, WORLD_CONFIG_ID, MapConfig);
        let reward_resource_amount: u128 = explore_config.reward_resource_amount;
        return array![(reward_resource_id, reward_resource_amount)].span();
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct TickConfig {
    #[key]
    config_id: ID,
    #[key]
    tick_id: u8,
    tick_interval_in_seconds: u64
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct StaminaRefillConfig {
    #[key]
    config_id: ID,
    amount_per_tick: u16,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct StaminaConfig {
    #[key]
    config_id: ID,
    #[key]
    unit_type: u8,
    max_stamina: u16,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct TravelFoodCostConfig {
    #[key]
    config_id: ID,
    #[key]
    unit_type: u8,
    explore_wheat_burn_amount: u128,
    explore_fish_burn_amount: u128,
    travel_wheat_burn_amount: u128,
    travel_fish_burn_amount: u128,
}

#[generate_trait]
impl TravelFoodCostConfigImpl of TravelFoodCostConfigTrait {
    fn pay_exploration_cost(world: IWorldDispatcher, unit_entity_owner: EntityOwner, troops: Troops) {
        let unit_owner_id = unit_entity_owner.entity_owner_id;
        assert!(unit_owner_id.is_non_zero(), "entity has no owner for exploration payment");

        let knight_travel_food_cost_config: TravelFoodCostConfig = get!(
            world, (WORLD_CONFIG_ID, ResourceTypes::KNIGHT), TravelFoodCostConfig
        );
        let paladin_travel_food_cost_config: TravelFoodCostConfig = get!(
            world, (WORLD_CONFIG_ID, ResourceTypes::PALADIN), TravelFoodCostConfig
        );
        let crossbowman_travel_food_cost_config: TravelFoodCostConfig = get!(
            world, (WORLD_CONFIG_ID, ResourceTypes::CROSSBOWMAN), TravelFoodCostConfig
        );

        let knight_wheat_pay_amount = knight_travel_food_cost_config.explore_wheat_burn_amount
            * troops.knight_count.into();
        let knight_fish_pay_amount = knight_travel_food_cost_config.explore_fish_burn_amount
            * troops.knight_count.into();

        let paladin_wheat_pay_amount = paladin_travel_food_cost_config.explore_wheat_burn_amount
            * troops.paladin_count.into();
        let paladin_fish_pay_amount = paladin_travel_food_cost_config.explore_fish_burn_amount
            * troops.paladin_count.into();

        let crossbowman_wheat_pay_amount = crossbowman_travel_food_cost_config.explore_wheat_burn_amount
            * troops.crossbowman_count.into();
        let crossbowman_fish_pay_amount = crossbowman_travel_food_cost_config.explore_fish_burn_amount
            * troops.crossbowman_count.into();

        let mut wheat_pay_amount = knight_wheat_pay_amount + paladin_wheat_pay_amount + crossbowman_wheat_pay_amount;
        let mut fish_pay_amount = knight_fish_pay_amount + paladin_fish_pay_amount + crossbowman_fish_pay_amount;
        assert!(wheat_pay_amount != 0, "Cannot explore with 0 troops");
        assert!(fish_pay_amount != 0, "Cannot explore with 0 troops");

        ResourceFoodImpl::pay(world, unit_owner_id, wheat_pay_amount, fish_pay_amount);
    }

    fn pay_travel_cost(world: IWorldDispatcher, unit_entity_owner: EntityOwner, troops: Troops, steps: usize) {
        let unit_owner_id = unit_entity_owner.entity_owner_id;
        assert!(unit_owner_id.is_non_zero(), "entity has no owner for travel payment");

        let knight_travel_food_cost_config: TravelFoodCostConfig = get!(
            world, (WORLD_CONFIG_ID, ResourceTypes::KNIGHT), TravelFoodCostConfig
        );
        let paladin_travel_food_cost_config: TravelFoodCostConfig = get!(
            world, (WORLD_CONFIG_ID, ResourceTypes::PALADIN), TravelFoodCostConfig
        );
        let crossbowman_travel_food_cost_config: TravelFoodCostConfig = get!(
            world, (WORLD_CONFIG_ID, ResourceTypes::CROSSBOWMAN), TravelFoodCostConfig
        );

        let knight_wheat_pay_amount = knight_travel_food_cost_config.travel_wheat_burn_amount
            * troops.knight_count.into()
            * steps.into();
        let knight_fish_pay_amount = knight_travel_food_cost_config.travel_fish_burn_amount
            * troops.knight_count.into()
            * steps.into();

        let paladin_wheat_pay_amount = paladin_travel_food_cost_config.travel_wheat_burn_amount
            * troops.paladin_count.into()
            * steps.into();
        let paladin_fish_pay_amount = paladin_travel_food_cost_config.travel_fish_burn_amount
            * troops.paladin_count.into()
            * steps.into();

        let crossbowman_wheat_pay_amount = crossbowman_travel_food_cost_config.travel_wheat_burn_amount
            * troops.crossbowman_count.into()
            * steps.into();
        let crossbowman_fish_pay_amount = crossbowman_travel_food_cost_config.travel_fish_burn_amount
            * troops.crossbowman_count.into()
            * steps.into();

        let mut wheat_pay_amount = knight_wheat_pay_amount + paladin_wheat_pay_amount + crossbowman_wheat_pay_amount;
        let mut fish_pay_amount = knight_fish_pay_amount + paladin_fish_pay_amount + crossbowman_fish_pay_amount;
        assert!(wheat_pay_amount != 0, "Cannot travel with 0 troops");
        assert!(fish_pay_amount != 0, "Cannot travel with 0 troops");

        ResourceFoodImpl::pay(world, unit_owner_id, wheat_pay_amount, fish_pay_amount);
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct MercenariesConfig {
    #[key]
    config_id: ID,
    troops: Troops,
    rewards: Span<(u8, u128)>
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
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WeightConfig {
    #[key]
    config_id: ID,
    #[key]
    weight_config_id: ID,
    entity_type: ID,
    weight_gram: u128,
}

#[generate_trait]
impl WeightConfigCustomImpl of WeightConfigCustomTrait {
    fn get_weight(world: IWorldDispatcher, resource_type: u8, amount: u128) -> u128 {
        let resource_weight_config = get!(world, (WORLD_CONFIG_ID, resource_type), WeightConfig);

        (resource_weight_config.weight_gram * amount) / RESOURCE_PRECISION
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct LevelingConfig {
    #[key]
    config_id: ID,
    decay_interval: u64,
    max_level: u64,
    decay_scaled: u128,
    cost_percentage_scaled: u128,
    base_multiplier: u128,
    wheat_base_amount: u128,
    fish_base_amount: u128,
    // low tier resources
    resource_1_cost_id: ID,
    resource_1_cost_count: u32,
    // mid tier resources
    resource_2_cost_id: ID,
    resource_2_cost_count: u32,
    // high tier resources
    resource_3_cost_id: ID,
    resource_3_cost_count: u32
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ProductionConfig {
    #[key]
    resource_type: u8,
    // production amount per tick
    amount: u128,
    // num materials required to produce this resource
    input_count: u128,
    // num different resources that this resource can produce
    output_count: u128
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BankConfig {
    #[key]
    config_id: ID,
    lords_cost: u128,
    lp_fee_num: u128,
    lp_fee_denom: u128,
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingGeneralConfig {
    #[key]
    config_id: ID,
    base_cost_percent_increase: u16,
}


#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingConfig {
    #[key]
    config_id: ID,
    #[key]
    category: BuildingCategory,
    #[key]
    resource_type: u8,
    resource_cost_id: ID,
    resource_cost_count: u32,
}

#[generate_trait]
impl BuildingConfigCustomImpl of BuildingConfigCustomTrait {
    fn get(world: IWorldDispatcher, category: BuildingCategory, resource_type: u8) -> BuildingConfig {
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

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct TroopConfig {
    #[key]
    config_id: ID,
    health: u32,
    knight_strength: u8,
    paladin_strength: u8,
    crossbowman_strength: u16,
    advantage_percent: u16,
    disadvantage_percent: u16,
    max_troop_count: u64,
    // By setting the divisor to 8, the max health that can be taken from the weaker army
    // during pillage is 100 / 8 = 12.5% . Adjust this value to change that.
    //
    // The closer the armies are in strength and health, the closer they both
    // get to losing 12.5% each. If an army is far stronger than the order,
    // they lose a small precentage (it goes closer to 0% health loss) while the
    // weak army's loss is closer to 12.5%
    pillage_health_divisor: u8,
    // the number of armies that can be created per structure
    // before military buildings are required to create more
    army_free_per_structure: u8,
    // the number of additional  armies that can be create with
    // each new military building
    army_extra_per_building: u8,
    // hard limit of armies per structure
    army_max_per_structure: u8,
    // percentage to slash army by if they leave early
    // e.g num = 25, denom = 100 // represents 25%
    battle_leave_slash_num: u8,
    battle_leave_slash_denom: u8
}


#[generate_trait]
impl TroopConfigCustomImpl of TroopConfigCustomTrait {
    fn get(world: IWorldDispatcher) -> TroopConfig {
        return get!(world, WORLD_CONFIG_ID, TroopConfig);
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BattleConfig {
    #[key]
    config_id: ID,
    battle_grace_tick_count: u8,
    battle_delay_seconds: u64,
}

#[generate_trait]
impl BattleConfigCustomImpl of BattleConfigCustomTrait {
    fn get(world: IWorldDispatcher) -> BattleConfig {
        get!(world, WORLD_CONFIG_ID, BattleConfig)
    }
}


#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingCategoryPopConfig {
    #[key]
    config_id: ID,
    #[key]
    building_category: BuildingCategory,
    population: u32, // adds to population
    capacity: u32, // increase capacity by this amount
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct PopulationConfig {
    #[key]
    config_id: ID,
    base_population: u32,
}

#[generate_trait]
impl BuildingCategoryPopulationConfigCustomImpl of BuildingCategoryPopConfigCustomTrait {
    fn get(world: IWorldDispatcher, building_id: BuildingCategory) -> BuildingCategoryPopConfig {
        get!(world, (BUILDING_CATEGORY_POPULATION_CONFIG_ID, building_id), BuildingCategoryPopConfig)
    }
}

#[generate_trait]
impl HyperstructureResourceConfigCustomImpl of HyperstructureResourceConfigCustomTrait {
    fn get(world: IWorldDispatcher, resource_id: u8) -> HyperstructureResourceConfig {
        get!(world, (HYPERSTRUCTURE_CONFIG_ID, resource_id), HyperstructureResourceConfig)
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HasClaimedStartingResources {
    #[key]
    entity_id: ID,
    #[key]
    config_id: ID,
    claimed: bool,
}

// speed
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct RealmMaxLevelConfig {
    #[key]
    config_id: ID,
    max_level: u8,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
struct RealmLevelConfig {
    #[key]
    level: u8,
    required_resources_id: ID,
    required_resource_count: u8,
}
