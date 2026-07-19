#[starknet::contract]
pub mod DeterministicVrfProvider {
    use cartridge_vrf::{PublicKey, Source};
    use stark_vrf::ecvrf::Proof;
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        consume_count: u32,
        public_key: PublicKey,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.public_key.write(PublicKey { x: 1, y: 1 });
    }

    // This implements the released provider ABI explicitly. Returning the transaction hash
    // preserves deterministic legacy fixture outcomes without weakening production VRF policy.
    #[abi(embed_v0)]
    impl VrfProviderImpl of cartridge_vrf::IVrfProvider<ContractState> {
        fn request_random(self: @ContractState, caller: ContractAddress, source: Source) {
            let _ = (caller, source);
        }

        fn submit_random(ref self: ContractState, seed: felt252, proof: Proof) {
            let _ = (seed, proof);
        }

        fn consume_random(ref self: ContractState, source: Source) -> felt252 {
            let _ = source;
            self.consume_count.write(self.consume_count.read() + 1);
            starknet::get_tx_info().unbox().transaction_hash
        }

        fn assert_consumed(ref self: ContractState, seed: felt252) {
            let _ = seed;
            assert!(self.consume_count.read() > 0, "VRF randomness was not consumed");
        }

        fn get_consume_count(self: @ContractState) -> u32 {
            self.consume_count.read()
        }

        fn is_vrf_call(self: @ContractState) -> bool {
            self.consume_count.read() > 0
        }

        fn get_public_key(self: @ContractState) -> PublicKey {
            self.public_key.read()
        }

        fn set_public_key(ref self: ContractState, new_pubkey: PublicKey) {
            self.public_key.write(new_pubkey);
        }
    }
}
