// SPDX-License-Identifier: MIT

use starknet::ContractAddress;
#[starknet::interface]
trait TimeLockMakerTrait<TState> {
    fn create_lock(ref self: TState, collection: ContractAddress, lock_end_time: u64);
}


#[starknet::contract]
mod CollectibleTimeLockMaker {
    use collectibles::contract::{IRealmsCollectibleLockAdminDispatcher, IRealmsCollectibleLockAdminDispatcherTrait};

    use starknet::ContractAddress;

    const ONE_DAY_IN_SECONDS: u64 = 86400; // 24 * 60 * 60
    const ONE_MONTH_IN_SECONDS: u64 = ONE_DAY_IN_SECONDS * 30; // 30 days assumed per month
    const MAX_LOCK_DURATION: u64 = ONE_MONTH_IN_SECONDS * 6; // 6 months

    #[derive(Drop, starknet::Event)]
    pub struct TimeLockCreatedOrUpdated {
        #[key]
        pub lock_id: felt252,
        pub lock_end_at: u64,
    }

    #[storage]
    struct Storage {}

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        TimeLockCreatedOrUpdated: TimeLockCreatedOrUpdated,
    }


    #[abi(embed_v0)]
    impl TimeLockMakerImpl of super::TimeLockMakerTrait<ContractState> {
        fn create_lock(ref self: ContractState, collection: ContractAddress, lock_end_time: u64) {
            // ensure lock_end_time is in the future
            let now = starknet::get_block_timestamp();
            assert!(lock_end_time > now, "CollectibleTimeLockMaker: lock end time must be in the future");

            // ensure lock_end_time not more than 6 months in the future
            assert!(
                lock_end_time <= MAX_LOCK_DURATION, "CollectibleTimeLockMaker: lock end time must be within 6 months",
            );

            // create or update lock with lock_end_time as lock_id
            let collectible = IRealmsCollectibleLockAdminDispatcher { contract_address: collection };
            collectible.lock_state_update(lock_end_time.into(), lock_end_time);

            self.emit(TimeLockCreatedOrUpdated { lock_id: lock_end_time.into(), lock_end_at: lock_end_time });
        }
    }
}
