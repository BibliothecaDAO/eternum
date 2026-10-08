//! Throwaway scheduling probe. Never merge or reuse without a rewrite.

#[starknet::interface]
pub trait INodeFirstProbe<T> {
    fn probe(ref self: T, game: u32, run: u64, arm: u8, writes: u32, hashes: u32);
}

#[starknet::contract]
pub mod NodeFirstProbe {
    use core::poseidon::poseidon_hash_span;
    use core::num::traits::Zero;
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};

    #[storage]
    struct Storage {
        counters: Map<(u32, u64), u64>,
        heads: Map<(u32, u64), felt252>,
        attempts: Map<(u32, u64, ContractAddress), u64>,
        words: Map<(u32, u64, ContractAddress, u32), felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Applied: Applied,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Applied {
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
    impl Probe of super::INodeFirstProbe<ContractState> {
        fn probe(ref self: ContractState, game: u32, run: u64, arm: u8, writes: u32, hashes: u32) {
            assert!(arm <= 1, "invalid arm");
            assert!(writes > 0 && writes <= 128, "invalid writes");
            assert!(hashes > 0 && hashes <= 4096 && writes * hashes <= 65536, "invalid hashes");
            let actor = get_caller_address();
            assert!(actor.is_non_zero(), "account caller required");
            let attempt = self.attempts.read((game, run, actor)) + 1;
            self.attempts.write((game, run, actor), attempt);
            // X reads/writes both shared slots before doing the work, as today's host does.
            // Y's id and every write depend only on this caller and run.
            let (id, previous) = if arm == 0 {
                let id = self.counters.read((game, run)) + 1;
                self.counters.write((game, run), id);
                (id.into(), self.heads.read((game, run)))
            } else {
                (poseidon_hash_span(array![actor.into(), attempt.into()].span()), 0)
            };
            let mut digest = poseidon_hash_span(array![id, previous, game.into(), run.into()].span());
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
            if arm == 0 {
                self.heads.write((game, run), digest);
            }
            self.emit(Applied { actor, game, run, arm, writes, hashes, digest });
        }
    }
}
