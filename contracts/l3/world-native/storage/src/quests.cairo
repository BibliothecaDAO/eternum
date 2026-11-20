use starknet::storage::Map;

#[starknet::storage_node]
pub struct QuestStateStorage {
    pub progress: Map<(u32, u64, u64), (u128, u8)>,
}
