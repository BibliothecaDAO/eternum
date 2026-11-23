// Check-only ABI projection replaces unchecked fact-model wire declarations.
// Production schema generation never loads this test class.
#[derive(Drop, Serde)]
pub struct FactWire {
    pub first_team_bane: crate::banes::FirstTeamBane,
    pub world_bane: crate::banes::WorldBane,
    pub bane_progress: crate::banes::BaneProgress,
    pub team_bane: crate::deep::TeamBane,
    pub altar_bar: crate::deep::AltarBar,
    pub quest_progress: crate::quests::QuestProgress,
    pub settlement_rules: crate::settlement::SettlementRules,
    pub arrival: crate::arrivals::Arrival,
    pub arrival_key: crate::arrivals::ArrivalKey,
    pub building: crate::buildings::Building,
    pub building_key: crate::buildings::BuildingKey,
    pub building_rule_key: crate::buildings::BuildingRuleKey,
    pub population: crate::buildings::Population,
    pub structure_buildings: crate::buildings::StructureBuildings,
    pub game_registry: crate::game::GameRegistry,
    pub game_overrides: crate::game::GameOverrides,
    pub labor_grant: crate::entry::LaborGrant,
    pub tile_opt: crate::map::TileOpt,
    pub tile_occupancy: crate::map::TileOccupancy,
    pub army_slot_key: crate::troops::ArmySlotKey,
    pub expedition_spire_key: crate::spires::ExpeditionSpireKey,
    pub expedition_spire: crate::spires::ExpeditionSpire,
    pub deep_site: crate::deep::DeepSite,
    pub deep_guard: crate::deep::DeepGuard,
    pub deep_army: crate::deep::DeepArmy,
    pub army_slot: crate::troops::ArmySlot,
    pub army_progress: crate::progression::ArmyProgress,
    pub army_combat: crate::combat::ArmyCombat,
    pub explorer_record: crate::troops::ExplorerRecord,
    pub mine_kind_key: crate::mines::MineKindKey,
    pub entity_name: crate::names::EntityName,
    pub recipe_key: crate::production::RecipeKey,
    pub realm_catalogue: crate::realms::RealmCatalogue,
    pub production: crate::resources::Production,
    pub weight: crate::resources::Weight,
    pub player_entry: crate::settlement::PlayerEntry,
    pub settlement_progress: crate::settlement::SettlementProgress,
    pub structure: crate::structures::Structure,
    pub structure_base: crate::structures::StructureBase,
    pub structure_metadata: crate::structures::StructureMetadata,
    pub village_pass: crate::village::VillagePass,
    pub mine_weight: crate::mines::MineWeight,
    pub board_rules: crate::buildings::BoardRules,
    pub frontier_discovery_rules: crate::expeditions::FrontierDiscoveryRules,
    pub race_rules: crate::race::RaceRules,
    pub research_price: crate::research::ResearchPrice,
    pub resource_rule: crate::resources::ResourceRule,
    pub resource_slot: crate::resources::ResourceSlot,
    pub upgrade_limits: crate::upgrades::UpgradeLimits,
    pub upgrade_recipe: crate::upgrades::UpgradeRecipe,
    pub deep_ring: crate::deep::DeepRing,
    pub deep_beast: crate::deep::DeepBeast,
    pub deep_pay: crate::deep::DeepPay,
}

#[starknet::contract]
pub mod FactWireFixture {
    #[storage]
    struct Storage {}

    #[external(v0)]
    fn fact_wire(self: @ContractState, value: super::FactWire) {}
}
