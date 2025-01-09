use core::integer::BoundedU128;
use cubit::f128::math::comp::{max as fixed_max};
use cubit::f128::math::trig::{cos as fixed_cos, sin as fixed_sin};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s0_eternum::alias::ID;
use s0_eternum::constants::{
    WORLD_CONFIG_ID, BUILDING_CATEGORY_POPULATION_CONFIG_ID, RESOURCE_PRECISION, HYPERSTRUCTURE_CONFIG_ID, TickIds,
    split_resources_and_probs, ResourceTypes, ResourceTiers
};
use s0_eternum::models::capacity::{CapacityCategory, CapacityCategoryImpl, CapacityCategoryTrait};
use s0_eternum::models::combat::Troops;
use s0_eternum::models::owner::{EntityOwner, EntityOwnerTrait};
use s0_eternum::models::position::{Coord};
use s0_eternum::models::quantity::Quantity;
use s0_eternum::models::resource::production::building::BuildingCategory;

use s0_eternum::models::resource::resource::{ResourceFoodImpl};
use s0_eternum::models::season::{Season, SeasonImpl, SeasonTrait};
use s0_eternum::models::weight::Weight;
use s0_eternum::utils::map::constants::fixed_constants as fc;
use s0_eternum::utils::math::{max, min};
use s0_eternum::utils::random::VRFImpl;
use s0_eternum::utils::random;
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
pub struct SeasonAddressesConfig {
    #[key]
    config_id: ID,
    season_pass_address: ContractAddress,
    realms_address: ContractAddress,
    lords_address: ContractAddress,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct SeasonBridgeConfig {
    #[key]
    config_id: ID,
    // the number of seconds after the season ends
    // that the bridge will be closed
    close_after_end_seconds: u64,
}

#[generate_trait]
impl SeasonBridgeConfigImpl of SeasonBridgeConfigTrait {
    fn assert_bridge_is_open(world: WorldStorage) {
        // ensure season has started
        let season: Season = world.read_model(WORLD_CONFIG_ID);
        SeasonImpl::assert_has_started(world);

        // check if season is over
        if season.ended_at.is_non_zero() {
            // close bridge after grace period has elapsed
            let season_bridge_config: SeasonBridgeConfig = world.read_model(WORLD_CONFIG_ID);
            let now = starknet::get_block_timestamp();
            assert!(now <= season.ended_at + season_bridge_config.close_after_end_seconds, "Bridge is closed");
        }
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureResourceConfig {
    #[key]
    config_id: ID,
    #[key]
    resource_tier: u8,
    min_amount: u128,
    max_amount: u128,
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
impl CapacityConfigImpl of CapacityConfigTrait {
    fn get(ref world: WorldStorage, category: CapacityConfigCategory) -> CapacityConfig {
        world.read_model(category)
    }

    fn get_from_entity(ref world: WorldStorage, entity_id: ID) -> CapacityConfig {
        let capacity_category = CapacityCategoryImpl::assert_exists_and_get(ref world, entity_id);
        return world.read_model(capacity_category.category);
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
    center: u32,
    base_distance: u32,
    min_first_layer_distance: u32,
    points_placed: u32,
    current_layer: u32,
    current_side: u32,
    current_point_on_side: u32,
}

#[generate_trait]
impl SettlementConfigImpl of SettlementConfigTrait {
    fn get_distance_from_center(ref self: SettlementConfig) -> u32 {
        self.min_first_layer_distance + (self.current_layer - 1) * self.base_distance
    }

    fn get_points_on_side(ref self: SettlementConfig) -> u32 {
        if self.current_side > 0 {
            self.current_layer
        } else {
            self.current_layer - 1
        }
    }

    fn get_pos_percentage(ref self: SettlementConfig, points_on_side: u32) -> Fixed {
        FixedTrait::new_unscaled(self.current_point_on_side.into() + 1, false)
            / FixedTrait::new_unscaled(points_on_side.into() + 1, false)
    }

    fn get_side_coords(ref self: SettlementConfig, side: u32, distance_from_center: u32) -> (Fixed, Fixed) {
        let side_fixed = FixedTrait::new_unscaled(side.into(), false);
        let angle_fixed = side_fixed * fc::PI() / FixedTrait::new_unscaled(3, false);

        let cos = fixed_cos(angle_fixed);
        let sin = fixed_sin(angle_fixed);

        let centre_fixed = FixedTrait::new_unscaled(self.center.into(), false);
        let distance_fixed = FixedTrait::new_unscaled(distance_from_center.into(), false);

        let x_fixed = centre_fixed + distance_fixed * cos;
        let y_fixed = centre_fixed + distance_fixed * sin;
        (x_fixed, y_fixed)
    }

    fn get_next_settlement_coord(ref self: SettlementConfig) -> Coord {
        let distance_from_center = Self::get_distance_from_center(ref self);

        let (start_x_fixed, start_y_fixed) = Self::get_side_coords(ref self, self.current_side, distance_from_center);

        let next_side = (self.current_side + 1) % 6;

        let (end_x_fixed, end_y_fixed) = Self::get_side_coords(ref self, next_side, distance_from_center);

        let points_on_side = Self::get_points_on_side(ref self);

        let pos_percentage_fixed = Self::get_pos_percentage(ref self, points_on_side);

        let x_fixed = start_x_fixed + (end_x_fixed - start_x_fixed) * pos_percentage_fixed;
        let y_fixed = start_y_fixed + (end_y_fixed - start_y_fixed) * pos_percentage_fixed;

        self.current_point_on_side += 1;
        self.points_placed += 1;

        if self.current_point_on_side >= points_on_side {
            self.current_point_on_side = 0;
            self.current_side += 1;

            // If we've completed all sides, move to next layer
            if self.current_side >= 6 {
                self.current_side = 0;
                self.current_layer += 1;
            }
        }

        Coord { x: x_fixed.try_into().unwrap(), y: y_fixed.try_into().unwrap() }
    }
}

#[generate_trait]
impl MapConfigImpl of MapConfigTrait {
    fn random_reward(ref world: WorldStorage) -> Span<(u8, u128)> {
        let (resource_types, resources_probs) = split_resources_and_probs();

        let vrf_provider: ContractAddress = VRFConfigImpl::get_provider_address(ref world);
        let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
        let reward_resource_id: u8 = *random::choices(
            resource_types, resources_probs, array![].span(), 1, true, vrf_seed
        )
            .at(0);

        let explore_config: MapConfig = world.read_model(WORLD_CONFIG_ID);
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
    start_boost_tick_count: u8
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
    fn pay_exploration_cost(ref world: WorldStorage, unit_entity_owner: EntityOwner, troops: Troops) {
        let unit_owner_id = unit_entity_owner.entity_owner_id;
        assert!(unit_owner_id.is_non_zero(), "entity has no owner for exploration payment");

        let knight_travel_food_cost_config: TravelFoodCostConfig = world
            .read_model((WORLD_CONFIG_ID, ResourceTypes::KNIGHT));

        let paladin_travel_food_cost_config: TravelFoodCostConfig = world
            .read_model((WORLD_CONFIG_ID, ResourceTypes::PALADIN));

        let crossbowman_travel_food_cost_config: TravelFoodCostConfig = world
            .read_model((WORLD_CONFIG_ID, ResourceTypes::CROSSBOWMAN));

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

        ResourceFoodImpl::pay(ref world, unit_owner_id, wheat_pay_amount, fish_pay_amount);
    }

    fn pay_travel_cost(ref world: WorldStorage, unit_entity_owner: EntityOwner, troops: Troops, steps: usize) {
        let unit_owner_id = unit_entity_owner.entity_owner_id;
        assert!(unit_owner_id.is_non_zero(), "entity has no owner for travel payment");

        let knight_travel_food_cost_config: TravelFoodCostConfig = world
            .read_model((WORLD_CONFIG_ID, ResourceTypes::KNIGHT));

        let paladin_travel_food_cost_config: TravelFoodCostConfig = world
            .read_model((WORLD_CONFIG_ID, ResourceTypes::PALADIN));

        let crossbowman_travel_food_cost_config: TravelFoodCostConfig = world
            .read_model((WORLD_CONFIG_ID, ResourceTypes::CROSSBOWMAN));

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

        ResourceFoodImpl::pay(ref world, unit_owner_id, wheat_pay_amount, fish_pay_amount);
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct MercenariesConfig {
    #[key]
    config_id: ID,
    knights_lower_bound: u64,
    knights_upper_bound: u64,
    paladins_lower_bound: u64,
    paladins_upper_bound: u64,
    crossbowmen_lower_bound: u64,
    crossbowmen_upper_bound: u64,
    rewards: Span<(u8, u128)>
}


#[generate_trait]
impl TickImpl of TickTrait {
    fn get_default_tick_config(ref world: WorldStorage) -> TickConfig {
        let tick_config: TickConfig = world.read_model((WORLD_CONFIG_ID, TickIds::DEFAULT));
        return tick_config;
    }

    fn get_armies_tick_config(ref world: WorldStorage) -> TickConfig {
        let tick_config: TickConfig = world.read_model((WORLD_CONFIG_ID, TickIds::ARMIES));
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
impl WeightConfigImpl of WeightConfigTrait {
    fn get_weight_grams(ref world: WorldStorage, resource_type: u8, amount: u128) -> u128 {
        let resource_weight_config: WeightConfig = world.read_model((WORLD_CONFIG_ID, resource_type));
        (resource_weight_config.weight_gram * amount) / RESOURCE_PRECISION
    }

    fn get_weight_grams_with_precision(ref world: WorldStorage, resource_type: u8, amount: u128) -> u128 {
        let resource_weight_config: WeightConfig = world.read_model((WORLD_CONFIG_ID, resource_type));
        (resource_weight_config.weight_gram * amount)
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
    produced_amount: u128,
    // labor cost amount per tick
    labor_cost: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct LaborConfig {
    #[key]
    // e.g when configuring stone labor, resource_type = stone
    resource_type: u8,
    // uuid used to get the ResourceCost
    input_id: ID,
    // number of resources required to make labor
    input_count: u8,
}

// vrf
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct VRFConfig {
    #[key]
    config_id: ID,
    vrf_provider_address: ContractAddress,
}

#[generate_trait]
impl VRFConfigImpl of VRFConfigTrait {
    fn get_provider_address(ref world: WorldStorage) -> ContractAddress {
        let vrf_config: VRFConfig = world.read_model(WORLD_CONFIG_ID);
        return vrf_config.vrf_provider_address;
    }
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
impl BuildingConfigImpl of BuildingConfigTrait {
    fn get(ref world: WorldStorage, category: BuildingCategory, resource_type: u8) -> BuildingConfig {
        return world
            .read_model(
                (
                    WORLD_CONFIG_ID,
                    Into::<BuildingCategory, felt252>::into(category),
                    Into::<u8, felt252>::into(resource_type)
                )
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
    battle_leave_slash_denom: u8,
    // 1_000. multiply this number by 2 to reduce battle time by 2x,
    // and reduce by 2x to increase battle time by 2x, etc
    battle_time_scale: u16,
    battle_max_time_seconds: u64
}


#[generate_trait]
impl TroopConfigImpl of TroopConfigTrait {
    fn get(world: WorldStorage) -> TroopConfig {
        return world.read_model(WORLD_CONFIG_ID);
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BattleConfig {
    #[key]
    config_id: ID,
    regular_immunity_ticks: u8,
    hyperstructure_immunity_ticks: u8, // hyperstucture immunity
    battle_delay_seconds: u64,
}

#[generate_trait]
impl BattleConfigImpl of BattleConfigTrait {
    fn get(world: WorldStorage) -> BattleConfig {
        world.read_model(WORLD_CONFIG_ID)
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
impl BuildingCategoryPopulationConfigImpl of BuildingCategoryPopConfigTrait {
    fn get(ref world: WorldStorage, building_id: BuildingCategory) -> BuildingCategoryPopConfig {
        world.read_model((BUILDING_CATEGORY_POPULATION_CONFIG_ID, building_id))
    }
}

#[generate_trait]
impl HyperstructureResourceConfigImpl of HyperstructureResourceConfigTrait {
    fn get_all(world: WorldStorage) -> Span<HyperstructureResourceConfig> {
        let mut all_tier_configs: Array<HyperstructureResourceConfig> = array![];
        let mut tier = ResourceTiers::LORDS; // lords is the first tier == 1
        while (tier <= ResourceTiers::MYTHIC) { // mythic is the last tier == 9
            let hyperstructure_resource_config: HyperstructureResourceConfig = world
                .read_model((HYPERSTRUCTURE_CONFIG_ID, tier));
            all_tier_configs.append(hyperstructure_resource_config);
            tier += 1;
        };
        return all_tier_configs.span();
    }


    fn get_required_amount(self: @HyperstructureResourceConfig, randomness: u256) -> u128 {
        if *self.min_amount == *self.max_amount {
            return *self.min_amount;
        }
        let min_amount: u256 = (*self.min_amount).into();
        let max_amount: u256 = (*self.max_amount).into();
        let additional_amount = randomness % (max_amount - min_amount);
        return (min_amount + additional_amount).try_into().unwrap();
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestConfig {
    #[key]
    config_id: ID,
    production_material_multiplier: u16,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestRewardConfig {
    #[key]
    quest_id: ID,
    detached_resource_id: ID,
    detached_resource_count: u32
}


#[dojo::model]
#[derive(IntrospectPacked, Copy, Drop, Serde)]
struct ResourceBridgeConfig {
    #[key]
    config_id: ID,
    deposit_paused: bool,
    withdraw_paused: bool,
}

#[dojo::model]
#[derive(IntrospectPacked, Copy, Drop, Serde)]
struct ResourceBridgeFeeSplitConfig {
    #[key]
    config_id: ID,
    // the percentage of the deposit and withdrawal amount that the velords addr will receive
    velords_fee_on_dpt_percent: u16,
    velords_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the season pool will receive
    season_pool_fee_on_dpt_percent: u16,
    season_pool_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the frontend provider will receive
    client_fee_on_dpt_percent: u16,
    client_fee_on_wtdr_percent: u16,
    // the address that will receive the velords fee percentage
    velords_fee_recipient: ContractAddress,
    // the address that will receive the season pool fee
    season_pool_fee_recipient: ContractAddress,
    // max bank fee amount
    max_bank_fee_dpt_percent: u16,
    max_bank_fee_wtdr_percent: u16,
}


#[dojo::model]
#[derive(Copy, Drop, Serde)]
struct ResourceBridgeWhitelistConfig {
    #[key]
    token: ContractAddress,
    resource_type: u8
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
