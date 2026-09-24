use core::poseidon::poseidon_hash_span;

#[derive(Copy, Drop, Default, Serde, starknet::Store)]
pub struct RandomnessEpoch {
    pub commitment: felt252,
    pub revealed_secret: Option<u256>,
}

#[starknet::interface]
pub trait IRandomnessEpochs<T> {
    fn open_randomness_epoch(ref self: T, commitment: felt252);
    fn reveal_randomness_epoch(ref self: T, secret: u256);
    fn current_randomness_epoch(self: @T) -> u64;
    fn get_randomness_epoch(self: @T, epoch: u64) -> RandomnessEpoch;
}

pub fn epoch_commitment(secret: u256) -> felt252 {
    poseidon_hash_span(array!['ETERNUM_EPOCH', 1, secret.low.into(), secret.high.into()].span())
}

pub fn epoch_root(secret: u256, game: felt252, order: u64) -> u256 {
    poseidon_hash_span(array![secret.low.into(), secret.high.into(), game, order.into()].span()).into()
}

#[starknet::component]
pub mod EpochState {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use super::{RandomnessEpoch, epoch_commitment};

    #[storage]
    pub struct Storage {
        pub current: u64,
        epochs: Map<u64, RandomnessEpoch>,
        used_commitments: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RandomnessEpochOpened: RandomnessEpochOpened,
        RandomnessEpochRevealed: RandomnessEpochRevealed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RandomnessEpochOpened {
        pub epoch: u64,
        pub commitment: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RandomnessEpochRevealed {
        pub epoch: u64,
        pub secret: u256,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn epoch(self: @ComponentState<TContractState>, id: u64) -> RandomnessEpoch {
            assert!(id > 0 && id <= self.current.read(), "unknown randomness epoch");
            self.epochs.read(id)
        }
        fn open(ref self: ComponentState<TContractState>, commitment: felt252) {
            assert!(commitment != 0 && !self.used_commitments.read(commitment), "invalid or reused commitment");
            let current = self.current.read();
            if current != 0 {
                assert!(self.epoch(current).revealed_secret.is_some(), "previous epoch is unrevealed");
            }
            let next = current + 1;
            self.epochs.write(next, RandomnessEpoch { commitment, revealed_secret: None });
            self.current.write(next);
            self.used_commitments.write(commitment, true);
            self.emit(RandomnessEpochOpened { epoch: next, commitment });
        }
        /// Revealing closes the epoch: execution naming it is refused from then on, so the
        /// sequencer reveals only after every ticket it assigned from this secret is recorded.
        fn reveal(ref self: ComponentState<TContractState>, secret: u256) {
            let id = self.current.read();
            let mut epoch = self.epoch(id);
            assert!(epoch.revealed_secret.is_none(), "epoch already revealed");
            assert!(epoch_commitment(secret) == epoch.commitment, "wrong epoch secret");
            epoch.revealed_secret = Some(secret);
            self.epochs.write(id, epoch);
            self.emit(RandomnessEpochRevealed { epoch: id, secret });
        }
        fn require_open(self: @ComponentState<TContractState>) {
            assert!(self.epoch(self.current.read()).revealed_secret.is_none(), "revealed epoch cannot execute");
        }
    }
}
