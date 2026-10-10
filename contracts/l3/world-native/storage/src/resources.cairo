use starknet::storage::Map;

#[starknet::storage_node]
pub struct ResourceStateStorage<TProduction, TWeight> {
    pub balances: Map<(u32, u64, u8), u128>,
    pub productions: Map<(u32, u64, u8), TProduction>,
    pub weights: Map<(u32, u64), TWeight>,
    pub resource_exists: Map<(u32, u64), bool>,
}
