use starknet::{ClassHash, ContractAddress};

#[derive(Copy, Drop, Serde, PartialEq, Debug, starknet::Store)]
pub struct Peers {
    pub season: ContractAddress,
    pub map: ContractAddress,
    pub structures: ContractAddress,
    pub troops: ContractAddress,
    pub settlement: ContractAddress,
    pub resources: ContractAddress,
    pub economy: ContractAddress,
    pub prizes: ContractAddress,
    pub registry: ContractAddress,
    pub combat: ContractAddress,
    pub bridge: ContractAddress,
}

#[generate_trait]
pub impl PeersImpl of PeersTrait {
    fn addresses(self: Peers) -> Span<ContractAddress> {
        array![
            self.season, self.map, self.structures, self.troops, self.settlement, self.resources, self.economy,
            self.prizes, self.registry, self.combat, self.bridge,
        ]
            .span()
    }
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct DomainState {
    pub authority: ContractAddress,
    pub peers: Peers,
    pub active: bool,
}

#[starknet::interface]
pub trait IDomain<T> {
    fn domain_state(self: @T) -> DomainState;
    fn configure(ref self: T, peers: Peers);
    fn activate(ref self: T);
    fn upgrade(ref self: T, class_hash: ClassHash);
}

#[starknet::component]
pub mod Lifecycle {
    use core::num::traits::Zero;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress, get_caller_address, get_contract_address};
    use crate::events::RowSet;
    use super::{DomainState, IDomainDispatcher, IDomainDispatcherTrait, Peers, PeersTrait};

    #[storage]
    pub struct Storage {
        pub state: DomainState,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }

    #[embeddable_as(DomainImpl)]
    impl Domain<TContractState, +HasComponent<TContractState>> of super::IDomain<ComponentState<TContractState>> {
        fn domain_state(self: @ComponentState<TContractState>) -> DomainState {
            self.state.read()
        }

        fn configure(ref self: ComponentState<TContractState>, peers: Peers) {
            self.assert_authority();
            let mut state = self.state.read();
            assert!(state.peers.season.is_zero(), "already configured");
            let addresses = peers.addresses();
            let mut contains_self = false;
            for index in 0..addresses.len() {
                let address = *addresses.at(index);
                assert!(address.is_non_zero(), "zero peer");
                contains_self = contains_self || address == get_contract_address();
                for previous in 0..index {
                    assert!(address != *addresses.at(previous), "duplicate peer");
                }
            }
            assert!(contains_self, "missing self peer");
            state.peers = peers;
            self.write_state(state);
        }

        fn activate(ref self: ComponentState<TContractState>) {
            self.assert_authority();
            let mut state = self.state.read();
            assert!(!state.active, "already active");
            let peers = state.peers;
            assert!(peers.season.is_non_zero(), "not configured");
            for address in peers.addresses() {
                let peer = IDomainDispatcher { contract_address: *address }.domain_state();
                assert!(peer.peers == peers, "peer mismatch");
                assert!(peer.authority == state.authority, "authority mismatch");
            }
            state.active = true;
            self.write_state(state);
        }

        fn upgrade(ref self: ComponentState<TContractState>, class_hash: ClassHash) {
            self.assert_authority();
            starknet::syscalls::replace_class_syscall(class_hash).unwrap();
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'DomainClass',
                        keys: array![get_contract_address().into()].span(),
                        values: array![class_hash.into()].span(),
                    },
                );
        }
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn initialize(ref self: ComponentState<TContractState>, authority: ContractAddress) {
            assert!(authority.is_non_zero(), "zero authority");
            assert!(self.state.read().authority.is_zero(), "already initialized");
            self
                .write_state(
                    DomainState {
                        authority,
                        peers: Peers {
                            season: 0.try_into().unwrap(),
                            map: 0.try_into().unwrap(),
                            structures: 0.try_into().unwrap(),
                            troops: 0.try_into().unwrap(),
                            settlement: 0.try_into().unwrap(),
                            resources: 0.try_into().unwrap(),
                            economy: 0.try_into().unwrap(),
                            prizes: 0.try_into().unwrap(),
                            registry: 0.try_into().unwrap(),
                            combat: 0.try_into().unwrap(),
                            bridge: 0.try_into().unwrap(),
                        },
                        active: false,
                    },
                );
        }

        #[inline(never)]
        fn assert_authority(self: @ComponentState<TContractState>) {
            assert!(get_caller_address() == self.state.read().authority, "only authority");
        }

        #[inline(never)]
        fn assert_configurator(self: @ComponentState<TContractState>) {
            let state = self.state.read();
            let caller = get_caller_address();
            assert!(state.active, "domain inactive");
            assert!(caller == state.authority || caller == state.peers.registry, "only authority or registrar");
        }

        #[inline(never)]
        fn require_active(self: @ComponentState<TContractState>) -> Peers {
            let state = self.state.read();
            assert!(state.active, "domain inactive");
            state.peers
        }

        fn write_state(ref self: ComponentState<TContractState>, state: DomainState) {
            self.state.write(state);
            let mut values = array![];
            state.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'DomainState',
                        keys: array![get_contract_address().into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
