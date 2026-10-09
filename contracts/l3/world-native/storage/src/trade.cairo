use starknet::storage::Map;

#[starknet::storage_node]
pub struct TradeStateStorage<TTradeOrder> {
    pub orders: Map<(u32, u64), TTradeOrder>,
    pub open_count: Map<(u32, u64), u8>,
}
