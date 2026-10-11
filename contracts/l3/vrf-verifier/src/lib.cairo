pub mod frame;
pub mod vendor;
use vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point, Proof};

pub const STAMP_TAG: felt252 = 'VRF1';

/// The account validates the device prefix; this library authenticates the root for exactly its signed transaction.
pub fn transaction_root(key: Point, l2_gas_bound: u64) -> felt252 {
    let tx = starknet::get_tx_info().unbox();
    frame::assert_frame(@tx, l2_gas_bound);
    let signature = tx.signature;
    assert!(signature.len() == 9 && *signature[3] == STAMP_TAG, "VRF signature width");
    let proof = Proof {
        gamma: Point { x: *signature[4], y: *signature[5] },
        c: *signature[6],
        s: *signature[7],
        sqrt_ratio_hint: *signature[8],
    };
    ECVRFImpl::new(key).verify(proof, array![tx.transaction_hash].span()).expect('invalid VRF proof')
}

#[starknet::interface]
pub trait IVrfVerifier<T> {
    fn verify(self: @T, key: vendor::ecvrf::Point, l2_gas_bound: u64) -> felt252;
}

/// Library calls share Games' transaction context, but this class never reads or writes its storage.
#[starknet::contract]
pub mod Verifier {
    #[storage]
    struct Storage {}
    #[abi(embed_v0)]
    impl Verify of super::IVrfVerifier<ContractState> {
        fn verify(self: @ContractState, key: super::vendor::ecvrf::Point, l2_gas_bound: u64) -> felt252 {
            super::transaction_root(key, l2_gas_bound)
        }
    }
}
