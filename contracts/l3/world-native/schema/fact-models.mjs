import { readFileSync } from "node:fs";

const combatSource = readFileSync(new URL("../src/combat.cairo", import.meta.url), "utf8");
const combatBody = /pub struct ArmyCombat \{([^}]+)\}/.exec(combatSource)?.[1];
if (!combatBody) throw new Error("Missing ArmyCombat declaration");
const combatMembers = combatBody
  .split(",")
  .filter((field) => field.trim())
  .map((field) => {
    const member = /^\s*pub (\w+): (u(?:8|16|32|64|128)),?\s*$/.exec(field);
    if (!member)
      throw new Error("ArmyCombat wire fields must be unsigned integers; extend the source decoder for this field");
    return { name: member[1], type: `core::integer::${member[2]}` };
  });

// Fact-only Cairo wire types replace the removed fixture getter ABIs.
// Production definitions, when present, must agree exactly with these fields.
export const factWireTypes = [
  {
    type: "struct",
    name: "world_native::mines::MineWeight",
    members: [
      { name: "kind", type: "core::integer::u8" },
      { name: "weight", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::BuildingRule",
    members: [
      { name: "population_cost", type: "core::integer::u8" },
      { name: "capacity_grant", type: "core::integer::u8" },
      { name: "simple_cost", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
      { name: "complex_cost", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
    ],
  },
  {
    type: "struct",
    name: "world_native::expeditions::DepthRules",
    members: [
      { name: "reveal_percent", type: "core::integer::u16" },
      { name: "site_guard_lower", type: "core::integer::u16" },
      { name: "site_guard_upper", type: "core::integer::u16" },
      { name: "rift_guard_lower", type: "core::integer::u16" },
      { name: "rift_guard_upper", type: "core::integer::u16" },
      { name: "reveal_site_neighbors", type: "core::bool" },
      { name: "chest", type: "world_native::relics::ChestTiers" },
      { name: "guard_step", type: "core::integer::u32" },
      { name: "beast_weak_lower", type: "core::integer::u16" },
      { name: "beast_weak_upper", type: "core::integer::u16" },
      { name: "beast_strong_lower", type: "core::integer::u16" },
      { name: "beast_strong_upper", type: "core::integer::u16" },
    ],
  },
  {
    type: "struct",
    name: "world_native::production::ProductionRecipe",
    members: [
      { name: "simple_output", type: "core::integer::u64" },
      { name: "complex_output", type: "core::integer::u64" },
      { name: "simple_inputs", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
      { name: "complex_inputs", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
    ],
  },
  {
    type: "struct",
    name: "world_native::realms::RealmTraits",
    members: [
      { name: "wonder", type: "core::integer::u8" },
      { name: "order", type: "core::integer::u8" },
      { name: "resources", type: "core::array::Span::<core::integer::u8>" },
    ],
  },
  {
    type: "struct",
    name: "world_native::relics::ChestTiers",
    members: [
      { name: "common", type: "core::integer::u16" },
      { name: "uncommon", type: "core::integer::u16" },
      { name: "rare", type: "core::integer::u16" },
      { name: "epic", type: "core::integer::u16" },
      { name: "legendary", type: "core::integer::u16" },
    ],
  },
  {
    type: "struct",
    name: "world_native::relics::LordsWithdrawal",
    members: [
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u128" },
      { name: "prize_rank", type: "core::integer::u16" },
      { name: "prize_count", type: "core::integer::u16" },
    ],
  },
  {
    type: "struct",
    name: "world_native::settlement::RealmGrants",
    members: [
      { name: "resources", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
      { name: "starting_troops", type: "core::array::Span::<world_native::troops::TroopType>" },
      { name: "realm_resources", type: "core::array::Span::<core::integer::u8>" },
    ],
  },
  {
    type: "enum",
    name: "world_native::settlement::SettlementMode",
    variants: [
      { name: "Single", type: "()" },
      { name: "Triple", type: "()" },
    ],
  },
  {
    type: "struct",
    name: "world_native::village::VillageResource",
    members: [
      { name: "resource_type", type: "core::integer::u8" },
      { name: "weight", type: "core::integer::u128" },
    ],
  },
  {
    type: "struct",
    name: "world_native::village::VillageRules",
    members: [
      { name: "troop_delay_ticks", type: "core::integer::u16" },
      { name: "resources", type: "core::array::Span::<world_native::resources::ResourceAmount>" },
      { name: "resource_pool", type: "core::array::Span::<world_native::village::VillageResource>" },
    ],
  },
  {
    type: "struct",
    name: "world_native::banes::BaneRules",
    members: [
      { name: "chance_step", type: "core::integer::u16" },
      { name: "quorum_percent", type: "core::integer::u16" },
      { name: "beast_percent", type: "core::integer::u16" },
      { name: "stamina_percent", type: "core::integer::u16" },
      { name: "production_percent", type: "core::integer::u16" },
      { name: "quest_counts", type: "core::array::Span::<core::integer::u128>" },
    ],
  },
  {
    type: "struct",
    name: "world_native::quests::QuestRules",
    members: [
      { name: "base_counts", type: "core::array::Span::<core::integer::u32>" },
      { name: "labor", type: "core::integer::u128" },
      { name: "essence", type: "core::integer::u128" },
      { name: "bonus_percent", type: "core::integer::u16" },
    ],
  },
  {
    type: "struct",
    name: "world_native::buildings::BoardRules",
    members: [
      { name: "demolition_refund_bps", type: "core::integer::u16" },
      { name: "workshop_rate", type: "core::integer::u64" },
      { name: "output_step_bps", type: "core::integer::u16" },
      { name: "storage_step_bps", type: "core::integer::u16" },
      { name: "ration_step", type: "core::integer::u128" },
      { name: "troop_store_deploys", type: "core::integer::u8" },
      { name: "settlement_resource_cap", type: "core::integer::u32" },
      { name: "city_resource_cap", type: "core::integer::u32" },
      { name: "kingdom_resource_cap", type: "core::integer::u32" },
      { name: "empire_resource_cap", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::expeditions::FrontierDiscoveryRules",
    members: [
      { name: "beasts_bps", type: "core::integer::u16" },
      { name: "camp_bps", type: "core::integer::u16" },
      { name: "rift_bps", type: "core::integer::u16" },
      { name: "ruin_bps", type: "core::integer::u16" },
      { name: "shrine_bps", type: "core::integer::u16" },
      { name: "well_bps", type: "core::integer::u16" },
      { name: "empty_reveal_limit", type: "core::integer::u8" },
    ],
  },
  {
    type: "struct",
    name: "world_native::race::RaceRules",
    members: [
      { name: "season_days", type: "core::integer::u64" },
      { name: "stage_height", type: "core::integer::u32" },
      { name: "clear_mist_percent", type: "core::integer::u16" },
      { name: "second_wind_percent", type: "core::integer::u16" },
      { name: "pale_moon_percent", type: "core::integer::u16" },
      { name: "spoils_percent", type: "core::integer::u16" },
    ],
  },
  {
    type: "struct",
    name: "world_native::research::ResearchPrice",
    members: [
      { name: "essence", type: "core::integer::u128" },
      { name: "labor", type: "core::integer::u128" },
    ],
  },
  {
    type: "struct",
    name: "world_native::resources::ResourceRule",
    members: [
      { name: "resource_type", type: "core::integer::u8" },
      { name: "unit_weight", type: "core::integer::u128" },
      { name: "realm_rate", type: "core::integer::u64" },
      { name: "village_rate", type: "core::integer::u64" },
    ],
  },
  {
    type: "struct",
    name: "world_native::upgrades::UpgradeLimits",
    members: [
      { name: "realm_max", type: "core::integer::u8" },
      { name: "village_max", type: "core::integer::u8" },
    ],
  },
  {
    type: "struct",
    name: "world_native::upgrades::UpgradeRecipe",
    members: [{ name: "costs", type: "core::array::Span::<world_native::resources::ResourceAmount>" }],
  },
  {
    type: "struct",
    name: "world_native::deep::DeepRing",
    members: [
      { name: "radius", type: "core::integer::u32" },
      { name: "realms", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::deep::DeepBeast",
    members: [
      { name: "count", type: "core::integer::u128" },
      { name: "bow", type: "core::bool" },
    ],
  },
  {
    type: "struct",
    name: "world_native::deep::DeepPay",
    members: [
      { name: "alone", type: "core::integer::u32" },
      { name: "pair", type: "core::integer::u32" },
      { name: "crowd", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::deep::DeepRules",
    members: [
      { name: "gate_distance", type: "core::integer::u32" },
      { name: "rings", type: "core::array::Span::<world_native::deep::DeepRing>" },
      { name: "beasts", type: "core::array::Span::<world_native::deep::DeepBeast>" },
      { name: "loss_per_tick", type: "core::integer::u128" },
      { name: "core_per_tick", type: "core::integer::u128" },
      { name: "mine_per_tick", type: "core::integer::u128" },
      { name: "building_pay", type: "world_native::deep::DeepPay" },
      { name: "altar_threshold", type: "core::integer::u32" },
    ],
  },
  {
    type: "struct",
    name: "world_native::combat::ArmyCombat",
    members: combatMembers,
  },
  {
    type: "struct",
    name: "world_native::spires::ExpeditionSpireKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "structure_id",
        type: "core::integer::u64",
      },
      {
        name: "epoch",
        type: "core::integer::u64",
      },
      {
        name: "depth",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "enum",
    name: "core::option::Option::<world_native::troops::Coord>",
    variants: [
      {
        name: "Some",
        type: "world_native::troops::Coord",
      },
      {
        name: "None",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::spires::ExpeditionSpire",
    members: [
      {
        name: "reveals",
        type: "core::integer::u8",
      },
      {
        name: "location",
        type: "core::option::Option::<world_native::troops::Coord>",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::banes::WorldBane",
    members: [
      {
        name: "kind",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::banes::FirstTeamBane",
    members: [
      {
        name: "issued_day",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::banes::BaneProgress",
    members: [
      {
        name: "completed",
        type: "core::integer::u32",
      },
      {
        name: "ended_at",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::deep::TeamBane",
    members: [
      {
        name: "source",
        type: "core::integer::u8",
      },
      {
        name: "issued_day",
        type: "core::integer::u64",
      },
      {
        name: "quest",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::deep::AltarBar",
    members: [
      {
        name: "charge",
        type: "core::integer::u32",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::quests::QuestProgress",
    members: [
      { name: "progress", type: "core::integer::u128" },
      { name: "completed_level", type: "core::integer::u8" },
    ],
  },
  {
    type: "enum",
    name: "world_native::army_relics::RelicKind",
    variants: [
      {
        name: "Blade",
        type: "()",
      },
      {
        name: "Ward",
        type: "()",
      },
      {
        name: "Plunder",
        type: "()",
      },
      {
        name: "StaminaRegen",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::army_relics::ArmyRelic",
    members: [
      {
        name: "kind",
        type: "world_native::army_relics::RelicKind",
      },
      {
        name: "rank",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "enum",
    name: "core::option::Option::<world_native::army_relics::ArmyRelic>",
    variants: [
      {
        name: "Some",
        type: "world_native::army_relics::ArmyRelic",
      },
      {
        name: "None",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::army_relics::ArmyRelics",
    members: [
      {
        name: "first",
        type: "core::option::Option::<world_native::army_relics::ArmyRelic>",
      },
      {
        name: "second",
        type: "core::option::Option::<world_native::army_relics::ArmyRelic>",
      },
      {
        name: "third",
        type: "core::option::Option::<world_native::army_relics::ArmyRelic>",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::army_relics::ArmyRelicEffectKey",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "explorer_id",
        type: "core::integer::u64",
      },
      {
        name: "kind",
        type: "world_native::army_relics::RelicKind",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::army_relics::ArmyRelicEffect",
    members: [
      {
        name: "rank",
        type: "core::integer::u8",
      },
      {
        name: "expires_at",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::settlement::SettlementPool",
    members: [
      { name: "opened", type: "core::integer::u32" },
      { name: "available", type: "core::array::Span::<world_native::settlement::SettlementLocation>" },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<world_native::settlement::SettlementLocation>",
    members: [{ name: "snapshot", type: "@core::array::Array::<world_native::settlement::SettlementLocation>" }],
  },
  {
    type: "struct",
    name: "world_native::settlement::SettlementLocation",
    members: [{ name: "coords", type: "core::array::Span::<world_native::troops::Coord>" }],
  },
  {
    type: "struct",
    name: "core::array::Span::<world_native::troops::Coord>",
    members: [{ name: "snapshot", type: "@core::array::Array::<world_native::troops::Coord>" }],
  },
  {
    type: "struct",
    name: "world_native::deep::DeepArmy",
    members: [{ name: "last_tick", type: "core::integer::u64" }],
  },
  {
    type: "struct",
    name: "world_native::deep::GarrisonSlot",
    members: [{ name: "home", type: "core::integer::u64" }],
  },
  {
    type: "struct",
    name: "world_native::deep::DeepSite",
    members: [
      { name: "kind", type: "core::integer::u8" },
      { name: "ring", type: "core::integer::u8" },
      { name: "day", type: "core::integer::u64" },
      { name: "aspect", type: "core::integer::u8" },
    ],
  },
  {
    type: "struct",
    name: "world_native::troops::ArmySlotKey",
    members: [
      { name: "game_id", type: "core::integer::u32" },
      { name: "structure_id", type: "core::integer::u64" },
      { name: "epoch", type: "core::integer::u64" },
      { name: "slot", type: "core::integer::u8" },
    ],
  },
  {
    type: "struct",
    name: "world_native::troops::ArmySlot",
    members: [
      { name: "explorer_id", type: "core::integer::u64" },
      { name: "stamina", type: "world_native::troops::Stamina" },
    ],
  },
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
    name: "world_native::entry::LaborGrant",
    members: [
      { name: "game_id", type: "core::integer::u32" },
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
      { name: "home", type: "core::integer::u64" },
      { name: "amount", type: "core::integer::u128" },
      { name: "essence", type: "core::integer::u128" },
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
        type: "core::integer::u64",
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
        type: "core::integer::u64",
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
    name: "world_native::game::GameRegistry",
    members: [
      {
        name: "name",
        type: "core::felt252",
      },
      {
        name: "family",
        type: "core::integer::u8",
      },
      {
        name: "settled",
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
        name: "seed",
        type: "core::felt252",
      },
      {
        name: "scheduled_end_at",
        type: "core::integer::u64",
      },
      {
        name: "clock_scale",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::map::TileOccupancy",
    members: [
      { name: "entity_id", type: "core::integer::u64" },
      { name: "category", type: "core::integer::u8" },
      { name: "is_structure", type: "core::bool" },
    ],
  },
  {
    type: "struct",
    name: "world_native::troops::ExplorerRecord",
    members: [
      { name: "owner", type: "core::integer::u64" },
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
    name: "world_native::names::RealmSkin",
    members: [
      {
        name: "family",
        type: "core::integer::u8",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::relics::ChestRules",
    members: [
      {
        name: "price_ceiling",
        type: "core::integer::u128",
      },
      {
        name: "shares",
        type: "world_native::relics::ChestTiers",
      },
      {
        name: "claim_window_seconds",
        type: "core::integer::u32",
      },
      {
        name: "pool_bps",
        type: "core::integer::u16",
      },
      {
        name: "top_n",
        type: "core::integer::u16",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::relics::LordsBudget",
    members: [
      {
        name: "pool",
        type: "core::integer::u128",
      },
      {
        name: "pool_left",
        type: "core::integer::u128",
      },
      {
        name: "open",
        type: "core::integer::u128",
      },
      {
        name: "day",
        type: "core::integer::u64",
      },
      {
        name: "price",
        type: "core::integer::u128",
      },
      {
        name: "rolled_shares",
        type: "core::integer::u128",
      },
      {
        name: "yesterday_shares",
        type: "core::integer::u128",
      },
      {
        name: "yesterday_ticks",
        type: "core::integer::u64",
      },
    ],
  },
  {
    type: "struct",
    name: "world_native::resources::ResourceSlot",
    members: [
      {
        name: "game_id",
        type: "core::integer::u32",
      },
      {
        name: "entity_id",
        type: "core::integer::u64",
      },
      {
        name: "resource_type",
        type: "core::integer::u8",
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
        name: "last_settled_at",
        type: "core::integer::u32",
      },
      { name: "remainder", type: "core::integer::u8" },
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
        type: "core::integer::u64",
      },
      {
        name: "mine_kind",
        type: "core::integer::u8",
      },
      {
        name: "deepest_depth",
        type: "core::integer::u8",
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
        type: "core::integer::u64",
      },
    ],
  },
];

// Native row declarations are shared by schema generation, behavioural observations and client bindings.
const presetDerivedModels = new Set([
  "SliceRules",
  "SettlementRules",
  "AspectRules",
  "QuestRules",
  "BaneRules",
  "RaceRules",
  "ResourceRule",
  "ProductionRecipe",
  "MineKindConfig",
  "MinePool",
  "BuildingRule",
  "BoardRules",
  "ResearchPrice",
  "UpgradeLimits",
  "UpgradeRecipe",
  "RealmGrants",
  "VillageRules",
  "DepthRules",
  "ChestRules",
  "DeepRules",
]);

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
    if (row.name === "RaceMember")
      row.absence = {
        parent: "Structure",
        value: "zero",
        meaning: "This home has earned no Glory or height contribution yet.",
      };
    if (row.name === "ExpeditionDiscovery" || row.name === "ExpeditionSpire")
      row.absence = {
        parent: "Structure",
        parentKeys: { entity_id: "structure_id" },
        value: "zero",
        meaning:
          row.name === "ExpeditionSpire"
            ? "No eligible Spire reveals on this home, day and layer yet."
            : "No empty player reveals in this expedition yet.",
      };
    if (row.name === "ArmyRelics" || row.name === "ArmyRelicEffect")
      row.absence = {
        parent: "ExplorerTroops",
        value: "zero",
        meaning: "No carried relics or running relic of this kind while the army exists.",
      };
    if (row.name === "AspectActivity")
      row.absence = {
        parent: "GameRegistry",
        value: "zero",
        meaning: "No home in this Aspect allocated an army on this day.",
      };
    if (row.name === "ArmySlot")
      row.absence = {
        parent: "Structure",
        parentKeys: { entity_id: "structure_id" },
        value: "unused",
        meaning: "This army slot has not been used on this season day.",
      };
    if (row.name === "Guard")
      row.absence = {
        parent: "Structure",
        parentKeys: { entity_id: "structure_id" },
        value: "zero",
        meaning: "No troops or resurrection delay in this guard slot.",
      };
    if (row.name === "BaneProgress")
      row.absence = {
        parent: "BaneRules",
        value: "zero",
        meaning: "No member of this Aspect has completed the bane quest on this day.",
      };
    if (row.name === "DeepEntries")
      row.absence = { parent: "DeepRules", value: "zero", meaning: "No Realm has entered the Deep on this day." };
    if (row.name === "AltarBar")
      row.absence = {
        parent: "DeepRules",
        value: "zero",
        meaning: "This Aspect has not received an Altar charge in this game.",
      };
    if (row.name === "QuestProgress")
      row.absence = {
        parent: "Structure",
        parentKeys: { entity_id: "home" },
        value: "zero",
        meaning: "This home has made no daily quest progress on this day.",
      };
    if (row.name === "AspectMembers")
      row.absence = { parent: "AspectRules", value: "zero", meaning: "No home has joined this Aspect in this game." };
    if (row.name === "SettlementProgress")
      row.absence = {
        parent: "SettlementRules",
        value: "zero",
        meaning: "No players have settled or registered realms in this game.",
      };
    const observation = behaviouralFacts[row.name];
    return observation ? { ...row, observation } : row;
  };
  return [
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
      "DepositSource",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      struct("deposits::DepositSource"),
    ),
    model("ExpeditionSpire", "game", struct("spires::ExpeditionSpireKey"), struct("spires::ExpeditionSpire")),
    model(
      "ExpeditionDiscovery",
      "game",
      struct("expeditions::ExpeditionDiscoveryKey"),
      struct("expeditions::ExpeditionDiscovery"),
    ),
    model(
      "FragmentCredit",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "id", type: "core::felt252" },
      ],
      struct("fragments::FragmentCredit").filter(({ name }) => name !== "id"),
    ),
    model(
      "Fragments",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "account", type: "core::starknet::contract_address::ContractAddress" },
      ],
      [{ name: "balance", type: "core::integer::u128" }],
    ),
    model(
      "Seal",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "account", type: "core::starknet::contract_address::ContractAddress" },
      ],
      [{ name: "granted_at", type: "core::integer::u64" }],
    ),
    model(
      "SpendLords",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "account", type: "core::starknet::contract_address::ContractAddress" },
      ],
      struct("deposits::SpendLords"),
    ),
    model(
      "PrincipalWithdrawal",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "account", type: "core::starknet::contract_address::ContractAddress" },
      ],
      struct("deposits::PrincipalWithdrawal"),
    ),
    model(
      "DepositReceipt",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "id", type: "core::integer::u64" },
      ],
      struct("deposits::DepositReceipt"),
    ),
    model("RaceRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("race::RaceRules")),
    model("RaceMember", "game", struct("resources::ResourceKey"), struct("race::RaceMember")),
    model("AspectHyperstructure", "game", struct("race::AspectKey"), struct("race::AspectHyperstructure")),
    model("TriumphDay", "game", struct("race::TriumphKey"), [{ name: "day", type: "core::integer::u64" }]),
    model("RaceResult", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("race::RaceResult")),
    model("BaneRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("banes::BaneRules")),
    model("QuestRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("quests::QuestRules")),
    model(
      "QuestProgress",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "home", type: "core::integer::u64" },
        { name: "day", type: "core::integer::u64" },
      ],
      struct("quests::QuestProgress"),
    ),
    model(
      "WorldBane",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "day", type: "core::integer::u64" },
      ],
      struct("banes::WorldBane"),
    ),
    model("FirstTeamBane", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("banes::FirstTeamBane")),
    model(
      "BaneProgress",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "aspect", type: "core::integer::u8" },
        { name: "day", type: "core::integer::u64" },
      ],
      struct("banes::BaneProgress"),
    ),
    model(
      "TeamBane",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "aspect", type: "core::integer::u8" },
        { name: "day", type: "core::integer::u64" },
      ],
      struct("deep::TeamBane"),
    ),
    model(
      "AltarBar",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "aspect", type: "core::integer::u8" },
      ],
      struct("deep::AltarBar"),
    ),
    model(
      "BaneGrant",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "home", type: "core::integer::u64" },
        { name: "day", type: "core::integer::u64" },
      ],
      struct("entry::LaborGrant").filter(({ name }) => name !== "game_id" && name !== "home"),
    ),
    model("DeepRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("deep::DeepRules")),
    model(
      "LaborGrant",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "home", type: "core::integer::u64" },
        { name: "day", type: "core::integer::u64" },
      ],
      struct("entry::LaborGrant").filter(({ name }) => name !== "game_id" && name !== "home"),
    ),
    model("FrontierPrize", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("entry::FrontierPrize")),
    model("ChestRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("relics::ChestRules")),
    model("LordsBudget", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("relics::LordsBudget")),
    model(
      "LordsWithdrawal",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "claim_id", type: "core::felt252" },
      ],
      struct("relics::LordsWithdrawal"),
    ),
    model("Guard", "game", struct("guards::GuardKey"), struct("guards::Guard")),
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
    model("RealmGrants", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("settlement::RealmGrants")),
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
    model(
      "SettledRealm",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "realm_id", type: "core::integer::u32" },
      ],
      [{ name: "home", type: "core::integer::u64" }],
    ),
    model("EntryEntitlement", "game", struct("settlement::EntryKey"), struct("settlement::EntryEntitlement")),
    model("PlayerEntry", "game", struct("settlement::EntryKey"), struct("settlement::PlayerEntry")),
    model(
      "AspectRules",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "orders", type: "core::array::Span::<core::integer::u8>" }],
    ),
    model(
      "HomeAspect",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "home", type: "core::integer::u64" },
      ],
      [{ name: "aspect", type: "core::integer::u8" }],
    ),
    model(
      "AspectMembers",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "aspect", type: "core::integer::u8" },
      ],
      [{ name: "members", type: "core::integer::u32" }],
    ),
    model("TileOpt", "game", struct("map::TileKey"), struct("map::TileOpt")),
    model("TileOccupancy", "game", struct("map::TileKey"), struct("map::TileOccupancy")),
    model("ArmyRelics", "game", struct("troops::ExplorerKey"), struct("army_relics::ArmyRelics")),
    model("ArmyRelicEffect", "game", struct("army_relics::ArmyRelicEffectKey"), struct("army_relics::ArmyRelicEffect")),
    model("RuinRelic", "game", struct("resources::ResourceKey"), struct("army_relics::ArmyRelic")),
    model("RuinCache", "game", struct("resources::ResourceKey"), [{ name: "fragments", type: "core::integer::u128" }]),
    model("ArmyCombat", "game", struct("troops::ExplorerKey"), struct("combat::ArmyCombat")),
    model("ArmyProgress", "game", struct("troops::ExplorerKey"), struct("progression::ArmyProgress")),
    model("ArmyDay", "game", struct("troops::ExplorerKey"), [{ name: "day", type: "core::integer::u64" }]),
    model(
      "DeepTick",
      "game",
      [{ name: "game_id", type: "core::integer::u32" }],
      [{ name: "paid_tick", type: "core::integer::u64" }],
    ),
    model("DeepSite", "game", struct("resources::ResourceKey"), struct("deep::DeepSite")),
    model(
      "DeepEntries",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "day", type: "core::integer::u64" },
      ],
      [{ name: "count", type: "core::integer::u32" }],
    ),
    model("GarrisonSlot", "game", struct("guards::GuardKey"), struct("deep::GarrisonSlot")),
    model("DeepArmy", "game", struct("troops::ExplorerKey"), struct("deep::DeepArmy")),
    model(
      "AspectActivity",
      "game",
      [
        { name: "game_id", type: "core::integer::u32" },
        { name: "aspect", type: "core::integer::u8" },
        { name: "day", type: "core::integer::u64" },
      ],
      [{ name: "active", type: "core::integer::u32" }],
    ),
    model("ArmySlot", "game", struct("troops::ArmySlotKey"), struct("troops::ArmySlot")),
    model("ExplorerTroops", "game", struct("troops::ExplorerKey"), struct("troops::ExplorerRecord")),
    model("ExpeditionSite", "game", struct("resources::ResourceKey"), struct("expeditions::ExpeditionSite")),
    model("Structure", "game", struct("resources::ResourceKey"), struct("structures::Structure")),
    model("ResourceBalance", "game", struct("resources::ResourceSlot"), [
      { name: "balance", type: "core::integer::u128" },
    ]),
    model("ResourceProduction", "game", struct("resources::ResourceSlot"), struct("resources::Production")),
    model("ProductionRecipe", "game", struct("production::RecipeKey"), struct("production::ProductionRecipe")),
    model("ResourceWeight", "game", struct("resources::ResourceKey"), struct("resources::Weight")),
    model("ResourceArrival", "game", struct("arrivals::ArrivalKey"), struct("arrivals::Arrival")),
    model(
      "RealmKnowledge",
      "game",
      [struct("resources::ResourceKey")[0], { name: "structure_id", type: "core::integer::u64" }],
      struct("research::RealmKnowledge"),
    ),
    model(
      "ResearchPrice",
      "game",
      [
        struct("resources::ResourceKey")[0],
        { name: "row", type: "core::integer::u8" },
        { name: "tier", type: "core::integer::u8" },
      ],
      struct("research::ResearchPrice"),
    ),
    model("BoardRules", "game", [struct("resources::ResourceKey")[0]], struct("buildings::BoardRules")),
    model("BuildingRule", "game", struct("buildings::BuildingRuleKey"), struct("buildings::BuildingRule")),
    model("Building", "game", struct("buildings::BuildingKey"), struct("buildings::Building")),
    model("StructureBuildings", "game", struct("resources::ResourceKey"), struct("buildings::StructureBuildings")),
    model("EntityName", "game", struct("resources::ResourceKey"), struct("names::EntityName")),
    model("RealmSkin", "game", struct("resources::ResourceKey"), struct("names::RealmSkin")),

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
        { name: "created_release_id", type: "core::integer::u32" },
      ],
    ),
    model("GameRegistry", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("game::GameRegistry")),
    model("GameOverrides", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("game::GameOverrides")),
    model("SliceRules", "game", [{ name: "game_id", type: "core::integer::u32" }], struct("rules::SliceRules")),
  ].map((fact) => (presetDerivedModels.has(fact.name) ? { ...fact, derivedFrom: "preset" } : fact));
}

// Paths describe observable values, not serialized row positions.
const behaviouralFacts = {
  Guard: { domain: "troops", fields: { troops: "troops", destroyedAt: "destroyed_tick" } },
  RealmTraits: { domain: "realm/season", fields: { wonder: "wonder", order: "order", resources: "resources" } },
  ResourceBalance: { domain: "resources", fields: { balance: "balance" } },
  ResourceProduction: {
    domain: "resources",
    transform: "production",
    meaning:
      "Production pays its per-second rate for elapsed seconds after last_settled_at, while at least one production building exists; inactive time projects to zero.",
    fields: {
      buildingCount: "building_count",
      rate: "production_rate",
      outputRemaining: "output_amount_left",
      settledAt: "last_settled_at",
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
      revealPercent: "reveal_percent",
      siteGuardLower: "site_guard_lower",
      siteGuardUpper: "site_guard_upper",
      riftGuardLower: "rift_guard_lower",
      riftGuardUpper: "rift_guard_upper",
      guardStep: "guard_step",
      beastWeakLower: "beast_weak_lower",
      beastWeakUpper: "beast_weak_upper",
      beastStrongLower: "beast_strong_lower",
      beastStrongUpper: "beast_strong_upper",
      chestOdds: "chest",
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
};

// Which rows a player's subscription carries. "shared" rows reach every subscriber and "actor" rows only the selected
// gameplay account. "internal" rows remain in Herald and never reach a subscription. In an expedition game every
// other row is in scope when any listed field names one of the player's owners, entities, realms, realm traits,
// production sources or regions; `epoch`, a season day index, also requires the current day.
// Generation fails for a fact or event without an entry here.
const shared = "shared";
const byEntity = { entities: ["entity_id"] };
const byOwner = { owners: ["owner"] };
const byPlayer = { owners: ["player"] };
export const syncScopes = {
  GameOverrides: "internal",
  GameplayRejected: "actor",
  BatchProgress: "actor",
  ...Object.fromEntries(
    [
      "ChestRules",
      "DeepRules",
      "LordsBudget",
      "FrontierPrize",
      "DepositSource",
      "MineKindConfig",
      "MinePool",
      "RealmGrants",
      "SettlementRules",
      "SettlementProgress",
      "SettlementPool",
      "VillageRules",
      "VillagePool",
      "ProductionRecipe",
      "BoardRules",
      "ResearchPrice",
      "BuildingRule",
      "ResourceRule",
      "UpgradeLimits",
      "UpgradeRecipe",
      "DepthRules",
      "GameRegistry",
      "GameRelease",
      "SliceRules",
    ].map((name) => [name, shared]),
  ),
  RealmTraits: { realmTraits: ["realm_id"] },
  SettledRealm: { entities: ["home"] },
  EntryEntitlement: byOwner,
  PlayerEntry: byOwner,
  AspectRules: "shared",
  QuestRules: "shared",
  BaneRules: "shared",
  RaceRules: "shared",
  RaceMember: "shared",
  AspectHyperstructure: "shared",
  TriumphDay: "shared",
  RaceResult: "shared",
  WorldBane: "shared",
  FirstTeamBane: "shared",
  BaneProgress: "shared",
  TeamBane: "shared",
  AltarBar: "shared",
  BaneGrant: { owners: ["account"] },
  QuestProgress: { entities: ["home"] },
  HomeAspect: "shared",
  AspectMembers: "shared",
  VillagePass: byOwner,
  StoryEvent: byOwner,
  Guild: { owners: ["guild_id"] },
  GuildMember: { owners: ["actor"] },
  GuildWhitelist: byPlayer,
  LordsWithdrawal: { owners: ["account"] },
  LaborGrant: { owners: ["account"] },
  FragmentCredit: { owners: ["account"] },
  Fragments: { owners: ["account"] },
  Seal: { owners: ["account"] },
  SpendLords: { owners: ["account"] },
  PrincipalWithdrawal: { owners: ["account"] },
  DepositReceipt: { owners: ["account"] },
  TileOpt: { regions: [{ alt: "alt", x: "col", y: "row" }] },
  TileOccupancy: { regions: [{ alt: "alt", x: "col", y: "row" }], entities: ["entity_id"] },
  Building: { realms: ["structure_id"] },
  RealmKnowledge: { realms: ["structure_id"] },
  ExpeditionSite: { regions: [{ alt: "alt", x: "col", y: "row" }], entities: ["entity_id"] },
  ArmyCombat: { entities: ["explorer_id"] },
  ArmyProgress: { entities: ["explorer_id"] },
  ArmyRelics: { entities: ["explorer_id"] },
  ArmyRelicEffect: { entities: ["explorer_id"] },
  RuinRelic: { entities: ["entity_id"] },
  RuinCache: { entities: ["entity_id"] },
  ExpeditionDiscovery: { realms: ["structure_id"], epoch: "epoch" },
  ExpeditionSpire: { realms: ["structure_id"], epoch: "epoch" },
  ArmyDay: { entities: ["explorer_id"] },
  AspectActivity: shared,
  DeepTick: shared,
  DeepSite: shared,
  DeepEntries: shared,
  GarrisonSlot: shared,
  DeepArmy: shared,
  ArmySlot: { entities: ["structure_id"], epoch: "epoch" },
  ExplorerTroops: { entities: ["explorer_id"] },
  Guard: { entities: ["structure_id"] },
  BattleEvent: { entities: ["attacker_id", "defender_id"] },
  ResourceProduction: { entities: ["entity_id"] },
  Structure: byEntity,
  ResourceBalance: byEntity,
  ResourceWeight: byEntity,
  ResourceArrival: byEntity,
  StructureBuildings: byEntity,
  EntityName: byEntity,
  RealmSkin: byEntity,
};
