#[starknet::contract]
pub mod EconomicSettlementCallbackMock {
    use core::hash::HashStateTrait;
    use core::poseidon::PoseidonTrait;
    use settlement_protocol::appchain_spike_interfaces::IEconomicCallbackMetricsSpike;
    use settlement_protocol::interfaces::IGameEconomicSettlementCallbacks;
    use settlement_protocol::types::LiabilityId;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        hub: ContractAddress,
        reject_assignments: bool,
        assignment_count: u64,
        assignment_exists: Map<felt252, bool>,
        assignment_batch: Map<felt252, u64>,
        assignment_leaf: Map<felt252, u8>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, hub: ContractAddress, reject_assignments: bool) {
        self.hub.write(hub);
        self.reject_assignments.write(reject_assignments);
    }

    #[abi(embed_v0)]
    impl EconomicCallbacksImpl of IGameEconomicSettlementCallbacks<ContractState> {
        fn assign_open_batch(
            ref self: ContractState, liability_id: LiabilityId, batch_id: u64, leaf_index: u8,
        ) -> felt252 {
            assert_hub(@self);
            assert!(!self.reject_assignments.read(), "ASSIGNMENT_REJECTED");
            assert!(!self.assignment_exists.read(liability_id), "LIABILITY_ALREADY_ASSIGNED");
            self.assignment_exists.write(liability_id, true);
            self.assignment_batch.write(liability_id, batch_id);
            self.assignment_leaf.write(liability_id, leaf_index);
            self.assignment_count.write(self.assignment_count.read() + 1);
            PoseidonTrait::new().update(liability_id).update(batch_id.into()).update(leaf_index.into()).finalize()
        }

        fn get_liability_assignment(self: @ContractState, liability_id: LiabilityId) -> Option<(u64, u8)> {
            if self.assignment_exists.read(liability_id) {
                Option::Some((self.assignment_batch.read(liability_id), self.assignment_leaf.read(liability_id)))
            } else {
                Option::None
            }
        }
    }

    #[abi(embed_v0)]
    impl MetricsImpl of IEconomicCallbackMetricsSpike<ContractState> {
        fn assignment_count(self: @ContractState) -> u64 {
            self.assignment_count.read()
        }

        fn promotion_count(self: @ContractState) -> u64 {
            0
        }
    }

    fn assert_hub(self: @ContractState) {
        assert!(get_caller_address() == self.hub.read(), "ONLY_HUB");
    }
}
