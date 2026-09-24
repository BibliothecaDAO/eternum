use starknet::storage::Map;

#[starknet::storage_node]
pub struct BlitzResultStateStorage<TPlayerResult> {
    pub results: Map<(u32, u8), TPlayerResult>,
    pub count: Map<u32, u8>,
}
