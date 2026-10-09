// This host replaces the separately deployed domains in behaviour fixtures.
#[starknet::contract]
pub mod GamesTest {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::games::Authentication;
    use crate::games_entry::GamesEntry;
    use crate::logic::release::ReleaseState;
    component!(path: GamesEntry, storage: entry, event: EntryEvent);
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl EntryInternal = GamesEntry::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Releases = ReleaseState::ReleasesImpl<ContractState>;
    #[abi(embed_v0)]
    impl AuthenticationViews = GamesEntry::AuthenticationImpl<ContractState>;
    #[abi(embed_v0)]
    impl RandomnessViews = GamesEntry::RandomnessImpl<ContractState>;
    #[abi(embed_v0)]
    impl Roles = GamesEntry::RolesImpl<ContractState>;
    #[abi(embed_v0)]
    impl Play = GamesEntry::PlayImpl<ContractState>;
    #[abi(embed_v0)]
    impl Registrar = GamesEntry::RegistrarImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        entry: GamesEntry::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
        last_applied: bool,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        EntryEvent: GamesEntry::Event,
        ReleaseEvent: ReleaseState::Event,
    }
    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        launcher: ContractAddress,
        authentication: Authentication,
        release_id: u32,
        release: crate::logic::release::Release,
        vrf_public_key: realms_vrf_verifier::vendor::ecvrf::Point,
        l2_gas_bound: u64,
    ) {
        self.entry.initializer(owner, launcher, authentication, release_id, release, vrf_public_key, l2_gas_bound);
    }
    #[abi(embed_v0)]
    impl RootFixture of crate::tests::play_fixture::IPlayFixture<ContractState> {
        fn play_with_root(
            ref self: ContractState,
            game_id: u32,
            release_id: u32,
            preset_commitment: felt252,
            command: Span<felt252>,
            root: u256,
        ) {
            let actor = self.entry.validate_play(game_id, release_id, preset_commitment, command);
            let context = crate::commands::ActionContext {
                raw_root: root, timestamp: starknet::get_block_timestamp(),
            };
            let applied = self.entry.apply_gameplay(game_id, actor, command, context);
            self.last_applied.write(applied);
        }
        fn last_applied(self: @ContractState) -> bool {
            self.last_applied.read()
        }
    }
    use crate::tests::games_fixture::GamesFixture;
    #[abi(embed_v0)]
    impl ExpeditionRulesFixture = GamesFixture::ExpeditionRulesFixture<ContractState>;
    #[abi(embed_v0)]
    impl CaptureFixture = GamesFixture::CaptureFixture<ContractState>;
    #[abi(embed_v0)]
    impl SpiresFixture = GamesFixture::SpiresFixture<ContractState>;
    #[abi(embed_v0)]
    impl SeasonPlacementFixture = GamesFixture::SeasonPlacementFixture<ContractState>;
    #[abi(embed_v0)]
    impl SettlementPoolFixture = GamesFixture::SettlementPoolFixture<ContractState>;
    #[abi(embed_v0)]
    impl BlitzReservationsFixture = GamesFixture::BlitzReservationsFixture<ContractState>;
    #[abi(embed_v0)]
    impl MapFixture = GamesFixture::MapFixture<ContractState>;
    #[abi(embed_v0)]
    impl ExtractionFixture = GamesFixture::ExtractionFixture<ContractState>;
    #[abi(embed_v0)]
    impl RelicMapFixture = GamesFixture::RelicMapFixture<ContractState>;
    #[abi(embed_v0)]
    impl RelicTroopsFixture = GamesFixture::RelicTroopsFixture<ContractState>;
    #[abi(embed_v0)]
    impl GuardsFixture = GamesFixture::GuardsFixture<ContractState>;
    #[abi(embed_v0)]
    impl TroopManagementFixture = GamesFixture::TroopManagementFixture<ContractState>;
    #[abi(embed_v0)]
    impl TroopCommandsFixture = GamesFixture::TroopCommandsFixture<ContractState>;
    #[abi(embed_v0)]
    impl ExploreFixture = GamesFixture::ExploreFixture<ContractState>;
    #[abi(embed_v0)]
    impl CampRulesFixture = GamesFixture::CampRulesFixture<ContractState>;
    #[abi(embed_v0)]
    impl BankCreationFixture = GamesFixture::BankCreationFixture<ContractState>;
    #[abi(embed_v0)]
    impl BuildingRulesFixture = GamesFixture::BuildingRulesFixture<ContractState>;
    #[abi(embed_v0)]
    impl StructuresFixture = GamesFixture::StructuresFixture<ContractState>;
    #[abi(embed_v0)]
    impl SettlementCreationFixture = GamesFixture::SettlementCreationFixture<ContractState>;
    #[abi(embed_v0)]
    impl BuildingCommandsFixture = GamesFixture::BuildingCommandsFixture<ContractState>;
    #[abi(embed_v0)]
    impl NamesFixture = GamesFixture::NamesFixture<ContractState>;
    #[abi(embed_v0)]
    impl StructureCaptureFixture = GamesFixture::StructureCaptureFixture<ContractState>;
    #[abi(embed_v0)]
    impl UpgradeRulesFixture = GamesFixture::UpgradeRulesFixture<ContractState>;
    #[abi(embed_v0)]
    impl SeasonRealmsFixture = GamesFixture::SeasonRealmsFixture<ContractState>;
    #[abi(embed_v0)]
    impl VillagesFixture = GamesFixture::VillagesFixture<ContractState>;
    #[abi(embed_v0)]
    impl SettlementViewsFixture = GamesFixture::SettlementViewsFixture<ContractState>;
    #[abi(embed_v0)]
    impl SettlementEntryFixture = GamesFixture::SettlementEntryFixture<ContractState>;
    #[abi(embed_v0)]
    impl SettlementCommandsFixture = GamesFixture::SettlementCommandsFixture<ContractState>;
    #[abi(embed_v0)]
    impl ResourcesFixture = GamesFixture::ResourcesFixture<ContractState>;
    #[abi(embed_v0)]
    impl EconomyDeliveryFixture = GamesFixture::EconomyDeliveryFixture<ContractState>;
    #[abi(embed_v0)]
    impl MineRulesFixture = GamesFixture::MineRulesFixture<ContractState>;
    #[abi(embed_v0)]
    impl ExplorationGrantFixture = GamesFixture::ExplorationGrantFixture<ContractState>;
    #[abi(embed_v0)]
    impl RelicProductionFixture = GamesFixture::RelicProductionFixture<ContractState>;
    #[abi(embed_v0)]
    impl ProductionRulesFixture = GamesFixture::ProductionRulesFixture<ContractState>;
    #[abi(embed_v0)]
    impl ProductionCommandsFixture = GamesFixture::ProductionCommandsFixture<ContractState>;
    #[abi(embed_v0)]
    impl ResourceCommandsFixture = GamesFixture::ResourceCommandsFixture<ContractState>;
    #[abi(embed_v0)]
    impl TradeFixture = GamesFixture::TradeFixture<ContractState>;
    #[abi(embed_v0)]
    impl BankFixture = GamesFixture::BankFixture<ContractState>;
    #[abi(embed_v0)]
    impl FaithOwnershipViewsFixture = GamesFixture::FaithOwnershipViewsFixture<ContractState>;
    #[abi(embed_v0)]
    impl BitcoinViewsFixture = GamesFixture::BitcoinViewsFixture<ContractState>;
    #[abi(embed_v0)]
    impl BitcoinFundingFixture = GamesFixture::BitcoinFundingFixture<ContractState>;
    #[abi(embed_v0)]
    impl BitcoinCommandsFixture = GamesFixture::BitcoinCommandsFixture<ContractState>;
    #[abi(embed_v0)]
    impl GameFixture = GamesFixture::GameFixture<ContractState>;
    #[abi(embed_v0)]
    impl WithdrawalsFixture = GamesFixture::WithdrawalsFixture<ContractState>;
    #[abi(embed_v0)]
    impl SeasonLifecycleFixture = GamesFixture::SeasonLifecycleFixture<ContractState>;
    #[abi(embed_v0)]
    impl GameSettlementFixture = GamesFixture::GameSettlementFixture<ContractState>;
    #[abi(embed_v0)]
    impl PointsFixture = GamesFixture::PointsFixture<ContractState>;
    #[abi(embed_v0)]
    impl HyperstructuresFixture = GamesFixture::HyperstructuresFixture<ContractState>;
    #[abi(embed_v0)]
    impl GuildsFixture = GamesFixture::GuildsFixture<ContractState>;
    #[abi(embed_v0)]
    impl BridgeFixture = GamesFixture::BridgeFixture<ContractState>;
    #[abi(embed_v0)]
    impl BankWithdrawalFixture = GamesFixture::BankWithdrawalFixture<ContractState>;
    #[abi(embed_v0)]
    impl LedgerOperatorFixture = GamesFixture::LedgerOperatorFixture<ContractState>;
    #[abi(embed_v0)]
    impl BlitzResultsFixture = GamesFixture::BlitzResultsFixture<ContractState>;
    #[abi(embed_v0)]
    impl FaithFixture = GamesFixture::FaithFixture<ContractState>;
    #[abi(embed_v0)]
    impl RelicsFixture = GamesFixture::RelicsFixture<ContractState>;
    #[abi(embed_v0)]
    impl ArtificerFixture = GamesFixture::ArtificerFixture<ContractState>;
    #[external(v0)]
    fn layout_tile(self: @ContractState, key: crate::map::TileKey) -> Option<crate::map::TileOpt> {
        crate::logic::map::tile(key)
    }
}
