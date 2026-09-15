// Native row declarations are shared by schema generation, behavioural observations and client bindings.
export function defineFactModels({ contracts, struct, method, model: declare, types }) {
  const model = (...arguments_) => {
    const row = declare(...arguments_);
    const observation =
      row.name === "Resource"
        ? {
            domain: "resources",
            fields: Object.fromEntries(
              row.members
                .filter((member) => member.name !== "LORDS_PRODUCTION")
                .map((member) => [member.name, member.name]),
            ),
          }
        : behaviouralFacts[row.name];
    return observation ? { ...row, observation } : row;
  };
  const domainKey = [{ name: "address", type: struct("lifecycle::Peers")[0].type }];
  return [
    model("TileOpt", ["map"], "game", struct("map::TileKey"), struct("map::TileOpt")),
    model("ExplorerTroops", ["troops"], "game", struct("troops::ExplorerKey"), struct("troops::ExplorerTroops")),
    model("Structure", ["structures"], "game", struct("resources::ResourceKey"), struct("structures::Structure")),
    model("Resource", ["structures"], "game", struct("resources::ResourceKey"), struct("resources::Resource")),
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
      ["structures"],
      "game",
      [
        struct("resources::ResourceKey")[0],
        { name: "hyperstructure_id", type: struct("resources::ResourceKey")[1].type },
      ],
      struct("structures::Hyperstructure"),
    ),
    model("HyperstructureGlobals", ["structures"], "game", method("structures", "hyperstructure_count").inputs, [
      { name: "created_count", type: method("structures", "hyperstructure_count").outputs[0].type },
      { name: "completed_count", type: method("structures", "hyperstructure_count").outputs[0].type },
    ]),
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
        struct(`ownership::${name}`),
      ),
    ),
    model(
      "PlayerFaithPoints",
      ["structures"],
      "game",
      struct("ownership::PlayerFaithKey"),
      struct("ownership::PlayerFaithPoints"),
    ),
    model(
      "WonderFaithWinners",
      ["structures"],
      "game",
      method("structures", "wonder_faith_winners").inputs,
      struct("ownership::WonderFaithWinners"),
    ),

    model(
      "ResourceRule",
      ["structures"],
      "game",
      [struct("resources::ResourceKey")[0], struct("structures::ResourceRule")[0]],
      struct("structures::ResourceRule").slice(1),
    ),
    model(
      "ResourceRulesReady",
      ["structures"],
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
      "PlayerRegisteredPoints",
      ["season"],
      "game",
      method("season", "player_points").inputs.map((key) => ({
        ...key,
        name: key.name === "actor" ? "address" : key.name,
      })),
      [{ name: "registered_points", type: method("season", "player_points").outputs[0].type }],
    ),
    model("SeasonPrize", ["season"], "game", method("season", "season_points").inputs, [
      { name: "total_registered_points", type: method("season", "season_points").outputs[0].type },
      { name: "total_lords_pool", type: "core::integer::u256" },
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

// Paths describe observable values, not serialized row positions. Oracle adapters live only in the parity fixture.
const behaviouralFacts = {
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
    fields: { category: "category", bonus: "bonus_percent", structure: "outer_entity_id", paused: "paused" },
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
  Hyperstructure: {
    domain: "hyperstructures",
    fields: {
      initialized: "initialized",
      completed: "completed",
      access: "access",
      constructionSeed: "randomness",
      pointsMultiplier: "points_multiplier",
    },
  },
  HyperstructureGlobals: { domain: "hyperstructures", fields: { discovered: "created_count" } },
  SeasonPrize: { domain: "points", fields: { registered: "total_registered_points" } },
  PlayerRegisteredPoints: { domain: "points", fields: { registered: "registered_points" } },
  Structure: {
    domain: "structures",
    fields: {
      owner: "owner",
      level: "base.level",
      kind: "base.category",
      column: "base.coord_x",
      row: "base.coord_y",
      foundedAt: "base.created_at",
      guards: "troop_guards",
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
  WonderFaithWinners: {
    domain: "faith",
    fields: { score: "high_score", wonders: "wonder_ids" },
  },
};
