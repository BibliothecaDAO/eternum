use starknet::storage::Map;

#[starknet::storage_node]
pub struct RealmStateStorage {
    pub catalogue_count: u32,
    pub traits: Map<u32, u32>,
    pub slots: Map<(u32, u32), u32>,
    pub reverse_indices: Map<(u32, u32), u32>,
    pub catalogue_digest: felt252,
}
