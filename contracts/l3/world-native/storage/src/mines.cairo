use starknet::storage::Map;

#[starknet::storage_node]
pub struct MineStateStorage<TMineKindConfig, TMineWeight> {
    pub mine_configured: Map<u32, bool>,
    pub mine_kinds: Map<(u32, u8), TMineKindConfig>,
    pub mine_pool_count: Map<u32, u8>,
    pub mine_weights: Map<(u32, u8), TMineWeight>,
}
