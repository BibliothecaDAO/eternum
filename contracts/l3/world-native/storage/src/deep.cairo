use starknet::storage::Map;

#[starknet::storage_node]
pub struct DeepStorage<TSite> {
    pub paid_tick: Map<u32, Option<u64>>,
    pub army_ticks: Map<(u32, u64), Option<u64>>,
    pub site_ids: Map<(u32, u8), u64>,
    pub slots: Map<(u32, u64, u8), u64>,
    pub sites: Map<(u32, u64), Option<TSite>>,
    pub realms_entered: Map<(u32, u64), u32>,
    pub realm_entered: Map<(u32, u64, u64), bool>,
    pub day_draws: Map<(u32, u64), Option<u256>>,
}
