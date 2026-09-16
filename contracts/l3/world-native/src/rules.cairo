pub const RESOURCE_PRECISION: u128 = 1000000000;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TroopDamageConfig {
    pub damage_raid_percent_num: u16,
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

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
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
    pub stamina_defense_req: u16, // Minimum stamina required for effecttive defense
    // Exploration and travel stamina costs
    pub stamina_explore_stamina_cost: u16,
    pub stamina_travel_stamina_cost: u16,
    // Exploration food costs
    pub stamina_explore_wheat_cost: u32,
    pub stamina_explore_fish_cost: u32,
    // Travel food costs
    pub stamina_travel_wheat_cost: u32,
    pub stamina_travel_fish_cost: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TroopLimitConfig {
    // Guard specific settings
    pub guard_resurrection_delay: u16,
    // Mercenary bounds without precision
    pub mercenaries_troop_lower_bound: u16,
    // without precision
    pub mercenaries_troop_upper_bound: u16,
    // Agents bounds without precision
    pub agents_troop_lower_bound: u16,
    // without precision
    pub agents_troop_upper_bound: u16,
    // Deployment caps per structure level (without precision)
    // Max_Army_Size = (Deployment_Cap / Tier_Strength) * Tier_Modifier / 100
    pub settlement_deployment_cap: u32,
    pub city_deployment_cap: u32,
    pub kingdom_deployment_cap: u32,
    pub empire_deployment_cap: u32,
    // Tier strength: T1=1, T2=3, T3=9
    pub t1_tier_strength: u8,
    pub t2_tier_strength: u8,
    pub t3_tier_strength: u8,
    // Tier modifier (x100): T1=50 (0.5), T2=100 (1.0), T3=150 (1.5)
    pub t1_tier_modifier: u8,
    pub t2_tier_modifier: u8,
    pub t3_tier_modifier: u8,
}


#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct BiomeClimateConfig {
    pub elevation_scale_bps: u16,
    pub moisture_scale_bps: u16,
    pub elevation_bias_bps: u16,
    pub moisture_bias_bps: u16,
    pub elevation_seed: u32,
    pub moisture_seed: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MapConfig {
    pub reward_resource_amount: u16,
    pub shards_mines_win_probability: u16,
    pub shards_mines_fail_probability: u16,
    pub agent_discovery_prob: u16,
    pub agent_discovery_fail_prob: u16,
    pub camp_win_probability: u16,
    pub camp_fail_probability: u16,
    // Reserved: removing these shifts the packed map config of existing games.
    pub holysite_win_probability: u16,
    pub holysite_fail_probability: u16,
    pub bitcoin_mine_win_probability: u16, // 1/50 = 2% = 200 (out of 10000)
    pub bitcoin_mine_fail_probability: u16, // 9800
    pub hyps_win_prob: u32,
    pub hyps_fail_prob: u32,
    // fail probability increase per hex distance from center
    pub hyps_fail_prob_increase_p_hex: u16,
    // fail probability increase per hyperstructure found
    pub hyps_fail_prob_increase_p_fnd: u16,
    // Relic discovery
    pub relic_discovery_interval_sec: u16,
    pub relic_hex_dist_from_center: u8,
    pub relic_chest_relics_per_chest: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TickConfig {
    pub armies_tick_in_seconds: u64,
    pub delivery_tick_in_seconds: u64,
    pub bitcoin_phase_in_seconds: u64 // 600 = 10 minutes
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct CapacityConfig {
    pub structure_capacity: u128, // grams // deprecated
    pub troop_capacity: u32, // grams
    pub donkey_capacity: u32, // grams
    pub storehouse_boost_capacity: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct StructureCapacityConfig {
    pub realm_capacity: u64, // grams
    pub village_capacity: u64, // grams
    pub hyperstructure_capacity: u64, // grams
    pub fragment_mine_capacity: u64, // grams
    pub bank_structure_capacity: u64,
    pub holysite_capacity: u64, // Reserved for stored presets.
    pub camp_capacity: u64, // grams
    pub bitcoin_mine_capacity: u64 // grams
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct BitcoinMineConfig {
    pub enabled: bool,
    pub prize_per_phase: u128, // Amount of SATOSHI awarded per phase
    pub min_labor_per_contribution: u128, // Minimum labor required per contribution
    pub owner_cut_bps: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct BuildingConfig {
    pub base_population: u32,
    pub base_cost_percent_increase: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct VictoryPointsGrantConfig {
    pub hyp_points_per_second: u32,
    // Only granted when claim hyperstructure from bandits
    pub claim_hyperstructure_points: u32,
    // Only granted when claim non hyperstructure from bandits
    pub claim_otherstructure_points: u32,
    pub explore_tiles_points: u32,
    pub relic_open_points: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SliceRules {
    pub battle_config: BattleConfig,
    pub map_config: MapConfig,
    pub biome_climate_config: BiomeClimateConfig,
    pub tick_config: TickConfig,
    pub troop_damage_config: TroopDamageConfig,
    pub troop_stamina_config: TroopStaminaConfig,
    pub troop_limit_config: TroopLimitConfig,
    pub capacity_config: CapacityConfig,
    pub structure_capacity_config: StructureCapacityConfig,
    pub building_config: BuildingConfig,
    pub bitcoin_mine_config: BitcoinMineConfig,
    pub victory_points_grant_config: VictoryPointsGrantConfig,
    pub map_center_offset: u32,
    pub spire_travel_essence_cost: u128,
    pub blitz_mode_on: bool,
    pub faith_enabled: bool,
    pub speed_config: SpeedConfig,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct BattleConfig {
    pub regular_immunity_ticks: u8,
    pub village_immunity_ticks: u8,
    pub village_raid_immunity_ticks: u8,
}

// Each word holds consecutive fields without crossing a 128-bit boundary.
#[derive(Copy, Drop, starknet::Store)]
pub struct PackedRuleWords {
    pub first: u128,
    pub second: u128,
    pub third: u128,
}

pub impl TroopStaminaConfigPacking of starknet::storage_access::StorePacking<TroopStaminaConfig, PackedRuleWords> {
    fn pack(value: TroopStaminaConfig) -> PackedRuleWords {
        PackedRuleWords {
            first: value.stamina_gain_per_tick.into()
                + value.stamina_initial.into() * 0x10000
                + value.stamina_bonus_value.into() * 0x100000000
                + value.stamina_knight_max.into() * 0x1000000000000
                + value.stamina_paladin_max.into() * 0x10000000000000000
                + value.stamina_crossbowman_max.into() * 0x100000000000000000000
                + value.stamina_attack_req.into() * 0x1000000000000000000000000
                + value.stamina_defense_req.into() * 0x10000000000000000000000000000,
            second: value.stamina_explore_stamina_cost.into()
                + value.stamina_travel_stamina_cost.into() * 0x10000
                + value.stamina_explore_wheat_cost.into() * 0x100000000
                + value.stamina_explore_fish_cost.into() * 0x10000000000000000
                + value.stamina_travel_wheat_cost.into() * 0x1000000000000000000000000,
            third: value.stamina_travel_fish_cost.into(),
        }
    }
    fn unpack(value: PackedRuleWords) -> TroopStaminaConfig {
        TroopStaminaConfig {
            stamina_gain_per_tick: (value.first % 0x10000).try_into().unwrap(),
            stamina_initial: (value.first / 0x10000 % 0x10000).try_into().unwrap(),
            stamina_bonus_value: (value.first / 0x100000000 % 0x10000).try_into().unwrap(),
            stamina_knight_max: (value.first / 0x1000000000000 % 0x10000).try_into().unwrap(),
            stamina_paladin_max: (value.first / 0x10000000000000000 % 0x10000).try_into().unwrap(),
            stamina_crossbowman_max: (value.first / 0x100000000000000000000 % 0x10000).try_into().unwrap(),
            stamina_attack_req: (value.first / 0x1000000000000000000000000 % 0x10000).try_into().unwrap(),
            stamina_defense_req: (value.first / 0x10000000000000000000000000000).try_into().unwrap(),
            stamina_explore_stamina_cost: (value.second % 0x10000).try_into().unwrap(),
            stamina_travel_stamina_cost: (value.second / 0x10000 % 0x10000).try_into().unwrap(),
            stamina_explore_wheat_cost: (value.second / 0x100000000 % 0x100000000).try_into().unwrap(),
            stamina_explore_fish_cost: (value.second / 0x10000000000000000 % 0x100000000).try_into().unwrap(),
            stamina_travel_wheat_cost: (value.second / 0x1000000000000000000000000).try_into().unwrap(),
            stamina_travel_fish_cost: (value.third % 0x100000000).try_into().unwrap(),
        }
    }
}

pub impl TroopLimitConfigPacking of starknet::storage_access::StorePacking<TroopLimitConfig, PackedRuleWords> {
    fn pack(value: TroopLimitConfig) -> PackedRuleWords {
        PackedRuleWords {
            first: value.guard_resurrection_delay.into()
                + value.mercenaries_troop_lower_bound.into() * 0x10000
                + value.mercenaries_troop_upper_bound.into() * 0x100000000
                + value.agents_troop_lower_bound.into() * 0x1000000000000
                + value.agents_troop_upper_bound.into() * 0x10000000000000000
                + value.settlement_deployment_cap.into() * 0x100000000000000000000,
            second: value.city_deployment_cap.into()
                + value.kingdom_deployment_cap.into() * 0x100000000
                + value.empire_deployment_cap.into() * 0x10000000000000000
                + value.t1_tier_strength.into() * 0x1000000000000000000000000
                + value.t2_tier_strength.into() * 0x100000000000000000000000000
                + value.t3_tier_strength.into() * 0x10000000000000000000000000000
                + value.t1_tier_modifier.into() * 0x1000000000000000000000000000000,
            third: value.t2_tier_modifier.into() + value.t3_tier_modifier.into() * 0x100,
        }
    }
    fn unpack(value: PackedRuleWords) -> TroopLimitConfig {
        TroopLimitConfig {
            guard_resurrection_delay: (value.first % 0x10000).try_into().unwrap(),
            mercenaries_troop_lower_bound: (value.first / 0x10000 % 0x10000).try_into().unwrap(),
            mercenaries_troop_upper_bound: (value.first / 0x100000000 % 0x10000).try_into().unwrap(),
            agents_troop_lower_bound: (value.first / 0x1000000000000 % 0x10000).try_into().unwrap(),
            agents_troop_upper_bound: (value.first / 0x10000000000000000 % 0x10000).try_into().unwrap(),
            settlement_deployment_cap: (value.first / 0x100000000000000000000 % 0x100000000).try_into().unwrap(),
            city_deployment_cap: (value.second % 0x100000000).try_into().unwrap(),
            kingdom_deployment_cap: (value.second / 0x100000000 % 0x100000000).try_into().unwrap(),
            empire_deployment_cap: (value.second / 0x10000000000000000 % 0x100000000).try_into().unwrap(),
            t1_tier_strength: (value.second / 0x1000000000000000000000000 % 0x100).try_into().unwrap(),
            t2_tier_strength: (value.second / 0x100000000000000000000000000 % 0x100).try_into().unwrap(),
            t3_tier_strength: (value.second / 0x10000000000000000000000000000 % 0x100).try_into().unwrap(),
            t1_tier_modifier: (value.second / 0x1000000000000000000000000000000).try_into().unwrap(),
            t2_tier_modifier: (value.third % 0x100).try_into().unwrap(),
            t3_tier_modifier: (value.third / 0x100 % 0x100).try_into().unwrap(),
        }
    }
}

pub impl MapConfigPacking of starknet::storage_access::StorePacking<MapConfig, PackedRuleWords> {
    fn pack(value: MapConfig) -> PackedRuleWords {
        PackedRuleWords {
            first: value.reward_resource_amount.into()
                + value.shards_mines_win_probability.into() * 0x10000
                + value.shards_mines_fail_probability.into() * 0x100000000
                + value.agent_discovery_prob.into() * 0x1000000000000
                + value.agent_discovery_fail_prob.into() * 0x10000000000000000
                + value.camp_win_probability.into() * 0x100000000000000000000
                + value.camp_fail_probability.into() * 0x1000000000000000000000000
                + value.holysite_win_probability.into() * 0x10000000000000000000000000000,
            second: value.holysite_fail_probability.into()
                + value.bitcoin_mine_win_probability.into() * 0x10000
                + value.bitcoin_mine_fail_probability.into() * 0x100000000
                + value.hyps_win_prob.into() * 0x1000000000000
                + value.hyps_fail_prob.into() * 0x100000000000000000000
                + value.hyps_fail_prob_increase_p_hex.into() * 0x10000000000000000000000000000,
            third: value.hyps_fail_prob_increase_p_fnd.into()
                + value.relic_discovery_interval_sec.into() * 0x10000
                + value.relic_hex_dist_from_center.into() * 0x100000000
                + value.relic_chest_relics_per_chest.into() * 0x10000000000,
        }
    }
    fn unpack(value: PackedRuleWords) -> MapConfig {
        MapConfig {
            reward_resource_amount: (value.first % 0x10000).try_into().unwrap(),
            shards_mines_win_probability: (value.first / 0x10000 % 0x10000).try_into().unwrap(),
            shards_mines_fail_probability: (value.first / 0x100000000 % 0x10000).try_into().unwrap(),
            agent_discovery_prob: (value.first / 0x1000000000000 % 0x10000).try_into().unwrap(),
            agent_discovery_fail_prob: (value.first / 0x10000000000000000 % 0x10000).try_into().unwrap(),
            camp_win_probability: (value.first / 0x100000000000000000000 % 0x10000).try_into().unwrap(),
            camp_fail_probability: (value.first / 0x1000000000000000000000000 % 0x10000).try_into().unwrap(),
            holysite_win_probability: (value.first / 0x10000000000000000000000000000).try_into().unwrap(),
            holysite_fail_probability: (value.second % 0x10000).try_into().unwrap(),
            bitcoin_mine_win_probability: (value.second / 0x10000 % 0x10000).try_into().unwrap(),
            bitcoin_mine_fail_probability: (value.second / 0x100000000 % 0x10000).try_into().unwrap(),
            hyps_win_prob: (value.second / 0x1000000000000 % 0x100000000).try_into().unwrap(),
            hyps_fail_prob: (value.second / 0x100000000000000000000 % 0x100000000).try_into().unwrap(),
            hyps_fail_prob_increase_p_hex: (value.second / 0x10000000000000000000000000000).try_into().unwrap(),
            hyps_fail_prob_increase_p_fnd: (value.third % 0x10000).try_into().unwrap(),
            relic_discovery_interval_sec: (value.third / 0x10000 % 0x10000).try_into().unwrap(),
            relic_hex_dist_from_center: (value.third / 0x100000000 % 0x100).try_into().unwrap(),
            relic_chest_relics_per_chest: (value.third / 0x10000000000 % 0x100).try_into().unwrap(),
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct SpeedConfig {
    pub donkey_sec_per_km: u16,
    pub donkey_sec_per_km_troops: u16,
}
