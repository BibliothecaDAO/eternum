pub type Storage =
    games_storage::games::GamesStorage<
        crate::resources::ResourceAmount,
        crate::buildings::Building,
        crate::buildings::StructureBuildings,
        crate::game::GameRegistry,
        crate::game::GameOverrides,
        crate::guards::Guard,
        crate::guilds::Guild,
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
