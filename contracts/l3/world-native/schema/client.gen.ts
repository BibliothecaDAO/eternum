// Generated from native fact models and contract ABIs. Run the native schema generator to update.
export const NativeTroopType = {
  "Knight": "Knight",
  "Paladin": "Paladin",
  "Crossbowman": "Crossbowman"
} as const;
export const nativeFactSchemaIdentity = "9350c8c56b388922143ba0c028d0eaf68b1f358b7a8557713a5e2bebcba3eea9";
export const nativeIdentifiers = {
  "rule": {
    "ENTRY_ENTITLEMENT": 0,
    "ENTRY_OPEN": 1,
    "ENTRY_ROSTER": 2,
    "HOME_REWARDS": 1,
    "DISCOVER_CAMPS": 2,
    "UNOWNED_TARGETS": 32,
    "CAPTURE_VILLAGES": 64,
    "DEPTH_CONTENTS": 128,
    "REVEAL_SUPPLIES": 262144,
    "SAME_OWNER_TRANSFER": 256,
    "DEV_VILLAGE_ENTRY": 8192,
    "PRODUCTION_START": 131072,
    "FRONTIER_REPORT_GRACE_SECONDS": 3600,
    "DEEP_MAP_SIZE": 50,
    "DEEP_FOUNDATION": 0,
    "DEEP_CORE": 1,
    "DEEP_MINE": 2,
    "DEEP_ALTAR": 3,
    "DEEP_KIND_COUNT": 4,
    "DEEP_RING_SITES": 6,
    "DEEP_PLAZA_RADIUS": 4,
    "DEEP_GUARD_SLOTS": 4
  },
  "quest": {
    "HUNT": 0,
    "CAMPS": 1,
    "RIFTS": 2,
    "RELICS": 3,
    "VETERANS": 4,
    "FINDS": 5,
    "REVEALS": 6,
    "QUEST_COUNT": 7,
    "STAND": 7,
    "LIGHTS": 8,
    "CULL": 9
  },
  "bane": {
    "BLOOD_MOON": 1,
    "MIST_TIDE": 2,
    "ASH_FALL": 3,
    "BLOOD_MOON_QUEST": 7,
    "MIST_TIDE_QUEST": 8,
    "ASH_FALL_QUEST": 9
  },
  "race": {
    "STAGE_COUNT": 5,
    "CLEAR_MIST_STAGE": 1,
    "SECOND_WIND_STAGE": 2,
    "PALE_MOON_STAGE": 3,
    "SPOILS_STAGE": 4
  },
  "arrival": {
    "SLOTS_PER_DAY": 48
  },
  "oath": {
    "GIANTS": 1,
    "PERFECTION": 2,
    "RAGE": 3,
    "FOX": 4,
    "TWINS": 5,
    "FURY": 6,
    "REFLECTION": 7,
    "DETECTION": 8,
    "SKILL": 9,
    "BRILLIANCE": 10,
    "PROTECTION": 11,
    "POWER": 12,
    "TITANS": 13,
    "VITRIOL": 14,
    "ANGER": 15,
    "ENLIGHTENMENT": 16,
    "REROLLED": 4096
  },
  "research": {
    "ROW_FARM": 0,
    "ROW_WORKSHOP": 1,
    "ROW_CONSCRIPTION": 2,
    "ROW_RATIONS": 4,
    "ROW_SUPPLY_YARD": 5,
    "ROW_KNIGHT_OATHS": 6,
    "ROW_SCOUT_OATHS": 7,
    "ROW_CROSSBOW_OATHS": 11,
    "ROW_LORE": 10,
    "LORE_WELLS": 1,
    "LORE_SHRINES": 2,
    "LORE_SPIRES": 3,
    "LORE_SHRINES_LEVEL": 1,
    "LORE_SPIRES_LEVEL": 2,
    "STOREROOM": 2,
    "STOREROOM_LEVEL": 1,
    "WORKSHOP": 25,
    "BARRACKS": 28,
    "RANGE": 31,
    "RATIONS_DEPOT": 41,
    "CONSCRIPTION_CAMP": 44,
    "RANGE_LEVEL": 1,
    "CONSCRIPTION_CAMP_LEVEL": 1,
    "RATIONS_DEPOT_LEVEL": 2,
    "FARM": 37,
    "SUPPLY_YARD": 42,
    "SUPPLY_YARD_LEVEL": 2,
    "SCOUTS_LODGE": 43,
    "SCOUTS_LODGE_LEVEL": 1
  },
  "family": {
    "FRONTIER": 1,
    "BLITZ": 2
  }
} as const;
export const nativeReleaseConstants = {
  "RUIN_DEPTH_LIMIT_RELEASE": 9,
  "SEAL_RELEASE": 10
} as const;
/** Structure categories named in src/taxonomy.cairo. */
export enum NativeStructureCategory {
  Realm = 1,
  Hyperstructure = 2,
  Bank = 3,
  Mine = 4,
  Village = 5,
  Camp = 7,
  Rift = 9,
  Ruin = 10,
  Beasts = 11,
  DeepSite = 12,
}
/** Tile occupiers named in src/taxonomy.cairo. */
export enum NativeTileOccupier {
  None = 0,
  RealmRegularLevel1 = 1,
  RealmRegularLevel2 = 2,
  RealmRegularLevel3 = 3,
  RealmRegularLevel4 = 4,
  RealmWonderLevel1 = 5,
  RealmWonderLevel2 = 6,
  RealmWonderLevel3 = 7,
  RealmWonderLevel4 = 8,
  Hyperstructure = 9,
  Mine = 12,
  Village = 13,
  Bank = 14,
  ExplorerKnightT1 = 15,
  ExplorerKnightT2 = 16,
  ExplorerKnightT3 = 17,
  ExplorerPaladinT1 = 18,
  ExplorerPaladinT2 = 19,
  ExplorerPaladinT3 = 20,
  ExplorerCrossbowmanT1 = 21,
  ExplorerCrossbowmanT2 = 22,
  ExplorerCrossbowmanT3 = 23,
  Chest = 34,
  Spire = 35,
  Camp = 37,
  ReservedHyperstructure = 39,
  Shrine = 40,
  Well = 41,
  DormantSpire = 45,
  DeepSite = 46,
  SupplyPost = 47,
  Rift = 42,
  Ruin = 43,
  Beasts = 44,
}
export const nativeTilePackingConstants = {
  "BIOME_SCALE": "0x20000000000",
  "BYTE_RANGE": "0x100",
  "REWARD_EXTRACTED_FLAG": "0x20000000000000000000000000000"
} as const;
export const nativeStoryVariants = [
  "StructureLevelUpStory",
  "RealmCreatedStory",
  "GuardAddStory",
  "ResourceBurnStory",
  "ResourceTransferStory",
  "ResourceReceiveArrivalStory",
  "ProductionStory",
  "BuildingPlacementStory",
  "BuildingPaymentStory",
  "StructureCapturedStory",
  "ExplorationReward",
  "BlitzFinalized",
  "ExplorerCreateStory",
  "ExplorerAddStory",
  "ExplorerDeleteStory",
  "GuardDeleteStory",
  "TroopsTransferred",
  "LordsWithdrawn",
  "SitePayout",
  "SpireDiscovered",
  "SiteUsed"
] as const;
export type NativeStoryVariant = (typeof nativeStoryVariants)[number];
export interface NativeRows {
  Guild: { readonly game_id: number; readonly guild_id: bigint; readonly public: boolean; readonly name: bigint };
  GuildMember: { readonly game_id: number; readonly actor: bigint; readonly guild_id: bigint };
  GuildWhitelist: { readonly game_id: number; readonly guild_id: bigint; readonly player: bigint; readonly allowed: boolean };
  DepositSource: { readonly game_id: number; readonly chain: bigint; readonly ledger: bigint; readonly signer: bigint; readonly epoch: bigint };
  ExpeditionSpire: { readonly game_id: number; readonly structure_id: bigint; readonly epoch: bigint; readonly depth: number; readonly reveals: number; readonly location: ({ readonly alt: boolean; readonly x: number; readonly y: number }) | null };
  ExpeditionDiscovery: { readonly game_id: number; readonly structure_id: bigint; readonly epoch: bigint; readonly empty_reveals: number; readonly ruin_cleared: boolean };
  FragmentCredit: { readonly game_id: number; readonly id: bigint; readonly account: bigint; readonly amount: bigint };
  Fragments: { readonly game_id: number; readonly account: bigint; readonly balance: bigint };
  Seal: { readonly game_id: number; readonly account: bigint; readonly granted_at: bigint };
  SpendLords: { readonly game_id: number; readonly account: bigint; readonly available: bigint; readonly consumed: bigint; readonly swept: bigint };
  PrincipalWithdrawal: { readonly game_id: number; readonly account: bigint; readonly amount: bigint };
  DepositReceipt: { readonly game_id: number; readonly id: bigint; readonly commitment: bigint; readonly account: bigint; readonly amount: bigint; readonly cancelled: boolean };
  RaceRules: { readonly game_id: number; readonly season_days: bigint; readonly stage_height: number; readonly clear_mist_percent: number; readonly second_wind_percent: number; readonly pale_moon_percent: number; readonly spoils_percent: number };
  RaceMember: { readonly game_id: number; readonly entity_id: bigint; readonly glory: bigint; readonly contribution: bigint };
  AspectHyperstructure: { readonly game_id: number; readonly aspect: number; readonly height: number };
  TriumphDay: { readonly game_id: number; readonly aspect: number; readonly stage: number; readonly day: bigint };
  RaceResult: { readonly game_id: number; readonly winner: (number) | null; readonly ended_at: bigint; readonly scheduled_end_at: bigint };
  BaneRules: { readonly game_id: number; readonly chance_step: number; readonly quorum_percent: number; readonly beast_percent: number; readonly stamina_percent: number; readonly production_percent: number; readonly quest_counts: readonly (bigint)[] };
  QuestRules: { readonly game_id: number; readonly base_counts: readonly (number)[]; readonly labor: bigint; readonly essence: bigint; readonly bonus_percent: number };
  QuestProgress: { readonly game_id: number; readonly home: bigint; readonly day: bigint; readonly progress: bigint; readonly completed_level: number };
  WorldBane: { readonly game_id: number; readonly day: bigint; readonly kind: number };
  FirstTeamBane: { readonly game_id: number; readonly issued_day: bigint };
  BaneProgress: { readonly game_id: number; readonly aspect: number; readonly day: bigint; readonly completed: number; readonly ended_at: bigint };
  TeamBane: { readonly game_id: number; readonly aspect: number; readonly day: bigint; readonly source: number; readonly issued_day: bigint; readonly quest: number };
  AltarBar: { readonly game_id: number; readonly aspect: number; readonly charge: number };
  BaneGrant: { readonly game_id: number; readonly home: bigint; readonly day: bigint; readonly account: bigint; readonly amount: bigint; readonly essence: bigint };
  DeepRules: { readonly game_id: number; readonly gate_distance: number; readonly rings: readonly ({ readonly radius: number; readonly realms: number })[]; readonly beasts: readonly ({ readonly count: bigint; readonly bow: boolean })[]; readonly loss_per_tick: bigint; readonly core_per_tick: bigint; readonly mine_per_tick: bigint; readonly building_pay: { readonly alone: number; readonly pair: number; readonly crowd: number }; readonly altar_threshold: number };
  LaborGrant: { readonly game_id: number; readonly home: bigint; readonly day: bigint; readonly account: bigint; readonly amount: bigint; readonly essence: bigint };
  FrontierPrize: { readonly game_id: number; readonly pool: bigint; readonly issued: bigint; readonly count: (number) | null };
  ChestRules: { readonly game_id: number; readonly price_ceiling: bigint; readonly shares: { readonly common: number; readonly uncommon: number; readonly rare: number; readonly epic: number; readonly legendary: number }; readonly claim_window_seconds: number; readonly pool_bps: number; readonly top_n: number };
  LordsBudget: { readonly game_id: number; readonly pool: bigint; readonly pool_left: bigint; readonly open: bigint; readonly day: bigint; readonly price: bigint; readonly rolled_shares: bigint; readonly yesterday_shares: bigint; readonly yesterday_ticks: bigint };
  LordsWithdrawal: { readonly game_id: number; readonly claim_id: bigint; readonly account: bigint; readonly amount: bigint; readonly prize_rank: number; readonly prize_count: number };
  Guard: { readonly game_id: number; readonly structure_id: bigint; readonly slot: number; readonly troops: { readonly category: "Knight" | "Paladin" | "Crossbowman"; readonly tier: "T1" | "T2" | "T3"; readonly count: bigint; readonly stamina: { readonly Inline: { readonly amount: bigint; readonly settled_at: number; readonly remainder: number } } | { readonly Slot: number }; readonly boosts: { readonly incr_damage_dealt_percent_num: number; readonly incr_damage_dealt_end_at: number; readonly decr_damage_gotten_percent_num: number; readonly decr_damage_gotten_end_at: number; readonly incr_stamina_regen_percent_num: number; readonly incr_stamina_regen_seconds_left: number; readonly incr_explore_reward_percent_num: number; readonly incr_explore_reward_end_at: number }; readonly battle_cooldown_end: number }; readonly destroyed_tick: number };
  MineKindConfig: { readonly game_id: number; readonly kind: number; readonly resource_type: number; readonly building_category: number; readonly production_rate: bigint; readonly cap_min: bigint; readonly cap_steps: number };
  MinePool: { readonly game_id: number; readonly weights: readonly ({ readonly kind: number; readonly weight: number })[] };
  RealmTraits: { readonly realm_id: number; readonly wonder: number; readonly order: number; readonly resources: readonly (number)[] };
  RealmGrants: { readonly game_id: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly starting_troops: readonly ("Knight" | "Paladin" | "Crossbowman")[]; readonly realm_resources: readonly (number)[] };
  SettlementRules: { readonly game_id: number; readonly registration_start: number; readonly registration_limit: number; readonly mode: "Single" | "Triple"; readonly spacing: number };
  SettlementProgress: { readonly game_id: number; readonly registered: number; readonly realm_count: number };
  SettlementPool: { readonly game_id: number; readonly opened: number; readonly available: readonly ({ readonly coords: readonly ({ readonly alt: boolean; readonly x: number; readonly y: number })[] })[] };
  VillageRules: { readonly game_id: number; readonly troop_delay_ticks: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly resource_pool: readonly ({ readonly resource_type: number; readonly weight: bigint })[] };
  VillagePass: { readonly game_id: number; readonly pass_id: number; readonly owner: bigint; readonly village_id: bigint };
  VillagePool: { readonly game_id: number; readonly opened: number; readonly available: readonly ({ readonly coords: readonly ({ readonly alt: boolean; readonly x: number; readonly y: number })[] })[] };
  SettledRealm: { readonly game_id: number; readonly realm_id: number; readonly home: bigint };
  EntryEntitlement: { readonly game_id: number; readonly owner: bigint; readonly realm_id: bigint; readonly metadata_1: bigint; readonly metadata_2: bigint; readonly metadata_3: bigint; readonly pass_kind: number };
  PlayerEntry: { readonly game_id: number; readonly owner: bigint; readonly player: bigint };
  AspectRules: { readonly game_id: number; readonly orders: readonly (number)[] };
  HomeAspect: { readonly game_id: number; readonly home: bigint; readonly aspect: number };
  AspectMembers: { readonly game_id: number; readonly aspect: number; readonly members: number };
  TileOpt: { readonly game_id: number; readonly alt: boolean; readonly col: number; readonly row: number; readonly data: bigint };
  TileOccupancy: { readonly game_id: number; readonly alt: boolean; readonly col: number; readonly row: number; readonly entity_id: bigint; readonly category: number; readonly is_structure: boolean };
  ArmyRelics: { readonly game_id: number; readonly explorer_id: bigint; readonly first: ({ readonly kind: "Blade" | "Ward" | "Plunder" | "StaminaRegen"; readonly rank: number }) | null; readonly second: ({ readonly kind: "Blade" | "Ward" | "Plunder" | "StaminaRegen"; readonly rank: number }) | null; readonly third: ({ readonly kind: "Blade" | "Ward" | "Plunder" | "StaminaRegen"; readonly rank: number }) | null };
  ArmyRelicEffect: { readonly game_id: number; readonly explorer_id: bigint; readonly kind: "Blade" | "Ward" | "Plunder" | "StaminaRegen"; readonly rank: number; readonly expires_at: bigint };
  RuinRelic: { readonly game_id: number; readonly entity_id: bigint; readonly kind: "Blade" | "Ward" | "Plunder" | "StaminaRegen"; readonly rank: number };
  RuinCache: { readonly game_id: number; readonly entity_id: bigint; readonly fragments: bigint };
  ArmyCombat: { readonly game_id: number; readonly explorer_id: bigint; readonly last_target: bigint };
  ArmyProgress: { readonly game_id: number; readonly explorer_id: bigint; readonly logistics: number; readonly oath_slots: number; readonly oaths: number; readonly oath_pick: number };
  ArmyDay: { readonly game_id: number; readonly explorer_id: bigint; readonly day: bigint };
  DeepTick: { readonly game_id: number; readonly paid_tick: bigint };
  DeepSite: { readonly game_id: number; readonly entity_id: bigint; readonly kind: number; readonly ring: number; readonly day: bigint; readonly aspect: number };
  DeepEntries: { readonly game_id: number; readonly day: bigint; readonly count: number };
  GarrisonSlot: { readonly game_id: number; readonly structure_id: bigint; readonly slot: number; readonly home: bigint };
  DeepArmy: { readonly game_id: number; readonly explorer_id: bigint; readonly last_tick: bigint };
  AspectActivity: { readonly game_id: number; readonly aspect: number; readonly day: bigint; readonly active: number };
  ArmySlot: { readonly game_id: number; readonly structure_id: bigint; readonly epoch: bigint; readonly slot: number; readonly explorer_id: bigint; readonly stamina: { readonly amount: bigint; readonly settled_at: number; readonly remainder: number } };
  ExplorerTroops: { readonly game_id: number; readonly explorer_id: bigint; readonly owner: bigint; readonly troops: { readonly category: "Knight" | "Paladin" | "Crossbowman"; readonly tier: "T1" | "T2" | "T3"; readonly count: bigint; readonly stamina: { readonly Inline: { readonly amount: bigint; readonly settled_at: number; readonly remainder: number } } | { readonly Slot: number }; readonly boosts: { readonly incr_damage_dealt_percent_num: number; readonly incr_damage_dealt_end_at: number; readonly decr_damage_gotten_percent_num: number; readonly decr_damage_gotten_end_at: number; readonly incr_stamina_regen_percent_num: number; readonly incr_stamina_regen_seconds_left: number; readonly incr_explore_reward_percent_num: number; readonly incr_explore_reward_end_at: number }; readonly battle_cooldown_end: number } };
  ExpeditionSite: { readonly game_id: number; readonly entity_id: bigint; readonly category: number; readonly initial_guard_count: bigint; readonly alt: boolean; readonly col: number; readonly row: number; readonly clear: ({ readonly explorer_id: bigint; readonly home_id: bigint; readonly reward: ({ readonly resource_type: number; readonly amount: bigint }) | null }) | null };
  Structure: { readonly game_id: number; readonly entity_id: bigint; readonly owner: bigint; readonly base: { readonly troop_max_guard_count: number; readonly troop_max_explorer_count: number; readonly created_at: number; readonly category: number; readonly level: number; readonly starting_troops_granted: boolean }; readonly resources_packed: bigint; readonly metadata: { readonly realm_id: number; readonly order: number; readonly has_wonder: boolean; readonly village_realm: bigint; readonly mine_kind: number; readonly deepest_depth: number } };
  ResourceBalance: { readonly game_id: number; readonly entity_id: bigint; readonly resource_type: number; readonly balance: bigint };
  ResourceProduction: { readonly game_id: number; readonly entity_id: bigint; readonly resource_type: number; readonly building_count: number; readonly production_rate: bigint; readonly output_amount_left: bigint; readonly last_settled_at: number; readonly remainder: number };
  ProductionRecipe: { readonly game_id: number; readonly resource_type: number; readonly simple_output: bigint; readonly complex_output: bigint; readonly simple_inputs: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly complex_inputs: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  ResourceWeight: { readonly game_id: number; readonly entity_id: bigint; readonly capacity: bigint; readonly weight: bigint };
  ResourceArrival: { readonly game_id: number; readonly entity_id: bigint; readonly day: bigint; readonly slot: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  RealmKnowledge: { readonly game_id: number; readonly structure_id: bigint; readonly learned: bigint };
  ResearchPrice: { readonly game_id: number; readonly row: number; readonly tier: number; readonly essence: bigint; readonly labor: bigint };
  BoardRules: { readonly game_id: number; readonly demolition_refund_bps: number; readonly workshop_rate: bigint; readonly output_step_bps: number; readonly storage_step_bps: number; readonly ration_step: bigint; readonly troop_store_deploys: number; readonly settlement_resource_cap: number; readonly city_resource_cap: number; readonly kingdom_resource_cap: number; readonly empire_resource_cap: number };
  BuildingRule: { readonly game_id: number; readonly category: number; readonly population_cost: number; readonly capacity_grant: number; readonly simple_cost: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly complex_cost: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  Building: { readonly game_id: number; readonly structure_id: bigint; readonly inner_col: number; readonly inner_row: number; readonly category: number; readonly paused: boolean; readonly labor_paid: bigint };
  StructureBuildings: { readonly game_id: number; readonly entity_id: bigint; readonly packed_counts_1: bigint; readonly packed_counts_2: bigint; readonly packed_counts_3: bigint; readonly population: { readonly current: number; readonly max: number } };
  EntityName: { readonly game_id: number; readonly entity_id: bigint; readonly name: bigint };
  ResourceRule: { readonly game_id: number; readonly resource_type: number; readonly unit_weight: bigint; readonly realm_rate: bigint; readonly village_rate: bigint };
  UpgradeLimits: { readonly game_id: number; readonly realm_max: number; readonly village_max: number };
  UpgradeRecipe: { readonly game_id: number; readonly level: number; readonly costs: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  DepthRules: { readonly game_id: number; readonly depth: number; readonly reveal_percent: number; readonly site_guard_lower: number; readonly site_guard_upper: number; readonly rift_guard_lower: number; readonly rift_guard_upper: number; readonly reveal_site_neighbors: boolean; readonly chest: { readonly common: number; readonly uncommon: number; readonly rare: number; readonly epic: number; readonly legendary: number }; readonly guard_step: number; readonly beast_weak_lower: number; readonly beast_weak_upper: number; readonly beast_strong_lower: number; readonly beast_strong_upper: number };
  GameRelease: { readonly game_id: number; readonly release_id: number; readonly created_release_id: number };
  GameRegistry: { readonly game_id: number; readonly name: bigint; readonly family: number; readonly settled: boolean; readonly dev_mode_on: boolean; readonly start_settling_at: bigint; readonly start_main_at: bigint; readonly end_at: bigint; readonly seed: bigint; readonly scheduled_end_at: bigint; readonly clock_scale: number };
  GameOverrides: { readonly game_id: number; readonly registration_start: number; readonly biome_climate: { readonly elevation_scale_bps: number; readonly moisture_scale_bps: number; readonly elevation_bias_bps: number; readonly moisture_bias_bps: number; readonly elevation_seed: number; readonly moisture_seed: number }; readonly map: ({ readonly shards_mines_win_probability: number; readonly shards_mines_fail_probability: number; readonly camp_win_probability: number; readonly camp_fail_probability: number; readonly hyps_win_prob: number; readonly hyps_fail_prob: number; readonly hyps_fail_prob_increase_p_hex: number; readonly hyps_fail_prob_increase_p_fnd: number; readonly relic_discovery_interval_sec: number; readonly relic_hex_dist_from_center: number }) | null; readonly map_center_offset: number };
  SliceRules: { readonly game_id: number; readonly battle_config: { readonly regular_immunity_ticks: number; readonly village_immunity_ticks: number; readonly cooldown_seconds: number }; readonly map_config: { readonly shards_mines_win_probability: number; readonly shards_mines_fail_probability: number; readonly camp_win_probability: number; readonly camp_fail_probability: number; readonly hyps_win_prob: number; readonly hyps_fail_prob: number; readonly hyps_fail_prob_increase_p_hex: number; readonly hyps_fail_prob_increase_p_fnd: number; readonly relic_discovery_interval_sec: number; readonly relic_hex_dist_from_center: number }; readonly biome_climate_config: { readonly elevation_scale_bps: number; readonly moisture_scale_bps: number; readonly elevation_bias_bps: number; readonly moisture_bias_bps: number; readonly elevation_seed: number; readonly moisture_seed: number }; readonly tick_config: { readonly armies_tick_in_seconds: bigint; readonly delivery_tick_in_seconds: bigint }; readonly troop_damage_config: { readonly damage_biome_bonus_num: number; readonly damage_scaling_factor: bigint; readonly t1_damage_value: bigint; readonly t2_damage_multiplier: bigint; readonly t3_damage_multiplier: bigint }; readonly troop_stamina_config: { readonly stamina_gain_per_tick: number; readonly stamina_initial: number; readonly stamina_bonus_value: number; readonly stamina_knight_max: number; readonly stamina_paladin_max: number; readonly stamina_crossbowman_max: number; readonly stamina_attack_req: number; readonly stamina_defense_req: number; readonly stamina_explore_stamina_cost: number; readonly stamina_travel_stamina_cost: number; readonly stamina_explore_wheat_cost: number; readonly stamina_explore_fish_cost: number; readonly stamina_travel_wheat_cost: number; readonly stamina_travel_fish_cost: number; readonly damage_stamina_refund: boolean; readonly capture_stamina_refund: number }; readonly troop_limit_config: { readonly guard_resurrection_delay: number; readonly light_guard_lower_bound: number; readonly light_guard_upper_bound: number; readonly heavy_guard_lower_bound: number; readonly heavy_guard_upper_bound: number; readonly settlement_deployment_cap: number; readonly city_deployment_cap: number; readonly kingdom_deployment_cap: number; readonly empire_deployment_cap: number; readonly t1_tier_strength: number; readonly t2_tier_strength: number; readonly t3_tier_strength: number; readonly t1_tier_modifier: number; readonly t2_tier_modifier: number; readonly t3_tier_modifier: number; readonly settlement_armies: number; readonly city_armies: number; readonly kingdom_armies: number; readonly empire_armies: number; readonly settlement_guard_slots: number; readonly city_guard_slots: number; readonly kingdom_guard_slots: number; readonly empire_guard_slots: number; readonly starting_guard: number; readonly camp_armies: number; readonly explore_reward_strength_cap: number }; readonly capacity_config: { readonly troop_capacity: number; readonly donkey_capacity: number; readonly storehouse_boost_capacity: number }; readonly structure_capacity_config: { readonly realm_capacity: bigint; readonly village_capacity: bigint; readonly hyperstructure_capacity: bigint; readonly fragment_mine_capacity: bigint; readonly bank_structure_capacity: bigint; readonly camp_capacity: bigint }; readonly building_config: { readonly base_population: number; readonly base_cost_percent_increase: number }; readonly map_center_offset: number; readonly spire_travel_essence_cost: bigint; readonly command_mask: bigint; readonly mode_rules: number; readonly day_unit_seconds: number; readonly entry_rule: number; readonly speed_config: { readonly donkey_sec_per_km: number; readonly donkey_sec_per_km_troops: number }; readonly relic_seconds_per_rank: number };
}
export interface NativeKeys {
  Guild: { readonly game_id: number; readonly guild_id: bigint };
  GuildMember: { readonly game_id: number; readonly actor: bigint };
  GuildWhitelist: { readonly game_id: number; readonly guild_id: bigint; readonly player: bigint };
  DepositSource: { readonly game_id: number };
  ExpeditionSpire: { readonly game_id: number; readonly structure_id: bigint; readonly epoch: bigint; readonly depth: number };
  ExpeditionDiscovery: { readonly game_id: number; readonly structure_id: bigint; readonly epoch: bigint };
  FragmentCredit: { readonly game_id: number; readonly id: bigint };
  Fragments: { readonly game_id: number; readonly account: bigint };
  Seal: { readonly game_id: number; readonly account: bigint };
  SpendLords: { readonly game_id: number; readonly account: bigint };
  PrincipalWithdrawal: { readonly game_id: number; readonly account: bigint };
  DepositReceipt: { readonly game_id: number; readonly id: bigint };
  RaceRules: { readonly game_id: number };
  RaceMember: { readonly game_id: number; readonly entity_id: bigint };
  AspectHyperstructure: { readonly game_id: number; readonly aspect: number };
  TriumphDay: { readonly game_id: number; readonly aspect: number; readonly stage: number };
  RaceResult: { readonly game_id: number };
  BaneRules: { readonly game_id: number };
  QuestRules: { readonly game_id: number };
  QuestProgress: { readonly game_id: number; readonly home: bigint; readonly day: bigint };
  WorldBane: { readonly game_id: number; readonly day: bigint };
  FirstTeamBane: { readonly game_id: number };
  BaneProgress: { readonly game_id: number; readonly aspect: number; readonly day: bigint };
  TeamBane: { readonly game_id: number; readonly aspect: number; readonly day: bigint };
  AltarBar: { readonly game_id: number; readonly aspect: number };
  BaneGrant: { readonly game_id: number; readonly home: bigint; readonly day: bigint };
  DeepRules: { readonly game_id: number };
  LaborGrant: { readonly game_id: number; readonly home: bigint; readonly day: bigint };
  FrontierPrize: { readonly game_id: number };
  ChestRules: { readonly game_id: number };
  LordsBudget: { readonly game_id: number };
  LordsWithdrawal: { readonly game_id: number; readonly claim_id: bigint };
  Guard: { readonly game_id: number; readonly structure_id: bigint; readonly slot: number };
  MineKindConfig: { readonly game_id: number; readonly kind: number };
  MinePool: { readonly game_id: number };
  RealmTraits: { readonly realm_id: number };
  RealmGrants: { readonly game_id: number };
  SettlementRules: { readonly game_id: number };
  SettlementProgress: { readonly game_id: number };
  SettlementPool: { readonly game_id: number };
  VillageRules: { readonly game_id: number };
  VillagePass: { readonly game_id: number; readonly pass_id: number };
  VillagePool: { readonly game_id: number };
  SettledRealm: { readonly game_id: number; readonly realm_id: number };
  EntryEntitlement: { readonly game_id: number; readonly owner: bigint };
  PlayerEntry: { readonly game_id: number; readonly owner: bigint };
  AspectRules: { readonly game_id: number };
  HomeAspect: { readonly game_id: number; readonly home: bigint };
  AspectMembers: { readonly game_id: number; readonly aspect: number };
  TileOpt: { readonly game_id: number; readonly alt: boolean; readonly col: number; readonly row: number };
  TileOccupancy: { readonly game_id: number; readonly alt: boolean; readonly col: number; readonly row: number };
  ArmyRelics: { readonly game_id: number; readonly explorer_id: bigint };
  ArmyRelicEffect: { readonly game_id: number; readonly explorer_id: bigint; readonly kind: "Blade" | "Ward" | "Plunder" | "StaminaRegen" };
  RuinRelic: { readonly game_id: number; readonly entity_id: bigint };
  RuinCache: { readonly game_id: number; readonly entity_id: bigint };
  ArmyCombat: { readonly game_id: number; readonly explorer_id: bigint };
  ArmyProgress: { readonly game_id: number; readonly explorer_id: bigint };
  ArmyDay: { readonly game_id: number; readonly explorer_id: bigint };
  DeepTick: { readonly game_id: number };
  DeepSite: { readonly game_id: number; readonly entity_id: bigint };
  DeepEntries: { readonly game_id: number; readonly day: bigint };
  GarrisonSlot: { readonly game_id: number; readonly structure_id: bigint; readonly slot: number };
  DeepArmy: { readonly game_id: number; readonly explorer_id: bigint };
  AspectActivity: { readonly game_id: number; readonly aspect: number; readonly day: bigint };
  ArmySlot: { readonly game_id: number; readonly structure_id: bigint; readonly epoch: bigint; readonly slot: number };
  ExplorerTroops: { readonly game_id: number; readonly explorer_id: bigint };
  ExpeditionSite: { readonly game_id: number; readonly entity_id: bigint };
  Structure: { readonly game_id: number; readonly entity_id: bigint };
  ResourceBalance: { readonly game_id: number; readonly entity_id: bigint; readonly resource_type: number };
  ResourceProduction: { readonly game_id: number; readonly entity_id: bigint; readonly resource_type: number };
  ProductionRecipe: { readonly game_id: number; readonly resource_type: number };
  ResourceWeight: { readonly game_id: number; readonly entity_id: bigint };
  ResourceArrival: { readonly game_id: number; readonly entity_id: bigint; readonly day: bigint; readonly slot: number };
  RealmKnowledge: { readonly game_id: number; readonly structure_id: bigint };
  ResearchPrice: { readonly game_id: number; readonly row: number; readonly tier: number };
  BoardRules: { readonly game_id: number };
  BuildingRule: { readonly game_id: number; readonly category: number };
  Building: { readonly game_id: number; readonly structure_id: bigint; readonly inner_col: number; readonly inner_row: number };
  StructureBuildings: { readonly game_id: number; readonly entity_id: bigint };
  EntityName: { readonly game_id: number; readonly entity_id: bigint };
  ResourceRule: { readonly game_id: number; readonly resource_type: number };
  UpgradeLimits: { readonly game_id: number };
  UpgradeRecipe: { readonly game_id: number; readonly level: number };
  DepthRules: { readonly game_id: number; readonly depth: number };
  GameRelease: { readonly game_id: number };
  GameRegistry: { readonly game_id: number };
  GameOverrides: { readonly game_id: number };
  SliceRules: { readonly game_id: number };
}
export type NativeModelName = keyof NativeRows;
export const nativeFactModels = {
  "Guild": {
    "keys": [
      "game_id",
      "guild_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "guild_id": "felt",
      "public": "boolean",
      "name": "felt"
    }
  },
  "GuildMember": {
    "keys": [
      "game_id",
      "actor"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "actor": "felt",
      "guild_id": "felt"
    }
  },
  "GuildWhitelist": {
    "keys": [
      "game_id",
      "guild_id",
      "player"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "guild_id": "felt",
      "player": "felt",
      "allowed": "boolean"
    }
  },
  "DepositSource": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "chain": "felt",
      "ledger": "felt",
      "signer": "felt",
      "epoch": "u64"
    }
  },
  "ExpeditionSpire": {
    "keys": [
      "game_id",
      "structure_id",
      "epoch",
      "depth"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "epoch": "u64",
      "depth": "u8",
      "reveals": "u8",
      "location": {
        "option": {
          "alt": "boolean",
          "x": "u32",
          "y": "u32"
        }
      }
    },
    "absence": {
      "parent": "Structure",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "structure_id"
      },
      "value": "zero",
      "meaning": "No eligible Spire reveals on this home, day and layer yet."
    }
  },
  "ExpeditionDiscovery": {
    "keys": [
      "game_id",
      "structure_id",
      "epoch"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "epoch": "u64",
      "empty_reveals": "u8",
      "ruin_cleared": "boolean"
    },
    "absence": {
      "parent": "Structure",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "structure_id"
      },
      "value": "zero",
      "meaning": "No empty player reveals in this expedition yet."
    }
  },
  "FragmentCredit": {
    "keys": [
      "game_id",
      "id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "id": "felt",
      "account": "felt",
      "amount": "u128"
    }
  },
  "Fragments": {
    "keys": [
      "game_id",
      "account"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "account": "felt",
      "balance": "u128"
    }
  },
  "Seal": {
    "keys": [
      "game_id",
      "account"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "account": "felt",
      "granted_at": "u64"
    }
  },
  "SpendLords": {
    "keys": [
      "game_id",
      "account"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "account": "felt",
      "available": "u128",
      "consumed": "u128",
      "swept": "u128"
    }
  },
  "PrincipalWithdrawal": {
    "keys": [
      "game_id",
      "account"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "account": "felt",
      "amount": "u128"
    }
  },
  "DepositReceipt": {
    "keys": [
      "game_id",
      "id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "id": "u64",
      "commitment": "felt",
      "account": "felt",
      "amount": "u128",
      "cancelled": "boolean"
    }
  },
  "RaceRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "season_days": "u64",
      "stage_height": "u32",
      "clear_mist_percent": "u16",
      "second_wind_percent": "u16",
      "pale_moon_percent": "u16",
      "spoils_percent": "u16"
    }
  },
  "RaceMember": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "glory": "u128",
      "contribution": "u128"
    },
    "absence": {
      "parent": "Structure",
      "value": "zero",
      "meaning": "This home has earned no Glory or height contribution yet.",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "entity_id"
      }
    }
  },
  "AspectHyperstructure": {
    "keys": [
      "game_id",
      "aspect"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "height": "u32"
    }
  },
  "TriumphDay": {
    "keys": [
      "game_id",
      "aspect",
      "stage"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "stage": "u8",
      "day": "u64"
    }
  },
  "RaceResult": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "winner": {
        "option": "u8"
      },
      "ended_at": "u64",
      "scheduled_end_at": "u64"
    }
  },
  "BaneRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "chance_step": "u16",
      "quorum_percent": "u16",
      "beast_percent": "u16",
      "stamina_percent": "u16",
      "production_percent": "u16",
      "quest_counts": [
        "u128"
      ]
    }
  },
  "QuestRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "base_counts": [
        "u32"
      ],
      "labor": "u128",
      "essence": "u128",
      "bonus_percent": "u16"
    }
  },
  "QuestProgress": {
    "keys": [
      "game_id",
      "home",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "home": "u64",
      "day": "u64",
      "progress": "u128",
      "completed_level": "u8"
    },
    "absence": {
      "parent": "Structure",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "home"
      },
      "value": "zero",
      "meaning": "This home has made no daily quest progress on this day."
    }
  },
  "WorldBane": {
    "keys": [
      "game_id",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "day": "u64",
      "kind": "u8"
    }
  },
  "FirstTeamBane": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "issued_day": "u64"
    }
  },
  "BaneProgress": {
    "keys": [
      "game_id",
      "aspect",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "day": "u64",
      "completed": "u32",
      "ended_at": "u64"
    },
    "absence": {
      "parent": "BaneRules",
      "value": "zero",
      "meaning": "No member of this Aspect has completed the bane quest on this day.",
      "parentKeys": {
        "game_id": "game_id"
      }
    }
  },
  "TeamBane": {
    "keys": [
      "game_id",
      "aspect",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "day": "u64",
      "source": "u8",
      "issued_day": "u64",
      "quest": "u8"
    }
  },
  "AltarBar": {
    "keys": [
      "game_id",
      "aspect"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "charge": "u32"
    },
    "absence": {
      "parent": "DeepRules",
      "value": "zero",
      "meaning": "This Aspect has not received an Altar charge in this game.",
      "parentKeys": {
        "game_id": "game_id"
      }
    }
  },
  "BaneGrant": {
    "keys": [
      "game_id",
      "home",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "home": "u64",
      "day": "u64",
      "account": "felt",
      "amount": "u128",
      "essence": "u128"
    }
  },
  "DeepRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "gate_distance": "u32",
      "rings": [
        {
          "radius": "u32",
          "realms": "u32"
        }
      ],
      "beasts": [
        {
          "count": "u128",
          "bow": "boolean"
        }
      ],
      "loss_per_tick": "u128",
      "core_per_tick": "u128",
      "mine_per_tick": "u128",
      "building_pay": {
        "alone": "u32",
        "pair": "u32",
        "crowd": "u32"
      },
      "altar_threshold": "u32"
    }
  },
  "LaborGrant": {
    "keys": [
      "game_id",
      "home",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "home": "u64",
      "day": "u64",
      "account": "felt",
      "amount": "u128",
      "essence": "u128"
    }
  },
  "FrontierPrize": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "pool": "u128",
      "issued": "u128",
      "count": {
        "option": "u16"
      }
    }
  },
  "ChestRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "price_ceiling": "u128",
      "shares": {
        "common": "u16",
        "uncommon": "u16",
        "rare": "u16",
        "epic": "u16",
        "legendary": "u16"
      },
      "claim_window_seconds": "u32",
      "pool_bps": "u16",
      "top_n": "u16"
    }
  },
  "LordsBudget": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "pool": "u128",
      "pool_left": "u128",
      "open": "u128",
      "day": "u64",
      "price": "u128",
      "rolled_shares": "u128",
      "yesterday_shares": "u128",
      "yesterday_ticks": "u64"
    }
  },
  "LordsWithdrawal": {
    "keys": [
      "game_id",
      "claim_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "claim_id": "felt",
      "account": "felt",
      "amount": "u128",
      "prize_rank": "u16",
      "prize_count": "u16"
    }
  },
  "Guard": {
    "keys": [
      "game_id",
      "structure_id",
      "slot"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "slot": "u8",
      "troops": {
        "category": {
          "enum": [
            "Knight",
            "Paladin",
            "Crossbowman"
          ]
        },
        "tier": {
          "enum": [
            "T1",
            "T2",
            "T3"
          ]
        },
        "count": "u128",
        "stamina": {
          "variants": {
            "Inline": {
              "amount": "u64",
              "settled_at": "u32",
              "remainder": "u32"
            },
            "Slot": "u8"
          }
        },
        "boosts": {
          "incr_damage_dealt_percent_num": "u16",
          "incr_damage_dealt_end_at": "u32",
          "decr_damage_gotten_percent_num": "u16",
          "decr_damage_gotten_end_at": "u32",
          "incr_stamina_regen_percent_num": "u16",
          "incr_stamina_regen_seconds_left": "u16",
          "incr_explore_reward_percent_num": "u16",
          "incr_explore_reward_end_at": "u32"
        },
        "battle_cooldown_end": "u32"
      },
      "destroyed_tick": "u32"
    },
    "absence": {
      "parent": "Structure",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "structure_id"
      },
      "value": "zero",
      "meaning": "No troops or resurrection delay in this guard slot."
    }
  },
  "MineKindConfig": {
    "keys": [
      "game_id",
      "kind"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "kind": "u8",
      "resource_type": "u8",
      "building_category": "u8",
      "production_rate": "u64",
      "cap_min": "u128",
      "cap_steps": "u32"
    }
  },
  "MinePool": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "weights": [
        {
          "kind": "u8",
          "weight": "u32"
        }
      ]
    }
  },
  "RealmTraits": {
    "keys": [
      "realm_id"
    ],
    "scope": "deployment",
    "fields": {
      "realm_id": "u32",
      "wonder": "u8",
      "order": "u8",
      "resources": [
        "u8"
      ]
    }
  },
  "RealmGrants": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "resources": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ],
      "starting_troops": [
        {
          "enum": [
            "Knight",
            "Paladin",
            "Crossbowman"
          ]
        }
      ],
      "realm_resources": [
        "u8"
      ]
    }
  },
  "SettlementRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "registration_start": "u32",
      "registration_limit": "u16",
      "mode": {
        "enum": [
          "Single",
          "Triple"
        ]
      },
      "spacing": "u32"
    }
  },
  "SettlementProgress": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "registered": "u16",
      "realm_count": "u16"
    },
    "absence": {
      "parent": "SettlementRules",
      "value": "zero",
      "meaning": "No players have settled or registered realms in this game.",
      "parentKeys": {
        "game_id": "game_id"
      }
    }
  },
  "SettlementPool": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "opened": "u32",
      "available": [
        {
          "coords": [
            {
              "alt": "boolean",
              "x": "u32",
              "y": "u32"
            }
          ]
        }
      ]
    }
  },
  "VillageRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "troop_delay_ticks": "u16",
      "resources": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ],
      "resource_pool": [
        {
          "resource_type": "u8",
          "weight": "u128"
        }
      ]
    }
  },
  "VillagePass": {
    "keys": [
      "game_id",
      "pass_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "pass_id": "u16",
      "owner": "felt",
      "village_id": "u64"
    }
  },
  "VillagePool": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "opened": "u32",
      "available": [
        {
          "coords": [
            {
              "alt": "boolean",
              "x": "u32",
              "y": "u32"
            }
          ]
        }
      ]
    }
  },
  "SettledRealm": {
    "keys": [
      "game_id",
      "realm_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "realm_id": "u32",
      "home": "u64"
    }
  },
  "EntryEntitlement": {
    "keys": [
      "game_id",
      "owner"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "owner": "felt",
      "realm_id": "u256",
      "metadata_1": "felt",
      "metadata_2": "felt",
      "metadata_3": "felt",
      "pass_kind": "u8"
    }
  },
  "PlayerEntry": {
    "keys": [
      "game_id",
      "owner"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "owner": "felt",
      "player": "felt"
    }
  },
  "AspectRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "orders": [
        "u8"
      ]
    }
  },
  "HomeAspect": {
    "keys": [
      "game_id",
      "home"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "home": "u64",
      "aspect": "u8"
    }
  },
  "AspectMembers": {
    "keys": [
      "game_id",
      "aspect"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "members": "u32"
    },
    "absence": {
      "parent": "AspectRules",
      "value": "zero",
      "meaning": "No home has joined this Aspect in this game.",
      "parentKeys": {
        "game_id": "game_id"
      }
    }
  },
  "TileOpt": {
    "keys": [
      "game_id",
      "alt",
      "col",
      "row"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "alt": "boolean",
      "col": "u32",
      "row": "u32",
      "data": "u128"
    }
  },
  "TileOccupancy": {
    "keys": [
      "game_id",
      "alt",
      "col",
      "row"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "alt": "boolean",
      "col": "u32",
      "row": "u32",
      "entity_id": "u64",
      "category": "u8",
      "is_structure": "boolean"
    }
  },
  "ArmyRelics": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "first": {
        "option": {
          "kind": {
            "enum": [
              "Blade",
              "Ward",
              "Plunder",
              "StaminaRegen"
            ]
          },
          "rank": "u8"
        }
      },
      "second": {
        "option": {
          "kind": {
            "enum": [
              "Blade",
              "Ward",
              "Plunder",
              "StaminaRegen"
            ]
          },
          "rank": "u8"
        }
      },
      "third": {
        "option": {
          "kind": {
            "enum": [
              "Blade",
              "Ward",
              "Plunder",
              "StaminaRegen"
            ]
          },
          "rank": "u8"
        }
      }
    },
    "absence": {
      "parent": "ExplorerTroops",
      "value": "zero",
      "meaning": "No carried relics or running relic of this kind while the army exists.",
      "parentKeys": {
        "game_id": "game_id",
        "explorer_id": "explorer_id"
      }
    }
  },
  "ArmyRelicEffect": {
    "keys": [
      "game_id",
      "explorer_id",
      "kind"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "kind": {
        "enum": [
          "Blade",
          "Ward",
          "Plunder",
          "StaminaRegen"
        ]
      },
      "rank": "u8",
      "expires_at": "u64"
    },
    "absence": {
      "parent": "ExplorerTroops",
      "value": "zero",
      "meaning": "No carried relics or running relic of this kind while the army exists.",
      "parentKeys": {
        "game_id": "game_id",
        "explorer_id": "explorer_id"
      }
    }
  },
  "RuinRelic": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "kind": {
        "enum": [
          "Blade",
          "Ward",
          "Plunder",
          "StaminaRegen"
        ]
      },
      "rank": "u8"
    }
  },
  "RuinCache": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "fragments": "u128"
    }
  },
  "ArmyCombat": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "last_target": "u64"
    }
  },
  "ArmyProgress": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "logistics": "u8",
      "oath_slots": "u8",
      "oaths": "u16",
      "oath_pick": "u16"
    }
  },
  "ArmyDay": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "day": "u64"
    }
  },
  "DeepTick": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "paid_tick": "u64"
    }
  },
  "DeepSite": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "kind": "u8",
      "ring": "u8",
      "day": "u64",
      "aspect": "u8"
    }
  },
  "DeepEntries": {
    "keys": [
      "game_id",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "day": "u64",
      "count": "u32"
    },
    "absence": {
      "parent": "DeepRules",
      "value": "zero",
      "meaning": "No Realm has entered the Deep on this day.",
      "parentKeys": {
        "game_id": "game_id"
      }
    }
  },
  "GarrisonSlot": {
    "keys": [
      "game_id",
      "structure_id",
      "slot"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "slot": "u8",
      "home": "u64"
    }
  },
  "DeepArmy": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "last_tick": "u64"
    }
  },
  "AspectActivity": {
    "keys": [
      "game_id",
      "aspect",
      "day"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "aspect": "u8",
      "day": "u64",
      "active": "u32"
    },
    "absence": {
      "parent": "GameRegistry",
      "value": "zero",
      "meaning": "No home in this Aspect allocated an army on this day.",
      "parentKeys": {
        "game_id": "game_id"
      }
    }
  },
  "ArmySlot": {
    "keys": [
      "game_id",
      "structure_id",
      "epoch",
      "slot"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "epoch": "u64",
      "slot": "u8",
      "explorer_id": "u64",
      "stamina": {
        "amount": "u64",
        "settled_at": "u32",
        "remainder": "u32"
      }
    },
    "absence": {
      "parent": "Structure",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "structure_id"
      },
      "value": "unused",
      "meaning": "This army slot has not been used on this season day."
    }
  },
  "ExplorerTroops": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u64",
      "owner": "u64",
      "troops": {
        "category": {
          "enum": [
            "Knight",
            "Paladin",
            "Crossbowman"
          ]
        },
        "tier": {
          "enum": [
            "T1",
            "T2",
            "T3"
          ]
        },
        "count": "u128",
        "stamina": {
          "variants": {
            "Inline": {
              "amount": "u64",
              "settled_at": "u32",
              "remainder": "u32"
            },
            "Slot": "u8"
          }
        },
        "boosts": {
          "incr_damage_dealt_percent_num": "u16",
          "incr_damage_dealt_end_at": "u32",
          "decr_damage_gotten_percent_num": "u16",
          "decr_damage_gotten_end_at": "u32",
          "incr_stamina_regen_percent_num": "u16",
          "incr_stamina_regen_seconds_left": "u16",
          "incr_explore_reward_percent_num": "u16",
          "incr_explore_reward_end_at": "u32"
        },
        "battle_cooldown_end": "u32"
      }
    }
  },
  "ExpeditionSite": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "category": "u8",
      "initial_guard_count": "u128",
      "alt": "boolean",
      "col": "u32",
      "row": "u32",
      "clear": {
        "option": {
          "explorer_id": "u64",
          "home_id": "u64",
          "reward": {
            "option": {
              "resource_type": "u8",
              "amount": "u128"
            }
          }
        }
      }
    }
  },
  "Structure": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "owner": "felt",
      "base": {
        "troop_max_guard_count": "u8",
        "troop_max_explorer_count": "u16",
        "created_at": "u32",
        "category": "u8",
        "level": "u8",
        "starting_troops_granted": "boolean"
      },
      "resources_packed": "u128",
      "metadata": {
        "realm_id": "u16",
        "order": "u8",
        "has_wonder": "boolean",
        "village_realm": "u64",
        "mine_kind": "u8",
        "deepest_depth": "u8"
      }
    }
  },
  "ResourceBalance": {
    "keys": [
      "game_id",
      "entity_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "resource_type": "u8",
      "balance": "u128"
    },
    "absence": {
      "parent": "ResourceWeight",
      "value": "zero",
      "meaning": "Zero balance or inactive production while the resource owner exists; no resource owner after its weight row is deleted.",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "entity_id"
      }
    }
  },
  "ResourceProduction": {
    "keys": [
      "game_id",
      "entity_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "resource_type": "u8",
      "building_count": "u8",
      "production_rate": "u64",
      "output_amount_left": "u128",
      "last_settled_at": "u32",
      "remainder": "u8"
    },
    "absence": {
      "parent": "ResourceWeight",
      "value": "zero",
      "meaning": "Zero balance or inactive production while the resource owner exists; no resource owner after its weight row is deleted.",
      "parentKeys": {
        "game_id": "game_id",
        "entity_id": "entity_id"
      }
    }
  },
  "ProductionRecipe": {
    "keys": [
      "game_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "resource_type": "u8",
      "simple_output": "u64",
      "complex_output": "u64",
      "simple_inputs": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ],
      "complex_inputs": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ]
    }
  },
  "ResourceWeight": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "capacity": "u128",
      "weight": "u128"
    }
  },
  "ResourceArrival": {
    "keys": [
      "game_id",
      "entity_id",
      "day",
      "slot"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "day": "u64",
      "slot": "u8",
      "resources": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ]
    }
  },
  "RealmKnowledge": {
    "keys": [
      "game_id",
      "structure_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "learned": "u64"
    }
  },
  "ResearchPrice": {
    "keys": [
      "game_id",
      "row",
      "tier"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "row": "u8",
      "tier": "u8",
      "essence": "u128",
      "labor": "u128"
    }
  },
  "BoardRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "demolition_refund_bps": "u16",
      "workshop_rate": "u64",
      "output_step_bps": "u16",
      "storage_step_bps": "u16",
      "ration_step": "u128",
      "troop_store_deploys": "u8",
      "settlement_resource_cap": "u32",
      "city_resource_cap": "u32",
      "kingdom_resource_cap": "u32",
      "empire_resource_cap": "u32"
    }
  },
  "BuildingRule": {
    "keys": [
      "game_id",
      "category"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "category": "u8",
      "population_cost": "u8",
      "capacity_grant": "u8",
      "simple_cost": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ],
      "complex_cost": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ]
    }
  },
  "Building": {
    "keys": [
      "game_id",
      "structure_id",
      "inner_col",
      "inner_row"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u64",
      "inner_col": "u32",
      "inner_row": "u32",
      "category": "u8",
      "paused": "boolean",
      "labor_paid": "u128"
    }
  },
  "StructureBuildings": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "packed_counts_1": "u128",
      "packed_counts_2": "u128",
      "packed_counts_3": "u128",
      "population": {
        "current": "u32",
        "max": "u32"
      }
    }
  },
  "EntityName": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u64",
      "name": "felt"
    }
  },
  "ResourceRule": {
    "keys": [
      "game_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "resource_type": "u8",
      "unit_weight": "u128",
      "realm_rate": "u64",
      "village_rate": "u64"
    }
  },
  "UpgradeLimits": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "realm_max": "u8",
      "village_max": "u8"
    }
  },
  "UpgradeRecipe": {
    "keys": [
      "game_id",
      "level"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "level": "u8",
      "costs": [
        {
          "resource_type": "u8",
          "amount": "u128"
        }
      ]
    }
  },
  "DepthRules": {
    "keys": [
      "game_id",
      "depth"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "depth": "u8",
      "reveal_percent": "u16",
      "site_guard_lower": "u16",
      "site_guard_upper": "u16",
      "rift_guard_lower": "u16",
      "rift_guard_upper": "u16",
      "reveal_site_neighbors": "boolean",
      "chest": {
        "common": "u16",
        "uncommon": "u16",
        "rare": "u16",
        "epic": "u16",
        "legendary": "u16"
      },
      "guard_step": "u32",
      "beast_weak_lower": "u16",
      "beast_weak_upper": "u16",
      "beast_strong_lower": "u16",
      "beast_strong_upper": "u16"
    }
  },
  "GameRelease": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "release_id": "u32",
      "created_release_id": "u32"
    }
  },
  "GameRegistry": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "name": "felt",
      "family": "u8",
      "settled": "boolean",
      "dev_mode_on": "boolean",
      "start_settling_at": "u64",
      "start_main_at": "u64",
      "end_at": "u64",
      "seed": "felt",
      "scheduled_end_at": "u64",
      "clock_scale": "u8"
    }
  },
  "GameOverrides": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "registration_start": "u32",
      "biome_climate": {
        "elevation_scale_bps": "u16",
        "moisture_scale_bps": "u16",
        "elevation_bias_bps": "u16",
        "moisture_bias_bps": "u16",
        "elevation_seed": "u32",
        "moisture_seed": "u32"
      },
      "map": {
        "option": {
          "shards_mines_win_probability": "u16",
          "shards_mines_fail_probability": "u16",
          "camp_win_probability": "u16",
          "camp_fail_probability": "u16",
          "hyps_win_prob": "u32",
          "hyps_fail_prob": "u32",
          "hyps_fail_prob_increase_p_hex": "u16",
          "hyps_fail_prob_increase_p_fnd": "u16",
          "relic_discovery_interval_sec": "u16",
          "relic_hex_dist_from_center": "u8"
        }
      },
      "map_center_offset": "u32"
    }
  },
  "SliceRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "battle_config": {
        "regular_immunity_ticks": "u8",
        "village_immunity_ticks": "u8",
        "cooldown_seconds": "u32"
      },
      "map_config": {
        "shards_mines_win_probability": "u16",
        "shards_mines_fail_probability": "u16",
        "camp_win_probability": "u16",
        "camp_fail_probability": "u16",
        "hyps_win_prob": "u32",
        "hyps_fail_prob": "u32",
        "hyps_fail_prob_increase_p_hex": "u16",
        "hyps_fail_prob_increase_p_fnd": "u16",
        "relic_discovery_interval_sec": "u16",
        "relic_hex_dist_from_center": "u8"
      },
      "biome_climate_config": {
        "elevation_scale_bps": "u16",
        "moisture_scale_bps": "u16",
        "elevation_bias_bps": "u16",
        "moisture_bias_bps": "u16",
        "elevation_seed": "u32",
        "moisture_seed": "u32"
      },
      "tick_config": {
        "armies_tick_in_seconds": "u64",
        "delivery_tick_in_seconds": "u64"
      },
      "troop_damage_config": {
        "damage_biome_bonus_num": "u16",
        "damage_scaling_factor": "u128",
        "t1_damage_value": "u128",
        "t2_damage_multiplier": "u128",
        "t3_damage_multiplier": "u128"
      },
      "troop_stamina_config": {
        "stamina_gain_per_tick": "u16",
        "stamina_initial": "u16",
        "stamina_bonus_value": "u16",
        "stamina_knight_max": "u16",
        "stamina_paladin_max": "u16",
        "stamina_crossbowman_max": "u16",
        "stamina_attack_req": "u16",
        "stamina_defense_req": "u16",
        "stamina_explore_stamina_cost": "u16",
        "stamina_travel_stamina_cost": "u16",
        "stamina_explore_wheat_cost": "u32",
        "stamina_explore_fish_cost": "u32",
        "stamina_travel_wheat_cost": "u32",
        "stamina_travel_fish_cost": "u32",
        "damage_stamina_refund": "boolean",
        "capture_stamina_refund": "u16"
      },
      "troop_limit_config": {
        "guard_resurrection_delay": "u16",
        "light_guard_lower_bound": "u16",
        "light_guard_upper_bound": "u16",
        "heavy_guard_lower_bound": "u16",
        "heavy_guard_upper_bound": "u16",
        "settlement_deployment_cap": "u32",
        "city_deployment_cap": "u32",
        "kingdom_deployment_cap": "u32",
        "empire_deployment_cap": "u32",
        "t1_tier_strength": "u8",
        "t2_tier_strength": "u8",
        "t3_tier_strength": "u8",
        "t1_tier_modifier": "u8",
        "t2_tier_modifier": "u8",
        "t3_tier_modifier": "u8",
        "settlement_armies": "u16",
        "city_armies": "u16",
        "kingdom_armies": "u16",
        "empire_armies": "u16",
        "settlement_guard_slots": "u8",
        "city_guard_slots": "u8",
        "kingdom_guard_slots": "u8",
        "empire_guard_slots": "u8",
        "starting_guard": "u32",
        "camp_armies": "u16",
        "explore_reward_strength_cap": "u16"
      },
      "capacity_config": {
        "troop_capacity": "u32",
        "donkey_capacity": "u32",
        "storehouse_boost_capacity": "u32"
      },
      "structure_capacity_config": {
        "realm_capacity": "u64",
        "village_capacity": "u64",
        "hyperstructure_capacity": "u64",
        "fragment_mine_capacity": "u64",
        "bank_structure_capacity": "u64",
        "camp_capacity": "u64"
      },
      "building_config": {
        "base_population": "u32",
        "base_cost_percent_increase": "u16"
      },
      "map_center_offset": "u32",
      "spire_travel_essence_cost": "u128",
      "command_mask": "u128",
      "mode_rules": "u32",
      "day_unit_seconds": "u32",
      "entry_rule": "u8",
      "speed_config": {
        "donkey_sec_per_km": "u16",
        "donkey_sec_per_km_troops": "u16"
      },
      "relic_seconds_per_rank": "u32"
    }
  }
} as const;
export const nativeSyncScopes = {
  "GameOverrides": "internal",
  "GameplayRejected": "actor",
  "BatchProgress": "actor",
  "ChestRules": "shared",
  "DeepRules": "shared",
  "LordsBudget": "shared",
  "FrontierPrize": "shared",
  "DepositSource": "shared",
  "MineKindConfig": "shared",
  "MinePool": "shared",
  "RealmGrants": "shared",
  "SettlementRules": "shared",
  "SettlementProgress": "shared",
  "SettlementPool": "shared",
  "VillageRules": "shared",
  "VillagePool": "shared",
  "ProductionRecipe": "shared",
  "BoardRules": "shared",
  "ResearchPrice": "shared",
  "BuildingRule": "shared",
  "ResourceRule": "shared",
  "UpgradeLimits": "shared",
  "UpgradeRecipe": "shared",
  "DepthRules": "shared",
  "GameRegistry": "shared",
  "GameRelease": "shared",
  "SliceRules": "shared",
  "RealmTraits": {
    "realmTraits": [
      "realm_id"
    ]
  },
  "SettledRealm": {
    "entities": [
      "home"
    ]
  },
  "EntryEntitlement": {
    "owners": [
      "owner"
    ]
  },
  "PlayerEntry": {
    "owners": [
      "owner"
    ]
  },
  "AspectRules": "shared",
  "QuestRules": "shared",
  "BaneRules": "shared",
  "RaceRules": "shared",
  "RaceMember": "shared",
  "AspectHyperstructure": "shared",
  "TriumphDay": "shared",
  "RaceResult": "shared",
  "WorldBane": "shared",
  "FirstTeamBane": "shared",
  "BaneProgress": "shared",
  "TeamBane": "shared",
  "AltarBar": "shared",
  "BaneGrant": {
    "owners": [
      "account"
    ]
  },
  "QuestProgress": {
    "entities": [
      "home"
    ]
  },
  "HomeAspect": "shared",
  "AspectMembers": "shared",
  "VillagePass": {
    "owners": [
      "owner"
    ]
  },
  "StoryEvent": {
    "owners": [
      "owner"
    ]
  },
  "Guild": {
    "owners": [
      "guild_id"
    ]
  },
  "GuildMember": {
    "owners": [
      "actor"
    ]
  },
  "GuildWhitelist": {
    "owners": [
      "player"
    ]
  },
  "LordsWithdrawal": {
    "owners": [
      "account"
    ]
  },
  "LaborGrant": {
    "owners": [
      "account"
    ]
  },
  "FragmentCredit": {
    "owners": [
      "account"
    ]
  },
  "Fragments": {
    "owners": [
      "account"
    ]
  },
  "Seal": {
    "owners": [
      "account"
    ]
  },
  "SpendLords": {
    "owners": [
      "account"
    ]
  },
  "PrincipalWithdrawal": {
    "owners": [
      "account"
    ]
  },
  "DepositReceipt": {
    "owners": [
      "account"
    ]
  },
  "TileOpt": {
    "regions": [
      {
        "alt": "alt",
        "x": "col",
        "y": "row"
      }
    ]
  },
  "TileOccupancy": {
    "regions": [
      {
        "alt": "alt",
        "x": "col",
        "y": "row"
      }
    ],
    "entities": [
      "entity_id"
    ]
  },
  "Building": {
    "realms": [
      "structure_id"
    ]
  },
  "RealmKnowledge": {
    "realms": [
      "structure_id"
    ]
  },
  "ExpeditionSite": {
    "regions": [
      {
        "alt": "alt",
        "x": "col",
        "y": "row"
      }
    ],
    "entities": [
      "entity_id"
    ]
  },
  "ArmyCombat": {
    "entities": [
      "explorer_id"
    ]
  },
  "ArmyProgress": {
    "entities": [
      "explorer_id"
    ]
  },
  "ArmyRelics": {
    "entities": [
      "explorer_id"
    ]
  },
  "ArmyRelicEffect": {
    "entities": [
      "explorer_id"
    ]
  },
  "RuinRelic": {
    "entities": [
      "entity_id"
    ]
  },
  "RuinCache": {
    "entities": [
      "entity_id"
    ]
  },
  "ExpeditionDiscovery": {
    "realms": [
      "structure_id"
    ],
    "epoch": "epoch"
  },
  "ExpeditionSpire": {
    "realms": [
      "structure_id"
    ],
    "epoch": "epoch"
  },
  "ArmyDay": {
    "entities": [
      "explorer_id"
    ]
  },
  "AspectActivity": "shared",
  "DeepTick": "shared",
  "DeepSite": "shared",
  "DeepEntries": "shared",
  "GarrisonSlot": "shared",
  "DeepArmy": "shared",
  "ArmySlot": {
    "entities": [
      "structure_id"
    ],
    "epoch": "epoch"
  },
  "ExplorerTroops": {
    "entities": [
      "explorer_id"
    ]
  },
  "Guard": {
    "entities": [
      "structure_id"
    ]
  },
  "BattleEvent": {
    "entities": [
      "attacker_id",
      "defender_id"
    ]
  },
  "ResourceProduction": {
    "entities": [
      "entity_id"
    ]
  },
  "Structure": {
    "entities": [
      "entity_id"
    ]
  },
  "ResourceBalance": {
    "entities": [
      "entity_id"
    ]
  },
  "ResourceWeight": {
    "entities": [
      "entity_id"
    ]
  },
  "ResourceArrival": {
    "entities": [
      "entity_id"
    ]
  },
  "StructureBuildings": {
    "entities": [
      "entity_id"
    ]
  },
  "EntityName": {
    "entities": [
      "entity_id"
    ]
  }
} as const;
