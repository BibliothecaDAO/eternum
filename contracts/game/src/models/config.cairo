use core::integer::BoundedU128;
use cubit::f128::math::comp::{max as fixed_max};
use cubit::f128::math::trig::{cos as fixed_cos, sin as fixed_sin};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::model::{Model, ModelStorage};
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{
    BUILDING_CATEGORY_POPULATION_CONFIG_ID, HYPERSTRUCTURE_CONFIG_ID, RESOURCE_PRECISION, ResourceTiers, ResourceTypes,
    WORLD_CONFIG_ID, split_resources_and_probs,
};
use s1_eternum::models::owner::{EntityOwner, EntityOwnerTrait};
use s1_eternum::models::position::{Coord};
use s1_eternum::models::quantity::Quantity;
use s1_eternum::models::resource::production::building::BuildingCategory;

use s1_eternum::models::season::{Season, SeasonImpl, SeasonTrait};
use s1_eternum::utils::map::constants::fixed_constants as fc;
use s1_eternum::utils::math::{max, min};
use s1_eternum::utils::random;
use s1_eternum::utils::random::VRFImpl;
use starknet::ContractAddress;

//
// GLOBAL CONFIGS
//

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldConfig {
    #[key]
    config_id: ID,
    admin_address: ContractAddress,
    vrf_provider_address: ContractAddress,
    season_addresses_config: SeasonAddressesConfig,
    season_bridge_config: SeasonBridgeConfig,
    hyperstructure_config: HyperstructureConfig,
    speed_config: SpeedConfig,
    map_config: MapConfig,
    settlement_config: SettlementConfig,
    tick_config: TickConfig,
    bank_config: BankConfig,
    population_config: PopulationConfig,
    resource_bridge_config: ResourceBridgeConfig,
    res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig,
    realm_max_level_config: RealmMaxLevelConfig,
    building_general_config: BuildingGeneralConfig,
    troop_damage_config: TroopDamageConfig,
    troop_stamina_config: TroopStaminaConfig,
    troop_limit_config: TroopLimitConfig,
    capacity_config: CapacityConfig,
    trade_count_config: TradeCountConfig,
}

#[generate_trait]
impl WorldConfigUtilImpl of WorldConfigTrait {
    fn get_member<T, impl TSerde: Serde<T>>(world: WorldStorage, selector: felt252) -> T {
        world.read_member(Model::<WorldConfig>::ptr_from_keys(WORLD_CONFIG_ID), selector)
    }
    fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>>(ref world: WorldStorage, selector: felt252, value: T) {
        world.write_member(Model::<WorldConfig>::ptr_from_keys(WORLD_CONFIG_ID), selector, value)
    }
}


#[derive(Introspect, Copy, Drop, Serde)]
pub struct TradeCountConfig {
    max_count: u8,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SeasonAddressesConfig {
    season_pass_address: ContractAddress,
    realms_address: ContractAddress,
    lords_address: ContractAddress,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SeasonBridgeConfig {
    close_after_end_seconds: u64,
}

#[generate_trait]
impl SeasonBridgeConfigImpl of SeasonBridgeConfigTrait {
    fn assert_bridge_is_open(self: SeasonBridgeConfig, world: WorldStorage) {
        // ensure season has started
        let season: Season = world.read_model(WORLD_CONFIG_ID);
        season.assert_has_started();

        // check if season is over
        if season.ended_at.is_non_zero() {
            // close bridge after grace period has elapsed
            let now = starknet::get_block_timestamp();
            assert!(now <= season.ended_at + self.close_after_end_seconds, "Bridge is closed");
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
pub struct HyperstructureConfig {
    points_per_cycle: u128,
    points_for_win: u128,
    points_on_completion: u128,
    time_between_shares_change: u64,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct CapacityConfig {
    structure_capacity: u32, // grams
    troop_capacity: u32, // grams
    donkey_capacity: u32, // grams
    storehouse_boost_capacity: u32,
}

// speed
#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SpeedConfig {
    donkey_sec_per_km: u16,
}

#[generate_trait]
impl SpeedImpl of SpeedTrait {
    fn for_donkey(ref world: WorldStorage) -> u16 {
        let speed_config: SpeedConfig = WorldConfigUtilImpl::get_member(world, selector!("speed_config"));
        speed_config.donkey_sec_per_km
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct MapConfig {
    reward_resource_amount: u128,
    // weight of fail
    // the higher, the less likely to find a mine
    // weight of sucess = 1000
    // ex: if set to 5000
    shards_mines_fail_probability: u128,
    // Mine discovery rewards
    mine_wheat_grant_amount: u128,
    mine_fish_grant_amount: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SettlementConfig {
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

        let vrf_provider: ContractAddress = WorldConfigUtilImpl::get_member(world, selector!("vrf_provider_address"));
        let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
        let reward_resource_id: u8 = *random::choices(
            resource_types, resources_probs, array![].span(), 1, true, vrf_seed,
        )
            .at(0);

        let explore_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
        let reward_resource_amount: u128 = explore_config.reward_resource_amount;
        return array![(reward_resource_id, reward_resource_amount)].span();
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct TickConfig {
    armies_tick_in_seconds: u64,
}


// todo: regroup meaningfully to avoid retrieving too many fields
#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
pub struct TroopDamageConfig {
    // Base damage values for each troop type
    knight_base_damage: u16,
    crossbowman_base_damage: u16,
    paladin_base_damage: u16,
    // Damage bonuses for tiers In the contracts, we do Fixed::ONE * t2_damage_bonus
    t2_damage_bonus: u16,
    // In the contracts, we do Fixed::ONE * t3_damage_bonus
    t3_damage_bonus: u16,
    // Combat modifiers. Used for biome damage calculations
    damage_bonus_num: u16,
    // Used in damage calculations for troop scaling
    damage_scaling_factor: u16,
}

#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
pub struct TroopStaminaConfig {
    // Base stamina settings
    stamina_gain_per_tick: u16, // Stamina gained per tick
    stamina_initial: u16, // Initial stamina for explorers
    stamina_bonus_value: u16, // Used for stamina movement bonuses
    // Max stamina per troop type
    stamina_knight_max: u16, // Maximum stamina for knights
    stamina_paladin_max: u16, // Maximum stamina for paladins
    stamina_crossbowman_max: u16, // Maximum stamina for crossbowmen
    // Combat stamina requirements
    stamina_attack_req: u16, // Minimum stamina required to attack
    stamina_attack_max: u16, // Maximum stamina that can be used in attack
    // Exploration costs
    stamina_explore_wheat_cost: u16,
    stamina_explore_fish_cost: u16,
    stamina_explore_stamina_cost: u16,
    // Travel costs
    stamina_travel_wheat_cost: u16,
    stamina_travel_fish_cost: u16,
    stamina_travel_stamina_cost: u16,
}


#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
pub struct TroopLimitConfig {
    // Maximum number of explorers allowed per structure
    explorer_max_party_count: u8,
    // Troop count per army limits without precision
    explorer_max_troop_count: u32,
    // Guard specific settings
    guard_resurrection_delay: u32,
    // Mercenary bounds without precision
    mercenaries_troop_lower_bound: u64,
    // without precision
    mercenaries_troop_upper_bound: u64,
}


#[generate_trait]
impl CombatConfigImpl of CombatConfigTrait {
    fn troop_damage_config(ref world: WorldStorage) -> TroopDamageConfig {
        return WorldConfigUtilImpl::get_member(world, selector!("troop_damage_config"));
    }

    fn troop_stamina_config(ref world: WorldStorage) -> TroopStaminaConfig {
        return WorldConfigUtilImpl::get_member(world, selector!("troop_stamina_config"));
    }

    fn troop_limit_config(ref world: WorldStorage) -> TroopLimitConfig {
        return WorldConfigUtilImpl::get_member(world, selector!("troop_limit_config"));
    }
}


#[generate_trait]
impl TickImpl of TickTrait {
    fn get_tick_config(ref world: WorldStorage) -> TickConfig {
        let tick_config: TickConfig = WorldConfigUtilImpl::get_member(world, selector!("tick_config"));
        return tick_config;
    }

    fn interval(self: TickConfig) -> u64 {
        self.armies_tick_in_seconds
    }

    fn current(self: TickConfig) -> u64 {
        let now = starknet::get_block_timestamp();
        now / self.interval()
    }

    fn at(self: TickConfig, time: u64) -> u64 {
        time / self.interval()
    }

    fn after(self: TickConfig, time_spent: u64) -> u64 {
        (starknet::get_block_timestamp() + time_spent) / self.interval()
    }

    fn next_tick_timestamp(self: TickConfig) -> u64 {
        self.current() + self.interval()
    }

    fn convert_from_seconds(self: TickConfig, seconds: u64) -> u64 {
        let mut ticks = seconds / self.interval();
        let rem = seconds % self.interval();
        if rem.is_non_zero() {
            ticks += 1;
        }
        ticks
    }
}

// weight
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WeightConfig {
    #[key]
    resource_type: u8,
    weight_gram: u128,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
// rename to ResourceFactoryConfig
pub struct ProductionConfig {
    #[key]
    resource_type: u8,
    // production amount per building, per tick
    amount_per_building_per_tick: u128,
    // values needed for converting resources to labor and vice versa
    labor_burn_strategy: LaborBurnPrStrategy,
    // values needed for converting multiple resources to a single resource
    multiple_resource_burn_strategy: MultipleResourceBurnPrStrategy,
}

/// A strategy for converting resources using a labor-based intermediary system.
/// This system allows for resource conversion while maintaining economic balance
/// through resource rarity and depreciation mechanics.
///
/// # Fields
/// * `resource_rarity` - Defines both the resource's relative value and its labor conversion rate
/// * `depreciation_percent_num` - Numerator of depreciation fraction (e.g., 2 for 20%)
/// * `depreciation_percent_denom` - Denominator of depreciation fraction (e.g., 10 for 20%)
///
/// # Resource to Labor Conversion
/// When converting a resource to labor, the formula is:
/// ```
/// labor_amount = resource_amount * resource_rarity
/// ```
///
/// # Labor to Resource Conversion
/// When converting labor to a resource, the formula includes depreciation:
/// ```
/// resource_amount = labor_amount / target_resource_rarity * (1 - depreciation)
/// ```
///
/// # Example
/// Given the following configuration:
/// ```
/// Resource      Rarity      Depreciation
/// Wood         100         20% (2/10)
/// Gold         1000        10% (1/10)
/// ```
///
/// ## Converting Wood to Gold
/// 1. Convert 3 wood to labor:
///    * Labor = 3 * 100 = 300 labor
/// 2. Convert labor to gold (with 10% depreciation):
///    * Gold = 300 / 1000 * (1 - 1/10) = 0.27 gold
///
/// ## Converting Gold to Wood
/// 1. Convert 7 gold to labor:
///    * Labor = 7 * 1000 = 7000 labor
/// 2. Convert labor to wood (with 20% depreciation):
///    * Wood = 7000 / 100 * (1 - 2/10) = 56 wood
///
/// # Note
/// The depreciation is always applied based on the target resource's depreciation rate,
/// creating an intentional loss in the conversion process
///
#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct LaborBurnPrStrategy {
    /// Represents the resource's rarity and determines labor conversion rate.
    /// Higher values indicate rarer resources that yield more labor when converted.
    resource_rarity: u128,
    /// Amount of wheat to burn per labor
    wheat_burn_per_labor: u128,
    /// Amount of fish to burn per labor
    fish_burn_per_labor: u128,
    /// Numerator of the depreciation percentage fraction.
    depreciation_percent_num: u16,
    /// Denominator of the depreciation percentage fraction.
    depreciation_percent_denom: u16,
}

/// A simple production strategy that requires burning multiple resources to produce output.
///
/// # Fields
/// * `required_resources_id` - ID referencing the list of required input resources
/// * `required_resources_count` - Number of different resources needed for production
///
/// # Example
/// If crafting stone requires:
/// - 2 coal
/// - 1 wood
/// - 1 coldiron
/// Then:
/// - required_resources_id would point to the id of ResourceList
/// - required_resources_count would be 3
///
#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct MultipleResourceBurnPrStrategy {
    /// ID referencing the list of required input resources
    required_resources_id: ID,
    /// Number of different resource types needed
    required_resources_count: u8,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct BankConfig {
    lords_cost: u128,
    lp_fee_num: u128,
    lp_fee_denom: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct BuildingGeneralConfig {
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
                    Into::<u8, felt252>::into(resource_type),
                ),
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
    battle_max_time_seconds: u64,
}


#[generate_trait]
pub impl TroopConfigImpl of TroopConfigTrait {
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
pub impl BattleConfigImpl of BattleConfigTrait {
    fn get(world: WorldStorage) -> BattleConfig {
        world.read_model(WORLD_CONFIG_ID)
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingCategoryPopConfig {
    #[key]
    config_id: ID,
    #[key]
    building_category: BuildingCategory,
    population: u32,
    capacity: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct PopulationConfig {
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
pub struct QuestRewardConfig {
    #[key]
    quest_id: ID,
    resource_list_id: ID,
    resource_list_count: u32,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
struct ResourceBridgeConfig {
    deposit_paused: bool,
    withdraw_paused: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
struct ResourceBridgeFeeSplitConfig {
    // the percentage of the deposit and withdrawal amount that the velords addr will receive
    velords_fee_on_dpt_percent: u16,
    velords_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the season pool will receive
    season_pool_fee_on_dpt_percent: u16,
    season_pool_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the frontend provider will receive
    client_fee_on_dpt_percent: u16,
    client_fee_on_wtdr_percent: u16,
    // max bank fee amount
    max_bank_fee_dpt_percent: u16,
    max_bank_fee_wtdr_percent: u16,
    // the address that will receive the velords fee percentage
    velords_fee_recipient: ContractAddress,
    // the address that will receive the season pool fee
    season_pool_fee_recipient: ContractAddress,
}


#[dojo::model]
#[derive(Copy, Drop, Serde)]
struct ResourceBridgeWhitelistConfig {
    #[key]
    token: ContractAddress,
    resource_type: u8,
}

// speed
#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct RealmMaxLevelConfig {
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
