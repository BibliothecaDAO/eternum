use starknet::storage::Map;

#[starknet::storage_node]
pub struct TradeStateStorage<TTradeOrder> {
    pub orders: Map<(u32, u32), TTradeOrder>,
    pub open_count: Map<(u32, u32), u8>,
}
