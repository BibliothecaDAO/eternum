use starknet::ContractAddress;
use crate::commands::ExecutionContext;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TradeKey {
    pub game_id: u32,
    pub trade_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TradeRules {
    pub max_count: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct TradeOrder {
    pub maker_id: u32,
    pub taker_id: u32,
    pub offered_resource: u8,
    pub requested_resource: u8,
    pub offered_per_lot: u64,
    pub requested_per_lot: u64,
    pub remaining_lots: u64,
    pub expires_at: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateOrder {
    pub maker_id: u32,
    pub taker_id: u32,
    pub offered_resource: u8,
    pub requested_resource: u8,
    pub offered_per_lot: u64,
    pub requested_per_lot: u64,
    pub lots: u64,
    pub expires_at: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TradeListing {
    pub trade_id: u32,
    pub order: TradeOrder,
}

pub fn new_order(command: CreateOrder) -> TradeOrder {
    TradeOrder {
        maker_id: command.maker_id,
        taker_id: command.taker_id,
        offered_resource: command.offered_resource,
        requested_resource: command.requested_resource,
        offered_per_lot: command.offered_per_lot,
        requested_per_lot: command.requested_per_lot,
        remaining_lots: command.lots,
        expires_at: command.expires_at,
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AcceptOrder {
    pub trade_id: u32,
    pub taker_id: u32,
    pub lots: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct TradeFill {
    pub trade_id: u32,
    pub maker_id: u32,
    pub taker_id: u32,
    pub offered_resource: u8,
    pub requested_resource: u8,
    pub offered_amount: u128,
    pub requested_amount: u128,
}

#[starknet::interface]
pub trait ITrade<T> {
    fn configure_trade(ref self: T, game_id: u32, rules: TradeRules);
    fn trade_rules(self: @T, game_id: u32) -> TradeRules;
    fn trade_order(self: @T, key: TradeKey) -> Option<TradeOrder>;
    fn create_trade_order(
        ref self: T, game_id: u32, actor: ContractAddress, command: CreateOrder, context: ExecutionContext,
    );
    fn accept_trade_order(
        ref self: T, game_id: u32, actor: ContractAddress, command: AcceptOrder, context: ExecutionContext,
    );
    fn cancel_trade_order(ref self: T, game_id: u32, actor: ContractAddress, trade_id: u32, context: ExecutionContext);
}

// Only the economy domain can release escrow or queue purchased resources.
#[starknet::interface]
pub trait IEconomyDelivery<T> {
    fn queue_economy_delivery(
        ref self: T,
        key: crate::resources::ResourceKey,
        resource: crate::resources::ResourceAmount,
        travel_time: u64,
        timestamp: u64,
    );
}

#[starknet::component]
pub mod TradeState {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess,
    };
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use super::{TradeKey, TradeOrder, TradeRules};

    #[storage]
    pub struct Storage {
        pub orders: Map<(u32, u32), TradeOrder>,
        pub open_count: Map<(u32, u32), u8>,
        pub rules: Map<u32, TradeRules>,
        pub configured: Map<u32, bool>,
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
            assert!(!self.configured.read(game_id), "trade rules already configured");
            self.configured.write(game_id, true);
            self.rules.write(game_id, rules);
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
            assert!(self.configured.read(game_id), "missing trade rules");
            self.rules.read(game_id)
        }
        fn order(self: @ComponentState<TContractState>, key: TradeKey) -> Option<TradeOrder> {
            let order = self.orders.read((key.game_id, key.trade_id));
            if order.maker_id == 0 {
                None
            } else {
                Some(order)
            }
        }
        fn create(ref self: ComponentState<TContractState>, key: TradeKey, order: TradeOrder) {
            let count = self.open_count.read((key.game_id, order.maker_id));
            assert!(count < self.rules(key.game_id).max_count, "trade count exceeds max");
            assert!(self.order(key).is_none(), "trade already exists");
            self.open_count.write((key.game_id, order.maker_id), count + 1);
            self.write(key, order);
        }
        fn write(ref self: ComponentState<TContractState>, key: TradeKey, order: TradeOrder) {
            self.orders.write((key.game_id, key.trade_id), order);
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
            self.orders.entry((key.game_id, key.trade_id)).remaining_lots.write(order.remaining_lots);
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
            let count = self.open_count.read((key.game_id, order.maker_id));
            self.open_count.write((key.game_id, order.maker_id), count - 1);
            self.orders.entry((key.game_id, key.trade_id)).maker_id.write(0);
            self
                .emit(
                    RowDeleted {
                        version: 1, model: 'TradeOrder', keys: array![key.game_id.into(), key.trade_id.into()].span(),
                    },
                );
        }
    }
}
