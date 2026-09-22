use starknet::storage::Map;

#[starknet::storage_node]
pub struct ResourceStateStorage<TProduction, TProductionReceiver, TWeight> {
    pub resource_rules: Map<(u32, u8), (u128, u128)>,
    pub resources_configured: Map<u32, bool>,
    pub balances: Map<(u32, u32, u8), u128>,
    pub productions: Map<(u32, u32, u8), TProduction>,
    pub production_receivers: Map<(u32, u32, u8), Option<TProductionReceiver>>,
    pub incoming_count: Map<(u32, u32, u8), u32>,
    pub incoming_sources: Map<(u32, u32, u8, u32), u32>,
    pub weights: Map<(u32, u32), TWeight>,
    pub resource_exists: Map<(u32, u32), bool>,
}
