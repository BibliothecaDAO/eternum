#[starknet::contract]
pub mod PendingLiabilitySourceMock {
    use settlement_protocol::appchain_spike_interfaces::{
        IPendingLiabilitySourceAdminSpike, IPendingLiabilitySourceSpike, PendingSourceSnapshot,
    };
    use settlement_protocol::types::{BackingKey, BackingTotal, LotSharePromotion};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use crate::season_hub_capacity::{backing_key_hash, backing_key_precedes, lot_share_precedes};

    const MAX_PARENTS: usize = 16;
    const MAX_LOT_SHARES: usize = 256;
    const MAX_LOT_SHARES_PER_PARENT: usize = 64;

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredParent {
        deployment_id: felt252,
        game_id: felt252,
        asset_mode: u8,
        asset_id: u32,
        backing_pool_id: felt252,
        amount: u256,
    }

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredShare {
        game_id: felt252,
        parent_key_hash: felt252,
        lot_index: u8,
        amount: u256,
    }

    #[storage]
    struct Storage {
        hub: ContractAddress,
        game_id: felt252,
        source_id: felt252,
        source_generation: u64,
        pending_liability_id: felt252,
        parent_count: u8,
        lot_share_count: u16,
        parents: Map<u8, StoredParent>,
        shares: Map<u16, StoredShare>,
        assigned_batch_id: u64,
        assigned_leaf_index: u8,
        assigned: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState, hub: ContractAddress, game_id: felt252, source_id: felt252) {
        assert!(source_id != 0, "ZERO_SOURCE_ID");
        self.hub.write(hub);
        self.game_id.write(game_id);
        self.source_id.write(source_id);
    }

    #[abi(embed_v0)]
    impl SourceAdminImpl of IPendingLiabilitySourceAdminSpike<ContractState> {
        fn create_pending_liability(
            ref self: ContractState,
            liability_id: felt252,
            parent_totals: Span<BackingTotal>,
            lot_share_promotions: Span<LotSharePromotion>,
        ) {
            validate_source_creation(@self, liability_id, parent_totals, lot_share_promotions);
            store_parents(ref self, parent_totals);
            store_shares(ref self, lot_share_promotions);
            self.pending_liability_id.write(liability_id);
            self.parent_count.write(parent_totals.len().try_into().unwrap());
            self.lot_share_count.write(lot_share_promotions.len().try_into().unwrap());
            self.source_generation.write(self.source_generation.read() + 1);
        }
    }

    #[abi(embed_v0)]
    impl SourceImpl of IPendingLiabilitySourceSpike<ContractState> {
        fn pending_vectors(
            self: @ContractState, liability_id: felt252,
        ) -> (felt252, felt252, u64, Array<BackingTotal>, Array<LotSharePromotion>) {
            assert!(self.pending_liability_id.read() == liability_id, "PENDING_LIABILITY_UNKNOWN");
            (
                self.game_id.read(),
                self.source_id.read(),
                self.source_generation.read() - 1,
                load_parents(self),
                load_shares(self),
            )
        }

        fn mark_batch_assigned(ref self: ContractState, liability_id: felt252, batch_id: u64, leaf_index: u8) {
            assert!(get_caller_address() == self.hub.read(), "ONLY_HUB");
            assert!(self.pending_liability_id.read() == liability_id, "PENDING_LIABILITY_UNKNOWN");
            assert!(!self.assigned.read(), "PENDING_ALREADY_ASSIGNED");
            self.assigned_batch_id.write(batch_id);
            self.assigned_leaf_index.write(leaf_index);
            self.assigned.write(true);
        }

        fn snapshot(self: @ContractState) -> PendingSourceSnapshot {
            PendingSourceSnapshot {
                source_generation: self.source_generation.read(),
                pending_liability_id: self.pending_liability_id.read(),
                parent_count: self.parent_count.read(),
                lot_share_count: self.lot_share_count.read(),
                assigned_batch_id: self.assigned_batch_id.read(),
                assigned_leaf_index: self.assigned_leaf_index.read(),
                assigned: self.assigned.read(),
            }
        }
    }

    fn validate_source_creation(
        self: @ContractState, liability_id: felt252, parents: Span<BackingTotal>, shares: Span<LotSharePromotion>,
    ) {
        assert!(liability_id != 0 && self.pending_liability_id.read() == 0, "PENDING_ALREADY_CREATED");
        assert!(!parents.is_empty() && parents.len() <= MAX_PARENTS, "PARENT_BOUND_EXCEEDED");
        assert!(shares.len() <= MAX_LOT_SHARES, "LOT_SHARE_BOUND_EXCEEDED");
        let game_id = self.game_id.read();
        for parent in parents {
            assert!(*parent.key.game_id == game_id && *parent.amount_or_quota != 0_u256, "INVALID_PARENT");
        }
        for share in shares {
            assert!(*share.game_id == game_id && *share.amount != 0_u256, "INVALID_LOT_SHARE");
            assert!(contains_parent(parents, *share.parent_key_hash), "LOT_PARENT_UNKNOWN");
        }
        assert_canonical_parent_order(parents);
        assert_canonical_lot_share_order(shares);
        assert_parent_share_accounting(parents, shares);
    }

    fn assert_canonical_parent_order(parents: Span<BackingTotal>) {
        let mut cursor: usize = 1;
        loop {
            if cursor == parents.len() {
                break;
            }
            assert!(backing_key_precedes(parents.at(cursor - 1).key, parents.at(cursor).key), "PARENTS_NOT_CANONICAL");
            cursor += 1;
        }
    }

    fn assert_canonical_lot_share_order(shares: Span<LotSharePromotion>) {
        let mut cursor: usize = 1;
        loop {
            if cursor == shares.len() {
                break;
            }
            assert!(lot_share_precedes(shares.at(cursor - 1), shares.at(cursor)), "LOT_SHARES_NOT_CANONICAL");
            cursor += 1;
        }
    }

    fn assert_parent_share_accounting(parents: Span<BackingTotal>, shares: Span<LotSharePromotion>) {
        for parent in parents {
            let parent_hash = backing_key_hash(parent.key);
            let mut share_count: usize = 0;
            let mut share_total = 0_u256;
            for share in shares {
                if *share.parent_key_hash == parent_hash {
                    share_count += 1;
                    share_total += *share.amount;
                }
            }
            assert!(share_count != 0 && share_count <= MAX_LOT_SHARES_PER_PARENT, "PARENT_SHARE_COUNT_INVALID");
            assert!(share_total == *parent.amount_or_quota, "PARENT_SHARE_TOTAL_MISMATCH");
        }
    }

    fn contains_parent(parents: Span<BackingTotal>, expected_hash: felt252) -> bool {
        for parent in parents {
            if backing_key_hash(parent.key) == expected_hash {
                return true;
            }
        }
        false
    }

    fn store_parents(ref self: ContractState, parents: Span<BackingTotal>) {
        let mut cursor: u8 = 0;
        for parent in parents {
            self
                .parents
                .write(
                    cursor,
                    StoredParent {
                        deployment_id: *parent.key.deployment_id,
                        game_id: *parent.key.game_id,
                        asset_mode: *parent.key.asset_mode,
                        asset_id: *parent.key.asset_id,
                        backing_pool_id: *parent.key.backing_pool_id,
                        amount: *parent.amount_or_quota,
                    },
                );
            cursor += 1;
        }
    }

    fn store_shares(ref self: ContractState, shares: Span<LotSharePromotion>) {
        let mut cursor: u16 = 0;
        for share in shares {
            self
                .shares
                .write(
                    cursor,
                    StoredShare {
                        game_id: *share.game_id,
                        parent_key_hash: *share.parent_key_hash,
                        lot_index: *share.lot_index,
                        amount: *share.amount,
                    },
                );
            cursor += 1;
        }
    }

    fn load_parents(self: @ContractState) -> Array<BackingTotal> {
        let mut result = array![];
        let mut cursor: u8 = 0;
        loop {
            if cursor == self.parent_count.read() {
                break;
            }
            let parent = self.parents.read(cursor);
            result
                .append(
                    BackingTotal {
                        key: BackingKey {
                            deployment_id: parent.deployment_id,
                            game_id: parent.game_id,
                            asset_mode: parent.asset_mode,
                            asset_id: parent.asset_id,
                            backing_pool_id: parent.backing_pool_id,
                        },
                        amount_or_quota: parent.amount,
                    },
                );
            cursor += 1;
        }
        result
    }

    fn load_shares(self: @ContractState) -> Array<LotSharePromotion> {
        let mut result = array![];
        let mut cursor: u16 = 0;
        loop {
            if cursor == self.lot_share_count.read() {
                break;
            }
            let share = self.shares.read(cursor);
            result
                .append(
                    LotSharePromotion {
                        game_id: share.game_id,
                        parent_key_hash: share.parent_key_hash,
                        lot_index: share.lot_index,
                        amount: share.amount,
                    },
                );
            cursor += 1;
        }
        result
    }
}
