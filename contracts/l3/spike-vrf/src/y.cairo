//! Throwaway paired Y work; never merge or reuse without rewrite.
#[starknet::interface]
pub trait IVrfYProbe<T> {
    fn probe(ref self: T, game: u32, run: u64, arm: u8, writes: u32, hashes: u32);
}

#[starknet::contract]
pub mod VrfYProbe {
    use core::num::traits::Zero;
    use core::poseidon::poseidon_hash_span;
    use starknet::{ContractAddress, get_caller_address, get_tx_info};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::vendor::ecvrf::Point;
    #[storage]
    struct Storage {
        verify_proofs: bool,
        key_x: felt252,
        key_y: felt252,
        attempts: Map<(u32, u64, ContractAddress), u64>,
        words: Map<(u32, u64, ContractAddress, u32), felt252>,
    }
    #[constructor]
    fn constructor(ref self: ContractState, key: Point, verify_proofs: bool) {
        assert!(core::ec::EcPointImpl::new(key.x, key.y).is_some(), "invalid VRF key");
        self.key_x.write(key.x);
        self.key_y.write(key.y);
        self.verify_proofs.write(verify_proofs);
    }
    #[external(v0)]
    fn vrf_config(self: @ContractState) -> (Point, bool) { (Point { x: self.key_x.read(), y: self.key_y.read() }, self.verify_proofs.read()) }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event { Applied: Applied }
    #[derive(Drop, starknet::Event)]
    struct Applied {
        #[key]
        actor: ContractAddress,
        #[key]
        game: u32,
        run: u64,
        arm: u8,
        writes: u32,
        hashes: u32,
        digest: felt252,
    }
    #[abi(embed_v0)]
    impl Probe of super::IVrfYProbe<ContractState> {
        fn probe(ref self: ContractState, game: u32, run: u64, arm: u8, writes: u32, hashes: u32) {
            assert!(arm == 1, "Y arm required");
            assert!(writes > 0 && writes <= 128, "invalid writes");
            assert!(hashes > 0 && hashes <= 4096 && writes * hashes <= 65536, "invalid hashes");
            let actor = get_caller_address();
            assert!(actor.is_non_zero(), "account caller required");
            let info = get_tx_info().unbox();
            assert!(info.tip == 0, "zero tip required");
            let mut gas_bound_present = false;
            for bound in info.resource_bounds {
                if *bound.resource == 'L2_GAS' {
                    assert!(*bound.max_amount == 1200000000, "fixed L2 gas required");
                    gas_bound_present = true;
                }
            };
            assert!(gas_bound_present, "missing L2 gas bound");
            let root = if self.verify_proofs.read() {
                crate::signature_root(Point { x: self.key_x.read(), y: self.key_y.read() })
            } else { 0 };
            let attempt = self.attempts.read((game, run, actor)) + 1;
            self.attempts.write((game, run, actor), attempt);
            let id = poseidon_hash_span(array![actor.into(), attempt.into()].span());
            let mut digest = poseidon_hash_span(array![id, 0, game.into(), run.into(), root].span());
            let mut index = 0;
            while index < writes {
                let mut pass = 0;
                while pass < hashes {
                    digest = poseidon_hash_span(array![digest, actor.into(), index.into(), pass.into()].span());
                    pass += 1;
                };
                self.words.write((game, run, actor, index), digest);
                index += 1;
            };
            self.emit(Applied { actor, game, run, arm, writes, hashes, digest });
        }
    }
}
