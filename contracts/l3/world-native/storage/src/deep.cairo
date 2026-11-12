use starknet::storage::Map;

#[starknet::storage_node]
pub struct DeepStorage<TSite, TGuard> {
    pub site_ids: Map<(u32, u8), u64>,
    pub guards: Map<(u32, u64), Option<TGuard>>,
    pub slots: Map<(u32, u64, u8), u64>,
    pub sites: Map<(u32, u64), Option<TSite>>,
}
