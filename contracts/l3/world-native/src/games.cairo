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
}

#[starknet::interface]
pub trait IGamesPlay<T> {
    fn play(ref self: T, game_id: u32, release_id: u32, command: Span<felt252>);
}

#[starknet::interface]
pub trait IGamesRandomness<T> {
    fn vrf_public_key(self: @T) -> realms_vrf_verifier::vendor::ecvrf::Point;
    fn l2_gas_bound(self: @T) -> u64;
}

#[starknet::interface]
pub trait IGamesSlots<T> {
    fn view_call(self: @T, game_id: u32, slot: u8, calldata: Span<felt252>) -> Span<felt252>;
    fn authority_call(ref self: T, family: u8, slot: u8, calldata: Span<felt252>) -> Span<felt252>;
}

#[starknet::contract]
pub mod Games {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::games::Authentication;
    use crate::games_entry::GamesEntry;
    use crate::logic::release::{ISlotAuthorityDispatcherTrait, ISlotViewsDispatcherTrait, ReleaseState};
    component!(path: GamesEntry, storage: entry, event: EntryEvent);
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl EntryInternal = GamesEntry::InternalImpl<ContractState>;
    impl ReleaseInternal = ReleaseState::InternalImpl<ContractState>;
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
    #[abi(embed_v0)]
    impl Slots of crate::games::IGamesSlots<ContractState> {
        fn view_call(self: @ContractState, game_id: u32, slot: u8, calldata: Span<felt252>) -> Span<felt252> {
            crate::logic::release::ISlotViewsLibraryDispatcher {
                class_hash: filled(crate::logic::release::class_of(game_id, slot)),
            }
                .slot_view(game_id, calldata)
        }
        fn authority_call(ref self: ContractState, family: u8, slot: u8, calldata: Span<felt252>) -> Span<felt252> {
            crate::logic::release::assert_authority();
            crate::logic::release::ISlotAuthorityLibraryDispatcher {
                class_hash: filled(crate::logic::release::family_class(family, slot)),
            }
                .slot_authority(family, calldata)
        }
    }

    fn filled(class_hash: starknet::ClassHash) -> starknet::ClassHash {
        assert!(core::num::traits::Zero::is_non_zero(@class_hash), "no logic class in this slot");
        class_hash
    }
    #[abi(embed_v0)]
    impl LedgerOperator of crate::entry::ILedgerOperator<ContractState> {
        fn deposit_source(self: @ContractState, game_id: u32) -> Option<crate::deposits::DepositSource> {
            crate::entry::ILedgerOperatorDispatcherTrait::deposit_source(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
            )
        }
        fn deliver_deposit(
            ref self: ContractState,
            game_id: u32,
            deposit: crate::deposits::LordsDeposit,
            r: felt252,
            s: felt252,
            cancel: bool,
        ) {
            crate::entry::ILedgerOperatorDispatcherTrait::deliver_deposit(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                deposit,
                r,
                s,
                cancel,
            )
        }
        fn deposit_receipt(self: @ContractState, game_id: u32, id: u64) -> Option<crate::deposits::DepositReceipt> {
            crate::entry::ILedgerOperatorDispatcherTrait::deposit_receipt(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                id,
            )
        }
        fn spend_lords(self: @ContractState, game_id: u32, account: ContractAddress) -> crate::deposits::SpendLords {
            crate::entry::ILedgerOperatorDispatcherTrait::spend_lords(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                account,
            )
        }
        fn principal_withdrawal(
            self: @ContractState, game_id: u32, account: ContractAddress,
        ) -> Option<crate::deposits::PrincipalWithdrawal> {
            crate::entry::ILedgerOperatorDispatcherTrait::principal_withdrawal(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                account,
            )
        }
        fn ledger_operator(self: @ContractState) -> ContractAddress {
            crate::entry::ILedgerOperatorDispatcherTrait::ledger_operator(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::family_class(crate::game::FRONTIER, crate::slots::BRIDGE),
                },
            )
        }
        fn set_ledger_operator(ref self: ContractState, operator: ContractAddress) {
            crate::entry::ILedgerOperatorDispatcherTrait::set_ledger_operator(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::family_class(crate::game::FRONTIER, crate::slots::BRIDGE),
                },
                operator,
            );
        }

        fn frontier_prize(self: @ContractState, game_id: u32) -> crate::entry::FrontierPrize {
            crate::entry::ILedgerOperatorDispatcherTrait::frontier_prize(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
            )
        }

        fn sweep_lords(ref self: ContractState, game_id: u32, structure_id: u64) {
            crate::entry::ILedgerOperatorDispatcherTrait::sweep_lords(
                crate::entry::ILedgerOperatorLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                structure_id,
            )
        }
    }
    #[abi(embed_v0)]
    impl HomeGrants of crate::entry::IHomeGrants<ContractState> {
        fn grant_seal(ref self: ContractState, game_id: u32, account: ContractAddress) {
            crate::entry::IHomeGrantsDispatcherTrait::grant_seal(
                crate::entry::IHomeGrantsLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(game_id, crate::slots::BRIDGE),
                },
                game_id,
                account,
            )
        }
        fn credit_fragments(ref self: ContractState, game_id: u32, credit: crate::fragments::FragmentCredit) {
            crate::entry::IHomeGrantsDispatcherTrait::credit_fragments(
                crate::entry::IHomeGrantsLibraryDispatcher { class_hash: self.release.classes(game_id).bridge.read() },
                game_id,
                credit,
            )
        }
    }
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        entry: GamesEntry::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        AdministrationEvent: crate::logic::entry::EntryAdministration::Event,
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
        classes: Span<starknet::ClassHash>,
        vrf_public_key: realms_vrf_verifier::vendor::ecvrf::Point,
        l2_gas_bound: u64,
    ) {
        self
            .entry
            .initializer(owner, launcher, authentication, release_id, release, classes, vrf_public_key, l2_gas_bound);
    }

    #[external(v0)]
    fn initialize_realm_traits(ref self: ContractState, first_realm: u32, packed_traits: Span<u32>) {
        // The immutable realm catalogue belongs to the shard, so administration uses the current release.
        crate::realms::ISeasonRealmsDispatcherTrait::initialize_realm_traits(
            crate::realms::ISeasonRealmsLibraryDispatcher {
                class_hash: crate::logic::release::family_class(crate::game::FRONTIER, crate::slots::SETTLEMENT),
            },
            first_realm,
            packed_traits,
        );
    }

    #[abi(embed_v0)]
    impl Entry of crate::settlement::ISettlementEntry<ContractState> {
        fn register_entitlement(
            ref self: ContractState, key: crate::settlement::EntryKey, entitlement: crate::settlement::EntryEntitlement,
        ) {
            crate::settlement::ISettlementEntryDispatcherTrait::register_entitlement(
                crate::settlement::ISettlementEntryLibraryDispatcher {
                    class_hash: crate::logic::release::class_of(key.game_id, crate::slots::SETTLEMENT),
                },
                key,
                entitlement,
            );
        }
        fn settled_realm(self: @ContractState, game_id: u32, realm_id: u32) -> u64 {
            crate::state::read().settlements.held_realm_homes.read((game_id, realm_id))
        }
        fn entry_entitlement(
            self: @ContractState, key: crate::settlement::EntryKey,
        ) -> Option<crate::settlement::EntryEntitlement> {
            crate::state::read().settlements.entitlements.read((key.game_id, key.owner))
        }
    }

    #[external(v0)]
    fn register_village_pass(ref self: ContractState, key: crate::village::VillagePassKey, owner: ContractAddress) {
        crate::village::IVillagePassesDispatcherTrait::register_village_pass(
            crate::village::IVillagePassesLibraryDispatcher {
                class_hash: crate::logic::release::class_of(key.game_id, crate::slots::SETTLEMENT),
            },
            key,
            owner,
        );
    }
    #[external(v0)]
    fn deployment_configuration(self: @ContractState) -> super::DeploymentConfiguration {
        super::DeploymentConfiguration {
            owner: self.release.authority(), launcher: crate::state::read().launcher.read(),
        }
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

    /// A realm's home ring for the day at `timestamp`, from the game's own map rule: the one read Herald makes to show
    /// a watched realm's ring before any command writes it.
    #[external(v0)]
    fn expedition_home_ring(
        self: @ContractState, game_id: u32, region_id: u32, timestamp: u64,
    ) -> Span<(crate::troops::Coord, u8)> {
        crate::map::IMapLogicDispatcherTrait::expedition_home_ring(
            crate::map::IMapLogicLibraryDispatcher {
                class_hash: crate::logic::release::class_of(game_id, crate::slots::MAP),
            },
            game_id,
            region_id,
            timestamp,
        )
    }
}
