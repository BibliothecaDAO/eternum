pub type Preset =
    games_storage::presets::PresetStorage<
        crate::rules::SliceRules,
        crate::resources::ResourceAmount,
        crate::production::RecipeTerms,
        crate::mines::MineKindConfig,
        crate::mines::MineWeight,
        crate::buildings::BoardTerms,
        crate::buildings::NeighborBonus,
        crate::buildings::BuildingTerms,
        crate::faith::FaithRules,
        crate::upgrades::UpgradeLimits,
        crate::settlement::SettlementMode,
        crate::troops::TroopType,
        crate::expeditions::DepthRules,
        crate::village::VillageResource,
        crate::spires::SpireLayout,
        crate::trade::TradeRules,
        crate::market::BankRules,
        crate::hyperstructures::ConstructionResource,
        crate::relics::RelicRule,
        crate::relics::ChestRules,
        crate::progression::ArmyProgressionRules,
        crate::bridge::DepositRules,
        crate::withdrawals::WithdrawalTerms,
        crate::withdrawals::Retention,
        crate::exploration_rewards::ExplorationReward,
    >;

pub type Storage =
    games_storage::games::GamesStorage<
        Preset,
        crate::resources::ResourceAmount,
        crate::bitcoin::Phase,
        crate::bitcoin::Contribution,
        crate::bitcoin::MineFunding,
        crate::blitz_results::PlayerResult,
        crate::buildings::Building,
        crate::buildings::StructureBuildings,
        crate::faith::WonderFaith,
        crate::faith::FaithfulStructure,
        crate::faith::PlayerFaithPoints,
        crate::game::GameRegistry,
        crate::game::GameOverrides,
        crate::guards::Guard,
        crate::guilds::Guild,
        crate::hyperstructures::Hyperstructure,
        crate::hyperstructures::Share,
        crate::market::Market,
        crate::production::ProductionBonus,
        crate::registrar::RosterPlayer,
        crate::relics::ChestReward,
        crate::resources::Production,
        crate::resources::ProductionReceiver,
        crate::resources::Weight,
        crate::settlement::SettlementProgress,
        crate::settlement::PlayerEntry,
        crate::settlement::EntryEntitlement,
        crate::structures::StructureRecord,
        crate::trade::TradeOrder,
        crate::troops::ExplorerRecord,
        crate::troops::ArmySlotRecord,
        crate::progression::PackedArmyProgress,
        crate::village::VillagePass,
    >;

pub fn read() -> starknet::storage::FlattenedStorage<Storage> {
    starknet::storage::FlattenedStorage {}
}

pub fn write() -> starknet::storage::FlattenedStorage<starknet::storage::Mutable<Storage>> {
    starknet::storage::FlattenedStorage {}
}
