use core::pedersen::pedersen;
use starknet::{ClassHash, ContractAddress};

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Authentication {
    pub account_class: ClassHash,
    pub guardian_public_key: felt252,
}

/// The shard fixes both the account class and guardian; both determine every player address.
pub fn player_account_address(realms_id: felt252, class: ClassHash, guardian: felt252) -> ContractAddress {
    let calldata_hash = pedersen(pedersen(pedersen(0, realms_id), guardian), 2);
    let prefix = pedersen(pedersen(0, 'STARKNET_CONTRACT_ADDRESS'), 0);
    let raw = pedersen(pedersen(pedersen(pedersen(prefix, realms_id), class.into()), calldata_hash), 5);
    let normalized: u256 = raw.into() % 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00;
    let address: felt252 = normalized.try_into().unwrap();
    address.try_into().unwrap()
}

#[derive(Drop, Serde)]
pub struct DeploymentConfiguration {
    pub owner: ContractAddress,
    pub launcher: ContractAddress,
}

#[starknet::interface]
pub trait IGamesAuthentication<T> {
    fn authentication(self: @T) -> crate::games::Authentication;
}

#[starknet::interface]
pub trait IGamesRoles<T> {
    fn owner(self: @T) -> ContractAddress;
    fn launcher(self: @T) -> ContractAddress;
    fn set_launcher(ref self: T, launcher: ContractAddress);
    fn prepare_homes(ref self: T, game_id: u32, owners: Span<ContractAddress>);
}

#[starknet::interface]
pub trait IGamesPlay<T> {
    fn play(ref self: T, game_id: u32, release_id: u32, preset_commitment: felt252, command: Span<felt252>);
}

#[starknet::contract]
pub mod Games {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::games::Authentication;
    use crate::games_entry::GamesEntry;
    use crate::logic::entry::EntryAdministration;
    use crate::logic::release::ReleaseState;
    component!(path: EntryAdministration, storage: administration, event: AdministrationEvent);
    #[abi(embed_v0)]
    impl LedgerOperator = EntryAdministration::LedgerOperatorImpl<ContractState>;
    component!(path: GamesEntry, storage: entry, event: EntryEvent);
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl EntryInternal = GamesEntry::InternalImpl<ContractState>;
    impl ReleaseInternal = ReleaseState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Releases = ReleaseState::ReleasesImpl<ContractState>;
    #[abi(embed_v0)]
    impl AuthenticationViews = GamesEntry::AuthenticationImpl<ContractState>;
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
        administration: EntryAdministration::Storage,
        #[substorage(v0)]
        entry: GamesEntry::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        AdministrationEvent: EntryAdministration::Event,
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
    ) {
        self.entry.initializer(owner, launcher, authentication, release_id, release);
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
        super::DeploymentConfiguration { owner: self.release.authority(), launcher: crate::state::read().launcher.read() }
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
