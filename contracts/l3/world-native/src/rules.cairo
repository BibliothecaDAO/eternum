pub const RESOURCE_PRECISION: u128 = 1000000000;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TroopDamageConfig {
    pub damage_raid_percent_num: u16,
    // Combat modifiers. Used for biome damage calculations
    pub damage_biome_bonus_num: u16,
    // Used in damage calculations for troop scaling
    pub damage_scaling_factor: u128,
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
    pub damage_stamina_refund: bool,
    pub capture_stamina_refund: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TroopLimitConfig {
    // Guard specific settings
    pub guard_resurrection_delay: u16,
    // Mercenary bounds without precision
    pub mercenaries_troop_lower_bound: u16,
    // without precision
    pub mercenaries_troop_upper_bound: u16,
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
    pub settlement_armies: u16,
    pub city_armies: u16,
    pub kingdom_armies: u16,
    pub empire_armies: u16,
    pub settlement_guard_slots: u8,
    pub city_guard_slots: u8,
    pub kingdom_guard_slots: u8,
    pub empire_guard_slots: u8,
    pub starting_guard: u32,
    pub camp_armies: u16,
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
    pub command_mask: u128,
    pub mode_rules: u32,
    pub epoch_seconds: u32,
    pub entry_rule: u8,
    pub faith_enabled: bool,
    pub speed_config: SpeedConfig,
}

pub const ENTRY_ENTITLEMENT: u8 = 0;
pub const ENTRY_OPEN: u8 = 1;
pub const ENTRY_ROSTER: u8 = 2;

pub const HOME_REWARDS: u32 = 1;
pub const DISCOVER_CAMPS: u32 = 2;
pub const DISCOVER_CHESTS: u32 = 4;
pub const DISCOVER_HYPERSTRUCTURES: u32 = 8;
pub const SPIRES: u32 = 16;
pub const UNOWNED_TARGETS: u32 = 32;
pub const CAPTURE_VILLAGES: u32 = 64;
pub const DEPTH_CONTENTS: u32 = 128;
pub const CAPTURE_CHESTS: u32 = 512;
pub const HOME_MINE_PRODUCTION: u32 = 4096;
pub const HOME_CAMP_REWARDS: u32 = 65536;
pub const REVEAL_SUPPLIES: u32 = 262144;
pub const SAME_OWNER_TRANSFER: u32 = 256;
pub const SEASON_CLOSE: u32 = 1024;
pub const RESERVED_HYPERSTRUCTURES: u32 = 2048;
pub const DEV_VILLAGE_ENTRY: u32 = 8192;
pub const OWNER_ONLY_SHARES: u32 = 16384;
pub const HYPERSTRUCTURE_MULTIPLIERS: u32 = 32768;
pub const PRODUCTION_START: u32 = 131072;

pub fn rule_enabled(rules: SliceRules, rule: u32) -> bool {
    rules.mode_rules & rule != 0
}

pub fn command_enabled(mask: u128, index: u128) -> bool {
    // Cairo lowers a dense integer match to a jump table.
    let bit = match index {
        0 => 1_u128,
        1 => 2_u128,
        2 => 4_u128,
        3 => 8_u128,
        4 => 16_u128,
        5 => 32_u128,
        6 => 64_u128,
        7 => 128_u128,
        8 => 256_u128,
        9 => 512_u128,
        10 => 1024_u128,
        11 => 2048_u128,
        12 => 4096_u128,
        13 => 8192_u128,
        14 => 16384_u128,
        15 => 32768_u128,
        16 => 65536_u128,
        17 => 131072_u128,
        18 => 262144_u128,
        19 => 524288_u128,
        20 => 1048576_u128,
        21 => 2097152_u128,
        22 => 4194304_u128,
        23 => 8388608_u128,
        24 => 16777216_u128,
        25 => 33554432_u128,
        26 => 67108864_u128,
        27 => 134217728_u128,
        28 => 268435456_u128,
        29 => 536870912_u128,
        30 => 1073741824_u128,
        31 => 2147483648_u128,
        32 => 4294967296_u128,
        33 => 8589934592_u128,
        34 => 17179869184_u128,
        35 => 34359738368_u128,
        36 => 68719476736_u128,
        37 => 137438953472_u128,
        38 => 274877906944_u128,
        39 => 549755813888_u128,
        40 => 1099511627776_u128,
        41 => 2199023255552_u128,
        42 => 4398046511104_u128,
        43 => 8796093022208_u128,
        44 => 17592186044416_u128,
        45 => 35184372088832_u128,
        46 => 70368744177664_u128,
        47 => 140737488355328_u128,
        48 => 281474976710656_u128,
        49 => 562949953421312_u128,
        50 => 1125899906842624_u128,
        51 => 2251799813685248_u128,
        52 => 4503599627370496_u128,
        53 => 9007199254740992_u128,
        54 => 18014398509481984_u128,
        55 => 36028797018963968_u128,
        56 => 72057594037927936_u128,
        57 => 144115188075855872_u128,
        58 => 288230376151711744_u128,
        59 => 576460752303423488_u128,
        60 => 1152921504606846976_u128,
        61 => 2305843009213693952_u128,
        62 => 4611686018427387904_u128,
        63 => 9223372036854775808_u128,
        64 => 18446744073709551616_u128,
        65 => 36893488147419103232_u128,
        66 => 73786976294838206464_u128,
        67 => 147573952589676412928_u128,
        68 => 295147905179352825856_u128,
        69 => 590295810358705651712_u128,
        70 => 1180591620717411303424_u128,
        71 => 2361183241434822606848_u128,
        72 => 4722366482869645213696_u128,
        73 => 9444732965739290427392_u128,
        74 => 18889465931478580854784_u128,
        75 => 37778931862957161709568_u128,
        76 => 75557863725914323419136_u128,
        77 => 151115727451828646838272_u128,
        78 => 302231454903657293676544_u128,
        79 => 604462909807314587353088_u128,
        80 => 1208925819614629174706176_u128,
        81 => 2417851639229258349412352_u128,
        82 => 4835703278458516698824704_u128,
        83 => 9671406556917033397649408_u128,
        84 => 19342813113834066795298816_u128,
        85 => 38685626227668133590597632_u128,
        86 => 77371252455336267181195264_u128,
        87 => 154742504910672534362390528_u128,
        88 => 309485009821345068724781056_u128,
        89 => 618970019642690137449562112_u128,
        90 => 1237940039285380274899124224_u128,
        91 => 2475880078570760549798248448_u128,
        92 => 4951760157141521099596496896_u128,
        93 => 9903520314283042199192993792_u128,
        94 => 19807040628566084398385987584_u128,
        95 => 39614081257132168796771975168_u128,
        96 => 79228162514264337593543950336_u128,
        97 => 158456325028528675187087900672_u128,
        98 => 316912650057057350374175801344_u128,
        99 => 633825300114114700748351602688_u128,
        100 => 1267650600228229401496703205376_u128,
        101 => 2535301200456458802993406410752_u128,
        102 => 5070602400912917605986812821504_u128,
        103 => 10141204801825835211973625643008_u128,
        104 => 20282409603651670423947251286016_u128,
        105 => 40564819207303340847894502572032_u128,
        106 => 81129638414606681695789005144064_u128,
        107 => 162259276829213363391578010288128_u128,
        108 => 324518553658426726783156020576256_u128,
        109 => 649037107316853453566312041152512_u128,
        110 => 1298074214633706907132624082305024_u128,
        111 => 2596148429267413814265248164610048_u128,
        112 => 5192296858534827628530496329220096_u128,
        113 => 10384593717069655257060992658440192_u128,
        114 => 20769187434139310514121985316880384_u128,
        115 => 41538374868278621028243970633760768_u128,
        116 => 83076749736557242056487941267521536_u128,
        117 => 166153499473114484112975882535043072_u128,
        118 => 332306998946228968225951765070086144_u128,
        119 => 664613997892457936451903530140172288_u128,
        120 => 1329227995784915872903807060280344576_u128,
        121 => 2658455991569831745807614120560689152_u128,
        122 => 5316911983139663491615228241121378304_u128,
        123 => 10633823966279326983230456482242756608_u128,
        124 => 21267647932558653966460912964485513216_u128,
        125 => 42535295865117307932921825928971026432_u128,
        126 => 85070591730234615865843651857942052864_u128,
        127 => 170141183460469231731687303715884105728_u128,
        _ => panic!("invalid command index"),
    };
    mask & bit != 0
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
            third: value.stamina_travel_fish_cost.into()
                + if value.damage_stamina_refund {
                    0x100000000
                } else {
                    0
                }
                + value.capture_stamina_refund.into() * 0x200000000,
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
            damage_stamina_refund: value.third / 0x100000000 % 2 == 1,
            capture_stamina_refund: (value.third / 0x200000000).try_into().unwrap(),
        }
    }
}

pub impl TroopLimitConfigPacking of starknet::storage_access::StorePacking<TroopLimitConfig, PackedRuleWords> {
    fn pack(value: TroopLimitConfig) -> PackedRuleWords {
        PackedRuleWords {
            first: value.guard_resurrection_delay.into()
                + value.mercenaries_troop_lower_bound.into() * 0x10000
                + value.mercenaries_troop_upper_bound.into() * 0x100000000
                + value.starting_guard.into() * 0x1000000000000
                + value.settlement_deployment_cap.into() * 0x100000000000000000000,
            second: value.city_deployment_cap.into()
                + value.kingdom_deployment_cap.into() * 0x100000000
                + value.empire_deployment_cap.into() * 0x10000000000000000
                + value.t1_tier_strength.into() * 0x1000000000000000000000000
                + value.t2_tier_strength.into() * 0x100000000000000000000000000
                + value.t3_tier_strength.into() * 0x10000000000000000000000000000
                + value.t1_tier_modifier.into() * 0x1000000000000000000000000000000,
            third: value.t2_tier_modifier.into()
                + value.t3_tier_modifier.into() * 0x100
                + value.settlement_armies.into() * 0x10000
                + value.city_armies.into() * 0x100000000
                + value.kingdom_armies.into() * 0x1000000000000
                + value.empire_armies.into() * 0x10000000000000000
                + value.settlement_guard_slots.into() * 0x100000000000000000000
                + value.city_guard_slots.into() * 0x10000000000000000000000
                + value.kingdom_guard_slots.into() * 0x1000000000000000000000000
                + value.empire_guard_slots.into() * 0x100000000000000000000000000
                + value.camp_armies.into() * 0x10000000000000000000000000000,
        }
    }
    fn unpack(value: PackedRuleWords) -> TroopLimitConfig {
        TroopLimitConfig {
            guard_resurrection_delay: (value.first % 0x10000).try_into().unwrap(),
            mercenaries_troop_lower_bound: (value.first / 0x10000 % 0x10000).try_into().unwrap(),
            mercenaries_troop_upper_bound: (value.first / 0x100000000 % 0x10000).try_into().unwrap(),
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
            settlement_armies: (value.third / 0x10000 % 0x10000).try_into().unwrap(),
            city_armies: (value.third / 0x100000000 % 0x10000).try_into().unwrap(),
            kingdom_armies: (value.third / 0x1000000000000 % 0x10000).try_into().unwrap(),
            empire_armies: (value.third / 0x10000000000000000 % 0x10000).try_into().unwrap(),
            settlement_guard_slots: (value.third / 0x100000000000000000000 % 0x100).try_into().unwrap(),
            city_guard_slots: (value.third / 0x10000000000000000000000 % 0x100).try_into().unwrap(),
            kingdom_guard_slots: (value.third / 0x1000000000000000000000000 % 0x100).try_into().unwrap(),
            empire_guard_slots: (value.third / 0x100000000000000000000000000 % 0x100).try_into().unwrap(),
            starting_guard: (value.first / 0x1000000000000 % 0x100000000).try_into().unwrap(),
            camp_armies: (value.third / 0x10000000000000000000000000000).try_into().unwrap(),
        }
    }
}

pub impl MapConfigPacking of starknet::storage_access::StorePacking<MapConfig, PackedRuleWords> {
    fn pack(value: MapConfig) -> PackedRuleWords {
        PackedRuleWords {
            first: value.reward_resource_amount.into()
                + value.shards_mines_win_probability.into() * 0x10000
                + value.shards_mines_fail_probability.into() * 0x100000000
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
