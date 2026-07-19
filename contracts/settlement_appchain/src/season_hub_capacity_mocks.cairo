#[starknet::contract]
pub mod EconomicSettlementCallbackMock {
    use core::hash::HashStateTrait;
    use core::poseidon::PoseidonTrait;
    use settlement_protocol::appchain_spike_interfaces::IEconomicCallbackMetricsSpike;
    use settlement_protocol::interfaces::IGameEconomicSettlementCallbacks;
    use settlement_protocol::types::{BackingTotal, LiabilityId, LotSharePromotion};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use crate::season_hub_capacity::backing_key_hash;

    #[storage]
    struct Storage {
        hub: ContractAddress,
        game_id: felt252,
        reject_assignments: bool,
        reject_preflight: bool,
        reject_promotions: bool,
        assignment_count: u64,
        promotion_count: u64,
        last_parent_count: u8,
        last_lot_share_count: u16,
        last_batch_id: u64,
        parent_active: Map<felt252, u256>,
        parent_cumulative: Map<felt252, u256>,
        lot_active: Map<felt252, u256>,
        lot_cumulative: Map<felt252, u256>,
        active_total: u256,
        cumulative_total: u256,
        assignment_exists: Map<felt252, bool>,
        assignment_batch: Map<felt252, u64>,
        assignment_leaf: Map<felt252, u8>,
        last_promotion_records_hash: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        hub: ContractAddress,
        game_id: felt252,
        reject_assignments: bool,
        reject_preflight: bool,
        reject_promotions: bool,
    ) {
        self.hub.write(hub);
        self.game_id.write(game_id);
        self.reject_assignments.write(reject_assignments);
        self.reject_preflight.write(reject_preflight);
        self.reject_promotions.write(reject_promotions);
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

        fn promote_sealed_batch(
            ref self: ContractState,
            batch_id: u64,
            parent_totals: Span<BackingTotal>,
            lot_share_promotions: Span<LotSharePromotion>,
        ) -> felt252 {
            assert_hub(@self);
            assert!(!self.reject_promotions.read(), "PROMOTION_REJECTED");
            let parent_count: u8 = parent_totals.len().try_into().unwrap();
            let lot_share_count: u16 = lot_share_promotions.len().try_into().unwrap();
            let game_id = self.game_id.read();
            let mut records_hash = 'PROMOTED_RECORDS_V1';
            for parent in parent_totals {
                assert!(*parent.key.game_id == game_id, "CALLBACK_PARENT_GAME_MISMATCH");
                let identity = backing_key_hash(parent.key);
                let active = self.parent_active.read(identity);
                assert!(active >= *parent.amount_or_quota, "CALLBACK_PARENT_UNDERFLOW");
                let next_active = active - *parent.amount_or_quota;
                let next_cumulative = self.parent_cumulative.read(identity) + *parent.amount_or_quota;
                self.parent_active.write(identity, next_active);
                self.parent_cumulative.write(identity, next_cumulative);
                records_hash = hash_promoted_record(records_hash, 1, identity, next_active, next_cumulative);
            }
            for share in lot_share_promotions {
                assert!(*share.game_id == game_id, "CALLBACK_LOT_GAME_MISMATCH");
                let identity = lot_identity(share);
                let active = self.lot_active.read(identity);
                assert!(active >= *share.amount, "CALLBACK_LOT_UNDERFLOW");
                let next_active = active - *share.amount;
                let next_cumulative = self.lot_cumulative.read(identity) + *share.amount;
                self.lot_active.write(identity, next_active);
                self.lot_cumulative.write(identity, next_cumulative);
                records_hash = hash_promoted_record(records_hash, 2, identity, next_active, next_cumulative);
            }
            let promoted = sum_parent_totals(parent_totals);
            self.active_total.write(self.active_total.read() - promoted);
            self.cumulative_total.write(self.cumulative_total.read() + promoted);
            self.promotion_count.write(self.promotion_count.read() + 1);
            self.last_batch_id.write(batch_id);
            self.last_parent_count.write(parent_count);
            self.last_lot_share_count.write(lot_share_count);
            self.last_promotion_records_hash.write(records_hash);
            state_hash(@self)
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
        fn preview_promotion(
            self: @ContractState, parent_totals: Span<BackingTotal>, lot_share_promotions: Span<LotSharePromotion>,
        ) -> bool {
            if self.reject_preflight.read() {
                return false;
            }
            let game_id = self.game_id.read();
            for parent in parent_totals {
                let identity = backing_key_hash(parent.key);
                assert!(*parent.key.game_id == game_id, "CALLBACK_PARENT_GAME_MISMATCH");
                assert!(self.parent_active.read(identity) >= *parent.amount_or_quota, "CALLBACK_PARENT_UNDERFLOW");
            }
            for share in lot_share_promotions {
                let identity = lot_identity(share);
                assert!(*share.game_id == game_id, "CALLBACK_LOT_GAME_MISMATCH");
                assert!(self.lot_active.read(identity) >= *share.amount, "CALLBACK_LOT_UNDERFLOW");
            }
            true
        }

        fn stage_active_totals(
            ref self: ContractState, parent_totals: Span<BackingTotal>, lot_share_promotions: Span<LotSharePromotion>,
        ) {
            let game_id = self.game_id.read();
            let parent_total = sum_parent_totals(parent_totals);
            let lot_total = sum_lot_shares(lot_share_promotions);
            assert!(parent_total == lot_total, "STAGED_TOTAL_MISMATCH");
            for parent in parent_totals {
                assert!(*parent.key.game_id == game_id, "STAGED_PARENT_GAME_MISMATCH");
                let identity = backing_key_hash(parent.key);
                self.parent_active.write(identity, self.parent_active.read(identity) + *parent.amount_or_quota);
            }
            for share in lot_share_promotions {
                assert!(*share.game_id == game_id, "STAGED_LOT_GAME_MISMATCH");
                let identity = lot_identity(share);
                self.lot_active.write(identity, self.lot_active.read(identity) + *share.amount);
            }
            self.active_total.write(self.active_total.read() + parent_total);
        }

        fn assignment_count(self: @ContractState) -> u64 {
            self.assignment_count.read()
        }

        fn promotion_count(self: @ContractState) -> u64 {
            self.promotion_count.read()
        }

        fn last_parent_count(self: @ContractState) -> u8 {
            self.last_parent_count.read()
        }

        fn last_lot_share_count(self: @ContractState) -> u16 {
            self.last_lot_share_count.read()
        }

        fn active_total(self: @ContractState) -> u256 {
            self.active_total.read()
        }

        fn cumulative_total(self: @ContractState) -> u256 {
            self.cumulative_total.read()
        }

        fn post_state_hash(self: @ContractState) -> felt252 {
            state_hash(self)
        }
    }

    fn sum_parent_totals(parent_totals: Span<BackingTotal>) -> u256 {
        let mut total = 0_u256;
        for parent in parent_totals {
            total += *parent.amount_or_quota;
        }
        total
    }

    fn sum_lot_shares(lot_share_promotions: Span<LotSharePromotion>) -> u256 {
        let mut total = 0_u256;
        for share in lot_share_promotions {
            total += *share.amount;
        }
        total
    }

    fn lot_identity(share: @LotSharePromotion) -> felt252 {
        PoseidonTrait::new()
            .update(*share.game_id)
            .update(*share.parent_key_hash)
            .update((*share.lot_index).into())
            .finalize()
    }

    fn state_hash(self: @ContractState) -> felt252 {
        let active = self.active_total.read();
        let cumulative = self.cumulative_total.read();
        PoseidonTrait::new()
            .update(self.last_batch_id.read().into())
            .update(self.game_id.read())
            .update(self.last_parent_count.read().into())
            .update(self.last_lot_share_count.read().into())
            .update(active.low.into())
            .update(active.high.into())
            .update(cumulative.low.into())
            .update(cumulative.high.into())
            .update(self.last_promotion_records_hash.read())
            .finalize()
    }

    fn hash_promoted_record(
        prior_hash: felt252, record_kind: felt252, identity: felt252, active: u256, cumulative: u256,
    ) -> felt252 {
        PoseidonTrait::new()
            .update(prior_hash)
            .update(record_kind)
            .update(identity)
            .update(active.low.into())
            .update(active.high.into())
            .update(cumulative.low.into())
            .update(cumulative.high.into())
            .finalize()
    }

    fn assert_hub(self: @ContractState) {
        assert!(get_caller_address() == self.hub.read(), "ONLY_HUB");
    }
}
