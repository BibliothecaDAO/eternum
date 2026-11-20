pub type Preset =
    games_storage::presets::PresetStorage<
        crate::rules::SliceRules,
        crate::resources::ResourceAmount,
        crate::production::RecipeTerms,
        crate::mines::MineKindConfig,
        crate::mines::MineWeight,
        crate::buildings::BoardRules,
        crate::research::ResearchPrice,
        crate::buildings::BuildingTerms,
        crate::upgrades::UpgradeLimits,
        crate::settlement::SettlementMode,
        crate::troops::TroopType,
        crate::village::VillageResource,
        crate::spires::SpireLayout,
        crate::bridge::DepositRules,
        crate::withdrawals::WithdrawalTerms,
        crate::withdrawals::Retention,
        crate::entry::LaborRules,
        crate::deep::DeepSettings,
        crate::race::RaceRules,
    >;

pub type Storage =
    games_storage::games::GamesStorage<
        Preset,
        crate::resources::ResourceAmount,
        crate::bitcoin::Phase,
        crate::bitcoin::Contribution,
        crate::bitcoin::MineFunding,
        crate::blitz_results::RankedPlayer,
        crate::buildings::Building,
        crate::buildings::StructureBuildings,
        crate::game::GameRegistry,
        crate::game::GameOverrides,
        crate::guards::Guard,
        crate::guilds::Guild,
        crate::registrar::RosterPlayer,
        crate::relics::LordsWithdrawal,
        crate::resources::Production,
        crate::resources::Weight,
        crate::settlement::SettlementProgress,
        crate::settlement::PlayerEntry,
        crate::settlement::EntryEntitlement,
        crate::structures::StructureRecord,
        crate::expeditions::ExpeditionSite,
        crate::troops::ExplorerRecord,
        crate::troops::ArmySlotRecord,
        crate::progression::ArmyProgress,
        crate::combat::ArmyCombat,
        crate::village::VillagePass,
        crate::deep::DeepSite,
        crate::deep::DeepGuard,
    >;

pub fn read() -> starknet::storage::FlattenedStorage<Storage> {
    starknet::storage::FlattenedStorage {}
}

pub fn write() -> starknet::storage::FlattenedStorage<starknet::storage::Mutable<Storage>> {
    starknet::storage::FlattenedStorage {}
}
