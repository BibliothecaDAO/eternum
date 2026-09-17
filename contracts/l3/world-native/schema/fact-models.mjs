// Native row declarations are shared by schema generation, behavioural observations and client bindings.
export function defineFactModels({ contracts, struct, method, model: declare, types }) {
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
    if (row.name === "LedgerOperator")
      row.absence = {
        value: "zero",
        meaning: "No ledger relay is configured; realm entry is open and prizes belong to gameplay accounts.",
      };
    if (row.name === "Guild" || row.name === "GuildMember")
      row.absence = { value: "empty", meaning: "No guild or membership exists for this key." };
    if (row.name === "GuildWhitelist") row.absence = { value: "false", meaning: "The player is not whitelisted." };
    if (row.name === "RankingTrial" || row.name === "PlayerRank")
      row.absence = { value: "empty", meaning: "No ranking trial or player rank has been recorded." };
    if (row.name === "FaithfulStructure")
      row.absence = { value: "empty", meaning: "The structure has no faith allegiance." };
    if (row.name === "FaithBlacklist") row.absence = { value: "false", meaning: "The identifier is not blacklisted." };
    if (row.name === "ResourceAllowance")
      row.absence = { value: "zero", meaning: "No approval for this owner, recipient and resource." };
    if (row.name === "ProductionBonus")
      row.absence = { value: "zero", meaning: "No production bonus has been granted to this structure." };
    if (row.name === "ResourceArrival")
      row.absence = { value: "empty", meaning: "No resources queued for this entity, day and slot." };
    const observation = behaviouralFacts[row.name];
    return observation ? { ...row, observation } : row;
  };
  const domainKey = [{ name: "address", type: struct("lifecycle::Peers")[0].type }];
  return [
    model(
      "LedgerOperator",
      ["registry"],
      "deployment",
      domainKey,
      [{ name: "operator", type: method("registry", "ledger_operator").outputs[0].type }],
      "address",
    ),
    model("AgentRules", ["troops"], "game", method("troops", "agent_rules").inputs, struct("agents::AgentRules")),
    model(
      "AgentDiscoveryStats",
      ["troops"],
      "game",
      method("troops", "agent_discovery_stats").inputs,
      struct("agents::AgentDiscoveryStats"),
    ),
    model("CampResources", ["structures"], "game", method("structures", "camp_resources").inputs, [
      { name: "resources", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
    ]),
    model("Guild", ["registry"], "game", method("registry", "guild").inputs, struct("guilds::Guild")),
    model("GuildMember", ["registry"], "game", method("registry", "guild_member").inputs, [
      { name: "guild_id", type: method("registry", "guild_member").outputs[0].type },
    ]),
    model("GuildWhitelist", ["registry"], "game", struct("guilds::WhitelistKey"), [
      { name: "allowed", type: "core::bool" },
    ]),
    model("ArtificerCost", ["economy"], "game", method("economy", "artificer_cost").inputs, [
      { name: "research", type: "core::integer::u128" },
    ]),
    model(
      "SeriesChestRules",
      ["prizes"],
      "deployment",
      method("prizes", "series_chest_rules").inputs,
      struct("series_chests::SeriesRules"),
    ),
    model(
      "SeriesChestState",
      ["prizes"],
      "deployment",
      method("prizes", "series_chest_state").inputs,
      struct("series_chests::SeriesState"),
    ),
    model(
      "GameChestReward",
      ["prizes"],
      "game",
      method("prizes", "game_chests").inputs,
      struct("blitz_prizes::GameChests"),
    ),
    model(
      "RankingTrial",
      ["prizes"],
      "game",
      method("prizes", "ranking_trial").inputs,
      struct("blitz_prizes::RankingTrial"),
    ),
    model("PlayerRank", ["prizes"], "game", method("prizes", "player_rank").inputs, struct("blitz_prizes::PlayerRank")),
    model("FaithRewardToken", ["prizes"], "game", method("prizes", "faith_reward_token").inputs, [
      { name: "token", type: method("prizes", "faith_reward_token").outputs[0].type },
    ]),
    model(
      "FaithPrizePool",
      ["prizes"],
      "game",
      method("prizes", "faith_prize_pool").inputs,
      struct("faith_prizes::PrizePool"),
    ),
    model("FaithPrizeClaimed", ["prizes"], "game", struct("faith::PlayerFaithKey"), [
      { name: "claimed", type: "core::bool" },
    ]),
    model(
      "FaithRules",
      ["structures"],
      "game",
      method("structures", "faith_rules").inputs,
      struct("faith::FaithRules"),
    ),
    model("FaithBlacklist", ["structures"], "game", struct("faith::BlacklistKey"), [
      { name: "blocked", type: "core::bool" },
    ]),
    model("SeasonWinThreshold", ["season"], "game", method("season", "season_win_threshold").inputs, [
      { name: "points", type: "core::integer::u128" },
    ]),
    model("ExtractionRewards", ["map"], "game", method("map", "extraction_rewards").inputs, [
      { name: "rewards", type: method("map", "extraction_rewards").outputs[0].type },
    ]),
    model("RelicRules", ["economy"], "game", method("economy", "relic_rules").inputs, [
      { name: "rules", type: method("economy", "relic_rules").outputs[0].type },
    ]),
    model("RelicDiscovery", ["map"], "game", method("map", "relic_discovery_time").inputs, [
      { name: "last_at", type: "core::integer::u64" },
    ]),
    model(
      "WithdrawalRules",
      ["economy"],
      "game",
      method("economy", "withdrawal_rules").inputs,
      struct("withdrawals::WithdrawalRules"),
    ),
    model("ResourceToken", ["economy"], "game", struct("market::MarketKey"), [
      { name: "token", type: struct("withdrawals::ResourceToken")[1].type },
    ]),
    model("BankRules", ["economy"], "game", method("economy", "bank_rules").inputs, struct("market::BankRules")),
    model("BankName", ["economy"], "game", struct("resources::ResourceKey"), [{ name: "name", type: "core::felt252" }]),
    model("Market", ["economy"], "game", struct("market::MarketKey"), struct("market::Market")),
    model("Liquidity", ["economy"], "game", struct("market::LiquidityKey"), [
      { name: "shares", type: "core::integer::u128" },
    ]),
    model("TradeOrder", ["economy"], "game", struct("trade::TradeKey"), struct("trade::TradeOrder")),
    model("TradeRules", ["economy"], "game", method("economy", "trade_rules").inputs, struct("trade::TradeRules")),
    model("Guard", ["troops"], "game", struct("guards::GuardKey"), struct("guards::Guard")),
    model("BitcoinMine", ["resources"], "game", struct("resources::ResourceKey"), struct("bitcoin::MineFunding")),
    model("BitcoinClaim", ["resources"], "game", struct("bitcoin::ClaimKey"), [
      { name: "claimed", type: "core::bool" },
    ]),
    model("BitcoinPhase", ["resources"], "game", struct("bitcoin::PhaseKey"), struct("bitcoin::Phase")),
    model("BitcoinContribution", ["resources"], "game", struct("bitcoin::ContributionKey"), [
      { name: "labor", type: "core::integer::u128" },
    ]),
    model("MineKindConfig", ["resources"], "game", struct("mines::MineKindKey"), struct("mines::MineKindConfig")),
    model("MinePool", ["resources"], "game", struct("mines::MinePoolKey"), [
      { name: "weights", type: "core::array::Span::<world_native::mines::MineWeight>" },
    ]),
    model(
      "RealmTraits",
      ["settlement"],
      "deployment",
      method("settlement", "realm_traits").inputs,
      struct("realms::RealmTraits"),
    ),
    model("RealmCatalogue", ["settlement"], "deployment", domainKey, struct("realms::RealmCatalogue"), "address"),
    model(
      "AgentPopulation",
      ["troops"],
      "game",
      method("troops", "agent_population").inputs,
      struct("troops::AgentPopulation"),
    ),
    model(
      "RealmGrants",
      ["settlement"],
      "game",
      method("settlement", "realm_grants").inputs,
      struct("settlement::RealmGrants"),
    ),
    model("HyperstructureReservations", ["map"], "game", method("map", "reserved_hyperstructures").inputs, [
      { name: "placed", type: "core::integer::u32" },
    ]),
    model(
      "SettlementRules",
      ["settlement"],
      "game",
      method("settlement", "settlement_rules").inputs,
      struct("settlement::SettlementRules"),
    ),
    model(
      "SettlementProgress",
      ["settlement"],
      "game",
      method("settlement", "settlement_progress").inputs,
      struct("settlement::SettlementProgress"),
    ),
    model(
      "SettlementPool",
      ["map"],
      "game",
      method("map", "settlement_pool").inputs,
      struct("settlement::SettlementPool"),
    ),
    model(
      "VillageRules",
      ["settlement"],
      "game",
      method("settlement", "village_rules").inputs,
      struct("village::VillageRules"),
    ),
    model("VillagePass", ["settlement"], "game", struct("village::VillagePassKey"), struct("village::VillagePass")),
    model("VillagePool", ["map"], "game", method("map", "village_pool").inputs, struct("settlement::SettlementPool")),
    model(
      "EntryEntitlement",
      ["settlement"],
      "game",
      struct("settlement::EntryKey"),
      struct("settlement::EntryEntitlement"),
    ),
    model("PlayerEntry", ["settlement"], "game", struct("settlement::EntryKey"), struct("settlement::PlayerEntry")),
    model(
      "PlayerCosmetics",
      ["settlement"],
      "game",
      struct("settlement::CosmeticsKey"),
      struct("settlement::PlayerCosmetics"),
    ),
    model("TileOpt", ["map"], "game", struct("map::TileKey"), struct("map::TileOpt")),
    model("ExplorerTroops", ["troops"], "game", struct("troops::ExplorerKey"), struct("troops::ExplorerTroops")),
    model("Structure", ["structures"], "game", struct("resources::ResourceKey"), struct("structures::Structure")),
    model("ResourceBalance", ["resources"], "game", struct("resources::ResourceSlot"), [
      { name: "balance", type: method("resources", "resource_balance").outputs[0].type },
    ]),
    model(
      "ResourceProduction",
      ["resources"],
      "game",
      struct("resources::ResourceSlot"),
      struct("resources::Production"),
    ),
    model(
      "ProductionBonus",
      ["resources"],
      "game",
      struct("resources::ResourceKey"),
      struct("production::ProductionBonus"),
    ),
    model(
      "ProductionRecipe",
      ["resources"],
      "game",
      struct("production::RecipeKey"),
      struct("production::ProductionRecipe"),
    ),
    model(
      "ProductionReady",
      ["resources"],
      "game",
      [struct("resources::ResourceKey")[0]],
      [{ name: "ready", type: "core::bool" }],
    ),
    model("ResourceWeight", ["resources"], "game", struct("resources::ResourceKey"), struct("resources::Weight")),
    model("ResourceArrival", ["resources"], "game", struct("arrivals::ArrivalKey"), struct("arrivals::Arrival")),
    model("ResourceAllowance", ["resources"], "game", struct("resources::AllowanceKey"), [
      { name: "amount", type: method("resources", "resource_allowance").outputs[0].type },
    ]),
    model(
      "BuildingRule",
      ["structures"],
      "game",
      struct("buildings::BuildingRuleKey"),
      struct("buildings::BuildingRule"),
    ),
    model(
      "BuildingRulesReady",
      ["structures"],
      "game",
      [struct("resources::ResourceKey")[0]],
      [{ name: "ready", type: "core::bool" }],
    ),
    model("Building", ["structures"], "game", struct("buildings::BuildingKey"), struct("buildings::Building")),
    model(
      "StructureBuildings",
      ["structures"],
      "game",
      struct("resources::ResourceKey"),
      struct("buildings::StructureBuildings"),
    ),
    model(
      "Hyperstructure",
      ["economy"],
      "game",
      struct("resources::ResourceKey"),
      struct("hyperstructures::Hyperstructure"),
    ),
    model("HyperstructureProgress", ["economy"], "game", struct("resources::ResourceSlot"), [
      { name: "contributed", type: "core::integer::u128" },
    ]),
    model(
      "HyperstructureShares",
      ["economy"],
      "game",
      struct("resources::ResourceKey"),
      struct("hyperstructures::ShareAllocation"),
    ),
    model(
      "HyperstructureRules",
      ["economy"],
      "game",
      method("economy", "hyperstructure_rules").inputs,
      struct("hyperstructures::HyperstructureRules"),
    ),
    model(
      "AddressName",
      ["structures"],
      "deployment",
      method("structures", "address_name").inputs,
      struct("names::AddressName"),
    ),
    model("AgentOwner", ["troops"], "game", method("troops", "agent_owner").inputs, [
      { name: "address", type: method("troops", "agent_owner").outputs[0].type },
    ]),
    ...["WonderFaith", "FaithfulStructure"].map((name) =>
      model(
        name,
        ["structures"],
        "game",
        [
          struct("resources::ResourceKey")[0],
          { name: name === "WonderFaith" ? "wonder_id" : "structure_id", type: "core::integer::u32" },
        ],
        struct(`faith::${name}`),
      ),
    ),
    model(
      "PlayerFaithPoints",
      ["structures"],
      "game",
      struct("faith::PlayerFaithKey"),
      struct("faith::PlayerFaithPoints"),
    ),

    model(
      "ResourceRule",
      ["resources"],
      "game",
      [struct("resources::ResourceKey")[0], struct("resources::ResourceRule")[0]],
      struct("resources::ResourceRule").slice(1),
    ),
    model(
      "ResourceRulesReady",
      ["resources"],
      "game",
      [struct("resources::ResourceKey")[0]],
      [{ name: "ready", type: "core::bool" }],
    ),
    model(
      "UpgradeLimits",
      ["season"],
      "game",
      method("season", "upgrade_limits").inputs,
      struct("upgrades::UpgradeLimits"),
    ),
    model(
      "UpgradeRecipe",
      ["season"],
      "game",
      method("season", "upgrade_recipe").inputs,
      struct("upgrades::UpgradeRecipe"),
    ),
    model("GameRegistry", ["season"], "game", method("season", "game").inputs, struct("game::GameRegistry")),
    model("SliceRules", ["season"], "game", method("season", "rules").inputs, struct("rules::SliceRules")),
    model("EntitySequence", ["season"], "game", method("season", "allocate_entity").inputs, [
      { name: "next_entity_id", type: method("season", "allocate_entity").outputs[0].type },
    ]),
    model(
      "PlayerPoints",
      ["season"],
      "game",
      method("season", "player_points").inputs.map((key) => ({
        ...key,
        name: key.name === "actor" ? "address" : key.name,
      })),
      [{ name: "points", type: method("season", "player_points").outputs[0].type }],
    ),
    model("PointsTotal", ["season"], "game", method("season", "season_points").inputs, [
      { name: "total", type: method("season", "season_points").outputs[0].type },
    ]),
    model("DomainState", Object.keys(contracts), "deployment", domainKey, struct("lifecycle::DomainState"), "address"),
    model(
      "DomainClass",
      Object.keys(contracts),
      "deployment",
      domainKey,
      method("season", "upgrade").inputs,
      "address",
    ),
    model("Authentication", ["season"], "deployment", domainKey, struct("season::Authentication"), "address"),
    model("ExecutionHead", ["season"], "deployment", domainKey, struct("recording::ExecutionHead"), "address"),
    model(
      "ExecutionResult",
      ["season"],
      "deployment",
      [...domainKey, ...method("season", "get_result").inputs],
      types.get(method("season", "get_result").outputs[0].type).members,
      "address",
    ),
    model("OwnershipRulesReady", ["season"], "game", method("season", "ownership_rules_ready").inputs, [
      { name: "ready", type: "core::bool" },
    ]),
    model(
      "AgentController",
      ["season"],
      "deployment",
      domainKey,
      [{ name: "controller", type: method("season", "set_agent_controller").inputs[0].type }],
      "address",
    ),
    model("ActionNonce", ["season"], "game", method("season", "next_nonce").inputs, [
      { name: "next_nonce", type: method("season", "next_nonce").outputs[0].type },
    ]),
  ];
}

// Paths describe observable values, not serialized row positions.
const behaviouralFacts = {
  Guard: { domain: "troops", fields: { troops: "troops", destroyedAt: "destroyed_tick" } },
  BitcoinMine: {
    domain: "bitcoin",
    fields: {
      eligibleFrom: "eligible_from",
      nextClaim: "next_phase",
      unsplitCarry: "unsplit_carry",
      winnerCarry: "winner_carry",
      ownerCarry: "owner_carry",
    },
  },
  BitcoinClaim: { domain: "bitcoin", fields: { claimed: "claimed" } },
  BitcoinPhase: {
    domain: "bitcoin",
    fields: { labor: "total_labor", contributors: "contributors", state: "state", root: "root" },
  },
  BitcoinContribution: { domain: "bitcoin", fields: { labor: "labor" } },
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
  ResourceAllowance: { domain: "resources", fields: { amount: "amount" } },
  ResourceArrival: { domain: "resources", fields: { resources: "resources" } },
  AgentPopulation: { domain: "troops", fields: { active: "count" } },
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
      profile: "reward_profile",
      cosmeticLimit: "cosmetic_limit",
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
  PlayerEntry: { domain: "realm/blitz", fields: { player: "player" } },
  PlayerCosmetics: { domain: "realm/blitz", fields: { attributes: "attributes" } },
  UpgradeLimits: { domain: "structure", fields: { realmMaximum: "realm_max", villageMaximum: "village_max" } },
  UpgradeRecipe: { domain: "structure", fields: { costs: "costs" } },
  AddressName: { domain: "name", fields: { name: "name" } },
  ExplorerTroops: {
    domain: "troops",
    fields: { home: "owner", position: "coord", troops: "troops" },
  },
  TileOpt: { domain: "map", fields: { tile: "data" }, transform: "tile" },
  Building: {
    domain: "production",
    fields: { category: "category", structure: "outer_entity_id", paused: "paused" },
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
  MinePool: { domain: "mines", fields: { kinds: "weights" } },
  Structure: {
    domain: "structures",
    fields: {
      owner: "owner",
      level: "base.level",
      kind: "base.category",
      layer: "base.alt",
      mineKind: "metadata.mine_kind",
      column: "base.coord_x",
      row: "base.coord_y",
      foundedAt: "base.created_at",
      explorers: "troop_explorers",
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
  AgentOwner: { domain: "ownership", fields: { owner: "address" } },
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
