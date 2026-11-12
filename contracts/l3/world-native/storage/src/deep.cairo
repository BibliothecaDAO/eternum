use starknet::storage::Map;

#[starknet::storage_node]
pub struct DeepStorage<TSite> {
    pub site_ids: Map<(u32, u8), u64>,
    pub sites: Map<(u32, u64), Option<TSite>>,
}
