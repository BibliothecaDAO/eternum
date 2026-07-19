use core::poseidon::poseidon_hash_span;
use settlement_protocol::types::{BackingKey, LotSharePromotion};

pub fn backing_key_hash(key: @BackingKey) -> felt252 {
    poseidon_hash_span(
        array![*key.deployment_id, *key.game_id, (*key.asset_mode).into(), (*key.asset_id).into(), *key.backing_pool_id]
            .span(),
    )
}

pub fn backing_key_precedes(left: @BackingKey, right: @BackingKey) -> bool {
    if *left.deployment_id != *right.deployment_id {
        return felt_precedes(*left.deployment_id, *right.deployment_id);
    }
    if *left.game_id != *right.game_id {
        return felt_precedes(*left.game_id, *right.game_id);
    }
    if *left.asset_mode != *right.asset_mode {
        let left_value = *left.asset_mode;
        let right_value = *right.asset_mode;
        return left_value < right_value;
    }
    if *left.asset_id != *right.asset_id {
        let left_value = *left.asset_id;
        let right_value = *right.asset_id;
        return left_value < right_value;
    }
    return felt_precedes(*left.backing_pool_id, *right.backing_pool_id);
}

pub fn lot_share_precedes(left: @LotSharePromotion, right: @LotSharePromotion) -> bool {
    if *left.game_id != *right.game_id {
        return felt_precedes(*left.game_id, *right.game_id);
    }
    if *left.parent_key_hash != *right.parent_key_hash {
        return felt_precedes(*left.parent_key_hash, *right.parent_key_hash);
    }
    let left_value = *left.lot_index;
    let right_value = *right.lot_index;
    return left_value < right_value;
}

pub fn felt_precedes(left: felt252, right: felt252) -> bool {
    let left_value: u256 = left.into();
    let right_value: u256 = right.into();
    left_value < right_value
}

#[starknet::contract]
pub mod SeasonSettlementCapacitySpike {
    use core::hash::HashStateTrait;
    use core::poseidon::PoseidonTrait;
    use settlement_protocol::appchain_spike_interfaces::{
        BatchCapacitySnapshot, BatchSealSummary, IEconomicCallbackMetricsSpikeDispatcher,
        IEconomicCallbackMetricsSpikeDispatcherTrait, IPendingLiabilitySourceSpikeDispatcher,
        IPendingLiabilitySourceSpikeDispatcherTrait, ISeasonSettlementCapacitySpike, PendingSourceSnapshot,
    };
    use settlement_protocol::interfaces::{
        IGameEconomicSettlementCallbacksDispatcher, IGameEconomicSettlementCallbacksDispatcherTrait,
    };
    use settlement_protocol::types::{BackingKey, BackingTotal, LotSharePromotion};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};
    use super::{backing_key_hash, backing_key_precedes, lot_share_precedes};

    const MAX_LIABILITIES: u8 = 64;
    const MAX_PARENTS: u8 = 16;
    const MAX_LOT_SHARES: u16 = 256;
    const MAX_INITIAL_WORLDS: u8 = 32;

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredParent {
        deployment_id: felt252,
        game_id: felt252,
        asset_mode: u8,
        asset_id: u32,
        backing_pool_id: felt252,
        amount_or_quota: u256,
    }

    #[derive(Copy, Drop, starknet::Store)]
    struct StoredLotShare {
        game_id: felt252,
        parent_key_hash: felt252,
        lot_index: u8,
        amount: u256,
    }

    #[derive(Copy, Drop)]
    struct PromotionResult {
        game_callback_count: u8,
        global_parent_count: u8,
        global_lot_share_count: u16,
        global_amount: u256,
        post_state_hash: felt252,
    }

    #[storage]
    struct Storage {
        admin: ContractAddress,
        current_batch_id: u64,
        liability_count: Map<u64, u8>,
        activation_count: Map<u64, u8>,
        activation_exists: Map<felt252, bool>,
        parent_count: Map<u64, u8>,
        lot_share_count: Map<u64, u16>,
        batch_sealed: Map<u64, bool>,
        parents: Map<(u64, u8), StoredParent>,
        parent_position: Map<(u64, felt252), u8>,
        parent_head: Map<u64, u8>,
        parent_tail: Map<u64, u8>,
        parent_next: Map<(u64, u8), u8>,
        lot_shares: Map<(u64, u16), StoredLotShare>,
        lot_share_position: Map<(u64, felt252), u16>,
        lot_share_head: Map<u64, u16>,
        lot_share_tail: Map<u64, u16>,
        lot_share_next: Map<(u64, u16), u16>,
        liability_exists: Map<felt252, bool>,
        source_provider: Map<felt252, ContractAddress>,
        source_game_id: Map<felt252, felt252>,
        economic_state_by_game: Map<felt252, ContractAddress>,
        global_parent_active: Map<felt252, u256>,
        global_parent_cumulative: Map<felt252, u256>,
        global_lot_active: Map<felt252, u256>,
        global_lot_cumulative: Map<felt252, u256>,
        global_active_total: u256,
        global_cumulative_total: u256,
        factory_world_registered: Map<felt252, bool>,
        staged_world_count: u8,
        staged_component_inventory_hash: felt252,
        staged_writer_inventory_hash: felt252,
        global_factory_seal_hash: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        BatchSealed: BatchSealed,
        GlobalFactorySealed: GlobalFactorySealed,
    }

    #[derive(Drop, starknet::Event)]
    struct BatchSealed {
        #[key]
        batch_id: u64,
        parent_count: u8,
        lot_share_count: u16,
        post_state_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct GlobalFactorySealed {
        #[key]
        seal_hash: felt252,
        world_count: u8,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        assert!(admin != zero_address(), "ZERO_ADMIN");
        self.admin.write(admin);
    }

    #[abi(embed_v0)]
    impl SeasonSettlementCapacityImpl of ISeasonSettlementCapacitySpike<ContractState> {
        fn register_game(ref self: ContractState, game_id: felt252, economic_state: ContractAddress) {
            assert_admin(@self);
            assert!(game_id != 0, "ZERO_GAME_ID");
            assert!(economic_state != zero_address(), "ZERO_ECONOMIC_STATE");
            assert!(self.economic_state_by_game.read(game_id) == zero_address(), "GAME_ALREADY_REGISTERED");
            self.economic_state_by_game.write(game_id, economic_state);
        }

        fn register_source(ref self: ContractState, source_id: felt252, game_id: felt252, provider: ContractAddress) {
            assert_admin(@self);
            assert!(source_id != 0, "ZERO_SOURCE_ID");
            assert!(provider != zero_address(), "ZERO_SOURCE_PROVIDER");
            assert!(self.source_provider.read(source_id) == zero_address(), "SOURCE_ALREADY_REGISTERED");
            self.source_provider.write(source_id, provider);
            self.source_game_id.write(source_id, game_id);
        }

        fn append_pending_liability(
            ref self: ContractState, source_id: felt252, expected_generation: u64, liability_id: felt252,
        ) -> (u64, u8) {
            let provider_address = self.source_provider.read(source_id);
            assert!(provider_address != zero_address(), "SOURCE_NOT_REGISTERED");
            let provider = IPendingLiabilitySourceSpikeDispatcher { contract_address: provider_address };
            let (game_id, loaded_source_id, loaded_generation, parent_totals, lot_share_promotions) = provider
                .pending_vectors(liability_id);
            roll_full_batch_before_append(ref self, parent_totals.span(), lot_share_promotions.span());
            let batch_id = self.current_batch_id.read();
            validate_append_request(
                @self,
                batch_id,
                game_id,
                source_id,
                expected_generation,
                liability_id,
                loaded_source_id,
                loaded_generation,
                parent_totals.span(),
                lot_share_promotions.span(),
            );
            let leaf_index = assign_open_liability(@self, batch_id, game_id, liability_id);
            merge_parent_totals(ref self, batch_id, game_id, parent_totals.span());
            merge_lot_share_promotions(ref self, batch_id, game_id, lot_share_promotions.span());
            provider.mark_batch_assigned(liability_id, batch_id, leaf_index);
            commit_liability(ref self, batch_id, liability_id);
            seal_full_batch_after_append(ref self, batch_id);
            (batch_id, leaf_index)
        }

        fn append_activation_only(ref self: ContractState, activation_id: felt252) -> (u64, u8) {
            assert!(activation_id != 0 && !self.activation_exists.read(activation_id), "ACTIVATION_ALREADY_ASSIGNED");
            let batch_id = self.current_batch_id.read();
            let activation_index = self.activation_count.read(batch_id);
            assert!(activation_index < MAX_LIABILITIES, "ACTIVATION_BOUND_EXCEEDED");
            self.activation_exists.write(activation_id, true);
            self.activation_count.write(batch_id, activation_index + 1);
            if activation_index + 1 == MAX_LIABILITIES {
                seal_current_batch(ref self);
            }
            (batch_id, activation_index)
        }

        fn seal_open_batch(ref self: ContractState) -> BatchSealSummary {
            seal_current_batch(ref self)
        }

        fn register_global_factory_world(
            ref self: ContractState, world_id: felt252, component_hash: felt252, writer_hash: felt252,
        ) {
            assert_admin(@self);
            assert!(self.global_factory_seal_hash.read() == 0, "GLOBAL_FACTORY_ALREADY_SEALED");
            assert!(world_id != 0 && component_hash != 0 && writer_hash != 0, "INVALID_WORLD_INVENTORY");
            assert!(!self.factory_world_registered.read(world_id), "WORLD_ALREADY_REGISTERED");
            let world_count = self.staged_world_count.read();
            assert!(world_count < MAX_INITIAL_WORLDS, "WORLD_COUNT_OUT_OF_BOUNDS");
            self.factory_world_registered.write(world_id, true);
            self.staged_world_count.write(world_count + 1);
            self
                .staged_component_inventory_hash
                .write(
                    PoseidonTrait::new()
                        .update(self.staged_component_inventory_hash.read())
                        .update(world_id)
                        .update(component_hash)
                        .finalize(),
                );
            self
                .staged_writer_inventory_hash
                .write(
                    PoseidonTrait::new()
                        .update(self.staged_writer_inventory_hash.read())
                        .update(world_id)
                        .update(writer_hash)
                        .finalize(),
                );
        }

        fn finalize_global_factory_seal(ref self: ContractState) -> felt252 {
            assert_admin(@self);
            let world_count = self.staged_world_count.read();
            assert!(world_count == MAX_INITIAL_WORLDS, "GLOBAL_FACTORY_INCOMPLETE");
            assert!(self.global_factory_seal_hash.read() == 0, "GLOBAL_FACTORY_ALREADY_SEALED");
            let seal_hash = PoseidonTrait::new()
                .update('GLOBAL_FACTORY_SEAL_V1')
                .update(world_count.into())
                .update(self.staged_component_inventory_hash.read())
                .update(self.staged_writer_inventory_hash.read())
                .finalize();
            self.global_factory_seal_hash.write(seal_hash);
            self.emit(GlobalFactorySealed { seal_hash, world_count });
            seal_hash
        }

        fn batch_capacity(self: @ContractState, batch_id: u64) -> BatchCapacitySnapshot {
            load_batch_capacity(self, batch_id)
        }

        fn source_snapshot(self: @ContractState, source_id: felt252) -> PendingSourceSnapshot {
            let provider = self.source_provider.read(source_id);
            assert!(provider != zero_address(), "SOURCE_NOT_REGISTERED");
            IPendingLiabilitySourceSpikeDispatcher { contract_address: provider }.snapshot()
        }

        fn global_active_total(self: @ContractState) -> u256 {
            self.global_active_total.read()
        }

        fn global_cumulative_total(self: @ContractState) -> u256 {
            self.global_cumulative_total.read()
        }

        fn global_factory_seal_hash(self: @ContractState) -> felt252 {
            self.global_factory_seal_hash.read()
        }
    }

    fn roll_full_batch_before_append(
        ref self: ContractState, parents: Span<BackingTotal>, shares: Span<LotSharePromotion>,
    ) {
        let batch_id = self.current_batch_id.read();
        if self.liability_count.read(batch_id) == 0 {
            return;
        }
        if append_exceeds_open_capacity(@self, batch_id, parents, shares) {
            seal_current_batch(ref self);
        }
    }

    fn append_exceeds_open_capacity(
        self: @ContractState, batch_id: u64, parents: Span<BackingTotal>, shares: Span<LotSharePromotion>,
    ) -> bool {
        let mut parent_count = self.parent_count.read(batch_id);
        for parent in parents {
            if self.parent_position.read((batch_id, backing_key_hash(parent.key))) == 0 {
                parent_count += 1;
            }
        }
        let mut share_count = self.lot_share_count.read(batch_id);
        for share in shares {
            if self.lot_share_position.read((batch_id, lot_share_identity(share))) == 0 {
                share_count += 1;
            }
        }
        parent_count > MAX_PARENTS || share_count > MAX_LOT_SHARES
    }

    fn seal_current_batch(ref self: ContractState) -> BatchSealSummary {
        let batch_id = self.current_batch_id.read();
        let snapshot = load_batch_capacity(@self, batch_id);
        assert!(snapshot.liability_count != 0 || snapshot.activation_count != 0, "EMPTY_BATCH");
        assert!(!snapshot.sealed, "BATCH_ALREADY_SEALED");
        preflight_batch(@self, snapshot);
        let promotion = promote_batch(ref self, snapshot);
        persist_sealed_batch(ref self, snapshot, promotion);
        BatchSealSummary {
            batch_id,
            parent_count: snapshot.parent_count,
            lot_share_count: snapshot.lot_share_count,
            game_callback_count: promotion.game_callback_count,
            global_parent_count: promotion.global_parent_count,
            global_lot_share_count: promotion.global_lot_share_count,
            post_state_hash: promotion.post_state_hash,
        }
    }

    fn preflight_batch(self: @ContractState, snapshot: BatchCapacitySnapshot) {
        let mut processed_games = array![];
        loop {
            let game_id = match next_unprocessed_game(self, snapshot, processed_games.span()) {
                Option::Some(game_id) => game_id,
                Option::None => { break; },
            };
            let parents = load_parents_for_game(self, snapshot, game_id);
            let shares = load_lot_shares_for_game(self, snapshot, game_id);
            if game_id == 0 {
                preview_global_group(self, parents.span(), shares.span());
            } else {
                let economic_state = self.economic_state_by_game.read(game_id);
                assert!(
                    IEconomicCallbackMetricsSpikeDispatcher { contract_address: economic_state }
                        .preview_promotion(parents.span(), shares.span()),
                    "PROMOTION_PREFLIGHT_REJECTED",
                );
            }
            processed_games.append(game_id);
        }
    }

    fn validate_append_request(
        self: @ContractState,
        batch_id: u64,
        game_id: felt252,
        source_id: felt252,
        expected_generation: u64,
        liability_id: felt252,
        loaded_source_id: felt252,
        loaded_generation: u64,
        parent_totals: Span<BackingTotal>,
        lot_share_promotions: Span<LotSharePromotion>,
    ) {
        assert!(!self.batch_sealed.read(batch_id), "BATCH_ALREADY_SEALED");
        assert!(liability_id != 0 && !self.liability_exists.read(liability_id), "LIABILITY_ALREADY_ASSIGNED");
        assert!(self.source_game_id.read(source_id) == game_id, "SOURCE_GAME_MISMATCH");
        assert!(loaded_source_id == source_id, "SOURCE_ID_MISMATCH");
        assert!(loaded_generation == expected_generation, "SOURCE_GENERATION_MISMATCH");
        if game_id != 0 {
            assert!(self.economic_state_by_game.read(game_id) != zero_address(), "GAME_NOT_REGISTERED");
        }
        assert!(!parent_totals.is_empty(), "PARENT_TOTALS_EMPTY");
        assert!(parent_totals.len() <= MAX_PARENTS.into(), "PARENT_BOUND_EXCEEDED");
        assert!(lot_share_promotions.len() <= MAX_LOT_SHARES.into(), "LOT_SHARE_BOUND_EXCEEDED");
        assert!(self.liability_count.read(batch_id) < MAX_LIABILITIES, "LIABILITY_BOUND_EXCEEDED");
    }

    fn merge_parent_totals(
        ref self: ContractState, batch_id: u64, game_id: felt252, parent_totals: Span<BackingTotal>,
    ) {
        for total in parent_totals {
            assert!(*total.key.game_id == game_id, "PARENT_GAME_MISMATCH");
            assert!(*total.amount_or_quota != 0_u256, "ZERO_PARENT_TOTAL");
            merge_parent_total(ref self, batch_id, total);
        }
    }

    fn merge_parent_total(ref self: ContractState, batch_id: u64, total: @BackingTotal) {
        let parent_hash = backing_key_hash(total.key);
        let encoded_position = self.parent_position.read((batch_id, parent_hash));
        if encoded_position == 0 {
            append_new_parent(ref self, batch_id, parent_hash, total);
        } else {
            let position = encoded_position - 1;
            let mut stored = self.parents.read((batch_id, position));
            stored.amount_or_quota += *total.amount_or_quota;
            self.parents.write((batch_id, position), stored);
        }
        if *total.key.game_id == 0 {
            self
                .global_parent_active
                .write(parent_hash, self.global_parent_active.read(parent_hash) + *total.amount_or_quota);
            self.global_active_total.write(self.global_active_total.read() + *total.amount_or_quota);
        }
    }

    fn append_new_parent(ref self: ContractState, batch_id: u64, parent_hash: felt252, total: @BackingTotal) {
        let parent_count = self.parent_count.read(batch_id);
        assert!(parent_count < MAX_PARENTS, "PARENT_BOUND_EXCEEDED");
        let position = parent_count;
        self.parents.write((batch_id, position), store_parent(total));
        self.parent_position.write((batch_id, parent_hash), position + 1);
        link_parent_position(ref self, batch_id, position, total);
        self.parent_count.write(batch_id, parent_count + 1);
    }

    fn merge_lot_share_promotions(
        ref self: ContractState, batch_id: u64, game_id: felt252, lot_shares: Span<LotSharePromotion>,
    ) {
        for share in lot_shares {
            assert!(*share.game_id == game_id, "LOT_SHARE_GAME_MISMATCH");
            assert!(*share.amount != 0_u256, "ZERO_LOT_SHARE");
            assert!(self.parent_position.read((batch_id, *share.parent_key_hash)) != 0, "LOT_PARENT_UNKNOWN");
            merge_lot_share(ref self, batch_id, share);
        }
    }

    fn merge_lot_share(ref self: ContractState, batch_id: u64, share: @LotSharePromotion) {
        let identity = lot_share_identity(share);
        let encoded_position = self.lot_share_position.read((batch_id, identity));
        if encoded_position == 0 {
            append_new_lot_share(ref self, batch_id, identity, share);
        } else {
            let position = encoded_position - 1;
            let mut stored = self.lot_shares.read((batch_id, position));
            stored.amount += *share.amount;
            self.lot_shares.write((batch_id, position), stored);
        }
        if *share.game_id == 0 {
            self.global_lot_active.write(identity, self.global_lot_active.read(identity) + *share.amount);
        }
    }

    fn append_new_lot_share(ref self: ContractState, batch_id: u64, identity: felt252, share: @LotSharePromotion) {
        let lot_share_count = self.lot_share_count.read(batch_id);
        assert!(lot_share_count < MAX_LOT_SHARES, "LOT_SHARE_BOUND_EXCEEDED");
        let position = lot_share_count;
        self.lot_shares.write((batch_id, position), store_lot_share(share));
        self.lot_share_position.write((batch_id, identity), position + 1);
        link_lot_share_position(ref self, batch_id, position, share);
        self.lot_share_count.write(batch_id, lot_share_count + 1);
    }

    fn link_parent_position(ref self: ContractState, batch_id: u64, position: u8, total: @BackingTotal) {
        let encoded_position = position + 1;
        let head = self.parent_head.read(batch_id);
        if head == 0 {
            self.parent_head.write(batch_id, encoded_position);
            self.parent_tail.write(batch_id, encoded_position);
            return;
        }
        let head_parent = load_parent(self.parents.read((batch_id, head - 1)));
        if backing_key_precedes(total.key, @head_parent.key) {
            self.parent_next.write((batch_id, encoded_position), head);
            self.parent_head.write(batch_id, encoded_position);
            return;
        }
        let tail = self.parent_tail.read(batch_id);
        let tail_parent = load_parent(self.parents.read((batch_id, tail - 1)));
        if backing_key_precedes(@tail_parent.key, total.key) {
            self.parent_next.write((batch_id, tail), encoded_position);
            self.parent_tail.write(batch_id, encoded_position);
            return;
        }
        insert_parent_between(ref self, batch_id, head, encoded_position, total);
    }

    fn insert_parent_between(
        ref self: ContractState, batch_id: u64, first: u8, encoded_position: u8, total: @BackingTotal,
    ) {
        let mut prior = first;
        loop {
            let next = self.parent_next.read((batch_id, prior));
            assert!(next != 0, "PARENT_LINK_CORRUPT");
            let next_parent = load_parent(self.parents.read((batch_id, next - 1)));
            if backing_key_precedes(total.key, @next_parent.key) {
                self.parent_next.write((batch_id, encoded_position), next);
                self.parent_next.write((batch_id, prior), encoded_position);
                return;
            }
            prior = next;
        }
    }

    fn link_lot_share_position(ref self: ContractState, batch_id: u64, position: u16, share: @LotSharePromotion) {
        let encoded_position = position + 1;
        let head = self.lot_share_head.read(batch_id);
        if head == 0 {
            self.lot_share_head.write(batch_id, encoded_position);
            self.lot_share_tail.write(batch_id, encoded_position);
            return;
        }
        let head_share = load_lot_share(self.lot_shares.read((batch_id, head - 1)));
        if lot_share_precedes(share, @head_share) {
            self.lot_share_next.write((batch_id, encoded_position), head);
            self.lot_share_head.write(batch_id, encoded_position);
            return;
        }
        let tail = self.lot_share_tail.read(batch_id);
        let tail_share = load_lot_share(self.lot_shares.read((batch_id, tail - 1)));
        if lot_share_precedes(@tail_share, share) {
            self.lot_share_next.write((batch_id, tail), encoded_position);
            self.lot_share_tail.write(batch_id, encoded_position);
            return;
        }
        insert_lot_share_between(ref self, batch_id, head, encoded_position, share);
    }

    fn insert_lot_share_between(
        ref self: ContractState, batch_id: u64, first: u16, encoded_position: u16, share: @LotSharePromotion,
    ) {
        let mut prior = first;
        loop {
            let next = self.lot_share_next.read((batch_id, prior));
            assert!(next != 0, "LOT_SHARE_LINK_CORRUPT");
            let next_share = load_lot_share(self.lot_shares.read((batch_id, next - 1)));
            if lot_share_precedes(share, @next_share) {
                self.lot_share_next.write((batch_id, encoded_position), next);
                self.lot_share_next.write((batch_id, prior), encoded_position);
                return;
            }
            prior = next;
        }
    }

    fn assign_open_liability(self: @ContractState, batch_id: u64, game_id: felt252, liability_id: felt252) -> u8 {
        let leaf_index = self.liability_count.read(batch_id);
        if game_id != 0 {
            let economic_state = self.economic_state_by_game.read(game_id);
            let post_state_hash = IGameEconomicSettlementCallbacksDispatcher { contract_address: economic_state }
                .assign_open_batch(liability_id, batch_id, leaf_index);
            assert!(post_state_hash != 0, "ASSIGNMENT_REJECTED");
        }
        leaf_index
    }

    fn commit_liability(ref self: ContractState, batch_id: u64, liability_id: felt252) {
        self.liability_exists.write(liability_id, true);
        self.liability_count.write(batch_id, self.liability_count.read(batch_id) + 1);
    }

    fn seal_full_batch_after_append(ref self: ContractState, batch_id: u64) {
        if self.liability_count.read(batch_id) == MAX_LIABILITIES {
            seal_current_batch(ref self);
        }
    }

    fn promote_batch(ref self: ContractState, snapshot: BatchCapacitySnapshot) -> PromotionResult {
        let mut processed_games = array![];
        let mut result = PromotionResult {
            game_callback_count: 0,
            global_parent_count: 0,
            global_lot_share_count: 0,
            global_amount: 0_u256,
            post_state_hash: 'BATCH_PROMOTION_V1',
        };
        loop {
            let game_id = match next_unprocessed_game(@self, snapshot, processed_games.span()) {
                Option::Some(game_id) => game_id,
                Option::None => { break; },
            };
            let parents = load_parents_for_game(@self, snapshot, game_id);
            let lot_shares = load_lot_shares_for_game(@self, snapshot, game_id);
            let (group_hash, global_amount) = if game_id == 0 {
                promote_global_group(ref self, parents.span(), lot_shares.span())
            } else {
                (promote_game_group(@self, snapshot.batch_id, game_id, parents.span(), lot_shares.span()), 0_u256)
            };
            result = record_group_result(result, game_id, parents.len(), lot_shares.len(), global_amount, group_hash);
            processed_games.append(game_id);
        }
        result
    }

    fn next_unprocessed_game(
        self: @ContractState, snapshot: BatchCapacitySnapshot, processed_games: Span<felt252>,
    ) -> Option<felt252> {
        let mut encoded_position = self.parent_head.read(snapshot.batch_id);
        let mut visited: u8 = 0;
        loop {
            if visited == snapshot.parent_count {
                return Option::None;
            }
            assert!(encoded_position != 0, "PARENT_LINK_CORRUPT");
            let game_id = self.parents.read((snapshot.batch_id, encoded_position - 1)).game_id;
            if !contains_game(processed_games, game_id) {
                return Option::Some(game_id);
            }
            encoded_position = self.parent_next.read((snapshot.batch_id, encoded_position));
            visited += 1;
        }
    }

    fn contains_game(games: Span<felt252>, game_id: felt252) -> bool {
        for current in games {
            if *current == game_id {
                return true;
            }
        }
        false
    }

    fn load_parents_for_game(
        self: @ContractState, snapshot: BatchCapacitySnapshot, game_id: felt252,
    ) -> Array<BackingTotal> {
        let mut parents = array![];
        let mut encoded_position = self.parent_head.read(snapshot.batch_id);
        let mut visited: u8 = 0;
        loop {
            if visited == snapshot.parent_count {
                break;
            }
            assert!(encoded_position != 0, "PARENT_LINK_CORRUPT");
            let stored = self.parents.read((snapshot.batch_id, encoded_position - 1));
            if stored.game_id == game_id {
                parents.append(load_parent(stored));
            }
            encoded_position = self.parent_next.read((snapshot.batch_id, encoded_position));
            visited += 1;
        }
        parents
    }

    fn load_lot_shares_for_game(
        self: @ContractState, snapshot: BatchCapacitySnapshot, game_id: felt252,
    ) -> Array<LotSharePromotion> {
        let mut shares = array![];
        let mut encoded_position = self.lot_share_head.read(snapshot.batch_id);
        let mut visited: u16 = 0;
        loop {
            if visited == snapshot.lot_share_count {
                break;
            }
            assert!(encoded_position != 0, "LOT_SHARE_LINK_CORRUPT");
            let stored = self.lot_shares.read((snapshot.batch_id, encoded_position - 1));
            if stored.game_id == game_id {
                shares.append(load_lot_share(stored));
            }
            encoded_position = self.lot_share_next.read((snapshot.batch_id, encoded_position));
            visited += 1;
        }
        shares
    }

    fn promote_game_group(
        self: @ContractState,
        batch_id: u64,
        game_id: felt252,
        parents: Span<BackingTotal>,
        lot_shares: Span<LotSharePromotion>,
    ) -> felt252 {
        let economic_state = self.economic_state_by_game.read(game_id);
        assert!(economic_state != zero_address(), "GAME_NOT_REGISTERED");
        let post_state_hash = IGameEconomicSettlementCallbacksDispatcher { contract_address: economic_state }
            .promote_sealed_batch(batch_id, parents, lot_shares);
        assert!(post_state_hash != 0, "PROMOTION_REJECTED");
        assert!(
            IEconomicCallbackMetricsSpikeDispatcher { contract_address: economic_state }
                .post_state_hash() == post_state_hash,
            "PROMOTION_POST_STATE_MISMATCH",
        );
        post_state_hash
    }

    fn preview_global_group(
        self: @ContractState, parents: Span<BackingTotal>, lot_shares: Span<LotSharePromotion>,
    ) -> u256 {
        let parent_total = sum_parent_totals(parents);
        let lot_total = sum_lot_shares(lot_shares);
        assert!(parent_total == lot_total, "GLOBAL_PROMOTION_TOTAL_MISMATCH");
        let active = self.global_active_total.read();
        assert!(active >= parent_total, "GLOBAL_ACTIVE_UNDERFLOW");
        validate_global_parent_records(self, parents);
        validate_global_lot_records(self, lot_shares);
        parent_total
    }

    fn promote_global_group(
        ref self: ContractState, parents: Span<BackingTotal>, lot_shares: Span<LotSharePromotion>,
    ) -> (felt252, u256) {
        let amount = preview_global_group(@self, parents, lot_shares);
        let mut records_hash = 'GLOBAL_PROMOTED_RECORDS_V1';
        for parent in parents {
            let identity = backing_key_hash(parent.key);
            let next_active = self.global_parent_active.read(identity) - *parent.amount_or_quota;
            let next_cumulative = self.global_parent_cumulative.read(identity) + *parent.amount_or_quota;
            self.global_parent_active.write(identity, next_active);
            self.global_parent_cumulative.write(identity, next_cumulative);
            records_hash = hash_promoted_record(records_hash, 1, identity, next_active, next_cumulative);
        }
        for share in lot_shares {
            let identity = lot_share_identity(share);
            let next_active = self.global_lot_active.read(identity) - *share.amount;
            let next_cumulative = self.global_lot_cumulative.read(identity) + *share.amount;
            self.global_lot_active.write(identity, next_active);
            self.global_lot_cumulative.write(identity, next_cumulative);
            records_hash = hash_promoted_record(records_hash, 2, identity, next_active, next_cumulative);
        }
        self.global_active_total.write(self.global_active_total.read() - amount);
        self.global_cumulative_total.write(self.global_cumulative_total.read() + amount);
        let active = self.global_active_total.read();
        let cumulative = self.global_cumulative_total.read();
        (
            PoseidonTrait::new()
                .update('GLOBAL_PROMOTION_POST_STATE_V1')
                .update(records_hash)
                .update(active.low.into())
                .update(active.high.into())
                .update(cumulative.low.into())
                .update(cumulative.high.into())
                .finalize(),
            amount,
        )
    }

    fn validate_global_parent_records(self: @ContractState, parents: Span<BackingTotal>) {
        for parent in parents {
            let identity = backing_key_hash(parent.key);
            assert!(self.global_parent_active.read(identity) >= *parent.amount_or_quota, "GLOBAL_PARENT_UNDERFLOW");
        }
    }

    fn validate_global_lot_records(self: @ContractState, lot_shares: Span<LotSharePromotion>) {
        for share in lot_shares {
            let identity = lot_share_identity(share);
            assert!(self.global_lot_active.read(identity) >= *share.amount, "GLOBAL_LOT_UNDERFLOW");
        }
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

    fn sum_parent_totals(parents: Span<BackingTotal>) -> u256 {
        let mut total = 0_u256;
        for parent in parents {
            total += *parent.amount_or_quota;
        }
        total
    }

    fn sum_lot_shares(lot_shares: Span<LotSharePromotion>) -> u256 {
        let mut total = 0_u256;
        for share in lot_shares {
            total += *share.amount;
        }
        total
    }

    fn record_group_result(
        result: PromotionResult,
        game_id: felt252,
        parent_count: usize,
        lot_share_count: usize,
        global_amount: u256,
        group_hash: felt252,
    ) -> PromotionResult {
        let post_state_hash = PoseidonTrait::new()
            .update(result.post_state_hash)
            .update(game_id)
            .update(group_hash)
            .finalize();
        if game_id == 0 {
            PromotionResult {
                global_parent_count: parent_count.try_into().unwrap(),
                global_lot_share_count: lot_share_count.try_into().unwrap(),
                global_amount,
                post_state_hash,
                ..result,
            }
        } else {
            PromotionResult { game_callback_count: result.game_callback_count + 1, post_state_hash, ..result }
        }
    }

    fn persist_sealed_batch(ref self: ContractState, snapshot: BatchCapacitySnapshot, promotion: PromotionResult) {
        self.batch_sealed.write(snapshot.batch_id, true);
        self.current_batch_id.write(snapshot.batch_id + 1);
        self
            .emit(
                BatchSealed {
                    batch_id: snapshot.batch_id,
                    parent_count: snapshot.parent_count,
                    lot_share_count: snapshot.lot_share_count,
                    post_state_hash: promotion.post_state_hash,
                },
            );
    }

    fn load_batch_capacity(self: @ContractState, batch_id: u64) -> BatchCapacitySnapshot {
        BatchCapacitySnapshot {
            batch_id,
            liability_count: self.liability_count.read(batch_id),
            activation_count: self.activation_count.read(batch_id),
            parent_count: self.parent_count.read(batch_id),
            lot_share_count: self.lot_share_count.read(batch_id),
            sealed: self.batch_sealed.read(batch_id),
        }
    }

    fn store_parent(total: @BackingTotal) -> StoredParent {
        StoredParent {
            deployment_id: *total.key.deployment_id,
            game_id: *total.key.game_id,
            asset_mode: *total.key.asset_mode,
            asset_id: *total.key.asset_id,
            backing_pool_id: *total.key.backing_pool_id,
            amount_or_quota: *total.amount_or_quota,
        }
    }

    fn load_parent(parent: StoredParent) -> BackingTotal {
        BackingTotal {
            key: BackingKey {
                deployment_id: parent.deployment_id,
                game_id: parent.game_id,
                asset_mode: parent.asset_mode,
                asset_id: parent.asset_id,
                backing_pool_id: parent.backing_pool_id,
            },
            amount_or_quota: parent.amount_or_quota,
        }
    }

    fn store_lot_share(share: @LotSharePromotion) -> StoredLotShare {
        StoredLotShare {
            game_id: *share.game_id,
            parent_key_hash: *share.parent_key_hash,
            lot_index: *share.lot_index,
            amount: *share.amount,
        }
    }

    fn load_lot_share(share: StoredLotShare) -> LotSharePromotion {
        LotSharePromotion {
            game_id: share.game_id,
            parent_key_hash: share.parent_key_hash,
            lot_index: share.lot_index,
            amount: share.amount,
        }
    }

    fn lot_share_identity(share: @LotSharePromotion) -> felt252 {
        PoseidonTrait::new()
            .update(*share.game_id)
            .update(*share.parent_key_hash)
            .update((*share.lot_index).into())
            .finalize()
    }

    fn assert_admin(self: @ContractState) {
        assert!(get_caller_address() == self.admin.read(), "ONLY_ADMIN");
    }

    fn zero_address() -> ContractAddress {
        0.try_into().unwrap()
    }
}
