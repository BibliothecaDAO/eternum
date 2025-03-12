use core::num::traits::zero::Zero;
use cubit::f128::math::trig::{cos as fixed_cos, sin as fixed_sin};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::model::{Model, ModelStorage};
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::{ResourceTiers, WORLD_CONFIG_ID};

use s1_eternum::models::position::Coord;

use s1_eternum::utils::map::constants::fixed_constants as fc;
use s1_eternum::utils::random::VRFImpl;
use starknet::ContractAddress;

//
// GLOBAL CONFIGS
//

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WorldConfig {
    #[key]
    pub config_id: ID,
    pub admin_address: ContractAddress,
    pub vrf_provider_address: ContractAddress,
    pub season_addresses_config: SeasonAddressesConfig,
    pub hyperstructure_config: HyperstructureConfig,
    pub speed_config: SpeedConfig,
    pub map_config: MapConfig,
    pub settlement_config: SettlementConfig,
    pub tick_config: TickConfig,
    pub bank_config: BankConfig,
    pub resource_bridge_config: ResourceBridgeConfig,
    pub res_bridge_fee_split_config: ResourceBridgeFeeSplitConfig,
    pub structure_max_level_config: StructureMaxLevelConfig,
    pub building_config: BuildingConfig,
    pub troop_damage_config: TroopDamageConfig,
    pub troop_stamina_config: TroopStaminaConfig,
    pub troop_limit_config: TroopLimitConfig,
    pub capacity_config: CapacityConfig,
    pub trade_config: TradeConfig,
    pub battle_config: BattleConfig,
    pub realm_count: RealmCountConfig,
    pub season_config: SeasonConfig,
    pub agent_controller_config: AgentControllerConfig,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct AgentControllerConfig {
    pub address: ContractAddress,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SeasonConfig {
    pub start_settling_at: u64,
    pub start_main_at: u64,
    pub end_at: u64,
    pub end_grace_seconds: u32,
}

#[generate_trait]
pub impl SeasonConfigImpl of SeasonConfigTrait {
    fn get(world: WorldStorage) -> SeasonConfig {
        WorldConfigUtilImpl::get_member(world, selector!("season_config"))
    }

    fn has_ended(self: SeasonConfig) -> bool {
        self.end_at.is_non_zero()
    }

    fn has_settling_started(self: SeasonConfig) -> bool {
        let now = starknet::get_block_timestamp();
        now >= self.start_settling_at
    }

    fn has_main_started(self: SeasonConfig) -> bool {
        let now = starknet::get_block_timestamp();
        now >= self.start_main_at
    }


    fn assert_started_settling(self: SeasonConfig) {
        let now = starknet::get_block_timestamp();
        assert!(
            self.has_settling_started(),
            "You will be able to settle your realm or village in {} hours {} minutes, {} seconds",
            (self.start_settling_at - now) / 60 / 60,
            ((self.start_settling_at - now) / 60) % 60,
            (self.start_settling_at - now) % 60,
        );
    }


    fn assert_started_main(self: SeasonConfig) {
        let now = starknet::get_block_timestamp();
        assert!(
            self.has_main_started() && self.has_settling_started(),
            "The game starts in {} hours {} minutes, {} seconds",
            (self.start_main_at - now) / 60 / 60,
            ((self.start_main_at - now) / 60) % 60,
            (self.start_main_at - now) % 60,
        );
    }
    fn assert_settling_started_and_not_over(self: SeasonConfig) {
        self.assert_started_settling();
        assert!(!self.has_ended(), "Season is over");
    }

    fn assert_started_and_not_over(self: SeasonConfig) {
        self.assert_started_main();
        assert!(!self.has_ended(), "Season is over");
    }

    fn assert_settling_started_and_grace_period_not_elapsed(self: SeasonConfig) {
        self.assert_started_settling();
        if self.has_ended() {
            let now = starknet::get_block_timestamp();
            assert!(now <= self.end_at + self.end_grace_seconds.into(), "The Game is Over");
        }
    }
    fn assert_main_game_started_and_grace_period_not_elapsed(self: SeasonConfig) {
        self.assert_started_main();
        if self.has_ended() {
            let now = starknet::get_block_timestamp();
            assert!(now <= self.end_at + self.end_grace_seconds.into(), "The Game is Over");
        }
    }

    fn end_season(ref world: WorldStorage) {
        let season_config_selector = selector!("season_config");
        let mut season_config: SeasonConfig = WorldConfigUtilImpl::get_member(world, season_config_selector);
        // ensure season is not over
        assert!(season_config.has_ended() == false, "Season is over");
        // set season as over
        season_config.end_at = starknet::get_block_timestamp();
        WorldConfigUtilImpl::set_member(ref world, season_config_selector, season_config);
    }
}

#[generate_trait]
pub impl WorldConfigUtilImpl of WorldConfigTrait {
    fn get_member<T, impl TSerde: Serde<T>>(world: WorldStorage, selector: felt252) -> T {
        world.read_member(Model::<WorldConfig>::ptr_from_keys(WORLD_CONFIG_ID), selector)
    }
    fn set_member<T, impl TSerde: Serde<T>, impl TDrop: Drop<T>>(ref world: WorldStorage, selector: felt252, value: T) {
        world.write_member(Model::<WorldConfig>::ptr_from_keys(WORLD_CONFIG_ID), selector, value)
    }
}


#[derive(Introspect, Copy, Drop, Serde)]
pub struct TradeConfig {
    pub max_count: u8,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SeasonAddressesConfig {
    pub season_pass_address: ContractAddress,
    pub realms_address: ContractAddress,
    pub lords_address: ContractAddress,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct HyperstructureResourceConfig {
    #[key]
    pub resource_tier: u8,
    pub min_amount: u128,
    pub max_amount: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct HyperstructureConfig {
    pub points_per_cycle: u128,
    pub points_for_win: u128,
    pub points_on_completion: u128,
    pub time_between_shares_change: u64,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct CapacityConfig {
    pub structure_capacity: u128, // grams
    pub troop_capacity: u32, // grams
    pub donkey_capacity: u32, // grams
    pub storehouse_boost_capacity: u32,
}

// speed
#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SpeedConfig {
    pub donkey_sec_per_km: u16,
}

#[generate_trait]
pub impl SpeedImpl of SpeedTrait {
    fn for_donkey(ref world: WorldStorage) -> u16 {
        let speed_config: SpeedConfig = WorldConfigUtilImpl::get_member(world, selector!("speed_config"));
        speed_config.donkey_sec_per_km
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct MapConfig {
    pub reward_resource_amount: u16,
    pub shards_mines_win_probability: u16,
    pub shards_mines_fail_probability: u16,
    pub agent_discovery_prob: u16,
    pub agent_discovery_fail_prob: u16,
    pub hyps_win_prob: u32,
    pub hyps_fail_prob: u32,
    // fail probability increase per hex distance from center
    pub hyps_fail_prob_increase_p_hex: u16,
    // fail probability increase per hyperstructure found
    pub hyps_fail_prob_increase_p_fnd: u16,
    // Mine discovery rewards
    pub mine_wheat_grant_amount: u32,
    pub mine_fish_grant_amount: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct SettlementConfig {
    pub center: u32,
    pub base_distance: u32,
    pub subsequent_distance: u32,
}

#[derive(Introspect, Copy, Drop, Serde)]
pub struct RealmCountConfig {
    pub count: u16,
}


#[generate_trait]
pub impl SettlementConfigImpl of SettlementConfigTrait {
    #[test]
    fn log_layer_capacity() { // // Get the current realm count
    // let realm_count: u16 =  8000;
    // // Calculate the maximum layer based on realm count
    // // We need to find n where 3n² - 3n + 1 >= realm_count
    // // Solving the quadratic equation: 3n² - 3n - (realm_count - 1) >= 0

    // // Start from layer 1 and find the first layer that can accommodate all realms
    // let mut layer: u32 = 1;
    // let mut capacity: u32 = 5; // Layer 1 capacity
    // println!("Layer: 1, Capacity: 5, Added Capacity: 5");

    // while capacity < realm_count.into() {
    //     layer += 1;
    //     // Each new layer adds 6 * layer realms
    //     capacity += 6 * layer;
    //     println!("Layer: {}, Capacity: {}, Added Capacity: {}", layer, capacity, 6 * layer);

    // };

    // println!("Max layer: {}", layer);
    }

    // Calculate the maximum layer on the concentric hexagon
    // that can be built on based on realm count
    fn max_layer(realm_count: u32) -> u32 {
        // each layer's capacity can be obtained by calling the function
        // above (fn log_layer_capacity)

        if realm_count <= 1500 {
            return 26; // 2105 capacity
        }

        if realm_count <= 2500 {
            return 32; // 3167 capacity
        }

        if realm_count <= 3500 {
            return 37; // 4217 capacity
        }

        if realm_count <= 4500 {
            return 41; // 5165 capacity
        }

        if realm_count <= 5500 {
            return 45; // 6209 capacity
        }

        if realm_count <= 6500 {
            return 49; // 7349 capacity
        }

        return 52; // 8267 capacity
    }

    fn layer_distance_from_center(self: SettlementConfig, layer: u32) -> u32 {
        self.base_distance + (layer - 1) * self.subsequent_distance
    }

    fn max_side_points(side: u32, layer: u32) -> u32 {
        if side > 0 {
            layer
        } else {
            layer - 1
        }
    }

    fn side_coordinate(self: SettlementConfig, side: u32, distance_from_center: u32) -> (Fixed, Fixed) {
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

    // todo: test aggresively
    fn generate_coord(self: SettlementConfig, max_layer: u32, side: u32, layer: u32, point: u32) -> Coord {
        assert!(side < 6, "Side must be less than 6"); // 0 - 5
        assert!(layer > 0, "Layer must be greater than 0");
        assert!(layer <= max_layer, "Layer must be less than max layer");
        assert!(point <= Self::max_side_points(side, layer), "Point must be less than max side points");

        let distance_from_center = Self::layer_distance_from_center(self, layer);
        let (start_x_fixed, start_y_fixed) = Self::side_coordinate(self, side, distance_from_center);
        let next_side = (side + 1) % 6;
        let max_points_on_side = Self::max_side_points(side, layer);
        let pos_percentage_fixed = FixedTrait::new_unscaled(point.into() + 1, false)
            / FixedTrait::new_unscaled(max_points_on_side.into() + 1, false);
        let (end_x_fixed, end_y_fixed) = Self::side_coordinate(self, next_side, distance_from_center);
        let x_fixed = start_x_fixed + (end_x_fixed - start_x_fixed) * pos_percentage_fixed;
        let y_fixed = start_y_fixed + (end_y_fixed - start_y_fixed) * pos_percentage_fixed;
        Coord { x: x_fixed.try_into().unwrap(), y: y_fixed.try_into().unwrap() }
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct TickConfig {
    pub armies_tick_in_seconds: u64,
}


// todo: regroup meaningfully to avoid retrieving too many fields
#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
pub struct TroopDamageConfig {
    // Combat modifiers. Used for biome damage calculations
    pub damage_biome_bonus_num: u16,
    // Used in damage calculations for troop scaling
    pub damage_beta_small: u64, // Fixed
    pub damage_beta_large: u64, // Fixed
    pub damage_scaling_factor: u128,
    pub damage_c0: u128, // Fixed
    pub damage_delta: u128, // Fixed
    pub t1_damage_value: u128,
    pub t2_damage_multiplier: u128, // Fixed
    pub t3_damage_multiplier: u128,
}

#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
pub struct TroopStaminaConfig {
    // Base stamina settings
    pub stamina_gain_per_tick: u16, // Stamina gained per tick
    pub stamina_initial: u16, // Initial stamina for explorers
    pub stamina_bonus_value: u16, // Used for stamina movement bonuses
    // Max stamina per troop type
    pub stamina_knight_max: u16, // Maximum stamina for knights
    pub stamina_paladin_max: u16, // Maximum stamina for paladins
    pub stamina_crossbowman_max: u16, // Maximum stamina for crossbowmen
    // Combat stamina requirements
    pub stamina_attack_req: u16, // Minimum stamina required to attack
    pub stamina_attack_max: u16, // Maximum stamina that can be used in attack
    // Exploration costs
    pub stamina_explore_wheat_cost: u16,
    pub stamina_explore_fish_cost: u16,
    pub stamina_explore_stamina_cost: u16,
    // Travel costs
    pub stamina_travel_wheat_cost: u16,
    pub stamina_travel_fish_cost: u16,
    pub stamina_travel_stamina_cost: u16,
}


#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
pub struct TroopLimitConfig {
    // Maximum number of explorers allowed per structure
    pub explorer_max_party_count: u8,
    // Troop count per army limits without precision
    // Applies to both explorers and guards
    pub explorer_guard_max_troop_count: u32,
    // Guard specific settings
    pub guard_resurrection_delay: u32,
    // Mercenary bounds without precision
    pub mercenaries_troop_lower_bound: u32,
    // without precision
    pub mercenaries_troop_upper_bound: u32,
    // Agents bounds without precision
    pub agents_troop_lower_bound: u32,
    // without precision
    pub agents_troop_upper_bound: u32,
}


#[generate_trait]
pub impl CombatConfigImpl of CombatConfigTrait {
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
pub impl TickImpl of TickTrait {
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
    pub resource_type: u8,
    pub weight_gram: u128,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
// rename to ResourceFactoryConfig
pub struct ProductionConfig {
    #[key]
    pub resource_type: u8,
    // production amount per building, per tick for realm
    pub realm_output_per_tick: u64,
    // production amount per building, per tick for village
    pub village_output_per_tick: u64,
    // values needed for converting resources to labor and vice versa
    pub labor_burn_strategy: LaborBurnPrStrategy,
    // values needed for converting multiple resources to a single resource
    pub multiple_resource_burn_strategy: MultipleResourceBurnPrStrategy,
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
    pub resource_rarity: u128,
    /// Amount of wheat to burn per labor
    pub wheat_burn_per_labor: u128,
    /// Amount of fish to burn per labor
    pub fish_burn_per_labor: u128,
    /// Numerator of the depreciation percentage fraction.
    pub depreciation_percent_num: u16,
    /// Denominator of the depreciation percentage fraction.
    pub depreciation_percent_denom: u16,
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
    pub required_resources_id: ID,
    /// Number of different resource types needed
    pub required_resources_count: u8,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct BankConfig {
    pub lp_fee_num: u32,
    pub lp_fee_denom: u32,
    pub owner_fee_num: u32,
    pub owner_fee_denom: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct BuildingConfig {
    pub base_population: u32,
    pub base_cost_percent_increase: u16,
}


#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct BuildingCategoryConfig {
    #[key]
    pub category: u8,
    pub erection_cost_id: ID,
    pub erection_cost_count: u32,
    pub population_cost: u32,
    pub capacity_grant: u32,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct BattleConfig {
    pub regular_immunity_ticks: u8,
    pub hyperstructure_immunity_ticks: u8,
}

#[generate_trait]
pub impl BattleConfigImpl of BattleConfigTrait {
    fn get(ref world: WorldStorage) -> BattleConfig {
        WorldConfigUtilImpl::get_member(world, selector!("battle_config"))
    }
}

#[generate_trait]
pub impl HyperstructureResourceConfigImpl of HyperstructureResourceConfigTrait {
    fn get_all(world: WorldStorage) -> Span<HyperstructureResourceConfig> {
        let mut all_tier_configs: Array<HyperstructureResourceConfig> = array![];
        let mut tier = ResourceTiers::LORDS; // lords is the first tier == 1
        while (tier <= ResourceTiers::MYTHIC) { // mythic is the last tier == 9
            let hyperstructure_resource_config: HyperstructureResourceConfig = world.read_model(tier);
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
pub struct StartingResourcesConfig {
    #[key]
    pub resource_type: u8,
    pub resource_amount: u128,
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct ResourceBridgeConfig {
    pub deposit_paused: bool,
    pub withdraw_paused: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct ResourceBridgeFeeSplitConfig {
    // the percentage of the deposit and withdrawal amount that the velords addr will receive
    pub velords_fee_on_dpt_percent: u16,
    pub velords_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the season pool will receive
    pub season_pool_fee_on_dpt_percent: u16,
    pub season_pool_fee_on_wtdr_percent: u16,
    // the percentage of the deposit and withdrawal amount that the frontend provider will receive
    pub client_fee_on_dpt_percent: u16,
    pub client_fee_on_wtdr_percent: u16,
    // max bank fee amount
    pub realm_fee_dpt_percent: u16,
    pub realm_fee_wtdr_percent: u16,
    // the address that will receive the velords fee percentage
    pub velords_fee_recipient: ContractAddress,
    // the address that will receive the season pool fee
    pub season_pool_fee_recipient: ContractAddress,
}


#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct ResourceBridgeWhitelistConfig {
    #[key]
    pub token: ContractAddress,
    pub resource_type: u8,
}

// speed
#[derive(IntrospectPacked, Copy, Drop, Serde)]
pub struct StructureMaxLevelConfig {
    pub realm_max: u8,
    pub village_max: u8,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct StructureLevelConfig {
    #[key]
    pub level: u8,
    pub required_resources_id: ID,
    pub required_resource_count: u8,
}
