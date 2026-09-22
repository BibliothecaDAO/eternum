use starknet::storage::Map;

#[starknet::storage_node]
pub struct TradeStateStorage<TTradeOrder, TTradeRules> {
    pub orders: Map<(u32, u32), TTradeOrder>,
    pub open_count: Map<(u32, u32), u8>,
    pub rules: Map<u32, TTradeRules>,
    pub configured: Map<u32, bool>,
}
