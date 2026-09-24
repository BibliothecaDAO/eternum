use starknet::{ClassHash, ContractAddress};

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Authentication {
    pub submitter: ContractAddress,
    pub account_class: ClassHash,
}

#[derive(Drop, Serde)]
pub struct DeploymentConfiguration {
    pub authority: ContractAddress,
}

#[starknet::interface]
pub trait IGamesAuthentication<T> {
    fn set_authentication(
        ref self: T, submitter: starknet::ContractAddress, approved_account_class: starknet::ClassHash,
    );
    fn authentication(self: @T) -> crate::games::Authentication;
    fn next_nonce(self: @T, game_id: u32, actor: starknet::ContractAddress) -> u64;
}

#[starknet::contract]
pub mod Games {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::games::Authentication;
    use crate::games_entry::GamesEntry;
    use crate::logic::entry::EntryAdministration;
    use crate::logic::release::ReleaseState;
    use crate::recording::RecordedState;
    component!(path: EntryAdministration, storage: administration, event: AdministrationEvent);
    #[abi(embed_v0)]
    impl LedgerOperator = EntryAdministration::LedgerOperatorImpl<ContractState>;
    component!(path: GamesEntry, storage: entry, event: EntryEvent);
    component!(path: RecordedState, storage: recording, event: RecordingEvent);
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl EntryInternal = GamesEntry::InternalImpl<ContractState>;
    impl ReleaseInternal = ReleaseState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Releases = ReleaseState::ReleasesImpl<ContractState>;
    #[abi(embed_v0)]
    impl Season = GamesEntry::SeasonImpl<ContractState>;
    #[abi(embed_v0)]
    impl Execute = GamesEntry::ExecuteImpl<ContractState>;
    #[abi(embed_v0)]
    impl ExecutionFailure = GamesEntry::ExecutionFailureImpl<ContractState>;
    #[abi(embed_v0)]
    impl AdmissionViews = GamesEntry::AdmissionViewsImpl<ContractState>;
    #[abi(embed_v0)]
    impl Registrar = GamesEntry::RegistrarImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        administration: EntryAdministration::Storage,
        #[substorage(v0)]
        entry: GamesEntry::Storage,
        #[substorage(v0)]
        recording: RecordedState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        AdministrationEvent: EntryAdministration::Event,
        #[flat]
        EntryEvent: GamesEntry::Event,
        RecordingEvent: RecordedState::Event,
        ReleaseEvent: ReleaseState::Event,
    }
    #[constructor]
    fn constructor(
        ref self: ContractState,
        authority: ContractAddress,
        authentication: Authentication,
        release_id: u32,
        release: crate::logic::release::Release,
    ) {
        self.entry.initializer(authority, authentication, release_id, release);
    }

    #[external(v0)]
    fn initialize_realm_traits(ref self: ContractState, first_realm: u32, packed_traits: Span<u32>) {
        let state = crate::state::read();
        // The immutable realm catalogue belongs to the shard, so administration uses the current release.
        let classes = state.releases.read(state.current_release.read()).classes;
        crate::realms::ISeasonRealmsDispatcherTrait::initialize_realm_traits(
            crate::realms::ISeasonRealmsLibraryDispatcher { class_hash: classes.settlement },
            first_realm,
            packed_traits,
        );
    }

    #[abi(embed_v0)]
    impl Entry of crate::settlement::ISettlementEntry<ContractState> {
        fn register_entitlement(
            ref self: ContractState, key: crate::settlement::EntryKey, entitlement: crate::settlement::EntryEntitlement,
        ) {
            let classes = self.release.classes(key.game_id);
            crate::settlement::ISettlementEntryDispatcherTrait::register_entitlement(
                crate::settlement::ISettlementEntryLibraryDispatcher { class_hash: classes.settlement.read() },
                key,
                entitlement,
            );
        }
        fn entry_entitlement(
            self: @ContractState, key: crate::settlement::EntryKey,
        ) -> Option<crate::settlement::EntryEntitlement> {
            crate::state::read().settlements.entitlements.read((key.game_id, key.owner))
        }
    }

    #[external(v0)]
    fn register_village_pass(ref self: ContractState, key: crate::village::VillagePassKey, owner: ContractAddress) {
        let classes = self.release.classes(key.game_id);
        crate::village::IVillagesDispatcherTrait::register_village_pass(
            crate::village::IVillagesLibraryDispatcher { class_hash: classes.settlement.read() }, key, owner,
        );
    }
    #[external(v0)]
    fn deployment_configuration(self: @ContractState) -> super::DeploymentConfiguration {
        super::DeploymentConfiguration { authority: self.release.authority() }
    }

    #[external(v0)]
    fn realm_catalogue(self: @ContractState) -> crate::realms::RealmCatalogue {
        let state = crate::state::read();
        crate::realms::RealmCatalogue {
            initialized: state.realms.catalogue_count.read(), digest: state.realms.catalogue_digest.read(),
        }
    }

    #[external(v0)]
    fn game(self: @ContractState, game_id: u32) -> crate::game::GameRegistry {
        crate::logic::game::game(game_id)
    }

    #[external(v0)]
    fn player_points(self: @ContractState, game_id: u32, actor: ContractAddress) -> u128 {
        crate::state::read().season.player_points.read((game_id, actor))
    }

    /// A realm's home ring for the day at `timestamp`, from the game's own map rule: the one read Herald makes to show
    /// a watched realm's ring before any command writes it.
    #[external(v0)]
    fn expedition_home_ring(
        self: @ContractState, game_id: u32, realm_id: u16, timestamp: u64,
    ) -> Span<(crate::troops::Coord, u8)> {
        crate::map::IMapLogicDispatcherTrait::expedition_home_ring(
            crate::map::IMapLogicLibraryDispatcher { class_hash: self.release.classes(game_id).map.read() },
            game_id,
            realm_id,
            timestamp,
        )
    }

    #[external(v0)]
    fn blitz_result(self: @ContractState, game_id: u32) -> crate::blitz_results::BlitzResult {
        crate::blitz_results::IBlitzResultsDispatcherTrait::blitz_result(
            crate::blitz_results::IBlitzResultsLibraryDispatcher {
                class_hash: self.release.classes(game_id).prizes.read(),
            },
            game_id,
        )
    }
}
