// ExecutionRecorded v2 separates the rejection class from the full domain reason.
export const executionRecordedVersion = 2;

// Fact-only Cairo wire types replace the removed fixture getter ABIs.
// Production definitions, when present, must agree exactly with these fields.
export const factWireTypes = [
  {
    type: "struct",
    name: "world_native::settlement::SettlementRules",
    members: [
      {
        name: "registration_start",
        type: "core::integer::u32",
      },
      {
        name: "registration_limit",
        type: "core::integer::u16",
      },
      {
        name: "mode",
        type: "world_native::settlement::SettlementMode",
      },
      {
        name: "spacing",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::game::GameOverrides",
    members: [
      { name: "registration_start", type: "core::integer::u32" },
      { name: "biome_climate", type: "world_native::rules::BiomeClimateConfig" },
      { name: "map", type: "core::option::Option::<world_native::rules::MapConfig>" },
      { name: "map_center_offset", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::faith::WonderFaith",
    members: [
      { name: "last_recorded_owner", type: "core::starknet::contract_address::ContractAddress" },
      { name: "claimed_points", type: "core::integer::u128" },
      { name: "claim_per_sec", type: "core::integer::u32" },
      { name: "claim_last_at", type: "core::integer::u64" },
      { name: "owner_claim_per_sec", type: "core::integer::u32" },
      { name: "num_structures_pledged", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::faith::FaithfulStructure",
    members: [
      { name: "wonder_id", type: "core::integer::u32" },
      { name: "faithful_since", type: "core::integer::u64" },
      { name: "fp_to_wonder_owner_per_sec", type: "core::integer::u16" },
      { name: "fp_to_struct_owner_per_sec", type: "core::integer::u16" },
      { name: "last_recorded_owner", type: "core::starknet::contract_address::ContractAddress" },
    ],
  },
  {
    type: "struct",
    name: "world_native::arrivals::Arrival",
    members: [
      {
        name: "resources",
        type: "core::array::Span::<world_native::resources::ResourceAmount>",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::arrivals::ArrivalKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "entity_id",
        type: "core::integer::u32",
      },
      {
        name: "day",
        type: "core::integer::u64",
      },
      {
        name: "slot",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::bitcoin::ClaimKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "phase",
        type: "core::integer::u64",
      },
      {
        name: "mine_id",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::bitcoin::Contribution",
    members: [
      {
        name: "labor",
        type: "core::integer::u128",
      },
      {
        name: "structure_id",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::bitcoin::ContributionKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "phase",
        type: "core::integer::u64",
      },
      {
        name: "player",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::bitcoin::MineFunding",
    members: [
      {
        name: "eligible_from",
        type: "core::integer::u64",
      },
      {
        name: "next_phase",
        type: "core::integer::u64",
      },
      {
        name: "unsplit_carry",
        type: "core::integer::u128",
      },
      {
        name: "winner_carry",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::bitcoin::Phase",
    members: [
      {
        name: "total_labor",
        type: "core::integer::u128",
      },
      {
        name: "contributors",
        type: "core::integer::u32",
      },
      {
        name: "state",
        type: "world_native::bitcoin::PhaseStatus",
      },
      {
        name: "root",
        type: "core::integer::u256",
      },
    ],
  },
  {
    type: "enum",
    name: "world_native::bitcoin::PhaseStatus",
    variants: [
      {
        name: "Open",
        type: "()",
      },
      {
        name: "Closed",
        type: "()",
      },
      {
        name: "Bound",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::bitcoin::PhaseKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "phase",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::Building",
    members: [
      {
        name: "category",
        type: "core::integer::u8",
      },
      {
        name: "paused",
        type: "core::bool",
      },
      {
        name: "labor_paid",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::BuildingKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "structure_id",
        type: "core::integer::u32",
      },
      {
        name: "inner_col",
        type: "core::integer::u32",
      },
      {
        name: "inner_row",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::BuildingRuleKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "category",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::Population",
    members: [
      {
        name: "current",
        type: "core::integer::u32",
      },
      {
        name: "max",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::StructureBuildings",
    members: [
      {
        name: "packed_counts_1",
        type: "core::integer::u128",
      },
      {
        name: "packed_counts_2",
        type: "core::integer::u128",
      },
      {
        name: "packed_counts_3",
        type: "core::integer::u128",
      },
      {
        name: "population",
        type: "world_native::buildings::Population",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::faith::PlayerFaithKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "player",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "wonder_id",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::faith::PlayerFaithPoints",
    members: [
      {
        name: "points_claimed",
        type: "core::integer::u128",
      },
      {
        name: "points_per_sec_as_owner",
        type: "core::integer::u32",
      },
      {
        name: "points_per_sec_as_pledger",
        type: "core::integer::u32",
      },
      {
        name: "last_updated_at",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::game::GameRegistry",
    members: [
      {
        name: "name",
        type: "core::felt252",
      },
      {
        name: "preset_id",
        type: "core::integer::u32",
      },
      {
        name: "creator",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "settled",
        type: "core::bool",
      },
      {
        name: "ready",
        type: "core::bool",
      },
      {
        name: "dev_mode_on",
        type: "core::bool",
      },
      {
        name: "start_settling_at",
        type: "core::integer::u64",
      },
      {
        name: "start_main_at",
        type: "core::integer::u64",
      },
      {
        name: "end_at",
        type: "core::integer::u64",
      },
      {
        name: "end_grace_seconds",
        type: "core::integer::u32",
      },
      {
        name: "seed",
        type: "core::felt252",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::map::TileOccupancy",
    members: [
      { name: "entity_id", type: "core::integer::u32" },
      { name: "category", type: "core::integer::u8" },
      { name: "is_structure", type: "core::bool" },
    ],
  },
  {
    type: "struct",
    name: "world_native::troops::ExplorerRecord",
    members: [
      { name: "owner", type: "core::integer::u32" },
      { name: "troops", type: "world_native::troops::Troops" },
    ],
  },
  {
    type: "struct",
    name: "world_native::map::TileOpt",
    members: [
      {
        name: "data",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::market::LiquidityKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "resource_type",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::mines::MineKindKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "kind",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::names::EntityName",
    members: [
      {
        name: "name",
        type: "core::felt252",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::production::ProductionBonus",
    members: [
      {
        name: "incr_resource_rate_percent_num",
        type: "core::integer::u16",
      },
      {
        name: "incr_labor_rate_percent_num",
        type: "core::integer::u16",
      },
      {
        name: "incr_troop_rate_percent_num",
        type: "core::integer::u16",
      },
      {
        name: "incr_resource_rate_end_tick",
        type: "core::integer::u32",
      },
      {
        name: "incr_labor_rate_end_tick",
        type: "core::integer::u32",
      },
      {
        name: "incr_troop_rate_end_tick",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::production::RecipeKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "resource_type",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::realms::RealmCatalogue",
    members: [
      {
        name: "initialized",
        type: "core::integer::u32",
      },
      {
        name: "digest",
        type: "core::felt252",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::resources::Production",
    members: [
      {
        name: "building_count",
        type: "core::integer::u8",
      },
      {
        name: "production_rate",
        type: "core::integer::u64",
      },
      {
        name: "output_amount_left",
        type: "core::integer::u128",
      },
      {
        name: "last_updated_at",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::resources::Weight",
    members: [
      {
        name: "capacity",
        type: "core::integer::u128",
      },
      {
        name: "weight",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::settlement::PlayerEntry",
    members: [
      {
        name: "player",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::settlement::SettlementProgress",
    members: [
      {
        name: "registered",
        type: "core::integer::u16",
      },
      {
        name: "realm_count",
        type: "core::integer::u16",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::structures::Structure",
    members: [
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "base",
        type: "world_native::structures::StructureBase",
      },
      {
        name: "resources_packed",
        type: "core::integer::u128",
      },
      {
        name: "metadata",
        type: "world_native::structures::StructureMetadata",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::structures::StructureBase",
    members: [
      {
        name: "troop_max_guard_count",
        type: "core::integer::u8",
      },
      {
        name: "troop_max_explorer_count",
        type: "core::integer::u16",
      },
      {
        name: "created_at",
        type: "core::integer::u32",
      },
      {
        name: "category",
        type: "core::integer::u8",
      },
      {
        name: "level",
        type: "core::integer::u8",
      },
      {
        name: "starting_troops_granted",
        type: "core::bool",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::structures::StructureMetadata",
    members: [
      {
        name: "realm_id",
        type: "core::integer::u16",
      },
      {
        name: "order",
        type: "core::integer::u8",
      },
      {
        name: "has_wonder",
        type: "core::bool",
      },
      {
        name: "village_realm",
        type: "core::integer::u32",
      },
      {
        name: "mine_kind",
        type: "core::integer::u8",
      },
      {
        name: "attunement",
        type: "core::integer::u8",
      },
      {
        name: "barracks_tier",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::trade::TradeKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "trade_id",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::village::VillagePass",
    members: [
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "village_id",
        type: "core::integer::u32",
      },
    ],
  },
];

// Native row declarations are shared by schema generation, behavioural observations and client bindings.
export function defineFactModels({ struct, model: declare }) {
  const model = (...arguments_) => {
    const row = declare(...arguments_);
    if (row.name === "ResourceBalance" || row.name === "ResourceProduction")
      row.absence = {
        parent: "ResourceWeight",
        value: "zero",
        meaning:
          "Zero balance or inactive production while the resource owner exists; no resource owner after its weight row is deleted.",
      };
    if (row.name === "HyperstructureProgress")
      row.absence = {
        parent: "Hyperstructure",
        value: "zero",
        meaning: "No resource contribution to this hyperstructure.",
      };
    if (row.name === "HyperstructureShares")
      row.absence = {
        parent: "Hyperstructure",
        value: "empty",
        meaning: "No shareholder allocation or accrued share points.",
      };
    if (row.name === "Guard")
      row.absence = {
        parent: "Structure",
        value: "zero",
        meaning: "No troops or resurrection delay in this guard slot.",
      };
    if (row.name === "SettlementProgress")
      row.absence = {
        parent: "SettlementRules",
        value: "zero",
        meaning: "No players have settled or registered realms in this game.",
      };
    if (row.name === "BoardRules")
      row.absence = {
        parent: "GameRelease",
        value: "empty",
        meaning:
          "The verified preset has no board section; this game uses base building rates and grants without board bonuses or demolition refunds.",
      };
    if (row.name === "ChestRules")
      row.absence = { parent: "RelicRules", value: "empty", meaning: "This game uses interval relic chests." };
    if (row.name === "ChestPity" || row.name === "ChestTokens")
      row.absence = { value: "zero", meaning: "No chests have advanced this counter." };
    if (row.name === "VillageRaid")
      row.absence = { value: "zero", meaning: "The village has not been successfully raided." };
    if (row.name === "LedgerOperator")
      row.absence = {
        value: "zero",
        meaning: "No ledger relay is configured; non-development entry still requires an entitlement.",
      };
    if (row.name === "Guild" || row.name === "GuildMember")
      row.absence = { value: "empty", meaning: "No guild or membership exists for this key." };
    if (row.name === "GuildWhitelist") row.absence = { value: "false", meaning: "The player is not whitelisted." };
    if (row.name === "BlitzResult")
      row.absence = { value: "empty", meaning: "No result batch has been recorded for this game." };
    if (row.name === "FaithfulStructure")
      row.absence = { value: "empty", meaning: "The structure has no faith allegiance." };
    if (row.name === "ProductionBonus")
      row.absence = { value: "zero", meaning: "No production bonus has been granted to this structure." };
    if (row.name === "ResourceArrival")
      row.absence = { value: "empty", meaning: "No resources queued for this entity, day and slot." };
    const observation = behaviouralFacts[row.name];
    return observation ? { ...row, observation } : row;
  };
  const domainKey = [{ name: "address", type: "core::starknet::contract_address::ContractAddress" }];
  return [
    model(
      "Preset",
      "deployment",
      [{ name: "preset_id", type: "core::integer::u32" }],
      [{ name: "commitment", type: "core::felt252" }],
    ),
    model("GameSequence", "deployment", domainKey, [{ name: "next_game_id", type: "core::integer::u32" }], "address"),
    model("SpireLayout", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("spires::SpireLayout")),
    model(
      "LedgerOperator",
      "deployment",
      domainKey,
      [{ name: "operator", type: "core::starknet::contract_address::ContractAddress" }],
      "address",
    ),
    model(
      "CampResources",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "resources", type: "core::array::Span::<world_native::resources::ResourceAmount>" }],
    ),
    model(
      "Guild",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "guild_id", type: "core::starknet::contract_address::ContractAddress" },
      ],
      struct("guilds::Guild"),
    ),
    model(
      "GuildMember",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "actor", type: "core::starknet::contract_address::ContractAddress" },
      ],
      [{ name: "guild_id", type: "core::starknet::contract_address::ContractAddress" }],
    ),
    model("GuildWhitelist", "game", struct("guilds::WhitelistKey"), [{ name: "allowed", type: "core::bool" }]),
    model(
      "ArtificerCost",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "research", type: "core::integer::u128" }],
    ),
    model(
      "BlitzResult",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("blitz_results::BlitzResult"),
    ),
    model("FaithRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("faith::FaithRules")),
    model(
      "SeasonWinThreshold",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "points", type: "core::integer::u128" }],
    ),
    model(
      "ExtractionRewards",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "rewards", type: "core::array::Span::<world_native::exploration_rewards::ExplorationReward>" }],
    ),
    model(
      "RelicRules",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "rules", type: "core::array::Span::<world_native::relics::RelicRule>" }],
    ),
    model("ChestRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("relics::ChestRules")),
    model(
      "ChestPity",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "player", type: "core::starknet::contract_address::ContractAddress" },
        { name: "depth", type: "core::integer::u8" },
      ],
      [{ name: "count", type: "core::integer::u16" }],
    ),
    model(
      "ChestTokens",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "player", type: "core::starknet::contract_address::ContractAddress" },
        { name: "epoch", type: "core::integer::u64" },
      ],
      [{ name: "count", type: "core::integer::u16" }],
    ),
    model(
      "ChestReward",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "order", type: "core::integer::u64" },
        { name: "index", type: "core::integer::u32" },
      ],
      struct("relics::ChestReward"),
    ),
    model(
      "RelicDiscovery",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "last_at", type: "core::integer::u64" }],
    ),
    model("DepositRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("bridge::DepositRules")),
    model(
      "WithdrawalRules",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("withdrawals::WithdrawalRules"),
    ),
    model("ResourceToken", "game", struct("market::MarketKey"), [
      { name: "token", type: struct("withdrawals::ResourceToken")[1].type },
    ]),
    model("BankRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("market::BankRules")),
    model("BankName", "game", struct("resources::ResourceKey"), [{ name: "name", type: "core::felt252" }]),
    model("Market", "game", struct("market::MarketKey"), struct("market::Market")),
    model("Liquidity", "game", struct("market::LiquidityKey"), [{ name: "shares", type: "core::integer::u128" }]),
    model("TradeOrder", "game", struct("trade::TradeKey"), struct("trade::TradeOrder")),
    model("TradeRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("trade::TradeRules")),
    model("Guard", "game", struct("guards::GuardKey"), struct("guards::Guard")),
    model("VillageRaid", "game", struct("resources::ResourceKey"), [{ name: "last_tick", type: "core::integer::u64" }]),
    model("BitcoinMine", "game", struct("resources::ResourceKey"), struct("bitcoin::MineFunding")),
    model("BitcoinClaim", "game", struct("bitcoin::ClaimKey"), [{ name: "claimed", type: "core::bool" }]),
    model("BitcoinPhase", "game", struct("bitcoin::PhaseKey"), struct("bitcoin::Phase")),
    model("BitcoinContribution", "game", struct("bitcoin::ContributionKey"), struct("bitcoin::Contribution")),
    model("MineKindConfig", "game", struct("mines::MineKindKey"), struct("mines::MineKindConfig")),
    model("MinePool", "game", struct("mines::MinePoolKey"), [
      { name: "weights", type: "core::array::Span::<world_native::mines::MineWeight>" },
    ]),
    model(
      "RealmTraits",
      "deployment",
      [{ name: "realm_id", type: "core::integer::u32" }],
      struct("realms::RealmTraits"),
    ),
    model(
      "BlitzSettlementOrder",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "players", type: "core::array::Span::<core::integer::u8>" }],
    ),
    model(
      "BlitzRoster",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "players", type: "core::array::Span::<world_native::registrar::RosterPlayer>" }],
    ),
    model("RealmCatalogue", "deployment", domainKey, struct("realms::RealmCatalogue"), "address"),
    model("RealmGrants", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("settlement::RealmGrants")),
    model(
      "HyperstructureReservations",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "placed", type: "core::integer::u32" }],
    ),
    model(
      "SettlementRules",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("settlement::SettlementRules"),
    ),
    model(
      "SettlementProgress",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("settlement::SettlementProgress"),
    ),
    model(
      "SettlementPool",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("settlement::SettlementPool"),
    ),
    model("VillageRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("village::VillageRules")),
    model("VillagePass", "game", struct("village::VillagePassKey"), struct("village::VillagePass")),
    model(
      "VillagePool",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("settlement::SettlementPool"),
    ),
    model("EntryEntitlement", "game", struct("settlement::EntryKey"), struct("settlement::EntryEntitlement")),
    model("PlayerEntry", "game", struct("settlement::EntryKey"), struct("settlement::PlayerEntry")),
    model("TileOpt", "game", struct("map::TileKey"), struct("map::TileOpt")),
    model("TileOccupancy", "game", struct("map::TileKey"), struct("map::TileOccupancy")),
    model("ExplorerTroops", "game", struct("troops::ExplorerKey"), struct("troops::ExplorerRecord")),
    model("Structure", "game", struct("resources::ResourceKey"), struct("structures::Structure")),
    model("ResourceBalance", "game", struct("resources::ResourceSlot"), [
      { name: "balance", type: "core::integer::u128" },
    ]),
    model("ResourceProduction", "game", struct("resources::ResourceSlot"), struct("resources::Production")),
    model("ProductionReceiver", "game", struct("resources::ResourceSlot"), struct("resources::ProductionReceiver")),
    model("ProductionBonus", "game", struct("resources::ResourceKey"), struct("production::ProductionBonus")),
    model("ProductionRecipe", "game", struct("production::RecipeKey"), struct("production::ProductionRecipe")),
    model("ResourceWeight", "game", struct("resources::ResourceKey"), struct("resources::Weight")),
    model("ResourceArrival", "game", struct("arrivals::ArrivalKey"), struct("arrivals::Arrival")),
    model("BoardRules", "game", [struct("resources::ResourceKey")[0]], struct("buildings::BoardRules")),
    model("BuildingRule", "game", struct("buildings::BuildingRuleKey"), struct("buildings::BuildingRule")),
    model("Building", "game", struct("buildings::BuildingKey"), struct("buildings::Building")),
    model("StructureBuildings", "game", struct("resources::ResourceKey"), struct("buildings::StructureBuildings")),
    model("Hyperstructure", "game", struct("resources::ResourceKey"), struct("hyperstructures::Hyperstructure")),
    model("HyperstructureProgress", "game", struct("resources::ResourceSlot"), [
      { name: "contributed", type: "core::integer::u128" },
    ]),
    model("HyperstructureShares", "game", struct("resources::ResourceKey"), struct("hyperstructures::ShareAllocation")),
    model(
      "HyperstructureRules",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("hyperstructures::HyperstructureRules"),
    ),
    model("EntityName", "game", struct("resources::ResourceKey"), struct("names::EntityName")),
    ...["WonderFaith", "FaithfulStructure"].map((name) =>
      model(
        name,
        "game",
        [
          struct("resources::ResourceKey")[0],
          { name: name === "WonderFaith" ? "wonder_id" : "structure_id", type: "core::integer::u32" },
        ],
        struct(`faith::${name}`),
      ),
    ),
    model("PlayerFaithPoints", "game", struct("faith::PlayerFaithKey"), struct("faith::PlayerFaithPoints")),

    model(
      "ResourceRule",
      "game",
      [struct("resources::ResourceKey")[0], struct("resources::ResourceRule")[0]],
      struct("resources::ResourceRule").slice(1),
    ),
    model(
      "UpgradeLimits",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("upgrades::UpgradeLimits"),
    ),
    model(
      "UpgradeRecipe",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "level", type: "core::integer::u8" },
      ],
      struct("upgrades::UpgradeRecipe"),
    ),
    model(
      "DepthRules",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "depth", type: "core::integer::u8" },
      ],
      struct("expeditions::DepthRules"),
    ),
    model(
      "GameRelease",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [
        { name: "release_id", type: "core::integer::u32" },
        { name: "preset_commitment", type: "core::felt252" },
      ],
    ),
    model("GameRegistry", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("game::GameRegistry")),
    model("GameOverrides", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("game::GameOverrides")),
    model("SliceRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("rules::SliceRules")),
    model(
      "EntitySequence",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "next_entity_id", type: "core::integer::u32" }],
    ),
    model(
      "PlayerPoints",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "actor", type: "core::starknet::contract_address::ContractAddress" },
      ].map((key) => ({
        ...key,
        name: key.name === "actor" ? "address" : key.name,
      })),
      [{ name: "points", type: "core::integer::u128" }],
    ),
    model(
      "PointsTotal",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "total", type: "core::integer::u128" }],
    ),
    model("Authentication", "deployment", domainKey, struct("games::Authentication"), "address"),
    model(
      "ActionNonce",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "actor", type: "core::starknet::contract_address::ContractAddress" },
      ],
      [{ name: "next_nonce", type: "core::integer::u64" }],
    ),
  ];
}

// Paths describe observable values, not serialized row positions.
const behaviouralFacts = {
  VillageRaid: { domain: "combat", fields: { lastRaidedAtTick: "last_tick" } },
  Guard: { domain: "troops", fields: { troops: "troops", destroyedAt: "destroyed_tick" } },
  BitcoinMine: {
    domain: "bitcoin",
    fields: {
      eligibleFrom: "eligible_from",
      nextClaim: "next_phase",
      unsplitCarry: "unsplit_carry",
      winnerCarry: "winner_carry",
    },
  },
  BitcoinClaim: { domain: "bitcoin", fields: { claimed: "claimed" } },
  BitcoinPhase: {
    domain: "bitcoin",
    fields: { labor: "total_labor", contributors: "contributors", state: "state", root: "root" },
  },
  BitcoinContribution: { domain: "bitcoin", fields: { labor: "labor", destination: "structure_id" } },
  RealmTraits: { domain: "realm/season", fields: { wonder: "wonder", order: "order", resources: "resources" } },
  RealmCatalogue: { domain: "realm/season", fields: { initialized: "initialized" } },
  ResourceBalance: { domain: "resources", fields: { balance: "balance" } },
  ResourceProduction: {
    domain: "resources",
    transform: "production",
    meaning:
      "Settlement time is meaningful only while at least one production building exists; inactive time projects to zero.",
    fields: {
      buildingCount: "building_count",
      rate: "production_rate",
      outputRemaining: "output_amount_left",
      updatedAt: "last_updated_at",
    },
  },
  ProductionBonus: {
    domain: "production",
    fields: {
      resourcePercent: "incr_resource_rate_percent_num",
      laborPercent: "incr_labor_rate_percent_num",
      troopPercent: "incr_troop_rate_percent_num",
      resourceEndTick: "incr_resource_rate_end_tick",
      laborEndTick: "incr_labor_rate_end_tick",
      troopEndTick: "incr_troop_rate_end_tick",
    },
  },
  ProductionRecipe: {
    domain: "production",
    fields: {
      simpleOutput: "simple_output",
      complexOutput: "complex_output",
      simpleInputs: "simple_inputs",
      complexInputs: "complex_inputs",
    },
  },
  ResourceWeight: { domain: "resources", fields: { capacity: "capacity", weight: "weight" } },
  ResourceArrival: { domain: "resources", fields: { resources: "resources" } },
  EntryEntitlement: {
    domain: "blitz-settlement",
    fields: {
      realmId: "realm_id",
      metadata1: "metadata_1",
      metadata2: "metadata_2",
      metadata3: "metadata_3",
      passKind: "pass_kind",
    },
  },
  RealmGrants: {
    domain: "blitz-settlement",
    fields: { resources: "resources", startingTroops: "starting_troops", realmResources: "realm_resources" },
  },
  HyperstructureReservations: { domain: "blitz-settlement", fields: { placed: "placed" } },
  SettlementRules: {
    domain: "realm/blitz",
    fields: {
      registrationOpens: "registration_start",
      capacity: "registration_limit",
      mode: "mode",
      spacing: "spacing",
    },
  },
  DepthRules: {
    domain: "expedition",
    fields: {
      supplies: "supply_multiplier",
      guardLower: "guard_lower",
      guardUpper: "guard_upper",
      mineMinimum: "mine_cap_min",
      mineMaximum: "mine_cap_max",
      mineRate: "mine_rate",
      mineChest: "mine_chest",
      revealSiteNeighbors: "reveal_site_neighbors",
    },
  },
  SettlementProgress: { domain: "realm/blitz", fields: { players: "registered", realms: "realm_count" } },
  SettlementPool: { domain: "realm/blitz", fields: { availableLocations: "available" } },
  VillageRules: {
    domain: "village",
    fields: { armyDelay: "troop_delay_ticks", grants: "resources", resourcePool: "resource_pool" },
  },
  VillagePass: { domain: "village", fields: { owner: "owner", consumedBy: "village_id" } },
  VillagePool: { domain: "village", fields: { availableLocations: "available" } },
  BlitzSettlementOrder: { domain: "realm/blitz", fields: { players: "players" } },
  BlitzRoster: { domain: "realm/blitz", fields: { players: "players" } },
  PlayerEntry: { domain: "realm/blitz", fields: { player: "player" } },
  UpgradeLimits: { domain: "structure", fields: { realmMaximum: "realm_max", villageMaximum: "village_max" } },
  UpgradeRecipe: { domain: "structure", fields: { costs: "costs" } },
  ExplorerTroops: {
    domain: "troops",
    fields: { home: "owner", troops: "troops" },
  },
  TileOpt: { domain: "map", fields: { terrain: "data" } },
  TileOccupancy: { domain: "map", fields: { entity: "entity_id", category: "category", isStructure: "is_structure" } },
  Building: {
    domain: "production",
    fields: { category: "category", structure: "structure_id", paused: "paused" },
  },
  StructureBuildings: {
    domain: "production",
    fields: {
      population: "population",
      counts1: "packed_counts_1",
      counts2: "packed_counts_2",
      counts3: "packed_counts_3",
    },
  },
  Hyperstructure: { domain: "hyperstructures", fields: { stage: "stage", access: "access", constructionSeed: "seed" } },
  PointsTotal: { domain: "points", fields: { registered: "total" } },
  PlayerPoints: { domain: "points", fields: { registered: "points" } },
  MineKindConfig: {
    domain: "mines",
    fields: {
      resource: "resource_type",
      building: "building_category",
      rate: "production_rate",
      minimum: "cap_min",
      steps: "cap_steps",
    },
  },
  ProductionReceiver: { domain: "mines", fields: { home: "home", ends: "end_at" } },
  MinePool: { domain: "mines", fields: { kinds: "weights" } },
  Structure: {
    domain: "structures",
    fields: {
      owner: "owner",
      level: "base.level",
      kind: "base.category",
      mineKind: "metadata.mine_kind",
      foundedAt: "base.created_at",
      explorerLimit: "base.troop_max_explorer_count",
      guardLimit: "base.troop_max_guard_count",
      startingTroopsGranted: "base.starting_troops_granted",
      realm: "metadata.realm_id",
      order: "metadata.order",
      wonder: "metadata.has_wonder",
      connectedRealm: "metadata.village_realm",
      resourceTraits: "resources_packed",
    },
  },
  WonderFaith: {
    domain: "faith",
    fields: {
      points: "claimed_points",
      pointsPerSecond: "claim_per_sec",
      settledAt: "claim_last_at",
      ownerPointsPerSecond: "owner_claim_per_sec",
      pledgedStructures: "num_structures_pledged",
    },
  },
  FaithfulStructure: {
    domain: "faith",
    fields: {
      wonder: "wonder_id",
      pledgedAt: "faithful_since",
      wonderOwnerPointsPerSecond: "fp_to_wonder_owner_per_sec",
      structureOwnerPointsPerSecond: "fp_to_struct_owner_per_sec",
    },
  },
  PlayerFaithPoints: {
    domain: "faith",
    fields: {
      points: "points_claimed",
      ownershipPointsPerSecond: "points_per_sec_as_owner",
      pledgePointsPerSecond: "points_per_sec_as_pledger",
      settledAt: "last_updated_at",
    },
  },
};

// Which rows a player's subscription carries. "shared" rows reach every subscriber and "actor" rows only the selected
// gameplay account. "internal" rows remain in Herald and never reach a subscription. In an expedition game every
// other row is in scope when any listed field names one of the player's owners, entities, realms, realm traits,
// production sources or regions; `epoch` also requires the current day.
// Generation fails for a fact or event without an entry here.
const shared = "shared";
const byEntity = { entities: ["entity_id"] };
const byOwner = { owners: ["owner"] };
const byPlayer = { owners: ["player"] };
export const syncScopes = {
  GameOverrides: "internal",
  ActionNonce: "actor",
  ExecutionRecorded: "actor",
  BatchProgress: "actor",
  ...Object.fromEntries(
    [
      "Preset",
      "GameSequence",
      "SpireLayout",
      "LedgerOperator",
      "CampResources",
      "ArtificerCost",
      "BlitzResult",
      "FaithRules",
      "SeasonWinThreshold",
      "ExtractionRewards",
      "RelicRules",
      "ChestRules",
      "RelicDiscovery",
      "DepositRules",
      "WithdrawalRules",
      "ResourceToken",
      "BankRules",
      "Market",
      "TradeRules",
      "BitcoinPhase",
      "MineKindConfig",
      "MinePool",
      "BlitzSettlementOrder",
      "BlitzRoster",
      "RealmCatalogue",
      "RealmGrants",
      "HyperstructureReservations",
      "SettlementRules",
      "SettlementProgress",
      "SettlementPool",
      "VillageRules",
      "VillagePool",
      "ProductionRecipe",
      "BoardRules",
      "BuildingRule",
      "HyperstructureRules",
      "ResourceRule",
      "UpgradeLimits",
      "UpgradeRecipe",
      "DepthRules",
      "GameRegistry",
      "GameRelease",
      "SliceRules",
      "EntitySequence",
      "PointsTotal",
      "Authentication",
    ].map((name) => [name, shared]),
  ),
  PlayerPoints: { owners: ["address"] },
  RealmTraits: { realmTraits: ["realm_id"] },
  EntryEntitlement: byOwner,
  PlayerEntry: byOwner,
  VillagePass: byOwner,
  Liquidity: byOwner,
  StoryEvent: byOwner,
  Guild: { owners: ["guild_id"] },
  GuildMember: { owners: ["actor"] },
  GuildWhitelist: byPlayer,
  ChestPity: byPlayer,
  BitcoinContribution: byPlayer,
  PlayerFaithPoints: byPlayer,
  PointsAwarded: byPlayer,
  ChestTokens: { owners: ["player"], epoch: "epoch" },
  ChestReward: { owners: ["player"], epoch: "epoch" },
  RaidEvent: { owners: ["player", "target_owner"] },
  WonderFaith: { owners: ["last_recorded_owner"] },
  TileOpt: { regions: [{ alt: "alt", x: "col", y: "row" }] },
  TileOccupancy: { regions: [{ alt: "alt", x: "col", y: "row" }], entities: ["entity_id"] },
  Building: { realms: ["structure_id"] },
  ProductionReceiver: { realms: ["home"] },
  ExplorerTroops: { entities: ["explorer_id"] },
  Guard: { entities: ["structure_id"] },
  FaithfulStructure: { entities: ["structure_id"] },
  BitcoinClaim: { entities: ["mine_id"] },
  TradeOrder: { entities: ["maker_id", "taker_id"] },
  BattleEvent: { entities: ["attacker_id", "defender_id"] },
  ResourceProduction: { entities: ["entity_id"], productionSources: ["entity_id"] },
  Structure: byEntity,
  BankName: byEntity,
  VillageRaid: byEntity,
  BitcoinMine: byEntity,
  ResourceBalance: byEntity,
  ProductionBonus: byEntity,
  ResourceWeight: byEntity,
  ResourceArrival: byEntity,
  StructureBuildings: byEntity,
  Hyperstructure: byEntity,
  HyperstructureProgress: byEntity,
  HyperstructureShares: byEntity,
  EntityName: byEntity,
};
