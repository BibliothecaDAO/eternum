use starknet::storage::Map;

#[starknet::storage_node]
pub struct ArrivalStateStorage<TResourceAmount> {
    pub arrival_bounds: Map<(u32, u32, u64, u8), u64>,
    pub arrival_items: Map<(u32, u32, u64, u8, u32), TResourceAmount>,
}
