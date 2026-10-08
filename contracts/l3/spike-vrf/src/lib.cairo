pub mod vendor;
pub mod account;
pub mod y;
use starknet::get_tx_info;
use vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point, Proof};

/// Throwaway spike: the account owns the three-felt prefix, and the proof owns the five-felt suffix.
pub fn signature_root(public_key: Point) -> felt252 {
    let info = get_tx_info().unbox();
    let signature = info.signature;
    assert!(signature.len() == 8, "VRF signature width");
    let mut suffix = signature.slice(3, 5);
    let proof: Proof = Serde::deserialize(ref suffix).expect('malformed VRF proof');
    ECVRFImpl::new(public_key).verify(proof, array![info.transaction_hash].span()).expect('invalid VRF proof')
}

#[starknet::interface]
pub trait ISpikeVerifier<T> {
    fn verify(self: @T) -> felt252;
}

#[starknet::contract]
pub mod SpikeVerifier {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point};
    #[storage]
    struct Storage { public_key_x: felt252, public_key_y: felt252 }
    #[constructor]
    fn constructor(ref self: ContractState, public_key: Point) {
        assert!(core::ec::EcPointImpl::new(public_key.x, public_key.y).is_some(), "invalid VRF public key");
        self.public_key_x.write(public_key.x);
        self.public_key_y.write(public_key.y);
    }
    #[abi(embed_v0)]
    impl Verifier of super::ISpikeVerifier<ContractState> {
        fn verify(self: @ContractState) -> felt252 {
            super::signature_root(Point { x: self.public_key_x.read(), y: self.public_key_y.read() })
        }
    }
}

#[starknet::contract]
pub mod SpikeBaseline {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point, Proof};
    #[storage]
    struct Storage { public_key_x: felt252, public_key_y: felt252 }
    #[constructor]
    fn constructor(ref self: ContractState, public_key: Point) {
        self.public_key_x.write(public_key.x);
        self.public_key_y.write(public_key.y);
    }
    #[abi(embed_v0)]
    impl Baseline of super::ISpikeVerifier<ContractState> {
        fn verify(self: @ContractState) -> felt252 {
            let signature = starknet::get_tx_info().unbox().signature;
            assert!(signature.len() == 8, "VRF signature width");
            let mut suffix = signature.slice(3, 5);
            let proof: Proof = Serde::deserialize(ref suffix).expect('malformed VRF proof');
            let key = Point { x: self.public_key_x.read(), y: self.public_key_y.read() };
            ECVRFImpl::new(key).proof_to_hash(proof).unwrap()
        }
    }
}

#[starknet::interface]
pub trait ISpikeVectors<T> {
    fn check(self: @T, seed: felt252, proof: vendor::ecvrf::Proof) -> felt252;
}

/// Known-answer/invalid-vector probes only; production-style verification uses SpikeVerifier's transaction hash.
#[starknet::contract]
pub mod SpikeVectors {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::vendor::ecvrf::{ECVRFImpl, ECVRFTrait, Point, Proof};
    #[storage]
    struct Storage { public_key_x: felt252, public_key_y: felt252 }
    #[constructor]
    fn constructor(ref self: ContractState, public_key: Point) {
        self.public_key_x.write(public_key.x);
        self.public_key_y.write(public_key.y);
    }
    #[abi(embed_v0)]
    impl Vectors of super::ISpikeVectors<ContractState> {
        fn check(self: @ContractState, seed: felt252, proof: Proof) -> felt252 {
            let key = Point { x: self.public_key_x.read(), y: self.public_key_y.read() };
            ECVRFImpl::new(key).verify(proof, array![seed].span()).expect('invalid VRF proof')
        }
    }
}
