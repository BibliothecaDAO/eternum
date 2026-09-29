use starknet::storage::Map;

#[starknet::storage_node]
pub struct HyperstructureStateStorage<THyperstructure, TShare> {
    pub hyper_states: Map<(u32, u32), THyperstructure>,
    pub hyper_ids: Map<(u32, u32), u32>,
    pub hyper_counts: Map<u32, u32>,
    pub hyper_exists: Map<(u32, u32), bool>,
    pub hyper_progress: Map<(u32, u32, u8), u128>,
    pub hyper_share_count: Map<(u32, u32), u32>,
    pub hyper_share_start: Map<(u32, u32), u64>,
    pub hyper_multiplier: Map<(u32, u32), u8>,
    pub hyper_shares: Map<(u32, u32, u32), TShare>,
    pub final_checkpoint_cursor: Map<u32, u32>,
    pub close_attempt: Map<u32, Option<(u64, u32, u32)>>,
}
