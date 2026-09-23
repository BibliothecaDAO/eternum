#[starknet::component]
pub mod TradeState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use crate::trade::{TradeKey, TradeOrder, TradeRules};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
        RowMemberSet: RowMemberSet,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn configure(ref self: ComponentState<TContractState>, game_id: u32, rules: TradeRules) {
            assert!(!self.data.trade.configured.read(game_id), "trade rules already configured");
            self.data.trade.configured.write(game_id, true);
            self.data.trade.rules.write(game_id, rules);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'TradeRules',
                        keys: array![game_id.into()].span(),
                        values: array![rules.max_count.into()].span(),
                    },
                );
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> TradeRules {
            assert!(self.data.trade.configured.read(game_id), "missing trade rules");
            self.data.trade.rules.read(game_id)
        }
        fn order(self: @ComponentState<TContractState>, key: TradeKey) -> Option<TradeOrder> {
            let order = self.data.trade.orders.read((key.game_id, key.trade_id));
            if order.maker_id == 0 {
                None
            } else {
                Some(order)
            }
        }
        fn create(ref self: ComponentState<TContractState>, key: TradeKey, order: TradeOrder) {
            let count = self.data.trade.open_count.read((key.game_id, order.maker_id));
            assert!(count < self.rules(key.game_id).max_count, "trade count exceeds max");
            assert!(self.order(key).is_none(), "trade already exists");
            self.data.trade.open_count.write((key.game_id, order.maker_id), count + 1);
            self.write(key, order);
        }
        fn write(ref self: ComponentState<TContractState>, key: TradeKey, order: TradeOrder) {
            self.data.trade.orders.write((key.game_id, key.trade_id), order);
            let mut values = array![];
            order.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'TradeOrder',
                        keys: array![key.game_id.into(), key.trade_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn fill(ref self: ComponentState<TContractState>, key: TradeKey, mut order: TradeOrder, lots: u64) {
            order.remaining_lots -= lots;
            if order.remaining_lots == 0 {
                self.remove(key, order);
                return;
            }
            self.data.trade.orders.entry((key.game_id, key.trade_id)).remaining_lots.write(order.remaining_lots);
            self
                .emit(
                    RowMemberSet {
                        version: 1,
                        model: 'TradeOrder',
                        member: 'remaining_lots',
                        keys: array![key.game_id.into(), key.trade_id.into()].span(),
                        values: array![order.remaining_lots.into()].span(),
                    },
                );
        }
        fn remove(ref self: ComponentState<TContractState>, key: TradeKey, order: TradeOrder) {
            let count = self.data.trade.open_count.read((key.game_id, order.maker_id));
            self.data.trade.open_count.write((key.game_id, order.maker_id), count - 1);
            self.data.trade.orders.entry((key.game_id, key.trade_id)).maker_id.write(0);
            self
                .emit(
                    RowDeleted {
                        version: 1, model: 'TradeOrder', keys: array![key.game_id.into(), key.trade_id.into()].span(),
                    },
                );
        }
    }
}
