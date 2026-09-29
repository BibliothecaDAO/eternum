use starknet::ContractAddress;
use starknet::account::Call;

#[starknet::interface]
pub trait ISequencingAuthority<T> {
    fn get_public_key(self: @T) -> felt252;
    fn configure(ref self: T, deployment: ContractAddress);
    fn rotate(ref self: T, public_key: felt252);
}

#[starknet::interface]
pub trait ISequencingAccount<T> {
    fn __validate__(self: @T, calls: Array<Call>) -> felt252;
    fn __execute__(ref self: T, calls: Array<Call>) -> Array<Span<felt252>>;
}

#[starknet::contract(account)]
pub mod SequencingAccount {
    use core::ecdsa::check_ecdsa_signature;
    use crate::epochs::{EpochState, IRandomnessEpochs, RandomnessEpoch};
    component!(path: EpochState, storage: epochs, event: EpochEvent);
    impl EpochInternal = EpochState::InternalImpl<ContractState>;
    use core::num::traits::Zero;
    use starknet::account::Call;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, SyscallResultTrait, get_caller_address, get_contract_address, get_tx_info};

    #[storage]
    struct Storage {
        administrator: ContractAddress,
        public_key: felt252,
        deployment: ContractAddress,
        #[substorage(v0)]
        epochs: EpochState::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        EpochEvent: EpochState::Event,
    }

    #[abi(embed_v0)]
    impl RandomnessEpochs of IRandomnessEpochs<ContractState> {
        fn open_randomness_epoch(ref self: ContractState, commitment: felt252) {
            assert!(get_caller_address() == get_contract_address(), "only sequencing account");
            self.epochs.open(commitment);
        }
        fn reveal_randomness_epoch(ref self: ContractState, secret: u256) {
            assert!(get_caller_address() == get_contract_address(), "only sequencing account");
            self.epochs.reveal(secret);
        }
        fn current_randomness_epoch(self: @ContractState) -> u64 {
            self.epochs.current.read()
        }
        fn get_randomness_epoch(self: @ContractState, epoch: u64) -> RandomnessEpoch {
            self.epochs.epoch(epoch)
        }
    }

    #[constructor]
    fn constructor(ref self: ContractState, administrator: ContractAddress, public_key: felt252) {
        assert!(administrator.is_non_zero() && public_key != 0, "invalid authority");
        self.administrator.write(administrator);
        self.public_key.write(public_key);
    }

    #[abi(embed_v0)]
    impl Authority of super::ISequencingAuthority<ContractState> {
        fn get_public_key(self: @ContractState) -> felt252 {
            self.public_key.read()
        }
        fn configure(ref self: ContractState, deployment: ContractAddress) {
            assert!(get_caller_address() == self.administrator.read(), "only authority administrator");
            assert!(self.deployment.read().is_zero() && deployment.is_non_zero(), "deployment already configured");
            self.deployment.write(deployment);
        }
        fn rotate(ref self: ContractState, public_key: felt252) {
            assert!(get_caller_address() == self.administrator.read(), "only authority administrator");
            assert!(public_key != 0, "invalid authority key");
            self.public_key.write(public_key);
        }
    }

    #[abi(embed_v0)]
    impl Account of super::ISequencingAccount<ContractState> {
        fn __validate__(self: @ContractState, calls: Array<Call>) -> felt252 {
            self.require_signed_execution(@calls);
            'VALID'
        }
        fn __execute__(ref self: ContractState, calls: Array<Call>) -> Array<Span<felt252>> {
            // Simulation can skip account validation. Execution must authenticate independently.
            self.require_signed_execution(@calls);
            let call = calls.at(0);
            if *call.to == self.deployment.read() {
                // The deployment checks each envelope names this epoch.
                self.epochs.require_open();
            }
            array![starknet::syscalls::call_contract_syscall(*call.to, *call.selector, *call.calldata).unwrap_syscall()]
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn require_signed_execution(self: @ContractState, calls: @Array<Call>) {
            let tx = get_tx_info().unbox();
            assert!(tx.version == 3, "queries and legacy transactions forbidden");
            assert!(get_caller_address().is_zero(), "nested authority execution forbidden");
            assert!(tx.account_contract_address == get_contract_address(), "foreign transaction account");
            assert!(calls.len() == 1, "one sequencing call required");
            let call = calls.at(0);
            assert!(
                (*call.to == self.deployment.read()
                    && (*call.selector == selector!("execute")
                        || *call.selector == selector!("execute_batch")
                        || *call.selector == selector!("reject_execution")))
                    || (*call.to == get_contract_address()
                        && (*call.selector == selector!("open_randomness_epoch")
                            || *call.selector == selector!("reveal_randomness_epoch"))),
                "foreign authority call",
            );
            assert!(tx.signature.len() == 2, "invalid authority signature length");
            assert!(
                check_ecdsa_signature(
                    tx.transaction_hash, self.public_key.read(), *tx.signature.at(0), *tx.signature.at(1),
                ),
                "invalid authority signature",
            );
        }
    }
}
