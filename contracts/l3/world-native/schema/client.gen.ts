// Generated from native fact models and contract ABIs. Run the native schema generator to update.
export const nativeFactSchemaIdentity = "2db222be1b50ba6f69b985c3c2bd24b88fd95970c1e98627a49ef4c707c6ea7e";
export interface NativeRows {
  Preset: { readonly preset_id: number; readonly commitment: bigint };
  GameSequence: { readonly address: bigint; readonly next_game_id: number };
  SpireLayout: { readonly game_id: number; readonly count: number; readonly base_distance: number; readonly layer_distance: number; readonly max_layer: number };
  LedgerOperator: { readonly address: bigint; readonly operator: bigint };
  CampResources: { readonly game_id: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  Guild: { readonly game_id: number; readonly guild_id: bigint; readonly public: boolean; readonly name: bigint };
  GuildMember: { readonly game_id: number; readonly actor: bigint; readonly guild_id: bigint };
  GuildWhitelist: { readonly game_id: number; readonly guild_id: bigint; readonly player: bigint; readonly allowed: boolean };
  ArtificerCost: { readonly game_id: number; readonly research: bigint };
  BlitzResult: { readonly game_id: number; readonly players: readonly ({ readonly player: bigint; readonly points: bigint; readonly rank: number })[]; readonly complete: boolean; readonly commitment: bigint };
  FaithRewardToken: { readonly game_id: number; readonly token: bigint };
  FaithPrizePool: { readonly game_id: number; readonly funded: bigint; readonly distributed: boolean };
  FaithPrizeClaimed: { readonly game_id: number; readonly player: bigint; readonly wonder_id: number; readonly claimed: boolean };
  FaithRules: { readonly game_id: number; readonly wonder_rate: number; readonly realm_rate: number; readonly village_rate: number; readonly owner_share_bps: number };
  FaithBlacklist: { readonly game_id: number; readonly wonder_id: number; readonly blocked_id: bigint; readonly blocked: boolean };
  SeasonWinThreshold: { readonly game_id: number; readonly points: bigint };
  ExtractionRewards: { readonly game_id: number; readonly rewards: readonly ({ readonly resource_type: number; readonly amount: bigint; readonly weight: bigint })[] };
  RelicRules: { readonly game_id: number; readonly rules: readonly ({ readonly rate_bps: number; readonly duration: number; readonly uses: number; readonly essence_cost: bigint; readonly draw_weight: bigint })[] };
  RelicDiscovery: { readonly game_id: number; readonly last_at: bigint };
  DepositRules: { readonly game_id: number; readonly paused: boolean; readonly realm_fee_bps: number; readonly velords_fee_bps: number; readonly season_fee_bps: number; readonly client_fee_bps: number };
  WithdrawalRules: { readonly game_id: number; readonly paused: boolean; readonly bank_fee_bps: number; readonly velords_fee_bps: number; readonly season_fee_bps: number; readonly client_fee_bps: number; readonly velords_recipient: bigint; readonly season_recipient: bigint; readonly retention: readonly ({ readonly troop_percent: number; readonly resource_percent: number })[] };
  ResourceToken: { readonly game_id: number; readonly resource_type: number; readonly token: bigint };
  BankRules: { readonly game_id: number; readonly lp_fee_num: number; readonly lp_fee_denom: number; readonly owner_fee_num: number; readonly owner_fee_denom: number };
  BankName: { readonly game_id: number; readonly entity_id: number; readonly name: bigint };
  Market: { readonly game_id: number; readonly resource_type: number; readonly lords: bigint; readonly resource: bigint; readonly shares: bigint };
  Liquidity: { readonly game_id: number; readonly owner: bigint; readonly resource_type: number; readonly shares: bigint };
  TradeOrder: { readonly game_id: number; readonly trade_id: number; readonly maker_id: number; readonly taker_id: number; readonly offered_resource: number; readonly requested_resource: number; readonly offered_per_lot: bigint; readonly requested_per_lot: bigint; readonly remaining_lots: bigint; readonly expires_at: number };
  TradeRules: { readonly game_id: number; readonly max_count: number };
  Guard: { readonly game_id: number; readonly structure_id: number; readonly slot: number; readonly troops: { readonly category: "Knight" | "Paladin" | "Crossbowman"; readonly tier: "T1" | "T2" | "T3"; readonly count: bigint; readonly stamina: { readonly amount: bigint; readonly updated_tick: bigint }; readonly boosts: { readonly incr_damage_dealt_percent_num: number; readonly incr_damage_dealt_end_tick: number; readonly decr_damage_gotten_percent_num: number; readonly decr_damage_gotten_end_tick: number; readonly incr_stamina_regen_percent_num: number; readonly incr_stamina_regen_tick_count: number; readonly incr_explore_reward_percent_num: number; readonly incr_explore_reward_end_tick: number }; readonly battle_cooldown_end: number }; readonly destroyed_tick: number };
  VillageRaid: { readonly game_id: number; readonly entity_id: number; readonly last_tick: bigint };
  BitcoinMine: { readonly game_id: number; readonly entity_id: number; readonly eligible_from: bigint; readonly next_phase: bigint; readonly unsplit_carry: bigint; readonly winner_carry: bigint };
  BitcoinClaim: { readonly game_id: number; readonly phase: bigint; readonly mine_id: number; readonly claimed: boolean };
  BitcoinPhase: { readonly game_id: number; readonly phase: bigint; readonly total_labor: bigint; readonly contributors: number; readonly state: "Open" | "Closed" | "Bound"; readonly root: bigint };
  BitcoinContribution: { readonly game_id: number; readonly phase: bigint; readonly player: bigint; readonly labor: bigint; readonly structure_id: number };
  MineKindConfig: { readonly game_id: number; readonly kind: number; readonly resource_type: number; readonly building_category: number; readonly production_rate: bigint; readonly cap_min: bigint; readonly cap_steps: number };
  MinePool: { readonly game_id: number; readonly weights: readonly ({ readonly kind: number; readonly weight: number })[] };
  RealmTraits: { readonly realm_id: number; readonly wonder: number; readonly order: number; readonly resources: readonly (number)[] };
  BlitzSettlementOrder: { readonly game_id: number; readonly players: readonly (number)[] };
  BlitzRoster: { readonly game_id: number; readonly players: readonly ({ readonly owner: bigint; readonly account: bigint })[] };
  RealmCatalogue: { readonly address: bigint; readonly initialized: number; readonly digest: bigint };
  RealmGrants: { readonly game_id: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly starting_troops: readonly ("Knight" | "Paladin" | "Crossbowman")[]; readonly realm_resources: readonly (number)[] };
  HyperstructureReservations: { readonly game_id: number; readonly placed: number };
  SettlementRules: { readonly game_id: number; readonly registration_start: number; readonly registration_limit: number; readonly mode: "Single" | "Triple" | "Duel"; readonly reward_profile: number };
  SettlementProgress: { readonly game_id: number; readonly registered: number; readonly realm_count: number };
  SettlementPool: { readonly game_id: number; readonly opened: number; readonly available: readonly ({ readonly coords: readonly ({ readonly alt: boolean; readonly x: number; readonly y: number })[] })[] };
  VillageRules: { readonly game_id: number; readonly troop_delay_ticks: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly resource_pool: readonly ({ readonly resource_type: number; readonly weight: bigint })[] };
  VillagePass: { readonly game_id: number; readonly pass_id: number; readonly owner: bigint; readonly village_id: number };
  VillagePool: { readonly game_id: number; readonly opened: number; readonly available: readonly ({ readonly coords: readonly ({ readonly alt: boolean; readonly x: number; readonly y: number })[] })[] };
  EntryEntitlement: { readonly game_id: number; readonly owner: bigint; readonly realm_id: bigint; readonly metadata_1: bigint; readonly metadata_2: bigint; readonly metadata_3: bigint; readonly pass_kind: number };
  PlayerEntry: { readonly game_id: number; readonly owner: bigint; readonly player: bigint };
  TileOpt: { readonly game_id: number; readonly alt: boolean; readonly col: number; readonly row: number; readonly data: bigint };
  ExplorerTroops: { readonly game_id: number; readonly explorer_id: number; readonly owner: number; readonly troops: { readonly category: "Knight" | "Paladin" | "Crossbowman"; readonly tier: "T1" | "T2" | "T3"; readonly count: bigint; readonly stamina: { readonly amount: bigint; readonly updated_tick: bigint }; readonly boosts: { readonly incr_damage_dealt_percent_num: number; readonly incr_damage_dealt_end_tick: number; readonly decr_damage_gotten_percent_num: number; readonly decr_damage_gotten_end_tick: number; readonly incr_stamina_regen_percent_num: number; readonly incr_stamina_regen_tick_count: number; readonly incr_explore_reward_percent_num: number; readonly incr_explore_reward_end_tick: number }; readonly battle_cooldown_end: number }; readonly coord: { readonly alt: boolean; readonly x: number; readonly y: number } };
  Structure: { readonly game_id: number; readonly entity_id: number; readonly owner: bigint; readonly base: { readonly troop_explorer_count: number; readonly troop_max_guard_count: number; readonly troop_max_explorer_count: number; readonly created_at: number; readonly category: number; readonly coord_x: number; readonly coord_y: number; readonly level: number; readonly starting_troops_granted: boolean; readonly alt: boolean }; readonly troop_explorers: readonly (number)[]; readonly resources_packed: bigint; readonly metadata: { readonly realm_id: number; readonly order: number; readonly has_wonder: boolean; readonly village_realm: number; readonly mine_kind: number } };
  ResourceBalance: { readonly game_id: number; readonly entity_id: number; readonly resource_type: number; readonly balance: bigint };
  ResourceProduction: { readonly game_id: number; readonly entity_id: number; readonly resource_type: number; readonly building_count: number; readonly production_rate: bigint; readonly output_amount_left: bigint; readonly last_updated_at: number };
  ProductionBonus: { readonly game_id: number; readonly entity_id: number; readonly incr_resource_rate_percent_num: number; readonly incr_labor_rate_percent_num: number; readonly incr_troop_rate_percent_num: number; readonly incr_resource_rate_end_tick: number; readonly incr_labor_rate_end_tick: number; readonly incr_troop_rate_end_tick: number };
  ProductionRecipe: { readonly game_id: number; readonly resource_type: number; readonly simple_output: bigint; readonly complex_output: bigint; readonly simple_inputs: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly complex_inputs: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  ProductionReady: { readonly game_id: number; readonly ready: boolean };
  ResourceWeight: { readonly game_id: number; readonly entity_id: number; readonly capacity: bigint; readonly weight: bigint };
  ResourceArrival: { readonly game_id: number; readonly entity_id: number; readonly day: bigint; readonly slot: number; readonly resources: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  ResourceAllowance: { readonly game_id: number; readonly owner_entity_id: number; readonly approved_entity_id: number; readonly resource_type: number; readonly amount: bigint };
  BuildingRule: { readonly game_id: number; readonly category: number; readonly population_cost: number; readonly capacity_grant: number; readonly simple_cost: readonly ({ readonly resource_type: number; readonly amount: bigint })[]; readonly complex_cost: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  BuildingRulesReady: { readonly game_id: number; readonly ready: boolean };
  Building: { readonly game_id: number; readonly alt: boolean; readonly outer_col: number; readonly outer_row: number; readonly inner_col: number; readonly inner_row: number; readonly category: number; readonly outer_entity_id: number; readonly paused: boolean };
  StructureBuildings: { readonly game_id: number; readonly entity_id: number; readonly packed_counts_1: bigint; readonly packed_counts_2: bigint; readonly packed_counts_3: bigint; readonly population: { readonly current: number; readonly max: number } };
  Hyperstructure: { readonly game_id: number; readonly entity_id: number; readonly stage: "Foundation" | "Construction" | "Complete"; readonly access: "Public" | "Private" | "GuildOnly"; readonly seed: bigint };
  HyperstructureProgress: { readonly game_id: number; readonly entity_id: number; readonly resource_type: number; readonly contributed: bigint };
  HyperstructureShares: { readonly game_id: number; readonly entity_id: number; readonly start_at: bigint; readonly multiplier: number; readonly shareholders: readonly ({ readonly player: bigint; readonly bps: number })[] };
  HyperstructureRules: { readonly game_id: number; readonly initialize_shards: bigint; readonly resources: readonly ({ readonly resource_type: number; readonly minimum: number; readonly maximum: number; readonly points: bigint })[] };
  AddressName: { readonly address: bigint; readonly name: bigint };
  EntityName: { readonly game_id: number; readonly entity_id: number; readonly name: bigint };
  WonderFaith: { readonly game_id: number; readonly wonder_id: number; readonly last_recorded_owner: bigint; readonly claimed_points: bigint; readonly claim_per_sec: number; readonly claim_last_at: bigint; readonly owner_claim_per_sec: number; readonly num_structures_pledged: number };
  FaithfulStructure: { readonly game_id: number; readonly structure_id: number; readonly wonder_id: number; readonly faithful_since: bigint; readonly fp_to_wonder_owner_per_sec: number; readonly fp_to_struct_owner_per_sec: number; readonly last_recorded_owner: bigint };
  PlayerFaithPoints: { readonly game_id: number; readonly player: bigint; readonly wonder_id: number; readonly points_claimed: bigint; readonly points_per_sec_as_owner: number; readonly points_per_sec_as_pledger: number; readonly last_updated_at: bigint };
  ResourceRule: { readonly game_id: number; readonly resource_type: number; readonly unit_weight: bigint; readonly realm_rate: bigint; readonly village_rate: bigint; readonly labor_output_per_resource: bigint };
  ResourceRulesReady: { readonly game_id: number; readonly ready: boolean };
  UpgradeLimits: { readonly game_id: number; readonly realm_max: number; readonly village_max: number };
  UpgradeRecipe: { readonly game_id: number; readonly level: number; readonly costs: readonly ({ readonly resource_type: number; readonly amount: bigint })[] };
  GameRegistry: { readonly game_id: number; readonly name: bigint; readonly preset_id: number; readonly creator: bigint; readonly settled: boolean; readonly ready: boolean; readonly dev_mode_on: boolean; readonly start_settling_at: bigint; readonly start_main_at: bigint; readonly end_at: bigint; readonly end_grace_seconds: number; readonly seed: bigint };
  SliceRules: { readonly game_id: number; readonly battle_config: { readonly regular_immunity_ticks: number; readonly village_immunity_ticks: number; readonly village_raid_immunity_ticks: number }; readonly map_config: { readonly reward_resource_amount: number; readonly shards_mines_win_probability: number; readonly shards_mines_fail_probability: number; readonly camp_win_probability: number; readonly camp_fail_probability: number; readonly holysite_win_probability: number; readonly holysite_fail_probability: number; readonly bitcoin_mine_win_probability: number; readonly bitcoin_mine_fail_probability: number; readonly hyps_win_prob: number; readonly hyps_fail_prob: number; readonly hyps_fail_prob_increase_p_hex: number; readonly hyps_fail_prob_increase_p_fnd: number; readonly relic_discovery_interval_sec: number; readonly relic_hex_dist_from_center: number; readonly relic_chest_relics_per_chest: number }; readonly biome_climate_config: { readonly elevation_scale_bps: number; readonly moisture_scale_bps: number; readonly elevation_bias_bps: number; readonly moisture_bias_bps: number; readonly elevation_seed: number; readonly moisture_seed: number }; readonly tick_config: { readonly armies_tick_in_seconds: bigint; readonly delivery_tick_in_seconds: bigint; readonly bitcoin_phase_in_seconds: bigint }; readonly troop_damage_config: { readonly damage_raid_percent_num: number; readonly damage_biome_bonus_num: number; readonly damage_scaling_factor: bigint; readonly t1_damage_value: bigint; readonly t2_damage_multiplier: bigint; readonly t3_damage_multiplier: bigint }; readonly troop_stamina_config: { readonly stamina_gain_per_tick: number; readonly stamina_initial: number; readonly stamina_bonus_value: number; readonly stamina_knight_max: number; readonly stamina_paladin_max: number; readonly stamina_crossbowman_max: number; readonly stamina_attack_req: number; readonly stamina_defense_req: number; readonly stamina_explore_stamina_cost: number; readonly stamina_travel_stamina_cost: number; readonly stamina_explore_wheat_cost: number; readonly stamina_explore_fish_cost: number; readonly stamina_travel_wheat_cost: number; readonly stamina_travel_fish_cost: number }; readonly troop_limit_config: { readonly guard_resurrection_delay: number; readonly mercenaries_troop_lower_bound: number; readonly mercenaries_troop_upper_bound: number; readonly settlement_deployment_cap: number; readonly city_deployment_cap: number; readonly kingdom_deployment_cap: number; readonly empire_deployment_cap: number; readonly t1_tier_strength: number; readonly t2_tier_strength: number; readonly t3_tier_strength: number; readonly t1_tier_modifier: number; readonly t2_tier_modifier: number; readonly t3_tier_modifier: number }; readonly capacity_config: { readonly troop_capacity: number; readonly donkey_capacity: number; readonly storehouse_boost_capacity: number }; readonly structure_capacity_config: { readonly realm_capacity: bigint; readonly village_capacity: bigint; readonly hyperstructure_capacity: bigint; readonly fragment_mine_capacity: bigint; readonly bank_structure_capacity: bigint; readonly camp_capacity: bigint; readonly bitcoin_mine_capacity: bigint }; readonly building_config: { readonly base_population: number; readonly base_cost_percent_increase: number }; readonly bitcoin_mine_config: { readonly enabled: boolean; readonly prize_per_phase: bigint; readonly min_labor_per_contribution: bigint; readonly owner_cut_bps: number }; readonly victory_points_grant_config: { readonly hyp_points_per_second: number; readonly claim_hyperstructure_points: number; readonly claim_otherstructure_points: number; readonly explore_tiles_points: number; readonly relic_open_points: number }; readonly map_center_offset: number; readonly spire_travel_essence_cost: bigint; readonly blitz_mode_on: boolean; readonly faith_enabled: boolean; readonly speed_config: { readonly donkey_sec_per_km: number; readonly donkey_sec_per_km_troops: number } };
  EntitySequence: { readonly game_id: number; readonly next_entity_id: number };
  PlayerPoints: { readonly game_id: number; readonly address: bigint; readonly points: bigint };
  PointsTotal: { readonly game_id: number; readonly total: bigint };
  DomainState: { readonly address: bigint; readonly authority: bigint; readonly peers: { readonly season: bigint; readonly map: bigint; readonly structures: bigint; readonly troops: bigint; readonly settlement: bigint; readonly resources: bigint; readonly economy: bigint; readonly prizes: bigint; readonly registry: bigint; readonly combat: bigint; readonly bridge: bigint }; readonly active: boolean };
  DomainClass: { readonly address: bigint; readonly class_hash: bigint };
  Authentication: { readonly address: bigint; readonly submitter: bigint; readonly registry: bigint; readonly account_class: bigint };
  OwnershipRulesReady: { readonly game_id: number; readonly ready: boolean };
  ActionNonce: { readonly game_id: number; readonly actor: bigint; readonly next_nonce: bigint };
}
export interface NativeKeys {
  Preset: { readonly preset_id: number };
  GameSequence: { readonly address: bigint };
  SpireLayout: { readonly game_id: number };
  LedgerOperator: { readonly address: bigint };
  CampResources: { readonly game_id: number };
  Guild: { readonly game_id: number; readonly guild_id: bigint };
  GuildMember: { readonly game_id: number; readonly actor: bigint };
  GuildWhitelist: { readonly game_id: number; readonly guild_id: bigint; readonly player: bigint };
  ArtificerCost: { readonly game_id: number };
  BlitzResult: { readonly game_id: number };
  FaithRewardToken: { readonly game_id: number };
  FaithPrizePool: { readonly game_id: number };
  FaithPrizeClaimed: { readonly game_id: number; readonly player: bigint; readonly wonder_id: number };
  FaithRules: { readonly game_id: number };
  FaithBlacklist: { readonly game_id: number; readonly wonder_id: number; readonly blocked_id: bigint };
  SeasonWinThreshold: { readonly game_id: number };
  ExtractionRewards: { readonly game_id: number };
  RelicRules: { readonly game_id: number };
  RelicDiscovery: { readonly game_id: number };
  DepositRules: { readonly game_id: number };
  WithdrawalRules: { readonly game_id: number };
  ResourceToken: { readonly game_id: number; readonly resource_type: number };
  BankRules: { readonly game_id: number };
  BankName: { readonly game_id: number; readonly entity_id: number };
  Market: { readonly game_id: number; readonly resource_type: number };
  Liquidity: { readonly game_id: number; readonly owner: bigint; readonly resource_type: number };
  TradeOrder: { readonly game_id: number; readonly trade_id: number };
  TradeRules: { readonly game_id: number };
  Guard: { readonly game_id: number; readonly structure_id: number; readonly slot: number };
  VillageRaid: { readonly game_id: number; readonly entity_id: number };
  BitcoinMine: { readonly game_id: number; readonly entity_id: number };
  BitcoinClaim: { readonly game_id: number; readonly phase: bigint; readonly mine_id: number };
  BitcoinPhase: { readonly game_id: number; readonly phase: bigint };
  BitcoinContribution: { readonly game_id: number; readonly phase: bigint; readonly player: bigint };
  MineKindConfig: { readonly game_id: number; readonly kind: number };
  MinePool: { readonly game_id: number };
  RealmTraits: { readonly realm_id: number };
  BlitzSettlementOrder: { readonly game_id: number };
  BlitzRoster: { readonly game_id: number };
  RealmCatalogue: { readonly address: bigint };
  RealmGrants: { readonly game_id: number };
  HyperstructureReservations: { readonly game_id: number };
  SettlementRules: { readonly game_id: number };
  SettlementProgress: { readonly game_id: number };
  SettlementPool: { readonly game_id: number };
  VillageRules: { readonly game_id: number };
  VillagePass: { readonly game_id: number; readonly pass_id: number };
  VillagePool: { readonly game_id: number };
  EntryEntitlement: { readonly game_id: number; readonly owner: bigint };
  PlayerEntry: { readonly game_id: number; readonly owner: bigint };
  TileOpt: { readonly game_id: number; readonly alt: boolean; readonly col: number; readonly row: number };
  ExplorerTroops: { readonly game_id: number; readonly explorer_id: number };
  Structure: { readonly game_id: number; readonly entity_id: number };
  ResourceBalance: { readonly game_id: number; readonly entity_id: number; readonly resource_type: number };
  ResourceProduction: { readonly game_id: number; readonly entity_id: number; readonly resource_type: number };
  ProductionBonus: { readonly game_id: number; readonly entity_id: number };
  ProductionRecipe: { readonly game_id: number; readonly resource_type: number };
  ProductionReady: { readonly game_id: number };
  ResourceWeight: { readonly game_id: number; readonly entity_id: number };
  ResourceArrival: { readonly game_id: number; readonly entity_id: number; readonly day: bigint; readonly slot: number };
  ResourceAllowance: { readonly game_id: number; readonly owner_entity_id: number; readonly approved_entity_id: number; readonly resource_type: number };
  BuildingRule: { readonly game_id: number; readonly category: number };
  BuildingRulesReady: { readonly game_id: number };
  Building: { readonly game_id: number; readonly alt: boolean; readonly outer_col: number; readonly outer_row: number; readonly inner_col: number; readonly inner_row: number };
  StructureBuildings: { readonly game_id: number; readonly entity_id: number };
  Hyperstructure: { readonly game_id: number; readonly entity_id: number };
  HyperstructureProgress: { readonly game_id: number; readonly entity_id: number; readonly resource_type: number };
  HyperstructureShares: { readonly game_id: number; readonly entity_id: number };
  HyperstructureRules: { readonly game_id: number };
  AddressName: { readonly address: bigint };
  EntityName: { readonly game_id: number; readonly entity_id: number };
  WonderFaith: { readonly game_id: number; readonly wonder_id: number };
  FaithfulStructure: { readonly game_id: number; readonly structure_id: number };
  PlayerFaithPoints: { readonly game_id: number; readonly player: bigint; readonly wonder_id: number };
  ResourceRule: { readonly game_id: number; readonly resource_type: number };
  ResourceRulesReady: { readonly game_id: number };
  UpgradeLimits: { readonly game_id: number };
  UpgradeRecipe: { readonly game_id: number; readonly level: number };
  GameRegistry: { readonly game_id: number };
  SliceRules: { readonly game_id: number };
  EntitySequence: { readonly game_id: number };
  PlayerPoints: { readonly game_id: number; readonly address: bigint };
  PointsTotal: { readonly game_id: number };
  DomainState: { readonly address: bigint };
  DomainClass: { readonly address: bigint };
  Authentication: { readonly address: bigint };
  OwnershipRulesReady: { readonly game_id: number };
  ActionNonce: { readonly game_id: number; readonly actor: bigint };
}
export type NativeModelName = keyof NativeRows;
export const nativeFactModels = {
  "Preset": {
    "keys": [
      "preset_id"
    ],
    "scope": "deployment",
    "fields": {
      "preset_id": "u32",
      "commitment": "felt"
    }
  },
  "GameSequence": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "next_game_id": "u32"
    }
  },
  "SpireLayout": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "count": "u16",
      "base_distance": "u8",
      "layer_distance": "u8",
      "max_layer": "u8"
    }
  },
  "LedgerOperator": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "operator": "felt"
    }
  },
  "CampResources": {
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
      ]
    }
  },
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
  "ArtificerCost": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "research": "u128"
    }
  },
  "BlitzResult": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "players": [
        {
          "player": "felt",
          "points": "u128",
          "rank": "u8"
        }
      ],
      "complete": "boolean",
      "commitment": "felt"
    }
  },
  "FaithRewardToken": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "token": "felt"
    }
  },
  "FaithPrizePool": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "funded": "u128",
      "distributed": "boolean"
    }
  },
  "FaithPrizeClaimed": {
    "keys": [
      "game_id",
      "player",
      "wonder_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "player": "felt",
      "wonder_id": "u32",
      "claimed": "boolean"
    }
  },
  "FaithRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "wonder_rate": "u16",
      "realm_rate": "u16",
      "village_rate": "u16",
      "owner_share_bps": "u16"
    }
  },
  "FaithBlacklist": {
    "keys": [
      "game_id",
      "wonder_id",
      "blocked_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "wonder_id": "u32",
      "blocked_id": "felt",
      "blocked": "boolean"
    }
  },
  "SeasonWinThreshold": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "points": "u128"
    }
  },
  "ExtractionRewards": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "rewards": [
        {
          "resource_type": "u8",
          "amount": "u128",
          "weight": "u128"
        }
      ]
    }
  },
  "RelicRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "rules": [
        {
          "rate_bps": "u16",
          "duration": "u32",
          "uses": "u8",
          "essence_cost": "u128",
          "draw_weight": "u128"
        }
      ]
    }
  },
  "RelicDiscovery": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "last_at": "u64"
    }
  },
  "DepositRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "paused": "boolean",
      "realm_fee_bps": "u16",
      "velords_fee_bps": "u16",
      "season_fee_bps": "u16",
      "client_fee_bps": "u16"
    }
  },
  "WithdrawalRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "paused": "boolean",
      "bank_fee_bps": "u16",
      "velords_fee_bps": "u16",
      "season_fee_bps": "u16",
      "client_fee_bps": "u16",
      "velords_recipient": "felt",
      "season_recipient": "felt",
      "retention": [
        {
          "troop_percent": "u8",
          "resource_percent": "u8"
        }
      ]
    }
  },
  "ResourceToken": {
    "keys": [
      "game_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "resource_type": "u8",
      "token": "felt"
    }
  },
  "BankRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "lp_fee_num": "u32",
      "lp_fee_denom": "u32",
      "owner_fee_num": "u32",
      "owner_fee_denom": "u32"
    }
  },
  "BankName": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "name": "felt"
    }
  },
  "Market": {
    "keys": [
      "game_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "resource_type": "u8",
      "lords": "u128",
      "resource": "u128",
      "shares": "u128"
    }
  },
  "Liquidity": {
    "keys": [
      "game_id",
      "owner",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "owner": "felt",
      "resource_type": "u8",
      "shares": "u128"
    }
  },
  "TradeOrder": {
    "keys": [
      "game_id",
      "trade_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "trade_id": "u32",
      "maker_id": "u32",
      "taker_id": "u32",
      "offered_resource": "u8",
      "requested_resource": "u8",
      "offered_per_lot": "u64",
      "requested_per_lot": "u64",
      "remaining_lots": "u64",
      "expires_at": "u32"
    }
  },
  "TradeRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "max_count": "u8"
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
      "structure_id": "u32",
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
          "amount": "u64",
          "updated_tick": "u64"
        },
        "boosts": {
          "incr_damage_dealt_percent_num": "u16",
          "incr_damage_dealt_end_tick": "u32",
          "decr_damage_gotten_percent_num": "u16",
          "decr_damage_gotten_end_tick": "u32",
          "incr_stamina_regen_percent_num": "u16",
          "incr_stamina_regen_tick_count": "u8",
          "incr_explore_reward_percent_num": "u16",
          "incr_explore_reward_end_tick": "u32"
        },
        "battle_cooldown_end": "u32"
      },
      "destroyed_tick": "u32"
    }
  },
  "VillageRaid": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "last_tick": "u64"
    }
  },
  "BitcoinMine": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "eligible_from": "u64",
      "next_phase": "u64",
      "unsplit_carry": "u128",
      "winner_carry": "u128"
    }
  },
  "BitcoinClaim": {
    "keys": [
      "game_id",
      "phase",
      "mine_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "phase": "u64",
      "mine_id": "u32",
      "claimed": "boolean"
    }
  },
  "BitcoinPhase": {
    "keys": [
      "game_id",
      "phase"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "phase": "u64",
      "total_labor": "u128",
      "contributors": "u32",
      "state": {
        "enum": [
          "Open",
          "Closed",
          "Bound"
        ]
      },
      "root": "u256"
    }
  },
  "BitcoinContribution": {
    "keys": [
      "game_id",
      "phase",
      "player"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "phase": "u64",
      "player": "felt",
      "labor": "u128",
      "structure_id": "u32"
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
  "BlitzSettlementOrder": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "players": [
        "u8"
      ]
    }
  },
  "BlitzRoster": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "players": [
        {
          "owner": "felt",
          "account": "felt"
        }
      ]
    }
  },
  "RealmCatalogue": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "initialized": "u32",
      "digest": "felt"
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
  "HyperstructureReservations": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "placed": "u32"
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
          "Triple",
          "Duel"
        ]
      },
      "reward_profile": "u8"
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
      "village_id": "u32"
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
  "ExplorerTroops": {
    "keys": [
      "game_id",
      "explorer_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "explorer_id": "u32",
      "owner": "u32",
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
          "amount": "u64",
          "updated_tick": "u64"
        },
        "boosts": {
          "incr_damage_dealt_percent_num": "u16",
          "incr_damage_dealt_end_tick": "u32",
          "decr_damage_gotten_percent_num": "u16",
          "decr_damage_gotten_end_tick": "u32",
          "incr_stamina_regen_percent_num": "u16",
          "incr_stamina_regen_tick_count": "u8",
          "incr_explore_reward_percent_num": "u16",
          "incr_explore_reward_end_tick": "u32"
        },
        "battle_cooldown_end": "u32"
      },
      "coord": {
        "alt": "boolean",
        "x": "u32",
        "y": "u32"
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
      "entity_id": "u32",
      "owner": "felt",
      "base": {
        "troop_explorer_count": "u16",
        "troop_max_guard_count": "u8",
        "troop_max_explorer_count": "u16",
        "created_at": "u32",
        "category": "u8",
        "coord_x": "u32",
        "coord_y": "u32",
        "level": "u8",
        "starting_troops_granted": "boolean",
        "alt": "boolean"
      },
      "troop_explorers": [
        "u32"
      ],
      "resources_packed": "u128",
      "metadata": {
        "realm_id": "u16",
        "order": "u8",
        "has_wonder": "boolean",
        "village_realm": "u32",
        "mine_kind": "u8"
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
      "entity_id": "u32",
      "resource_type": "u8",
      "balance": "u128"
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
      "entity_id": "u32",
      "resource_type": "u8",
      "building_count": "u8",
      "production_rate": "u64",
      "output_amount_left": "u128",
      "last_updated_at": "u32"
    }
  },
  "ProductionBonus": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "incr_resource_rate_percent_num": "u16",
      "incr_labor_rate_percent_num": "u16",
      "incr_troop_rate_percent_num": "u16",
      "incr_resource_rate_end_tick": "u32",
      "incr_labor_rate_end_tick": "u32",
      "incr_troop_rate_end_tick": "u32"
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
  "ProductionReady": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "ready": "boolean"
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
      "entity_id": "u32",
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
      "entity_id": "u32",
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
  "ResourceAllowance": {
    "keys": [
      "game_id",
      "owner_entity_id",
      "approved_entity_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "owner_entity_id": "u32",
      "approved_entity_id": "u32",
      "resource_type": "u8",
      "amount": "u128"
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
  "BuildingRulesReady": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "ready": "boolean"
    }
  },
  "Building": {
    "keys": [
      "game_id",
      "alt",
      "outer_col",
      "outer_row",
      "inner_col",
      "inner_row"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "alt": "boolean",
      "outer_col": "u32",
      "outer_row": "u32",
      "inner_col": "u32",
      "inner_row": "u32",
      "category": "u8",
      "outer_entity_id": "u32",
      "paused": "boolean"
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
      "entity_id": "u32",
      "packed_counts_1": "u128",
      "packed_counts_2": "u128",
      "packed_counts_3": "u128",
      "population": {
        "current": "u32",
        "max": "u32"
      }
    }
  },
  "Hyperstructure": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "stage": {
        "enum": [
          "Foundation",
          "Construction",
          "Complete"
        ]
      },
      "access": {
        "enum": [
          "Public",
          "Private",
          "GuildOnly"
        ]
      },
      "seed": "felt"
    }
  },
  "HyperstructureProgress": {
    "keys": [
      "game_id",
      "entity_id",
      "resource_type"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "resource_type": "u8",
      "contributed": "u128"
    }
  },
  "HyperstructureShares": {
    "keys": [
      "game_id",
      "entity_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "entity_id": "u32",
      "start_at": "u64",
      "multiplier": "u8",
      "shareholders": [
        {
          "player": "felt",
          "bps": "u16"
        }
      ]
    }
  },
  "HyperstructureRules": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "initialize_shards": "u128",
      "resources": [
        {
          "resource_type": "u8",
          "minimum": "u32",
          "maximum": "u32",
          "points": "u64"
        }
      ]
    }
  },
  "AddressName": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "name": "felt"
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
      "entity_id": "u32",
      "name": "felt"
    }
  },
  "WonderFaith": {
    "keys": [
      "game_id",
      "wonder_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "wonder_id": "u32",
      "last_recorded_owner": "felt",
      "claimed_points": "u128",
      "claim_per_sec": "u32",
      "claim_last_at": "u64",
      "owner_claim_per_sec": "u32",
      "num_structures_pledged": "u32"
    }
  },
  "FaithfulStructure": {
    "keys": [
      "game_id",
      "structure_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "structure_id": "u32",
      "wonder_id": "u32",
      "faithful_since": "u64",
      "fp_to_wonder_owner_per_sec": "u16",
      "fp_to_struct_owner_per_sec": "u16",
      "last_recorded_owner": "felt"
    }
  },
  "PlayerFaithPoints": {
    "keys": [
      "game_id",
      "player",
      "wonder_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "player": "felt",
      "wonder_id": "u32",
      "points_claimed": "u128",
      "points_per_sec_as_owner": "u32",
      "points_per_sec_as_pledger": "u32",
      "last_updated_at": "u64"
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
      "village_rate": "u64",
      "labor_output_per_resource": "u64"
    }
  },
  "ResourceRulesReady": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "ready": "boolean"
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
  "GameRegistry": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "name": "felt",
      "preset_id": "u32",
      "creator": "felt",
      "settled": "boolean",
      "ready": "boolean",
      "dev_mode_on": "boolean",
      "start_settling_at": "u64",
      "start_main_at": "u64",
      "end_at": "u64",
      "end_grace_seconds": "u32",
      "seed": "felt"
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
        "village_raid_immunity_ticks": "u8"
      },
      "map_config": {
        "reward_resource_amount": "u16",
        "shards_mines_win_probability": "u16",
        "shards_mines_fail_probability": "u16",
        "camp_win_probability": "u16",
        "camp_fail_probability": "u16",
        "holysite_win_probability": "u16",
        "holysite_fail_probability": "u16",
        "bitcoin_mine_win_probability": "u16",
        "bitcoin_mine_fail_probability": "u16",
        "hyps_win_prob": "u32",
        "hyps_fail_prob": "u32",
        "hyps_fail_prob_increase_p_hex": "u16",
        "hyps_fail_prob_increase_p_fnd": "u16",
        "relic_discovery_interval_sec": "u16",
        "relic_hex_dist_from_center": "u8",
        "relic_chest_relics_per_chest": "u8"
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
        "delivery_tick_in_seconds": "u64",
        "bitcoin_phase_in_seconds": "u64"
      },
      "troop_damage_config": {
        "damage_raid_percent_num": "u16",
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
        "stamina_travel_fish_cost": "u32"
      },
      "troop_limit_config": {
        "guard_resurrection_delay": "u16",
        "mercenaries_troop_lower_bound": "u16",
        "mercenaries_troop_upper_bound": "u16",
        "settlement_deployment_cap": "u32",
        "city_deployment_cap": "u32",
        "kingdom_deployment_cap": "u32",
        "empire_deployment_cap": "u32",
        "t1_tier_strength": "u8",
        "t2_tier_strength": "u8",
        "t3_tier_strength": "u8",
        "t1_tier_modifier": "u8",
        "t2_tier_modifier": "u8",
        "t3_tier_modifier": "u8"
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
        "camp_capacity": "u64",
        "bitcoin_mine_capacity": "u64"
      },
      "building_config": {
        "base_population": "u32",
        "base_cost_percent_increase": "u16"
      },
      "bitcoin_mine_config": {
        "enabled": "boolean",
        "prize_per_phase": "u128",
        "min_labor_per_contribution": "u128",
        "owner_cut_bps": "u16"
      },
      "victory_points_grant_config": {
        "hyp_points_per_second": "u32",
        "claim_hyperstructure_points": "u32",
        "claim_otherstructure_points": "u32",
        "explore_tiles_points": "u32",
        "relic_open_points": "u32"
      },
      "map_center_offset": "u32",
      "spire_travel_essence_cost": "u128",
      "blitz_mode_on": "boolean",
      "faith_enabled": "boolean",
      "speed_config": {
        "donkey_sec_per_km": "u16",
        "donkey_sec_per_km_troops": "u16"
      }
    }
  },
  "EntitySequence": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "next_entity_id": "u32"
    }
  },
  "PlayerPoints": {
    "keys": [
      "game_id",
      "address"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "address": "felt",
      "points": "u128"
    }
  },
  "PointsTotal": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "total": "u128"
    }
  },
  "DomainState": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "authority": "felt",
      "peers": {
        "season": "felt",
        "map": "felt",
        "structures": "felt",
        "troops": "felt",
        "settlement": "felt",
        "resources": "felt",
        "economy": "felt",
        "prizes": "felt",
        "registry": "felt",
        "combat": "felt",
        "bridge": "felt"
      },
      "active": "boolean"
    }
  },
  "DomainClass": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "class_hash": "felt"
    }
  },
  "Authentication": {
    "keys": [
      "address"
    ],
    "scope": "deployment",
    "fields": {
      "address": "felt",
      "submitter": "felt",
      "registry": "felt",
      "account_class": "felt"
    }
  },
  "OwnershipRulesReady": {
    "keys": [
      "game_id"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "ready": "boolean"
    }
  },
  "ActionNonce": {
    "keys": [
      "game_id",
      "actor"
    ],
    "scope": "game",
    "fields": {
      "game_id": "u32",
      "actor": "felt",
      "next_nonce": "u64"
    }
  }
} as const;
