use starknet::account::Call;

pub const MAX_DEVICES: u8 = 8;
pub const DEVICE_CHANGE: felt252 = 'REALMS_DEVICE_CHANGE';
pub const ADD_DEVICE: felt252 = 'ADD';
pub const REVOKE_DEVICE: felt252 = 'REVOKE';

/// A player's gameplay account on one shard. Deployed with salt = Realms id and constructor
/// `(realms_id, guardian_public_key)`, so it has the same address on every shard sharing the class and guardian.
/// The guardian only signs device changes; it never transacts. Device signatures are `[device_key, r, s]`.
#[starknet::interface]
pub trait IRealmsAccount<TState> {
    fn __execute__(self: @TState, calls: Array<Call>);
    /// A device joins through its own transaction: the signature `[device_key, r, s, guardian_r, guardian_s]` carries
    /// the guardian's approval to add that key, applied before the device's own signature is checked.
    fn __validate__(ref self: TState, calls: Array<Call>) -> felt252;
    fn __validate_deploy__(
        ref self: TState,
        class_hash: felt252,
        contract_address_salt: felt252,
        realms_id: felt252,
        guardian_public_key: felt252,
    ) -> felt252;
    /// SNIP-6: `'VALID'` when `signature` is `[device_key, r, s]` from a registered device, otherwise 0.
    fn is_valid_signature(self: @TState, hash: felt252, signature: Array<felt252>) -> felt252;
    /// Anyone may submit a guardian-signed revocation.
    fn revoke_device(ref self: TState, device_key: felt252, guardian_r: felt252, guardian_s: felt252);
    fn is_device(self: @TState, device_key: felt252) -> bool;
    /// The number of device changes applied; the guardian signs the next change with this plus one.
    fn device_change_counter(self: @TState) -> u64;
    /// Replaces the registry's `owner_of`: names the player behind an actor address.
    fn realms_id(self: @TState) -> felt252;
}

/// The message the guardian signs for one device change on one account on one chain.
pub fn device_change_hash(
    chain_id: felt252, account: starknet::ContractAddress, action: felt252, device_key: felt252, counter: u64,
) -> felt252 {
    core::poseidon::poseidon_hash_span(
        array![DEVICE_CHANGE, chain_id, account.into(), action, device_key, counter.into()].span(),
    )
}

#[starknet::contract(account)]
pub mod RealmsAccount {
    use core::ecdsa::check_ecdsa_signature;
    use core::num::traits::Zero;
    use openzeppelin_account::utils::{execute_calls, is_tx_version_valid};
    use starknet::account::Call;
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{VALIDATED, get_contract_address, get_tx_info};
    use super::{ADD_DEVICE, IRealmsAccount, MAX_DEVICES, REVOKE_DEVICE, device_change_hash};

    #[storage]
    pub struct Storage {
        pub realms_id: felt252,
        pub guardian_public_key: felt252,
        pub device_change_counter: u64,
        pub device_count: u8,
        pub devices: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DeviceAdded: DeviceChanged,
        DeviceRevoked: DeviceChanged,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DeviceChanged {
        #[key]
        pub device_key: felt252,
        pub counter: u64,
    }

    #[constructor]
    pub fn constructor(ref self: ContractState, realms_id: felt252, guardian_public_key: felt252) {
        assert!(realms_id.is_non_zero(), "zero realms id");
        assert!(guardian_public_key.is_non_zero(), "zero guardian key");
        self.realms_id.write(realms_id);
        self.guardian_public_key.write(guardian_public_key);
    }

    #[abi(embed_v0)]
    impl RealmsAccountImpl of IRealmsAccount<ContractState> {
        fn __execute__(self: @ContractState, calls: Array<Call>) {
            assert!(starknet::get_caller_address().is_zero(), "invalid caller");
            assert!(is_tx_version_valid(), "invalid tx version");
            execute_calls(calls.span());
        }

        fn __validate__(ref self: ContractState, calls: Array<Call>) -> felt252 {
            self.validate_own_transaction()
        }

        fn __validate_deploy__(
            ref self: ContractState,
            class_hash: felt252,
            contract_address_salt: felt252,
            realms_id: felt252,
            guardian_public_key: felt252,
        ) -> felt252 {
            self.validate_own_transaction()
        }

        fn is_valid_signature(self: @ContractState, hash: felt252, signature: Array<felt252>) -> felt252 {
            if self.is_signed_by_device(hash, signature.span()) {
                VALIDATED
            } else {
                0
            }
        }

        fn revoke_device(ref self: ContractState, device_key: felt252, guardian_r: felt252, guardian_s: felt252) {
            let counter = self.consume_guardian_change(REVOKE_DEVICE, device_key, guardian_r, guardian_s);
            assert!(self.devices.entry(device_key).read(), "unknown device");
            self.devices.entry(device_key).write(false);
            self.device_count.write(self.device_count.read() - 1);
            self.emit(Event::DeviceRevoked(DeviceChanged { device_key, counter }));
        }

        fn is_device(self: @ContractState, device_key: felt252) -> bool {
            self.devices.entry(device_key).read()
        }

        fn device_change_counter(self: @ContractState) -> u64 {
            self.device_change_counter.read()
        }

        fn realms_id(self: @ContractState) -> felt252 {
            self.realms_id.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Deployment and invoke validation share one rule: the transaction is signed by a registered device, which a
        /// five-felt signature registers first from the guardian's approval.
        fn validate_own_transaction(ref self: ContractState) -> felt252 {
            let tx_info = get_tx_info().unbox();
            let mut signature = tx_info.signature;
            if signature.len() == 5 {
                self.add_device(*signature[0], *signature[3], *signature[4]);
                signature = signature.slice(0, 3);
            }
            assert!(self.is_signed_by_device(tx_info.transaction_hash, signature), "invalid signature");
            VALIDATED
        }

        fn add_device(ref self: ContractState, device_key: felt252, guardian_r: felt252, guardian_s: felt252) {
            let counter = self.consume_guardian_change(ADD_DEVICE, device_key, guardian_r, guardian_s);
            assert!(!self.devices.entry(device_key).read(), "device already added");
            let device_count = self.device_count.read();
            assert!(device_count < MAX_DEVICES, "device limit");
            self.devices.entry(device_key).write(true);
            self.device_count.write(device_count + 1);
            self.emit(Event::DeviceAdded(DeviceChanged { device_key, counter }));
        }

        /// The guardian signs each change for the next counter, so a change applies once and in order.
        fn consume_guardian_change(
            ref self: ContractState, action: felt252, device_key: felt252, guardian_r: felt252, guardian_s: felt252,
        ) -> u64 {
            let counter = self.device_change_counter.read() + 1;
            let hash = device_change_hash(
                get_tx_info().unbox().chain_id, get_contract_address(), action, device_key, counter,
            );
            assert!(
                check_ecdsa_signature(hash, self.guardian_public_key.read(), guardian_r, guardian_s),
                "invalid guardian signature",
            );
            self.device_change_counter.write(counter);
            counter
        }

        fn is_signed_by_device(self: @ContractState, hash: felt252, signature: Span<felt252>) -> bool {
            if signature.len() != 3 {
                return false;
            }
            let device_key = *signature[0];
            self.devices.entry(device_key).read()
                && check_ecdsa_signature(hash, device_key, *signature[1], *signature[2])
        }
    }
}
