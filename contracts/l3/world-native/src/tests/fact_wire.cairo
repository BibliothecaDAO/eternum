// Check-only ABI projection replaces unchecked fact-model wire declarations.
// Production schema generation never loads this test class.
#[derive(Drop, Serde)]
pub struct FactWire {
    pub wonder_faith: crate::faith::WonderFaith,
    pub faithful_structure: crate::faith::FaithfulStructure,
    pub arrival: crate::arrivals::Arrival,
    pub arrival_key: crate::arrivals::ArrivalKey,
    pub claim_key: crate::bitcoin::ClaimKey,
    pub contribution: crate::bitcoin::Contribution,
    pub contribution_key: crate::bitcoin::ContributionKey,
    pub mine_funding: crate::bitcoin::MineFunding,
    pub phase: crate::bitcoin::Phase,
    pub phase_status: crate::bitcoin::PhaseStatus,
    pub phase_key: crate::bitcoin::PhaseKey,
    pub building: crate::buildings::Building,
    pub building_key: crate::buildings::BuildingKey,
    pub building_rule_key: crate::buildings::BuildingRuleKey,
    pub population: crate::buildings::Population,
    pub structure_buildings: crate::buildings::StructureBuildings,
    pub player_faith_key: crate::faith::PlayerFaithKey,
    pub player_faith_points: crate::faith::PlayerFaithPoints,
    pub game_registry: crate::game::GameRegistry,
    pub tile_opt: crate::map::TileOpt,
    pub liquidity_key: crate::market::LiquidityKey,
    pub mine_kind_key: crate::mines::MineKindKey,
    pub entity_name: crate::names::EntityName,
    pub production_bonus: crate::production::ProductionBonus,
    pub recipe_key: crate::production::RecipeKey,
    pub realm_catalogue: crate::realms::RealmCatalogue,
    pub production: crate::resources::Production,
    pub weight: crate::resources::Weight,
    pub player_entry: crate::settlement::PlayerEntry,
    pub settlement_progress: crate::settlement::SettlementProgress,
    pub structure: crate::structures::Structure,
    pub structure_base: crate::structures::StructureBase,
    pub structure_metadata: crate::structures::StructureMetadata,
    pub trade_key: crate::trade::TradeKey,
    pub village_pass: crate::village::VillagePass,
}

#[starknet::contract]
mod FactWireFixture {
    #[storage]
    struct Storage {}

    #[external(v0)]
    fn fact_wire(self: @ContractState, value: super::FactWire) {}
}
