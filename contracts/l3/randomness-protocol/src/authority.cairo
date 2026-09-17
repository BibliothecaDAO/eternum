use starknet::ContractAddress;
use starknet::account::Call;

#[starknet::interface]
pub trait ISequencingAuthority<T> {
    fn get_public_key(self: @T) -> felt252;
    fn authority_epoch(self: @T) -> u64;
    fn configure(ref self: T, deployment: ContractAddress);
    fn rotate(ref self: T, public_key: felt252, epoch: u64);
}

#[starknet::interface]
pub trait ISequencingAccount<T> {
    fn __validate__(self: @T, calls: Array<Call>) -> felt252;
    fn __execute__(ref self: T, calls: Array<Call>) -> Array<Span<felt252>>;
}

#[starknet::contract(account)]
pub mod SequencingAccount {
    use core::ecdsa::check_ecdsa_signature;
    use core::num::traits::Zero;
    use starknet::account::Call;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, SyscallResultTrait, get_caller_address, get_contract_address, get_tx_info};

    #[storage]
    struct Storage {
        administrator: ContractAddress,
        public_key: felt252,
        epoch: u64,
        deployment: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, administrator: ContractAddress, public_key: felt252) {
        assert!(administrator.is_non_zero() && public_key != 0, "invalid authority");
        self.administrator.write(administrator);
        self.public_key.write(public_key);
        self.epoch.write(1);
    }

    #[abi(embed_v0)]
    impl Authority of super::ISequencingAuthority<ContractState> {
        fn get_public_key(self: @ContractState) -> felt252 {
            self.public_key.read()
        }
        fn authority_epoch(self: @ContractState) -> u64 {
            self.epoch.read()
        }
        fn configure(ref self: ContractState, deployment: ContractAddress) {
            assert!(get_caller_address() == self.administrator.read(), "only authority administrator");
            assert!(self.deployment.read().is_zero() && deployment.is_non_zero(), "deployment already configured");
            self.deployment.write(deployment);
        }
        fn rotate(ref self: ContractState, public_key: felt252, epoch: u64) {
            assert!(get_caller_address() == self.administrator.read(), "only authority administrator");
            assert!(public_key != 0 && epoch == self.epoch.read() + 1, "invalid authority rotation");
            self.public_key.write(public_key);
            self.epoch.write(epoch);
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
            assert!(calls.len() == 1, "one recorded action required");
            let call = calls.at(0);
            assert!(
                *call.to == self.deployment.read()
                    && (*call.selector == selector!("execute") || *call.selector == selector!("reject_execution")),
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
