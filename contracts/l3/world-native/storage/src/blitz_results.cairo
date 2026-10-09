use starknet::storage::Map;

#[starknet::storage_node]
pub struct BlitzResultStateStorage<TRankedPlayer> {
    pub ranked_results: Map<(u32, u8), TRankedPlayer>,
    pub ranked_count: Map<u32, u8>,
}
